import { BankQuestion, Question, Exam, QuestionType, QuestionDifficulty, BankQuestionStatus } from '../types';

/**
 * Computes which exams in the school use a given question (by bankQuestionId or exact question text)
 */
export function getQuestionExamUsage(
  question: BankQuestion | { id?: string; q: string },
  exams: Exam[]
): Exam[] {
  if (!exams || !Array.isArray(exams)) return [];
  const qId = (question as any).id;
  const qText = (question.q || '').trim().toLowerCase();

  return exams.filter(exam => {
    if (!exam.questions || !Array.isArray(exam.questions)) return false;
    return exam.questions.some(eq => {
      if (qId && eq.bankQuestionId && eq.bankQuestionId === qId) return true;
      if (qId && eq.id && eq.id === qId) return true;
      if (qText && (eq.q || '').trim().toLowerCase() === qText) return true;
      return false;
    });
  });
}

/**
 * Converts a BankQuestion to an Exam Question object
 */
export function bankQuestionToExamQuestion(bq: BankQuestion): Question {
  return {
    id: bq.id,
    bankQuestionId: bq.id,
    type: bq.type,
    q: bq.q,
    options: bq.options ? [...bq.options] : undefined,
    ans: bq.ans,
    answer: bq.answer,
    answers: bq.answers ? [...bq.answers] : undefined,
    image: bq.image,
    marks: bq.marks || 1,
    explanation: bq.explanation,
    subject: bq.subject,
    class: bq.class,
    topic: bq.topic,
    subtopic: bq.subtopic,
    difficulty: bq.difficulty
  };
}

/**
 * Helper to escape CSV cell values
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports questions to Excel-compatible CSV with UTF-8 BOM
 */
export function exportQuestionBankToCsv(questions: BankQuestion[]): string {
  const headers = [
    'Type',
    'Question',
    'Subject',
    'Class',
    'Topic',
    'Subtopic',
    'Difficulty',
    'Marks',
    'Options',
    'CorrectAnswer',
    'AcceptedAnswers',
    'Explanation',
    'Tags',
    'Image',
    'Status'
  ];

  const rows = questions.map(q => {
    let optionsStr = '';
    if (q.options && Array.isArray(q.options)) {
      optionsStr = q.options.join(' | ');
    }

    let correctStr = '';
    if (q.type === 'true_false') {
      correctStr = q.ans ? 'True' : 'False';
    } else if (q.type === 'fill_blank') {
      correctStr = q.answer || '';
    } else {
      correctStr = q.ans !== undefined ? String(q.ans) : '';
    }

    let acceptedStr = '';
    if (q.answers && Array.isArray(q.answers)) {
      acceptedStr = q.answers.join(' | ');
    }

    let tagsStr = '';
    if (q.tags && Array.isArray(q.tags)) {
      tagsStr = q.tags.join('; ');
    }

    return [
      escapeCsvCell(q.type),
      escapeCsvCell(q.q),
      escapeCsvCell(q.subject || ''),
      escapeCsvCell(q.class || ''),
      escapeCsvCell(q.topic || ''),
      escapeCsvCell(q.subtopic || ''),
      escapeCsvCell(q.difficulty || 'Medium'),
      escapeCsvCell(q.marks || 1),
      escapeCsvCell(optionsStr),
      escapeCsvCell(correctStr),
      escapeCsvCell(acceptedStr),
      escapeCsvCell(q.explanation || ''),
      escapeCsvCell(tagsStr),
      escapeCsvCell(q.image || ''),
      escapeCsvCell(q.status || 'active')
    ].join(',');
  });

  // Include UTF-8 Byte Order Mark (\uFEFF) for Microsoft Excel compatibility
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Downloads a string file directly in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV line respecting quotes
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parses a CSV string into BankQuestion items with error reporting
 */
export function parseQuestionsCsv(
  csvText: string,
  defaultAuthor = 'Admin',
  defaultSubject = 'General',
  defaultClass = 'Primary 5'
): { valid: BankQuestion[]; errors: string[] } {
  const valid: BankQuestion[] = [];
  const errors: string[] = [];

  // Remove BOM if present
  let cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { valid, errors: ['File is empty'] };
  }

  // Split into lines respecting quotes
  const rawLines = cleanText.split(/\r?\n/);
  const lines: string[] = [];
  let buffer = '';
  let insideQuotes = false;

  for (const raw of rawLines) {
    let quoteCount = (raw.match(/"/g) || []).length;
    if (!insideQuotes) {
      buffer = raw;
      if (quoteCount % 2 !== 0) insideQuotes = true;
      else lines.push(buffer);
    } else {
      buffer += '\n' + raw;
      if (quoteCount % 2 !== 0) {
        insideQuotes = false;
        lines.push(buffer);
      }
    }
  }

  if (lines.length === 0) {
    return { valid, errors: ['No data found in CSV'] };
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const dataLines = lines.slice(1).filter(l => l.trim().length > 0);

  // Check if legacy CSV format: type,q,optA,optB,optC,optD,ans
  const isLegacy = headers.includes('opta') || (headers.length >= 7 && headers[2] === 'opta');

  dataLines.forEach((line, idx) => {
    const rowNum = idx + 2;
    try {
      const parts = parseCsvLine(line);
      if (parts.length < 2) {
        errors.push(`Row ${rowNum}: Insufficient columns`);
        return;
      }

      if (isLegacy) {
        const rawType = (parts[0] || 'mcq').toLowerCase().trim();
        const type: QuestionType = ['mcq', 'true_false', 'fill_blank', 'diagram'].includes(rawType)
          ? (rawType as QuestionType)
          : 'mcq';
        const q = parts[1] || '';
        if (!q) {
          errors.push(`Row ${rowNum}: Question text is required`);
          return;
        }

        let options: string[] | undefined = undefined;
        let ans: number | boolean | undefined = undefined;
        let answer: string | undefined = undefined;
        let answers: string[] | undefined = undefined;

        if (type === 'mcq' || type === 'diagram') {
          options = [parts[2], parts[3], parts[4], parts[5]].filter(Boolean);
          if (options.length < 2) {
            errors.push(`Row ${rowNum}: At least 2 options required for MCQ`);
            return;
          }
          ans = parseInt(parts[6] || '0', 10);
          if (isNaN(ans) || ans < 0 || ans >= options.length) ans = 0;
        } else if (type === 'true_false') {
          const rawAns = (parts[2] || '').toLowerCase().trim();
          ans = rawAns === '1' || rawAns === 'true' || rawAns === 't';
        } else if (type === 'fill_blank') {
          answer = parts[2] || '';
          answers = [answer];
        }

        valid.push({
          id: `qb_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type,
          q,
          subject: defaultSubject,
          class: defaultClass,
          topic: 'General',
          subtopic: 'General',
          difficulty: 'Medium',
          tags: ['Imported'],
          options,
          ans,
          answer,
          answers,
          marks: 1,
          createdBy: defaultAuthor,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active'
        });
      } else {
        // Full Column Format
        const getVal = (colName: string) => {
          const i = headers.findIndex(h => h.includes(colName));
          return i >= 0 && i < parts.length ? parts[i] : '';
        };

        const rawType = (getVal('type') || 'mcq').toLowerCase().trim();
        const type: QuestionType = ['mcq', 'true_false', 'fill_blank', 'diagram'].includes(rawType)
          ? (rawType as QuestionType)
          : 'mcq';

        const q = getVal('question') || parts[1] || '';
        if (!q) {
          errors.push(`Row ${rowNum}: Question text is missing`);
          return;
        }

        const subject = getVal('subject') || defaultSubject;
        const className = getVal('class') || defaultClass;
        const topic = getVal('topic') || 'General';
        const subtopic = getVal('subtopic') || 'General';
        const rawDiff = getVal('diff') || 'Medium';
        const difficulty: QuestionDifficulty = ['Easy', 'Medium', 'Hard'].includes(rawDiff)
          ? (rawDiff as QuestionDifficulty)
          : 'Medium';
        const marks = Math.max(1, parseInt(getVal('mark') || '1', 10) || 1);
        const explanation = getVal('expl') || '';
        const image = getVal('image') || '';
        const status: BankQuestionStatus = (getVal('status') || 'active') as BankQuestionStatus;

        const rawTags = getVal('tag');
        const tags = rawTags ? rawTags.split(/[;,]/).map(t => t.trim()).filter(Boolean) : ['Imported'];

        let options: string[] | undefined = undefined;
        let ans: number | boolean | undefined = undefined;
        let answer: string | undefined = undefined;
        let answers: string[] | undefined = undefined;

        const rawOptions = getVal('opt');
        if (type === 'mcq' || type === 'diagram') {
          if (rawOptions) {
            options = rawOptions.split('|').map(o => o.trim()).filter(Boolean);
          }
          if (!options || options.length < 2) {
            options = ['Option A', 'Option B', 'Option C', 'Option D'];
          }

          const rawCorrect = getVal('correct') || getVal('ans');
          const parsedAns = parseInt(rawCorrect, 10);
          if (!isNaN(parsedAns) && parsedAns >= 0 && parsedAns < options.length) {
            ans = parsedAns;
          } else {
            // Check if correct string matches an option text
            const matchIndex = options.findIndex(o => o.toLowerCase() === rawCorrect.toLowerCase());
            ans = matchIndex >= 0 ? matchIndex : 0;
          }
        } else if (type === 'true_false') {
          const rawCorrect = (getVal('correct') || getVal('ans') || '').toLowerCase().trim();
          ans = ['true', 't', '1', 'yes'].includes(rawCorrect);
        } else if (type === 'fill_blank') {
          answer = getVal('correct') || getVal('ans') || '';
          const rawAccepted = getVal('accept');
          if (rawAccepted) {
            answers = rawAccepted.split('|').map(a => a.trim()).filter(Boolean);
            if (answer && !answers.includes(answer)) {
              answers.unshift(answer);
            }
          } else {
            answers = answer ? [answer] : [];
          }
        }

        valid.push({
          id: `qb_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type,
          q,
          subject,
          class: className,
          topic,
          subtopic,
          difficulty,
          tags,
          options,
          ans,
          answer,
          answers,
          explanation,
          image,
          marks,
          createdBy: defaultAuthor,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: ['active', 'draft', 'archived'].includes(status) ? status : 'active'
        });
      }
    } catch (err: any) {
      errors.push(`Row ${rowNum}: Parse error (${err.message})`);
    }
  });

  return { valid, errors };
}

/**
 * Random exam generation algorithm from question bank pool
 */
export interface RandomGenOptions {
  count: number;
  subject?: string;
  class?: string;
  topic?: string;
  difficultyDist?: {
    Easy?: number;
    Medium?: number;
    Hard?: number;
  };
  types?: QuestionType[];
  allowDuplicatePool?: boolean;
}

export function generateRandomExamQuestions(
  pool: BankQuestion[],
  options: RandomGenOptions
): BankQuestion[] {
  let candidates = pool.filter(q => q.status === 'active');

  if (options.subject && options.subject !== 'All') {
    candidates = candidates.filter(q => q.subject.toLowerCase() === options.subject!.toLowerCase());
  }

  if (options.class && options.class !== 'All') {
    candidates = candidates.filter(q => q.class.toLowerCase() === options.class!.toLowerCase());
  }

  if (options.topic && options.topic !== 'All') {
    candidates = candidates.filter(q => q.topic.toLowerCase() === options.topic!.toLowerCase());
  }

  if (options.types && options.types.length > 0) {
    candidates = candidates.filter(q => options.types!.includes(q.type));
  }

  if (candidates.length === 0) return [];

  // Shuffle array utility
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const selected: BankQuestion[] = [];
  const dist = options.difficultyDist;

  if (dist && (dist.Easy || dist.Medium || dist.Hard)) {
    // Collect by difficulty
    const easyCandidates = shuffle(candidates.filter(q => q.difficulty === 'Easy'));
    const mediumCandidates = shuffle(candidates.filter(q => q.difficulty === 'Medium'));
    const hardCandidates = shuffle(candidates.filter(q => q.difficulty === 'Hard'));

    const needEasy = dist.Easy || 0;
    const needMedium = dist.Medium || 0;
    const needHard = dist.Hard || 0;

    selected.push(...easyCandidates.slice(0, needEasy));
    selected.push(...mediumCandidates.slice(0, needMedium));
    selected.push(...hardCandidates.slice(0, needHard));

    // Fill remaining if quota not met
    const totalNeeded = options.count;
    if (selected.length < totalNeeded) {
      const selectedIds = new Set(selected.map(q => q.id));
      const remainingCandidates = shuffle(candidates.filter(q => !selectedIds.has(q.id)));
      const stillNeed = totalNeeded - selected.length;
      selected.push(...remainingCandidates.slice(0, stillNeed));
    }
  } else {
    // Pure uniform random selection
    const shuffled = shuffle(candidates);
    selected.push(...shuffled.slice(0, options.count));
  }

  return selected;
}

import { Question, Grade, Config } from '../types';
import { DEFAULT_CONFIG } from '../constants';

/**
 * Normalizes True/False values across representations:
 * - Boolean true/false
 * - Strings 'true'/'false', 't'/'f', 'yes'/'no', '1'/'0'
 * - Radio index 0 ('True' in ['True', 'False']) and index 1 ('False')
 */
export function normalizeTrueFalse(val: any): boolean | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'boolean') return val;

  const s = String(val).trim().toLowerCase();
  if (['true', 't', 'yes'].includes(s)) return true;
  if (['false', 'f', 'no'].includes(s)) return false;

  // In CBT UI, options are rendered as ['True', 'False']:
  // Index 0 represents 'True'
  // Index 1 represents 'False'
  if (s === '0' || val === 0) return true;
  if (s === '1' || val === 1) return false;

  return null;
}

/**
 * Formats a True/False value cleanly for human display
 */
export function formatTrueFalseDisplay(val: any): string {
  const norm = normalizeTrueFalse(val);
  if (norm === true) return 'True';
  if (norm === false) return 'False';
  return val !== undefined && val !== null && val !== '' ? String(val) : 'No Answer';
}

/**
 * Letter map for standard multiple-choice option indices
 */
const LETTER_MAP: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  f: 5
};

const INDEX_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Resolves a readable display label for a student or correct answer in MCQ/Diagram
 */
export function formatOptionDisplay(val: any, options: string[] = []): string {
  if (val === undefined || val === null || val === '') return 'No Answer';

  const num = Number(val);
  if (Number.isInteger(num) && num >= 0 && num < options.length) {
    const letter = INDEX_LETTERS[num] || `Opt ${num + 1}`;
    return `Option ${letter}: "${options[num]}"`;
  }

  // If already option text
  const matchIdx = options.findIndex(o => o.trim().toLowerCase() === String(val).trim().toLowerCase());
  if (matchIdx >= 0) {
    const letter = INDEX_LETTERS[matchIdx] || `Opt ${matchIdx + 1}`;
    return `Option ${letter}: "${options[matchIdx]}"`;
  }

  const s = String(val).trim().toLowerCase();
  if (LETTER_MAP[s] !== undefined && options[LETTER_MAP[s]] !== undefined) {
    const idx = LETTER_MAP[s];
    return `Option ${s.toUpperCase()}: "${options[idx]}"`;
  }

  return String(val);
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  awardedMarks: number;
  maxMarks: number;
  studentDisplay: string;
  correctDisplay: string;
  explanation: string;
  requiresManual: boolean;
}

/**
 * Authoritative single-question answer evaluation
 */
export function evaluateAnswer(
  q: any,
  studentAnswer: any,
  optionsFallback?: string[]
): AnswerEvaluation {
  const qType = q.type || 'mcq';
  const maxMarks = Math.max(1, Number(q.marks) || 1);
  const options = (Array.isArray(q.options) && q.options.length > 0)
    ? q.options
    : (Array.isArray(optionsFallback) && optionsFallback.length > 0 ? optionsFallback : []);

  let isCorrect = false;
  let requiresManual = false;
  let explanation = '';
  let studentDisplay = 'No answer';
  let correctDisplay = '';

  const hasStudentAns = studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '';

  if (qType === 'short_answer') {
    const expected = q.answer || q.ans || (Array.isArray(q.answers) ? q.answers[0] : '');
    correctDisplay = expected || 'Subjective / Manual grading';
    studentDisplay = hasStudentAns ? String(studentAnswer) : 'No answer';

    if (expected && hasStudentAns) {
      const expList = Array.isArray(q.answers) ? q.answers : [expected];
      const s = String(studentAnswer).trim().toLowerCase();
      isCorrect = expList.some((e: any) => s === String(e).trim().toLowerCase());
      explanation = isCorrect ? 'Matches expected short answer text.' : 'Does not match expected short answer keywords.';
    } else {
      requiresManual = true;
      explanation = 'Subjective question requires teacher review and manual marks.';
    }
  } else if (qType === 'true_false') {
    const sNorm = normalizeTrueFalse(studentAnswer);
    const cNorm = normalizeTrueFalse(q.ans);

    correctDisplay = cNorm !== null ? (cNorm ? 'True' : 'False') : String(q.ans ?? 'True');
    studentDisplay = hasStudentAns ? (sNorm !== null ? (sNorm ? 'True' : 'False') : String(studentAnswer)) : 'No answer';

    if (hasStudentAns && sNorm !== null && cNorm !== null) {
      isCorrect = sNorm === cNorm;
      explanation = isCorrect
        ? `Correct: Student chose ${studentDisplay}, matching expected ${correctDisplay}.`
        : `Incorrect: Student chose ${studentDisplay}, but correct answer is ${correctDisplay}.`;
    } else if (!hasStudentAns) {
      explanation = 'No answer chosen by student.';
    } else {
      explanation = 'Could not resolve True/False comparison values.';
    }
  } else if (qType === 'fill_blank') {
    const expectedArr: string[] = [];
    if (Array.isArray(q.answers)) expectedArr.push(...q.answers.map(String));
    if (q.answer !== undefined && q.answer !== null && q.answer !== '') expectedArr.push(String(q.answer));
    if (q.ans !== undefined && q.ans !== null && q.ans !== '' && !expectedArr.includes(String(q.ans))) expectedArr.push(String(q.ans));

    correctDisplay = expectedArr.length > 0 ? expectedArr.join(' / ') : String(q.answer || q.ans || '');
    studentDisplay = hasStudentAns ? String(studentAnswer).trim() : 'No answer';

    if (hasStudentAns && expectedArr.length > 0) {
      const cleanStudent = String(studentAnswer).trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      isCorrect = expectedArr.some(exp => {
        const cleanExp = String(exp).trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        return cleanStudent === cleanExp || String(studentAnswer).trim().toLowerCase() === String(exp).trim().toLowerCase();
      });
      explanation = isCorrect
        ? `Correct: "${studentDisplay}" matches accepted answers (${correctDisplay}).`
        : `Incorrect: "${studentDisplay}" does not match accepted answers (${correctDisplay}).`;
    } else if (!hasStudentAns) {
      explanation = 'Blank answer submitted.';
    }
  } else {
    // MCQ & Diagram Questions
    const rawCorrect = q.ans;
    correctDisplay = formatOptionDisplay(rawCorrect, options);
    studentDisplay = hasStudentAns ? formatOptionDisplay(studentAnswer, options) : 'No answer';

    if (hasStudentAns) {
      // 1. Direct equality (numeric or string)
      if (Number(studentAnswer) === Number(rawCorrect)) {
        isCorrect = true;
        explanation = `Numeric option index match (Index ${studentAnswer}).`;
      } else if (String(studentAnswer).trim().toLowerCase() === String(rawCorrect).trim().toLowerCase()) {
        isCorrect = true;
        explanation = 'Exact text match with correct answer definition.';
      } else if (options.length > 0) {
        // 2. Options text cross-matching
        const correctIdx = Number(rawCorrect);
        const studentIdx = Number(studentAnswer);

        // Does student answer string match options[correctIdx]?
        if (Number.isInteger(correctIdx) && options[correctIdx] !== undefined) {
          if (String(options[correctIdx]).trim().toLowerCase() === String(studentAnswer).trim().toLowerCase()) {
            isCorrect = true;
            explanation = `Student selected option text matching option ${INDEX_LETTERS[correctIdx] || correctIdx}.`;
          }
        }

        // Does studentIdx option match correct option text string?
        if (!isCorrect && Number.isInteger(studentIdx) && options[studentIdx] !== undefined) {
          if (String(options[studentIdx]).trim().toLowerCase() === String(rawCorrect).trim().toLowerCase()) {
            isCorrect = true;
            explanation = `Student index ${studentIdx} corresponds to text "${options[studentIdx]}".`;
          }
        }

        // Both student and correct are valid indices
        if (!isCorrect && Number.isInteger(studentIdx) && Number.isInteger(correctIdx)) {
          if (options[studentIdx] && options[correctIdx] &&
              options[studentIdx].trim().toLowerCase() === options[correctIdx].trim().toLowerCase()) {
            isCorrect = true;
            explanation = 'Option index matches targeted answer option.';
          }
        }
      }

      // 3. Letter cross-mapping (A, B, C, D)
      if (!isCorrect) {
        const sStr = String(studentAnswer).trim().toLowerCase();
        const cStr = String(rawCorrect).trim().toLowerCase();
        if (LETTER_MAP[sStr] !== undefined && LETTER_MAP[sStr] === Number(rawCorrect)) {
          isCorrect = true;
          explanation = `Letter choice "${sStr.toUpperCase()}" matches index ${rawCorrect}.`;
        } else if (LETTER_MAP[cStr] !== undefined && LETTER_MAP[cStr] === Number(studentAnswer)) {
          isCorrect = true;
          explanation = `Choice index ${studentAnswer} matches correct letter "${cStr.toUpperCase()}".`;
        }
      }

      if (!isCorrect) {
        explanation = `Incorrect: Student chose ${studentDisplay}, correct answer is ${correctDisplay}.`;
      }
    } else {
      explanation = 'No option chosen.';
    }
  }

  const awardedMarks = isCorrect ? maxMarks : 0;

  return {
    isCorrect,
    awardedMarks,
    maxMarks,
    studentDisplay,
    correctDisplay,
    explanation,
    requiresManual
  };
}

/**
 * Calculates letter grade and remark strictly based on descending percentage thresholds.
 * Sorts grades descending by min to prevent arbitrary array order bugs.
 */
export function calculateGradeAndRemark(
  percentage: number,
  customGrades?: Grade[]
): { grade: string; remark: string } {
  const gradesList = customGrades && customGrades.length > 0
    ? customGrades
    : DEFAULT_CONFIG.grades;

  // Strict descending sort by minimum score requirement
  const sorted = [...gradesList].sort((a, b) => b.min - a.min);
  const matched = sorted.find(g => percentage >= g.min) || sorted[sorted.length - 1];

  return {
    grade: matched?.grade || 'F',
    remark: matched?.remark || (percentage >= 50 ? 'Pass' : 'Fail')
  };
}

export interface GradedAttemptResult {
  rawScore: number;
  rawMax: number;
  percentage: number;
  scaledScore: number | null;
  maxComponentMark: number | null;
  grade: string;
  remark: string;
  gradingStatus: 'final' | 'pending_manual';
  breakdown: Array<{
    qIndex: number;
    questionText: string;
    type: string;
    awardedMarks: number;
    maxMarks: number;
    isCorrect: boolean;
    requiresManual: boolean;
    studentDisplay: string;
    correctDisplay: string;
    rawStudentAnswer: any;
    rawCorrectAnswer: any;
    explanation: string;
  }>;
}

/**
 * Complete evaluation of all questions in an exam attempt
 */
export function evaluateAttempt(
  questions: any[],
  submittedAnswers: Record<string | number, any> = {},
  config: Config = DEFAULT_CONFIG,
  examType: string = 'CA 1'
): GradedAttemptResult {
  let rawScore = 0;
  let totalMaxMarks = 0;
  let pendingManualCount = 0;
  const breakdown: GradedAttemptResult['breakdown'] = [];

  questions.forEach((q, idx) => {
    const studentAns = submittedAnswers[idx] !== undefined
      ? submittedAnswers[idx]
      : submittedAnswers[String(idx)];

    const evaluation = evaluateAnswer(q, studentAns);
    totalMaxMarks += evaluation.maxMarks;

    if (evaluation.requiresManual) {
      pendingManualCount++;
    } else if (evaluation.isCorrect) {
      rawScore += evaluation.awardedMarks;
    }

    breakdown.push({
      qIndex: idx,
      questionText: q.q || `Question ${idx + 1}`,
      type: q.type || 'mcq',
      awardedMarks: evaluation.awardedMarks,
      maxMarks: evaluation.maxMarks,
      isCorrect: evaluation.isCorrect,
      requiresManual: evaluation.requiresManual,
      studentDisplay: evaluation.studentDisplay,
      correctDisplay: evaluation.correctDisplay,
      rawStudentAnswer: studentAns,
      rawCorrectAnswer: q.ans !== undefined ? q.ans : (q.answer || q.answers),
      explanation: evaluation.explanation
    });
  });

  const rawMax = totalMaxMarks > 0 ? totalMaxMarks : questions.length;
  const percentage = rawMax > 0 ? Math.round((rawScore / rawMax) * 100) : 0;

  // Component Scaling
  let maxComponentMark: number | null = null;
  if (examType === 'CA 1') maxComponentMark = config.ca1 || 20;
  else if (examType === 'CA 2') maxComponentMark = config.ca2 || 20;
  else if (examType === 'Examination') maxComponentMark = config.exam || 60;

  const scaledScore = maxComponentMark && rawMax > 0
    ? Math.round((rawScore / rawMax) * maxComponentMark)
    : null;

  const { grade, remark } = calculateGradeAndRemark(percentage, config.grades);
  const gradingStatus = pendingManualCount > 0 ? 'pending_manual' : 'final';

  return {
    rawScore,
    rawMax,
    percentage,
    scaledScore,
    maxComponentMark,
    grade,
    remark,
    gradingStatus,
    breakdown
  };
}

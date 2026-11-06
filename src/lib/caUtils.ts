import { AssessmentRecord, Config, Grade, Result } from '../types';

export interface SubjectCAResult {
  subject: string;
  ca1Score: number | null; // 0-20 or null if unrecorded (0 is a valid score!)
  ca1Max: number; // 20
  ca2Score: number | null; // 0-20 or null if unrecorded
  ca2Max: number; // 20
  combinedScore: number | null; // out of 40 (only if both assessments recorded)
  combinedMax: number; // 40
  provisionalScore?: number | null; // sum of recorded CA components if partial
  isComplete: boolean; // true only if BOTH CA1 & CA2 are recorded
  isPartiallyRecorded: boolean; // CA1 only OR CA2 only
  isUnrecorded: boolean; // neither recorded
  statusLabel: 'Complete' | 'CA1 Only' | 'CA2 Only' | 'Unrecorded';
  ca1Percentage: number | null; // (ca1 / 20) * 100
  ca1IsManual?: boolean;
  ca2Percentage: number | null; // (ca2 / 20) * 100
  ca2IsManual?: boolean;
  combinedPercentage: number | null; // (combinedScore / 40) * 100
  ca1Grade?: string;
  ca2Grade?: string;
  combinedGrade?: string;
  combinedRemark?: string;
  examScore?: number | null; // out of config.exam (e.g. 60)
  examMax?: number;
  examIsManual?: boolean;
  finalSubjectScore?: number | null; // CA1 + CA2 + Exam (out of 100)
  isAcademicComplete?: boolean;
}

export interface StudentCASummary {
  studentId: string;
  academicSession: string;
  term: string;
  subjects: SubjectCAResult[];
  totalSubjectsCount: number;
  completedSubjectsCount: number;
  partialSubjectsCount: number;
  unrecordedSubjectsCount: number;
  isOverallComplete: boolean;
  isProvisional: boolean;

  // CA1 Summary
  totalCA1Score: number;
  totalCA1Max: number;
  recordedCA1Count: number;
  ca1Percentage: number | null; // Normalized across recorded CA1 subjects

  // CA2 Summary
  totalCA2Score: number;
  totalCA2Max: number;
  recordedCA2Count: number;
  ca2Percentage: number | null; // Normalized across recorded CA2 subjects

  // Combined CA Summary (Normalized to 100%)
  // Sum of CA1 and CA2 scores across applicable recorded subjects ÷ Sum of maximum obtainable CA marks across those subjects * 100
  totalCombinedScore: number;
  totalCombinedMax: number;
  overallCAPercentage: number | null;
  overallGrade?: string;
  overallRemark?: string;
}

export function getGradeForPercentage(percentage: number | null, grades: Grade[]): { grade: string; remark: string } {
  if (percentage === null || isNaN(percentage)) {
    return { grade: 'N/A', remark: 'Incomplete Assessment' };
  }
  const sorted = [...(grades || [])].sort((a, b) => b.min - a.min);
  const match = sorted.find(g => percentage >= g.min) || sorted[sorted.length - 1];
  return {
    grade: match?.grade || 'F',
    remark: match?.remark || 'No remark'
  };
}

/**
 * Computes continuous assessment breakdown and normalized summary for a pupil.
 * Strictly respects validation rules:
 * - 0 is a valid score
 * - null/blank is an unrecorded assessment
 * - Does not silently treat missing scores as zero
 * - Incomplete subjects are clearly tagged and result is marked provisional
 */
export function matchSubject(sub1: string = '', sub2: string = ''): boolean {
  const clean = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const s1 = clean(sub1);
  const s2 = clean(sub2);
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  // Curated educational aliases (only exact alias pairs)
  const exactAliases: [string, string][] = [
    ['math', 'mathematics'],
    ['maths', 'mathematics'],
    ['math', 'maths'],
    ['english', 'englishlanguage'],
    ['basicscience', 'basicscienceandtechnology'],
    ['bst', 'basicscienceandtechnology'],
    ['crs', 'christianreligiousstudies'],
    ['crk', 'christianreligiousknowledge'],
    ['irs', 'islamicreligiousstudies'],
    ['irk', 'islamicreligiousknowledge'],
    ['cca', 'culturalandcreativearts'],
    ['creativeart', 'culturalandcreativearts'],
    ['creativearts', 'culturalandcreativearts'],
    ['phe', 'physicalandhealtheducation'],
    ['pe', 'physicaleducation'],
    ['socialstudies', 'socialstudiesandciviceducation'],
    ['civic', 'civiceducation'],
    ['ict', 'computerstudies'],
    ['computerscience', 'computerstudies'],
    ['agric', 'agriculturalscience'],
    ['agriculture', 'agriculturalscience'],
    ['handwriting', 'penmanship']
  ];

  if (exactAliases.some(([a, b]) => (s1 === a && s2 === b) || (s1 === b && s2 === a))) {
    return true;
  }

  // Allow standard suffix variations like "language" or "studies"
  // ONLY if the prefix root is identical and substantial (>= 4 chars), e.g. "french" vs "frenchlanguage"
  // NEVER allow generic "science" to match "computerscience" or "agriculturalscience"!
  const suffixes = ['language', 'studies', 'education'];
  for (const suf of suffixes) {
    if (s1 === s2 + suf || s2 === s1 + suf) {
      const root = s1.length < s2.length ? s1 : s2;
      if (root.length >= 4 && root !== 'science' && root !== 'basic' && root !== 'general' && root !== 'applied') {
        return true;
      }
    }
  }

  return false;
}

export function matchTerm(t1: string = '', t2: string = ''): boolean {
  const norm = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const s1 = norm(t1);
  const s2 = norm(t2);
  if (!s1 || !s2) return true; // match if either is unspecified
  if (s1 === s2) return true;
  if ((s1.includes('1') || s1.includes('first')) && (s2.includes('1') || s2.includes('first'))) return true;
  if ((s1.includes('2') || s1.includes('second')) && (s2.includes('2') || s2.includes('second'))) return true;
  if ((s1.includes('3') || s1.includes('third')) && (s2.includes('3') || s2.includes('third'))) return true;
  return false;
}

export function matchSession(s1: string = '', s2: string = ''): boolean {
  const norm = (s: string) => (s || '').trim().toLowerCase().replace(/[^0-9]/g, '');
  const n1 = norm(s1);
  const n2 = norm(s2);
  if (!n1 || !n2) return true;
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export function computeStudentCASummary(
  studentId: string,
  applicableSubjects: string[],
  assessments: AssessmentRecord[] = [],
  legacyResults: Result[] = [],
  config: any = { ca1: 20, ca2: 20, exam: 60, passMark: 50 },
  academicSession: string = '2026/2027',
  term: string = 'First Term'
): StudentCASummary {
  const studentIdNorm = (studentId || '').trim().toLowerCase();

  // Filter student assessments for session & term, excluding deleted ones
  const studentAssessments = (assessments || []).filter(a => 
    (a.studentId || '').trim().toLowerCase() === studentIdNorm &&
    !(a as any).isDeleted &&
    a.status !== 'locked' && // only if not deleted/abandoned
    (!a.academicSessionId || matchSession(a.academicSessionId, academicSession)) &&
    (!a.termId || matchTerm(a.termId, term))
  );

  // Filter student legacy results, excluding deleted results
  const studentLegacyResults = (legacyResults || [])
    .filter(r => (r.studentId || '').trim().toLowerCase() === studentIdNorm && !r.isDeleted && !(r as any).deleted)
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  // Canonicalize subjects so variations (e.g. "Math" vs "Mathematics", "English" vs "English Language")
  // do NOT produce duplicate or unrecorded phantom rows, but NEVER merge distinct subjects like Computer Science and Basic Science!
  const canonicalSubjects: string[] = [];
  const addCanonical = (subjName: string) => {
    if (!subjName || !subjName.trim()) return;
    const trimmed = subjName.trim();
    const existing = canonicalSubjects.find(s => matchSubject(s, trimmed));
    if (!existing) {
      canonicalSubjects.push(trimmed);
    }
  };

  (applicableSubjects.length > 0 ? applicableSubjects : ['Mathematics', 'English Language', 'Basic Science & Technology']).forEach(addCanonical);
  (studentAssessments || []).forEach(a => { if (a.subjectId) addCanonical(a.subjectId); });
  (studentLegacyResults || []).forEach(r => { if (r.subject) addCanonical(r.subject); });
  const subjectList = canonicalSubjects;

  const isCA1Type = (typeStr: string = '', titleStr: string = '') => {
    const cleanType = (typeStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanType === 'ca1' || cleanType === 'afl' || cleanType.startsWith('ca1') || cleanType === 'continuousassessment1' || cleanType === 'test1' || cleanType === 'quiz1' || cleanType === 'cat1') return true;
    if (cleanTitle.includes('ca1') || cleanTitle.includes('continuousassessment1') || cleanTitle.includes('firsttest') || cleanTitle.includes('test1') || cleanTitle.includes('quiz1') || cleanTitle.includes('cat1') || cleanTitle.includes('ca-1') || cleanTitle.includes('ca 1') || cleanTitle.includes('assessment1')) return true;
    return false;
  };

  const isCA2Type = (typeStr: string = '', titleStr: string = '') => {
    const cleanType = (typeStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanType === 'ca2' || cleanType.startsWith('ca2') || cleanType === 'continuousassessment2' || cleanType === 'test2' || cleanType === 'quiz2' || cleanType === 'cat2') return true;
    if (cleanTitle.includes('ca2') || cleanTitle.includes('continuousassessment2') || cleanTitle.includes('secondtest') || cleanTitle.includes('test2') || cleanTitle.includes('quiz2') || cleanTitle.includes('cat2') || cleanTitle.includes('ca-2') || cleanTitle.includes('ca 2') || cleanTitle.includes('assessment2')) return true;
    return false;
  };

  const isExamType = (typeStr: string = '', titleStr: string = '') => {
    const cleanType = (typeStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanType === 'examination' || cleanType.includes('exam') || cleanTitle.includes('exam') || cleanTitle.includes('terminal');
  };

  // Helper to safely extract score from a Result record without treating 0 as null
  const extractResultScore = (res: Result | null, maxMark: number = 20): number | null => {
    if (!res) return null;
    const toNum = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return !isNaN(n) ? n : null;
    };

    const scaled = toNum(res.scaled);
    const raw = toNum(res.raw);
    const rawMax = toNum(res.rawMax);
    const pct = toNum(res.percentage);
    const score = toNum((res as any).score);
    const resMax = toNum((res as any).max);

    if (scaled !== null) {
      if (resMax && resMax !== maxMark && resMax > 0) {
        return Math.max(0, Math.min(maxMark, Math.round((scaled / resMax) * maxMark)));
      }
      return Math.max(0, Math.min(maxMark, Math.round(scaled)));
    }

    if (raw !== null && rawMax !== null && rawMax > 0) {
      return Math.max(0, Math.min(maxMark, Math.round((raw / rawMax) * maxMark)));
    }

    if (pct !== null) {
      return Math.max(0, Math.min(maxMark, Math.round((pct / 100) * maxMark)));
    }

    if (score !== null) {
      const max = resMax || 100;
      return Math.max(0, Math.min(maxMark, Math.round((score / max) * maxMark)));
    }

    return null;
  };

  const ca1Max = config.ca1 || 20;
  const ca2Max = config.ca2 || 20;
  const examMax = config.exam || 60;

  const subjectResults: SubjectCAResult[] = subjectList.map(subj => {
    const subjNorm = subj.trim().toLowerCase();

    // 1. Check primary AssessmentRecord
    const ca1Record = studentAssessments.find(a => 
      ((a.subjectId || '').trim().toLowerCase() === subjNorm || matchSubject(a.subjectId, subj)) && 
      isCA1Type(a.assessmentType)
    );
    const ca2Record = studentAssessments.find(a => 
      ((a.subjectId || '').trim().toLowerCase() === subjNorm || matchSubject(a.subjectId, subj)) && 
      isCA2Type(a.assessmentType)
    );
    const examRecord = studentAssessments.find(a => 
      ((a.subjectId || '').trim().toLowerCase() === subjNorm || matchSubject(a.subjectId, subj)) && 
      isExamType(a.assessmentType)
    );

    // 2. Check legacy / CBT results fallback
    const matchingResultsForSubj = studentLegacyResults.filter(r => 
      (r.subject || '').trim().toLowerCase() === subjNorm || matchSubject(r.subject, subj)
    );

    const matchingCA1Results = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isCA1Type(r.type, title) || (['Test', 'Quiz', 'Assignment', 'CA 1', 'AFL'].includes(r.type) && !isCA2Type(r.type, title));
    }).sort((a, b) => {
      const scoreA = extractResultScore(a, ca1Max) ?? -1;
      const scoreB = extractResultScore(b, ca1Max) ?? -1;
      return scoreB - scoreA;
    });
    const legacyCA1 = matchingCA1Results.length > 0 ? matchingCA1Results[0] : null;

    const matchingCA2Results = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isCA2Type(r.type, title);
    }).sort((a, b) => {
      const scoreA = extractResultScore(a, ca2Max) ?? -1;
      const scoreB = extractResultScore(b, ca2Max) ?? -1;
      return scoreB - scoreA;
    });
    const legacyCA2 = matchingCA2Results.length > 0 ? matchingCA2Results[0] : null;

    const matchingExamResults = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isExamType(r.type, title);
    }).sort((a, b) => {
      const scoreA = extractResultScore(a, examMax) ?? -1;
      const scoreB = extractResultScore(b, examMax) ?? -1;
      return scoreB - scoreA;
    });
    const legacyExam = matchingExamResults.length > 0 ? matchingExamResults[0] : null;

    // CA1 score extraction (Manual override takes priority; unedited CBT scores remain valid)
    let ca1Score: number | null = null;
    let ca1IsManual = false;
    const isManualCA1Record = ca1Record && (ca1Record.isManualOverride || (ca1Record.enteredBy && ca1Record.enteredBy.role !== 'student'));
    const isManualLegacyCA1 = legacyCA1 && (legacyCA1.isManualOverride || (legacyCA1 as any).teacherScore !== undefined);

    if (isManualCA1Record && typeof ca1Record?.score === 'number' && !isNaN(ca1Record.score)) {
      ca1Score = Math.max(0, Math.min(ca1Max, Math.round(ca1Record.score)));
      ca1IsManual = true;
    } else if (isManualLegacyCA1) {
      ca1Score = extractResultScore(legacyCA1, ca1Max);
      ca1IsManual = true;
    } else if (legacyCA1) {
      // Unedited CBT score remains valid
      ca1Score = extractResultScore(legacyCA1, ca1Max);
      ca1IsManual = false;
    } else if (ca1Record && typeof ca1Record.score === 'number' && !isNaN(ca1Record.score)) {
      ca1Score = Math.max(0, Math.min(ca1Max, Math.round(ca1Record.score)));
      ca1IsManual = !!ca1Record.isManualOverride;
    }

    // CA2 score extraction (Manual override takes priority; unedited CBT scores remain valid)
    let ca2Score: number | null = null;
    let ca2IsManual = false;
    const isManualCA2Record = ca2Record && (ca2Record.isManualOverride || (ca2Record.enteredBy && ca2Record.enteredBy.role !== 'student'));
    const isManualLegacyCA2 = legacyCA2 && (legacyCA2.isManualOverride || (legacyCA2 as any).teacherScore !== undefined);

    if (isManualCA2Record && typeof ca2Record?.score === 'number' && !isNaN(ca2Record.score)) {
      ca2Score = Math.max(0, Math.min(ca2Max, Math.round(ca2Record.score)));
      ca2IsManual = true;
    } else if (isManualLegacyCA2) {
      ca2Score = extractResultScore(legacyCA2, ca2Max);
      ca2IsManual = true;
    } else if (legacyCA2) {
      // Unedited CBT score remains valid
      ca2Score = extractResultScore(legacyCA2, ca2Max);
      ca2IsManual = false;
    } else if (ca2Record && typeof ca2Record.score === 'number' && !isNaN(ca2Record.score)) {
      ca2Score = Math.max(0, Math.min(ca2Max, Math.round(ca2Record.score)));
      ca2IsManual = !!ca2Record.isManualOverride;
    }

    // Exam score extraction (Manual override takes priority; unedited CBT scores remain valid)
    let examScore: number | null = null;
    let examIsManual = false;
    const isManualExamRecord = examRecord && (examRecord.isManualOverride || (examRecord.enteredBy && examRecord.enteredBy.role !== 'student'));
    const isManualLegacyExam = legacyExam && (legacyExam.isManualOverride || (legacyExam as any).teacherScore !== undefined);

    if (isManualExamRecord && typeof examRecord?.score === 'number' && !isNaN(examRecord.score)) {
      examScore = Math.max(0, Math.min(examMax, Math.round(examRecord.score)));
      examIsManual = true;
    } else if (isManualLegacyExam) {
      examScore = extractResultScore(legacyExam, examMax);
      examIsManual = true;
    } else if (legacyExam) {
      // Unedited CBT score remains valid
      examScore = extractResultScore(legacyExam, examMax);
      examIsManual = false;
    } else if (examRecord && typeof examRecord.score === 'number' && !isNaN(examRecord.score)) {
      examScore = Math.max(0, Math.min(examMax, Math.round(examRecord.score)));
      examIsManual = !!examRecord.isManualOverride;
    }

    const hasCA1 = ca1Score !== null;
    const hasCA2 = ca2Score !== null;
    const isComplete = hasCA1 && hasCA2;
    const isPartiallyRecorded = (hasCA1 && !hasCA2) || (!hasCA1 && hasCA2);
    const isUnrecorded = !hasCA1 && !hasCA2;

    let statusLabel: 'Complete' | 'CA1 Only' | 'CA2 Only' | 'Unrecorded' = 'Unrecorded';
    if (isComplete) statusLabel = 'Complete';
    else if (hasCA1 && !hasCA2) statusLabel = 'CA1 Only';
    else if (!hasCA1 && hasCA2) statusLabel = 'CA2 Only';

    // Combined score out of 40 (only definitive if both recorded)
    const combinedScore = isComplete ? (ca1Score! + ca2Score!) : null;
    const provisionalScore = isComplete 
      ? combinedScore 
      : (hasCA1 ? ca1Score : (hasCA2 ? ca2Score : null));

    const ca1Percentage = hasCA1 ? Math.round((ca1Score! / 20) * 1000) / 10 : null;
    const ca2Percentage = hasCA2 ? Math.round((ca2Score! / 20) * 1000) / 10 : null;
    const combinedPercentage = isComplete ? Math.round((combinedScore! / 40) * 1000) / 10 : null;

    const ca1GradeInfo = getGradeForPercentage(ca1Percentage, config.grades);
    const ca2GradeInfo = getGradeForPercentage(ca2Percentage, config.grades);
    const combinedGradeInfo = getGradeForPercentage(combinedPercentage, config.grades);

    // Academic report integration (CA1 + CA2 + Exam)
    const isAcademicComplete = isComplete && examScore !== null;
    const finalSubjectScore = isAcademicComplete ? (combinedScore! + examScore!) : null;

    return {
      subject: subj,
      ca1Score,
      ca1Max: 20,
      ca1IsManual,
      ca2Score,
      ca2Max: 20,
      ca2IsManual,
      combinedScore,
      combinedMax: 40,
      provisionalScore,
      isComplete,
      isPartiallyRecorded,
      isUnrecorded,
      statusLabel,
      ca1Percentage,
      ca2Percentage,
      combinedPercentage,
      ca1Grade: hasCA1 ? ca1GradeInfo.grade : undefined,
      ca2Grade: hasCA2 ? ca2GradeInfo.grade : undefined,
      combinedGrade: isComplete ? combinedGradeInfo.grade : undefined,
      combinedRemark: isComplete ? combinedGradeInfo.remark : undefined,
      examScore,
      examMax,
      examIsManual,
      finalSubjectScore,
      isAcademicComplete
    };
  });

  // Calculate Aggregates
  let totalCA1Score = 0;
  let totalCA1Max = 0;
  let recordedCA1Count = 0;

  let totalCA2Score = 0;
  let totalCA2Max = 0;
  let recordedCA2Count = 0;

  // Complete subjects for combined CA
  let totalCombinedScore = 0;
  let totalCombinedMax = 0;
  let completedSubjectsCount = 0;
  let partialSubjectsCount = 0;
  let unrecordedSubjectsCount = 0;

  subjectResults.forEach(r => {
    if (r.ca1Score !== null) {
      totalCA1Score += r.ca1Score;
      totalCA1Max += 20;
      recordedCA1Count++;
    }
    if (r.ca2Score !== null) {
      totalCA2Score += r.ca2Score;
      totalCA2Max += 20;
      recordedCA2Count++;
    }

    if (r.isComplete) {
      totalCombinedScore += (r.ca1Score! + r.ca2Score!);
      totalCombinedMax += 40;
      completedSubjectsCount++;
    } else if (r.isPartiallyRecorded) {
      partialSubjectsCount++;
    } else {
      unrecordedSubjectsCount++;
    }
  });

  const totalSubjectsCount = subjectResults.length;
  const isOverallComplete = completedSubjectsCount === totalSubjectsCount && totalSubjectsCount > 0;
  const isProvisional = !isOverallComplete;

  const ca1Percentage = totalCA1Max > 0 
    ? Math.round((totalCA1Score / totalCA1Max) * 1000) / 10 
    : null;

  const ca2Percentage = totalCA2Max > 0 
    ? Math.round((totalCA2Score / totalCA2Max) * 1000) / 10 
    : null;

  // Formula as required:
  // Overall CA percentage = (Sum of CA1 and CA2 scores across applicable subjects ÷ Sum of maximum obtainable CA marks across those subjects) × 100
  // If only some subjects have recorded CA scores, calculate percentage across subjects with required recorded data and label provisional
  const overallCAPercentage = totalCombinedMax > 0 
    ? Math.round((totalCombinedScore / totalCombinedMax) * 1000) / 10 
    : null;

  const overallGradeInfo = getGradeForPercentage(overallCAPercentage, config.grades);

  return {
    studentId,
    academicSession,
    term,
    subjects: subjectResults,
    totalSubjectsCount,
    completedSubjectsCount,
    partialSubjectsCount,
    unrecordedSubjectsCount,
    isOverallComplete,
    isProvisional,

    totalCA1Score,
    totalCA1Max,
    recordedCA1Count,
    ca1Percentage,

    totalCA2Score,
    totalCA2Max,
    recordedCA2Count,
    ca2Percentage,

    totalCombinedScore,
    totalCombinedMax,
    overallCAPercentage,
    overallGrade: overallCAPercentage !== null ? overallGradeInfo.grade : 'N/A',
    overallRemark: overallCAPercentage !== null ? overallGradeInfo.remark : 'Incomplete CA'
  };
}

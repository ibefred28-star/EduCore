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
  ca2Percentage: number | null; // (ca2 / 20) * 100
  combinedPercentage: number | null; // (combinedScore / 40) * 100
  ca1Grade?: string;
  ca2Grade?: string;
  combinedGrade?: string;
  combinedRemark?: string;
  examScore?: number | null; // out of config.exam (e.g. 60)
  examMax?: number;
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
  const s1 = (sub1 || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = (sub2 || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;

  const aliases: [string, string][] = [
    ['math', 'mathematics'],
    ['maths', 'mathematics'],
    ['english', 'englishlanguage'],
    ['basicscience', 'basicscienceandtechnology'],
    ['basicscience', 'science'],
    ['history', 'nigerianhistory']
  ];
  return aliases.some(([a, b]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
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
  const cleanTerm = (t: string) => (t || '').trim().toLowerCase();
  const cleanSession = (s: string) => (s || '').trim().toLowerCase();
  const studentIdNorm = (studentId || '').trim().toLowerCase();

  // Filter student assessments for session & term
  const studentAssessments = (assessments || []).filter(a => 
    (a.studentId || '').trim().toLowerCase() === studentIdNorm &&
    (!a.academicSessionId || cleanSession(a.academicSessionId) === cleanSession(academicSession)) &&
    (!a.termId || cleanTerm(a.termId) === cleanTerm(term))
  );

  // Fallback to legacyResults if any, sorted newest to oldest
  const studentLegacyResults = (legacyResults || [])
    .filter(r => (r.studentId || '').trim().toLowerCase() === studentIdNorm)
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  // Canonicalize subjects so variations (e.g. "Math" vs "Mathematics", "English" vs "English Language")
  // do NOT produce duplicate or unrecorded phantom rows
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
    if (cleanType === 'ca1' || cleanType === 'afl' || cleanType.startsWith('ca1') || cleanType === 'continuousassessment1') return true;
    if (cleanTitle.includes('ca1') || cleanTitle.includes('continuousassessment1') || cleanTitle.includes('firsttest')) return true;
    return false;
  };

  const isCA2Type = (typeStr: string = '', titleStr: string = '') => {
    const cleanType = (typeStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanType === 'ca2' || cleanType.startsWith('ca2') || cleanType === 'continuousassessment2') return true;
    if (cleanTitle.includes('ca2') || cleanTitle.includes('continuousassessment2') || cleanTitle.includes('secondtest')) return true;
    return false;
  };

  const isExamType = (typeStr: string = '', titleStr: string = '') => {
    const cleanType = (typeStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanType === 'examination' || cleanType.includes('exam') || cleanTitle.includes('exam') || cleanTitle.includes('terminal');
  };

  // Helper to safely extract score from a Result record without treating 0 as null
  const extractResultScore = (res: Result | null, maxMark: number): number | null => {
    if (!res) return null;
    if (typeof res.scaled === 'number' && !isNaN(res.scaled)) {
      return Math.max(0, Math.min(maxMark, Math.round(res.scaled)));
    }
    if (typeof res.raw === 'number' && typeof res.rawMax === 'number' && res.rawMax > 0) {
      return Math.max(0, Math.min(maxMark, Math.round((res.raw / res.rawMax) * maxMark)));
    }
    if (typeof res.percentage === 'number' && !isNaN(res.percentage)) {
      return Math.max(0, Math.min(maxMark, Math.round((res.percentage / 100) * maxMark)));
    }
    return null;
  };

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

    // 2. Check legacy / CBT results fallback
    const matchingResultsForSubj = studentLegacyResults.filter(r => 
      (r.subject || '').trim().toLowerCase() === subjNorm || matchSubject(r.subject, subj)
    );

    const matchingCA1Results = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isCA1Type(r.type, title) || (['Test', 'Quiz', 'Assignment'].includes(r.type) && !isCA2Type(r.type, title));
    }).sort((a, b) => {
      const scoreA = typeof a.scaled === 'number' ? a.scaled : (a.percentage || 0);
      const scoreB = typeof b.scaled === 'number' ? b.scaled : (b.percentage || 0);
      return scoreB - scoreA;
    });
    const legacyCA1 = matchingCA1Results.length > 0 ? matchingCA1Results[0] : null;

    const matchingCA2Results = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isCA2Type(r.type, title);
    }).sort((a, b) => {
      const scoreA = typeof a.scaled === 'number' ? a.scaled : (a.percentage || 0);
      const scoreB = typeof b.scaled === 'number' ? b.scaled : (b.percentage || 0);
      return scoreB - scoreA;
    });
    const legacyCA2 = matchingCA2Results.length > 0 ? matchingCA2Results[0] : null;

    const matchingExamResults = matchingResultsForSubj.filter(r => {
      const title = (r as any).examTitle || (r as any).title || '';
      return isExamType(r.type, title);
    }).sort((a, b) => {
      const scoreA = typeof a.scaled === 'number' ? a.scaled : (a.percentage || 0);
      const scoreB = typeof b.scaled === 'number' ? b.scaled : (b.percentage || 0);
      return scoreB - scoreA;
    });
    const legacyExam = matchingExamResults.length > 0 ? matchingExamResults[0] : null;

    // CA1 score extraction
    const ca1Max = config.ca1 || 20;
    let ca1Score: number | null = null;
    if (ca1Record && typeof ca1Record.score === 'number' && !isNaN(ca1Record.score)) {
      ca1Score = Math.max(0, Math.min(ca1Max, Math.round(ca1Record.score)));
    } else if (legacyCA1) {
      ca1Score = extractResultScore(legacyCA1, ca1Max);
    }

    // CA2 score extraction
    const ca2Max = config.ca2 || 20;
    let ca2Score: number | null = null;
    if (ca2Record && typeof ca2Record.score === 'number' && !isNaN(ca2Record.score)) {
      ca2Score = Math.max(0, Math.min(ca2Max, Math.round(ca2Record.score)));
    } else if (legacyCA2) {
      ca2Score = extractResultScore(legacyCA2, ca2Max);
    }

    // Exam score extraction
    const examMax = config.exam || 60;
    let examScore: number | null = null;
    if (legacyExam) {
      examScore = extractResultScore(legacyExam, examMax);
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
      ca2Score,
      ca2Max: 20,
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

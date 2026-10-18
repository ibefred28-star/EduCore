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
export function computeStudentCASummary(
  studentId: string,
  applicableSubjects: string[],
  assessments: AssessmentRecord[] = [],
  legacyResults: Result[] = [],
  config: Config,
  academicSession: string = '2026/2027',
  term: string = 'First Term'
): StudentCASummary {
  // Ensure subject list is non-empty and unique
  const subjectList = Array.from(new Set(applicableSubjects.length > 0 ? applicableSubjects : ['Mathematics', 'English Language', 'Basic Science & Technology']));

  const cleanTerm = (t: string) => (t || '').trim().toLowerCase();
  const cleanSession = (s: string) => (s || '').trim().toLowerCase();

  const studentIdNorm = (studentId || '').trim().toLowerCase();

  // Filter student assessments for session & term
  const studentAssessments = (assessments || []).filter(a => 
    (a.studentId || '').trim().toLowerCase() === studentIdNorm &&
    (!a.academicSessionId || cleanSession(a.academicSessionId) === cleanSession(academicSession)) &&
    (!a.termId || cleanTerm(a.termId) === cleanTerm(term))
  );

  // Fallback to legacyResults if any
  const studentLegacyResults = (legacyResults || []).filter(
    r => (r.studentId || '').trim().toLowerCase() === studentIdNorm
  );

  const isCA1Type = (t: string = '') => {
    const clean = t.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'ca1' || clean === 'afl';
  };

  const isCA2Type = (t: string = '') => {
    const clean = t.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'ca2';
  };

  const subjectResults: SubjectCAResult[] = subjectList.map(subj => {
    const subjNorm = subj.trim().toLowerCase();

    // 1. Check primary AssessmentRecord
    const ca1Record = studentAssessments.find(a => 
      (a.subjectId || '').trim().toLowerCase() === subjNorm && 
      isCA1Type(a.assessmentType)
    );
    const ca2Record = studentAssessments.find(a => 
      (a.subjectId || '').trim().toLowerCase() === subjNorm && 
      isCA2Type(a.assessmentType)
    );

    // 2. Check legacy results fallback if no AssessmentRecord
    const legacyCA1 = !ca1Record ? studentLegacyResults.find(r => 
      (r.subject || '').trim().toLowerCase() === subjNorm && 
      isCA1Type(r.type)
    ) : null;

    const legacyCA2 = !ca2Record ? studentLegacyResults.find(r => 
      (r.subject || '').trim().toLowerCase() === subjNorm && 
      isCA2Type(r.type)
    ) : null;

    const legacyExam = studentLegacyResults.find(r => 
      (r.subject || '').trim().toLowerCase() === subjNorm && 
      (r.type === 'Examination' || (r.type || '').trim().toLowerCase().includes('exam'))
    );

    // CA1 score extraction (distinctly preserving 0 vs null)
    let ca1Score: number | null = null;
    if (ca1Record && typeof ca1Record.score === 'number' && !isNaN(ca1Record.score)) {
      ca1Score = Math.max(0, Math.min(20, ca1Record.score));
    } else if (legacyCA1) {
      if (typeof legacyCA1.scaled === 'number') {
        ca1Score = Math.max(0, Math.min(20, legacyCA1.scaled));
      } else if (typeof legacyCA1.raw === 'number' && legacyCA1.rawMax > 0) {
        ca1Score = Math.round((legacyCA1.raw / legacyCA1.rawMax) * (config.ca1 || 20));
      }
    }

    // CA2 score extraction
    let ca2Score: number | null = null;
    if (ca2Record && typeof ca2Record.score === 'number' && !isNaN(ca2Record.score)) {
      ca2Score = Math.max(0, Math.min(20, ca2Record.score));
    } else if (legacyCA2) {
      if (typeof legacyCA2.scaled === 'number') {
        ca2Score = Math.max(0, Math.min(20, legacyCA2.scaled));
      } else if (typeof legacyCA2.raw === 'number' && legacyCA2.rawMax > 0) {
        ca2Score = Math.round((legacyCA2.raw / legacyCA2.rawMax) * (config.ca2 || 20));
      }
    }

    // Exam score extraction
    let examScore: number | null = null;
    const examMax = config.exam || 60;
    if (legacyExam) {
      if (typeof legacyExam.scaled === 'number') {
        examScore = Math.max(0, Math.min(examMax, legacyExam.scaled));
      } else if (typeof legacyExam.raw === 'number' && legacyExam.rawMax > 0) {
        examScore = Math.round((legacyExam.raw / legacyExam.rawMax) * examMax);
      }
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

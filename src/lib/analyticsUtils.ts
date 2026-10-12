import { AppData, Exam, Result, Student, Attendance, Config, Question, BankQuestion } from '../types';
import { isStudentInTeacherClasses } from './classUtils';

export interface AnalyticsFilter {
  session?: string;
  term?: string;
  class?: string;
  subject?: string;
  examId?: string | number;
  startDate?: string;
  endDate?: string;
}

export interface StudentPerformanceSummary {
  studentId: string;
  studentName: string;
  studentClass: string;
  photo?: string;
  totalExams: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  strongestSubject: string;
  weakestSubject: string;
  passCount: number;
  failCount: number;
  passRate: number;
  attendancePercent: number | null;
  needsIntervention: boolean;
}

export interface QuestionAnalyticsItem {
  id: string;
  examId: string | number;
  examTitle: string;
  subject: string;
  class: string;
  topic: string;
  qText: string;
  type: string;
  taggedDifficulty: string;
  empiricalDifficulty: 'Easy' | 'Medium' | 'Hard';
  timesAttempted: number;
  timesCorrect: number;
  timesWrong: number;
  timesUnanswered: number;
  percentageCorrect: number;
  percentageWrong: number;
  unansweredRate: number;
  marks: number;
}

export interface TopicPerformanceItem {
  topic: string;
  subject: string;
  totalQuestions: number;
  totalAttempts: number;
  totalCorrect: number;
  percentageCorrect: number;
  performanceTier: 'High Mastery' | 'Moderate' | 'Needs Attention';
}

function normalizeTF(v: any): number {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v === 1 || v === 0 ? v : -1;
  const x = String(v ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', '1'].includes(x)) return 1;
  if (['false', 'f', 'no', '0'].includes(x)) return 0;
  return -1;
}

export function answerIsCorrect(q: any, a: any): boolean {
  const type = q.type || 'mcq';
  if (a === undefined || a === null || a === '') return false;
  if (type === 'fill_blank') {
    const expected = Array.isArray(q.answers) && q.answers.length > 0 ? q.answers : q.answer ? [q.answer] : q.ans !== undefined ? [q.ans] : [];
    const got = String(a).trim().toLowerCase();
    return expected.some((v: any) => got === String(v ?? '').trim().toLowerCase());
  }
  if (type === 'true_false') {
    return normalizeTF(a) === normalizeTF(q.ans);
  }
  if (type === 'mcq' || type === 'diagram') {
    const correctAns = q.ans;
    const options = q.options || [];
    if (Number(a) === Number(correctAns)) return true;
    if (String(a).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) return true;
    if (options.length > 0) {
      const correctIdx = Number(correctAns);
      const studentIdx = Number(a);
      if (Number.isFinite(correctIdx) && options[correctIdx] !== undefined) {
        if (String(options[correctIdx]).trim().toLowerCase() === String(a).trim().toLowerCase()) return true;
      }
      if (Number.isFinite(studentIdx) && options[studentIdx] !== undefined && Number.isFinite(correctIdx)) {
        if (String(options[studentIdx]).trim().toLowerCase() === String(options[correctIdx]).trim().toLowerCase()) return true;
      }
    }
    return false;
  }
  const expected = Number(q.ans);
  return Number.isFinite(expected) && Number(a) === expected;
}

export function getResultPercentage(r: Result): number {
  if (r.rawMax > 0) {
    return Math.round((r.raw / r.rawMax) * 100);
  }
  if (r.max && r.max > 0 && r.scaled !== null && r.scaled !== undefined) {
    return Math.round((r.scaled / r.max) * 100);
  }
  return 0;
}

/**
 * Filter results efficiently based on user filters and role authorization
 */
export function filterResults(
  results: Result[],
  students: Student[],
  exams: Exam[],
  filter: AnalyticsFilter,
  studentIdConstraint?: string,
  teacherClassesConstraint?: string[]
): Result[] {
  const studentMap = new Map<string, Student>();
  students.forEach(s => studentMap.set(s.id, s));

  const examMap = new Map<string | number, Exam>();
  exams.forEach(e => examMap.set(String(e.id), e));

  return results.filter(r => {
    // Role boundary checks
    if (studentIdConstraint && r.studentId !== studentIdConstraint) {
      return false;
    }

    const student = studentMap.get(r.studentId);
    if (teacherClassesConstraint && teacherClassesConstraint.length > 0) {
      if (!student || !isStudentInTeacherClasses(student.class, teacherClassesConstraint)) {
        return false;
      }
    }

    // Filter checks
    if (filter.subject && filter.subject !== 'All' && r.subject !== filter.subject) {
      return false;
    }

    if (filter.examId && filter.examId !== 'All' && String(r.examId) !== String(filter.examId)) {
      return false;
    }

    if (filter.class && filter.class !== 'All') {
      if (!student || !isStudentInTeacherClasses(student.class, [filter.class])) {
        return false;
      }
    }

    if (filter.session && filter.session !== 'All') {
      if (student && student.reportSession && student.reportSession !== filter.session) {
        return false;
      }
    }

    if (filter.term && filter.term !== 'All') {
      if (student && student.reportTerm && student.reportTerm !== filter.term) {
        return false;
      }
    }

    if (filter.startDate) {
      const subTime = new Date(r.submittedAt).getTime();
      const startTime = new Date(filter.startDate).getTime();
      if (!isNaN(subTime) && !isNaN(startTime) && subTime < startTime) {
        return false;
      }
    }

    if (filter.endDate) {
      const subTime = new Date(r.submittedAt).getTime();
      const endTime = new Date(filter.endDate).getTime() + 86400000; // include full day
      if (!isNaN(subTime) && !isNaN(endTime) && subTime > endTime) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Computes individual student performance metrics
 */
export function calculateStudentAnalytics(
  studentId: string,
  results: Result[],
  attendance: Attendance[],
  exams: Exam[],
  config: Config
) {
  const studentResults = results.filter(r => r.studentId === studentId);
  
  // Sort chronologically
  const sortedResults = [...studentResults].sort((a, b) => 
    new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );

  // Subject averages
  const subjectMap: Record<string, { totalPct: number; count: number }> = {};
  sortedResults.forEach(r => {
    const pct = getResultPercentage(r);
    if (!subjectMap[r.subject]) {
      subjectMap[r.subject] = { totalPct: 0, count: 0 };
    }
    subjectMap[r.subject].totalPct += pct;
    subjectMap[r.subject].count += 1;
  });

  const subjectAverages = Object.entries(subjectMap).map(([subject, data]) => ({
    subject,
    average: Math.round(data.totalPct / data.count)
  })).sort((a, b) => b.average - a.average);

  const strongestSubject = subjectAverages.length > 0 ? subjectAverages[0].subject : 'None';
  const weakestSubject = subjectAverages.length > 0 ? subjectAverages[subjectAverages.length - 1].subject : 'None';

  // Overall average
  const totalPercentage = sortedResults.reduce((sum, r) => sum + getResultPercentage(r), 0);
  const averagePercentage = sortedResults.length > 0 ? Math.round(totalPercentage / sortedResults.length) : 0;

  // Percentage trend calculation (first half vs second half or last 3 vs first 3)
  let percentageTrend: 'improving' | 'declining' | 'stable' = 'stable';
  let trendDelta = 0;
  if (sortedResults.length >= 2) {
    const half = Math.floor(sortedResults.length / 2);
    const firstHalfAvg = sortedResults.slice(0, half).reduce((s, r) => s + getResultPercentage(r), 0) / half;
    const secondHalfAvg = sortedResults.slice(half).reduce((s, r) => s + getResultPercentage(r), 0) / (sortedResults.length - half);
    trendDelta = Math.round(secondHalfAvg - firstHalfAvg);
    if (trendDelta >= 3) percentageTrend = 'improving';
    else if (trendDelta <= -3) percentageTrend = 'declining';
  }

  // Attendance
  const studentAttendance = attendance.find(a => a.studentId === studentId);
  const attendancePercent = studentAttendance ? studentAttendance.percent : null;

  return {
    resultsCount: sortedResults.length,
    averagePercentage,
    strongestSubject,
    strongestSubjectAvg: subjectAverages.length > 0 ? subjectAverages[0].average : 0,
    weakestSubject,
    weakestSubjectAvg: subjectAverages.length > 0 ? subjectAverages[subjectAverages.length - 1].average : 0,
    subjectAverages,
    sortedResults,
    percentageTrend,
    trendDelta,
    attendancePercent
  };
}

/**
 * Computes Question-level Performance Analytics across assessments
 */
export function calculateQuestionAnalytics(
  exams: Exam[],
  results: Result[],
  questionsBank: BankQuestion[] = []
): {
  questionStats: QuestionAnalyticsItem[];
  mostMissedQuestions: QuestionAnalyticsItem[];
  topicPerformance: TopicPerformanceItem[];
  overallAccuracy: number;
} {
  const examMap = new Map<string | number, Exam>();
  exams.forEach(e => examMap.set(String(e.id), e));

  const statsList: QuestionAnalyticsItem[] = [];
  const topicMap: Record<string, { subject: string; totalAttempts: number; totalCorrect: number; questions: Set<string> }> = {};

  let totalAllAttempts = 0;
  let totalAllCorrect = 0;

  exams.forEach(exam => {
    if (!exam.questions || !Array.isArray(exam.questions)) return;

    // Filter results for this exam
    const examResults = results.filter(r => String(r.examId) === String(exam.id));
    if (examResults.length === 0) return;

    exam.questions.forEach((q, qIndex) => {
      let timesAttempted = 0;
      let timesCorrect = 0;
      let timesWrong = 0;
      let timesUnanswered = 0;

      examResults.forEach(r => {
        const studentAns = r.answers ? r.answers[qIndex] : undefined;
        if (studentAns === undefined || studentAns === null || studentAns === '') {
          timesUnanswered += 1;
        } else {
          timesAttempted += 1;
          if (answerIsCorrect(q, studentAns)) {
            timesCorrect += 1;
          } else {
            timesWrong += 1;
          }
        }
      });

      const totalResponses = timesAttempted + timesUnanswered;
      const percentageCorrect = totalResponses > 0 ? Math.round((timesCorrect / totalResponses) * 100) : 0;
      const percentageWrong = totalResponses > 0 ? Math.round((timesWrong / totalResponses) * 100) : 0;
      const unansweredRate = totalResponses > 0 ? Math.round((timesUnanswered / totalResponses) * 100) : 0;

      // Empirical difficulty estimate
      let empiricalDifficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
      if (percentageCorrect >= 70) empiricalDifficulty = 'Easy';
      else if (percentageCorrect < 40) empiricalDifficulty = 'Hard';

      const qItem: QuestionAnalyticsItem = {
        id: q.id || `q_${exam.id}_${qIndex}`,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        class: exam.targetClasses?.[0] || 'General',
        topic: q.topic || 'General Topic',
        qText: q.q,
        type: q.type || 'mcq',
        taggedDifficulty: q.difficulty || 'Medium',
        empiricalDifficulty,
        timesAttempted,
        timesCorrect,
        timesWrong,
        timesUnanswered,
        percentageCorrect,
        percentageWrong,
        unansweredRate,
        marks: q.marks || 1
      };

      statsList.push(qItem);
      totalAllAttempts += totalResponses;
      totalAllCorrect += timesCorrect;

      // Group by topic
      const topicName = q.topic || 'General Curriculum';
      if (!topicMap[topicName]) {
        topicMap[topicName] = {
          subject: exam.subject,
          totalAttempts: 0,
          totalCorrect: 0,
          questions: new Set<string>()
        };
      }
      topicMap[topicName].totalAttempts += totalResponses;
      topicMap[topicName].totalCorrect += timesCorrect;
      topicMap[topicName].questions.add(qItem.id);
    });
  });

  const mostMissedQuestions = [...statsList]
    .filter(q => q.timesAttempted + q.timesUnanswered > 0)
    .sort((a, b) => a.percentageCorrect - b.percentageCorrect)
    .slice(0, 10);

  const topicPerformance: TopicPerformanceItem[] = Object.entries(topicMap).map(([topic, data]) => {
    const percentageCorrect = data.totalAttempts > 0 ? Math.round((data.totalCorrect / data.totalAttempts) * 100) : 0;
    let performanceTier: 'High Mastery' | 'Moderate' | 'Needs Attention' = 'Moderate';
    if (percentageCorrect >= 75) performanceTier = 'High Mastery';
    else if (percentageCorrect < 50) performanceTier = 'Needs Attention';

    return {
      topic,
      subject: data.subject,
      totalQuestions: data.questions.size,
      totalAttempts: data.totalAttempts,
      totalCorrect: data.totalCorrect,
      percentageCorrect,
      performanceTier
    };
  }).sort((a, b) => a.percentageCorrect - b.percentageCorrect);

  const overallAccuracy = totalAllAttempts > 0 ? Math.round((totalAllCorrect / totalAllAttempts) * 100) : 0;

  return {
    questionStats: statsList,
    mostMissedQuestions,
    topicPerformance,
    overallAccuracy
  };
}

/**
 * Computes School-Wide and Class Comparison Analytics, including Assessment Participation
 */
export function calculateSchoolAndClassAnalytics(
  results: Result[],
  students: Student[],
  attendance: Attendance[],
  exams: Exam[] = []
) {
  const studentMap = new Map<string, Student>();
  students.forEach(s => studentMap.set(s.id, s));

  const attendanceMap = new Map<string, number>();
  attendance.forEach(a => attendanceMap.set(a.studentId, a.percent));

  // Class aggregations
  const classMap: Record<string, { totalPct: number; count: number; studentIds: Set<string>; high: number; low: number }> = {};
  
  // Subject aggregations
  const subjectMap: Record<string, { totalPct: number; count: number }> = {};

  // Pass vs Fail distribution (benchmark: 50%)
  let passCount = 0;
  let failCount = 0;

  // Grade distributions (A, B, C, D, E, F)
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

  // Student summaries
  const studentSummaryMap: Record<string, { student: Student; totalPct: number; count: number; high: number; low: number; pass: number; fail: number; subjects: Record<string, { sum: number; count: number }> }> = {};

  results.forEach(r => {
    const pct = getResultPercentage(r);
    const student = studentMap.get(r.studentId);
    const className = student?.class || 'Unassigned';

    // Class map
    if (!classMap[className]) {
      classMap[className] = { totalPct: 0, count: 0, studentIds: new Set(), high: 0, low: 100 };
    }
    classMap[className].totalPct += pct;
    classMap[className].count += 1;
    classMap[className].studentIds.add(r.studentId);
    if (pct > classMap[className].high) classMap[className].high = pct;
    if (pct < classMap[className].low) classMap[className].low = pct;

    // Subject map
    if (!subjectMap[r.subject]) {
      subjectMap[r.subject] = { totalPct: 0, count: 0 };
    }
    subjectMap[r.subject].totalPct += pct;
    subjectMap[r.subject].count += 1;

    // Pass / Fail
    if (pct >= 50) passCount++;
    else failCount++;

    // Grades
    if (pct >= 75) gradeCounts.A++;
    else if (pct >= 65) gradeCounts.B++;
    else if (pct >= 55) gradeCounts.C++;
    else if (pct >= 45) gradeCounts.D++;
    else if (pct >= 40) gradeCounts.E++;
    else gradeCounts.F++;

    // Student performance tracking
    if (student) {
      if (!studentSummaryMap[r.studentId]) {
        studentSummaryMap[r.studentId] = {
          student,
          totalPct: 0,
          count: 0,
          high: 0,
          low: 100,
          pass: 0,
          fail: 0,
          subjects: {}
        };
      }
      studentSummaryMap[r.studentId].totalPct += pct;
      studentSummaryMap[r.studentId].count += 1;
      if (pct > studentSummaryMap[r.studentId].high) studentSummaryMap[r.studentId].high = pct;
      if (pct < studentSummaryMap[r.studentId].low) studentSummaryMap[r.studentId].low = pct;
      if (pct >= 50) studentSummaryMap[r.studentId].pass++;
      else studentSummaryMap[r.studentId].fail++;

      if (!studentSummaryMap[r.studentId].subjects[r.subject]) {
        studentSummaryMap[r.studentId].subjects[r.subject] = { sum: 0, count: 0 };
      }
      studentSummaryMap[r.studentId].subjects[r.subject].sum += pct;
      studentSummaryMap[r.studentId].subjects[r.subject].count += 1;
    }
  });

  // Calculate student profiles
  const studentSummaries: StudentPerformanceSummary[] = Object.values(studentSummaryMap).map(item => {
    const avg = item.count > 0 ? Math.round(item.totalPct / item.count) : 0;
    
    // Sort subjects
    const subList = Object.entries(item.subjects).map(([sub, d]) => ({
      subject: sub,
      avg: Math.round(d.sum / d.count)
    })).sort((a, b) => b.avg - a.avg);

    const strongestSubject = subList.length > 0 ? subList[0].subject : 'None';
    const weakestSubject = subList.length > 0 ? subList[subList.length - 1].subject : 'None';
    const passRate = item.count > 0 ? Math.round((item.pass / item.count) * 100) : 0;
    const attPct = attendanceMap.get(item.student.id) ?? null;

    return {
      studentId: item.student.id,
      studentName: item.student.name,
      studentClass: item.student.class,
      photo: item.student.photo,
      totalExams: item.count,
      averagePercentage: avg,
      highestPercentage: item.high,
      lowestPercentage: item.low === 100 && item.count === 0 ? 0 : item.low,
      strongestSubject,
      weakestSubject,
      passCount: item.pass,
      failCount: item.fail,
      passRate,
      attendancePercent: attPct,
      needsIntervention: avg < 50 || item.fail > item.pass
    };
  });

  const topPerformingStudents = [...studentSummaries]
    .sort((a, b) => b.averagePercentage - a.averagePercentage)
    .slice(0, 10);

  const studentsNeedingIntervention = [...studentSummaries]
    .filter(s => s.needsIntervention)
    .sort((a, b) => a.averagePercentage - b.averagePercentage);

  // Class Comparison Table data
  const classComparison = Object.entries(classMap).map(([className, data]) => ({
    className,
    average: Math.round(data.totalPct / data.count),
    studentCount: data.studentIds.size,
    totalAssessments: data.count,
    highestPercentage: data.high,
    lowestPercentage: data.low
  })).sort((a, b) => b.average - a.average);

  // Subject Comparison Table data
  const subjectComparison = Object.entries(subjectMap).map(([subject, data]) => ({
    subject,
    average: Math.round(data.totalPct / data.count),
    totalSubmissions: data.count
  })).sort((a, b) => b.average - a.average);

  // School-wide average
  const totalSchoolPct = results.reduce((sum, r) => sum + getResultPercentage(r), 0);
  const schoolWideAverage = results.length > 0 ? Math.round(totalSchoolPct / results.length) : 0;

  // Attendance vs Performance correlation brackets
  const highAttStudents = studentSummaries.filter(s => s.attendancePercent !== null && s.attendancePercent >= 90);
  const modAttStudents = studentSummaries.filter(s => s.attendancePercent !== null && s.attendancePercent >= 75 && s.attendancePercent < 90);
  const lowAttStudents = studentSummaries.filter(s => s.attendancePercent !== null && s.attendancePercent < 75);

  const avgFromList = (list: StudentPerformanceSummary[]) =>
    list.length > 0 ? Math.round(list.reduce((sum, s) => sum + s.averagePercentage, 0) / list.length) : 0;

  const attendancePerformanceCorrelation = {
    highAttendanceAvg: avgFromList(highAttStudents),
    highAttendanceCount: highAttStudents.length,
    moderateAttendanceAvg: avgFromList(modAttStudents),
    moderateAttendanceCount: modAttStudents.length,
    lowAttendanceAvg: avgFromList(lowAttStudents),
    lowAttendanceCount: lowAttStudents.length
  };

  // Assessment Participation Calculations
  const uniqueParticipatingStudentIds = new Set(results.map(r => r.studentId));
  const totalEnrolledStudents = students.length;
  const overallParticipationRate = totalEnrolledStudents > 0
    ? Math.round((uniqueParticipatingStudentIds.size / totalEnrolledStudents) * 100)
    : 0;

  const examParticipation = exams.map(e => {
    const eligibleStudents = students.filter(s =>
      e.targetClasses && e.targetClasses.length > 0
        ? e.targetClasses.some(c => isStudentInTeacherClasses(s.class, [c]))
        : true
    );
    const examResults = results.filter(r => String(r.examId) === String(e.id));
    const uniqueParticipants = new Set(examResults.map(r => r.studentId));
    const rate = eligibleStudents.length > 0
      ? Math.round((uniqueParticipants.size / eligibleStudents.length) * 100)
      : 0;
    const avgScore = examResults.length > 0
      ? Math.round(examResults.reduce((sum, r) => sum + getResultPercentage(r), 0) / examResults.length)
      : 0;

    return {
      examId: e.id,
      examTitle: e.title,
      subject: e.subject,
      targetClasses: e.targetClasses || [],
      eligibleCount: eligibleStudents.length,
      participatedCount: uniqueParticipants.size,
      participationRate: rate,
      averageScore: avgScore
    };
  }).sort((a, b) => b.participationRate - a.participationRate);

  const classParticipation = Object.entries(
    students.reduce<Record<string, { enrolled: number; participants: Set<string> }>>((acc, s) => {
      const cls = s.class || 'Unassigned';
      if (!acc[cls]) acc[cls] = { enrolled: 0, participants: new Set() };
      acc[cls].enrolled += 1;
      if (uniqueParticipatingStudentIds.has(s.id)) {
        acc[cls].participants.add(s.id);
      }
      return acc;
    }, {})
  ).map(([className, info]) => ({
    className,
    enrolledCount: info.enrolled,
    participatedCount: info.participants.size,
    participationRate: info.enrolled > 0 ? Math.round((info.participants.size / info.enrolled) * 100) : 0
  })).sort((a, b) => b.participationRate - a.participationRate);

  return {
    schoolWideAverage,
    totalResultsCount: results.length,
    passCount,
    failCount,
    passRate: results.length > 0 ? Math.round((passCount / results.length) * 100) : 0,
    gradeCounts,
    classComparison,
    subjectComparison,
    topPerformingStudents,
    studentsNeedingIntervention,
    studentSummaries,
    attendancePerformanceCorrelation,
    participation: {
      totalEnrolledStudents,
      uniqueParticipantsCount: uniqueParticipatingStudentIds.size,
      overallParticipationRate,
      examParticipation,
      classParticipation
    }
  };
}

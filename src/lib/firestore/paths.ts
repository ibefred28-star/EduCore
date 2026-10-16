/**
 * EduCore Firebase Architecture - Firestore Path Hierarchy
 * Canonical, strongly-typed path builders enforcing multi-school/tenant isolation.
 */

export const FirestorePaths = {
  // Global Super Admin Directory
  globalTenants: () => 'globalTenants',
  globalTenant: (schoolId: string) => `globalTenants/${cleanId(schoolId)}`,

  // School Root & Metadata
  school: (schoolId: string) => `schools/${cleanId(schoolId)}`,

  // Subcollections scoped under a specific school
  users: (schoolId: string) => `schools/${cleanId(schoolId)}/users`,
  user: (schoolId: string, userId: string) => `schools/${cleanId(schoolId)}/users/${cleanId(userId)}`,

  students: (schoolId: string) => `schools/${cleanId(schoolId)}/students`,
  student: (schoolId: string, studentId: string) => `schools/${cleanId(schoolId)}/students/${cleanId(studentId)}`,

  teachers: (schoolId: string) => `schools/${cleanId(schoolId)}/teachers`,
  teacher: (schoolId: string, teacherId: string) => `schools/${cleanId(schoolId)}/teachers/${cleanId(teacherId)}`,

  classes: (schoolId: string) => `schools/${cleanId(schoolId)}/classes`,
  classDoc: (schoolId: string, classId: string) => `schools/${cleanId(schoolId)}/classes/${cleanId(classId)}`,

  subjects: (schoolId: string) => `schools/${cleanId(schoolId)}/subjects`,
  subjectDoc: (schoolId: string, subjectId: string) => `schools/${cleanId(schoolId)}/subjects/${cleanId(subjectId)}`,

  questionBanks: (schoolId: string) => `schools/${cleanId(schoolId)}/questionBanks`,
  questionBankDoc: (schoolId: string, questionId: string) => `schools/${cleanId(schoolId)}/questionBanks/${cleanId(questionId)}`,

  // Exams (Sanitized for candidates - Answer keys stripped)
  exams: (schoolId: string) => `schools/${cleanId(schoolId)}/exams`,
  exam: (schoolId: string, examId: string | number) => `schools/${cleanId(schoolId)}/exams/${cleanId(examId)}`,

  // Confidential Answer Keys (Exclusively accessible by Cloud Functions / Admins)
  examKeys: (schoolId: string) => `schools/${cleanId(schoolId)}/examKeys`,
  examKey: (schoolId: string, examId: string | number) => `schools/${cleanId(schoolId)}/examKeys/${cleanId(examId)}`,

  // Student Active Attempts & Autosaves
  attempts: (schoolId: string) => `schools/${cleanId(schoolId)}/attempts`,
  attempt: (schoolId: string, attemptId: string) => `schools/${cleanId(schoolId)}/attempts/${cleanId(attemptId)}`,

  // Authoritative Graded Results
  results: (schoolId: string) => `schools/${cleanId(schoolId)}/results`,
  result: (schoolId: string, resultId: string | number) => `schools/${cleanId(schoolId)}/results/${cleanId(resultId)}`,

  // Attendance Records
  attendance: (schoolId: string) => `schools/${cleanId(schoolId)}/attendance`,
  attendanceDoc: (schoolId: string, attendanceId: string) => `schools/${cleanId(schoolId)}/attendance/${cleanId(attendanceId)}`,

  // Announcements
  announcements: (schoolId: string) => `schools/${cleanId(schoolId)}/announcements`,
  announcement: (schoolId: string, announcementId: string) => `schools/${cleanId(schoolId)}/announcements/${cleanId(announcementId)}`,

  // School Settings & Grading Rubrics
  settings: (schoolId: string) => `schools/${cleanId(schoolId)}/settings`,
  settingsDoc: (schoolId: string) => `schools/${cleanId(schoolId)}/settings/configuration`,

  // Real-time Candidate Monitoring & Presence
  liveSessions: (schoolId: string) => `schools/${cleanId(schoolId)}/liveSessions`,
  liveSession: (schoolId: string, sessionId: string) => `schools/${cleanId(schoolId)}/liveSessions/${cleanId(sessionId)}`,

  // Continuous Assessment (CA1 & CA2) Records
  assessments: (schoolId: string) => `schools/${cleanId(schoolId)}/assessments`,
  assessmentDoc: (schoolId: string, assessmentId: string) => `schools/${cleanId(schoolId)}/assessments/${cleanId(assessmentId)}`,

  // Learning Resources (Documents, Diagrams, Books, Links, Notes)
  learningResources: (schoolId: string) => `schools/${cleanId(schoolId)}/learningResources`,
  learningResource: (schoolId: string, resourceId: string) => `schools/${cleanId(schoolId)}/learningResources/${cleanId(resourceId)}`,

  // Immutable Audit Log Trail
  auditLogs: (schoolId: string) => `schools/${cleanId(schoolId)}/auditLogs`,
  auditLog: (schoolId: string, logId: string) => `schools/${cleanId(schoolId)}/auditLogs/${cleanId(logId)}`
};

/**
 * Sanitizes identifier tokens to ensure valid Firestore document paths
 */
export function cleanId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return 'default';
  return String(id).trim().toLowerCase().replace(/\//g, '_');
}

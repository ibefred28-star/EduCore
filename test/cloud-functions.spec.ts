/**
 * EduCore Cloud Functions Security & Authorization Test Matrix
 * Asserts server-side verification, authoritative grading, and privileged RBAC rules.
 */

export interface FunctionsTestCase {
  id: number;
  functionName: 'startExamAttempt' | 'submitExamAttempt' | 'createSchoolUser' | 'autoSubmitExpiredExams';
  description: string;
  caller: {
    authenticated: boolean;
    role?: 'student' | 'teacher' | 'admin' | 'superadmin';
    schoolId?: string;
    userId?: string;
  };
  payload: any;
  expectedStatus: 'SUCCESS' | 'ERROR';
  expectedErrorCode?: string;
}

export const FUNCTIONS_SECURITY_TEST_MATRIX: FunctionsTestCase[] = [
  {
    id: 1,
    functionName: 'createSchoolUser',
    description: 'Unauthenticated callers are rejected',
    caller: { authenticated: false },
    payload: { schoolId: 'greenwood', userId: 'new_teacher', role: 'teacher' },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'unauthenticated'
  },
  {
    id: 2,
    functionName: 'createSchoolUser',
    description: 'Students cannot invoke privileged administrative user provisioning',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'greenwood', userId: 'new_admin', role: 'admin' },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'permission-denied'
  },
  {
    id: 3,
    functionName: 'startExamAttempt',
    description: 'Teachers/Students cannot start exams belonging to another school',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'riverside', examId: 'EXAM1' },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'permission-denied'
  },
  {
    id: 4,
    functionName: 'createSchoolUser',
    description: 'School administrators cannot administer another school',
    caller: { authenticated: true, role: 'admin', schoolId: 'greenwood', userId: 'admin' },
    payload: { schoolId: 'riverside', userId: 'teacher_riv', role: 'teacher' },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'permission-denied'
  },
  {
    id: 5,
    functionName: 'submitExamAttempt',
    description: 'Students cannot submit attempts for another student',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'greenwood', attemptId: 'attempt_EXAM1_stu002_1', examId: 'EXAM1', answers: {} },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'permission-denied'
  },
  {
    id: 6,
    functionName: 'startExamAttempt',
    description: 'Unpublished or draft exams cannot be started by candidates',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'greenwood', examId: 'DRAFT_EXAM' },
    expectedStatus: 'ERROR',
    expectedErrorCode: 'failed-precondition'
  },
  {
    id: 7,
    functionName: 'startExamAttempt',
    description: 'Duplicate start requests within attempt limit return existing in-progress attempt (Idempotent resume)',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'greenwood', examId: 'EXAM1' },
    expectedStatus: 'SUCCESS'
  },
  {
    id: 8,
    functionName: 'submitExamAttempt',
    description: 'Client-supplied score is ignored; authoritative score is computed strictly from examKeys',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: {
      schoolId: 'greenwood',
      attemptId: 'attempt_EXAM1_stu001_1',
      examId: 'EXAM1',
      answers: { 0: 1, 1: 1 },
      clientScore: 100 // Ignored by server!
    },
    expectedStatus: 'SUCCESS'
  },
  {
    id: 9,
    functionName: 'submitExamAttempt',
    description: 'Repeated submissions return the cached official result without creating duplicates',
    caller: { authenticated: true, role: 'student', schoolId: 'greenwood', userId: 'stu001' },
    payload: { schoolId: 'greenwood', attemptId: 'attempt_EXAM1_stu001_1', examId: 'EXAM1', answers: {} },
    expectedStatus: 'SUCCESS'
  },
  {
    id: 10,
    functionName: 'createSchoolUser',
    description: 'Invalid payloads missing required parameters are rejected with invalid-argument',
    caller: { authenticated: true, role: 'admin', schoolId: 'greenwood', userId: 'admin' },
    payload: { schoolId: 'greenwood' }, // Missing userId, name, role
    expectedStatus: 'ERROR',
    expectedErrorCode: 'invalid-argument'
  }
];

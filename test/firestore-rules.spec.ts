/**
 * EduCore Firestore Security Rules Test Suite
 * Formal test matrix asserting Zero-Trust and Attribute-Based Access Control (ABAC) boundaries.
 */

export interface TestAuthContext {
  uid: string;
  email: string;
  token?: {
    schoolId?: string;
    role?: 'student' | 'teacher' | 'admin' | 'superadmin';
    userId?: string;
  };
}

export interface SecurityTestCase {
  id: number;
  description: string;
  auth: TestAuthContext | null;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload?: any;
  expectedOutcome: 'ALLOW' | 'DENY';
}

export const FIRESTORE_SECURITY_TEST_MATRIX: SecurityTestCase[] = [
  {
    id: 1,
    description: 'Unauthenticated read of protected student records must be DENIED',
    auth: null,
    path: 'schools/greenwood/students/STU001',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 2,
    description: 'A student can read their own user profile in their school',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/greenwood/users/stu001',
    operation: 'get',
    expectedOutcome: 'ALLOW'
  },
  {
    id: 3,
    description: 'A student CANNOT read another student private user profile',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/greenwood/users/stu002',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 4,
    description: 'A student CANNOT read data from a different school',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/riverside/exams/EXAM1',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 5,
    description: 'A student CANNOT elevate their role to admin in user profile update',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/greenwood/users/stu001',
    operation: 'update',
    payload: { role: 'admin' },
    expectedOutcome: 'DENY'
  },
  {
    id: 6,
    description: 'A student CANNOT directly create or forge an official result record',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/greenwood/results/res_EXAM1_stu001',
    operation: 'create',
    payload: { score: 100, percentage: 100 },
    expectedOutcome: 'DENY'
  },
  {
    id: 7,
    description: 'A student CANNOT read confidential exam answer keys',
    auth: {
      uid: 'stu_001_uid',
      email: 'greenwood.student.stu001@educore.internal',
      token: { schoolId: 'greenwood', role: 'student', userId: 'stu001' }
    },
    path: 'schools/greenwood/examKeys/EXAM1',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 8,
    description: 'A teacher CANNOT access an unauthorized school question bank',
    auth: {
      uid: 'teacher_001_uid',
      email: 'greenwood.teacher.teacher1@educore.internal',
      token: { schoolId: 'greenwood', role: 'teacher', userId: 'teacher1' }
    },
    path: 'schools/riverside/questionBanks/q1',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 9,
    description: 'A teacher CANNOT modify school settings or grading rubrics',
    auth: {
      uid: 'teacher_001_uid',
      email: 'greenwood.teacher.teacher1@educore.internal',
      token: { schoolId: 'greenwood', role: 'teacher', userId: 'teacher1' }
    },
    path: 'schools/greenwood/settings/configuration',
    operation: 'update',
    payload: { ca1: 50 },
    expectedOutcome: 'DENY'
  },
  {
    id: 10,
    description: 'A school admin CANNOT manage another school resources',
    auth: {
      uid: 'admin_greenwood_uid',
      email: 'greenwood.admin.admin@educore.internal',
      token: { schoolId: 'greenwood', role: 'admin', userId: 'admin' }
    },
    path: 'schools/riverside/settings/configuration',
    operation: 'update',
    payload: { passmark: 40 },
    expectedOutcome: 'DENY'
  },
  {
    id: 11,
    description: 'An authorized school admin CAN update their own school settings',
    auth: {
      uid: 'admin_greenwood_uid',
      email: 'greenwood.admin.admin@educore.internal',
      token: { schoolId: 'greenwood', role: 'admin', userId: 'admin' }
    },
    path: 'schools/greenwood/settings/configuration',
    operation: 'update',
    payload: { ca1: 20 },
    expectedOutcome: 'ALLOW'
  },
  {
    id: 12,
    description: 'A super admin CAN update global tenant records',
    auth: {
      uid: 'superadmin_uid',
      email: 'superadmin@educore.internal',
      token: { role: 'superadmin', userId: 'superadmin' }
    },
    path: 'globalTenants/greenwood',
    operation: 'update',
    payload: { status: 'suspended' },
    expectedOutcome: 'ALLOW'
  },
  {
    id: 13,
    description: 'A user without a valid school assignment is denied school-specific access',
    auth: {
      uid: 'unassigned_uid',
      email: 'guest@external.com',
      token: {}
    },
    path: 'schools/greenwood/students/STU001',
    operation: 'get',
    expectedOutcome: 'DENY'
  },
  {
    id: 14,
    description: 'Direct modifications to immutable audit logs are DENIED to everyone',
    auth: {
      uid: 'admin_greenwood_uid',
      email: 'greenwood.admin.admin@educore.internal',
      token: { schoolId: 'greenwood', role: 'admin', userId: 'admin' }
    },
    path: 'schools/greenwood/auditLogs/log_123',
    operation: 'update',
    payload: { action: 'TAMPERED' },
    expectedOutcome: 'DENY'
  },
  {
    id: 15,
    description: 'Unrestricted reads and writes to undefined root paths are DENIED',
    auth: null,
    path: 'arbitrary_root_collection/doc123',
    operation: 'get',
    expectedOutcome: 'DENY'
  }
];

import { Role, Grade } from '../../types';

export interface FirestoreSchoolDoc {
  schoolName: string;
  motto: string;
  address?: string;
  phone?: string;
  principal?: string;
  logo?: string;
  primary: string;
  secondary: string;
  accent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreUserDoc {
  uid: string;
  schoolId: string;
  username: string;
  name: string;
  email: string;
  role: Role | 'superadmin';
  classes?: string[];
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreGlobalTenantDoc {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreSettingsDoc {
  ca1: number;
  ca2: number;
  exam: number;
  violationLimit: number;
  grades?: Grade[];
  updatedAt: string;
}

export interface FirestoreExamKeyDoc {
  examId: string | number;
  schoolId: string;
  questions: Array<{
    qIndex: number;
    ans?: number | boolean;
    answer?: string;
    answers?: string[];
    marks?: number;
  }>;
  updatedAt: string;
}

export interface FirestoreAttemptDoc {
  id: string;
  examId: string | number;
  studentId: string;
  studentName: string;
  studentClass: string;
  schoolId: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';
  startTime: string;
  expiryTime: string;
  submittedAt?: string;
  answers: Record<number, any>;
  currentQuestionIndex: number;
  violationsCount: number;
  lastHeartbeat: number;
  updatedAt: number;
}

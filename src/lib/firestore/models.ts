import { Role, Grade, QuestionType, QuestionDifficulty, BankQuestionStatus } from '../../types';

export interface FirestoreStudentDoc {
  id: string;
  uid?: string;
  schoolId: string;
  name: string;
  class: string;
  photo?: string;
  reportTerm?: string;
  reportSession?: string;
  guardianEmail?: string;
  position?: string;
  nextTerm?: string;
  teacherName?: string;
  teacherComment?: string;
  principalComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreTeacherDoc {
  id: string;
  uid?: string;
  schoolId: string;
  name: string;
  email?: string;
  subjects: string[];
  classes: string[];
  photo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreClassDoc {
  id: string;
  schoolId: string;
  name: string;
  category?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreSubjectDoc {
  id: string;
  schoolId: string;
  name: string;
  code?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreQuestionBankDoc {
  id: string;
  schoolId: string;
  type: QuestionType;
  q: string;
  subject: string;
  class: string;
  topic: string;
  subtopic?: string;
  difficulty: QuestionDifficulty;
  tags: string[];
  options?: string[];
  // Confidential Answer Key fields (Teacher and Admin access only)
  ans?: number | boolean;
  answers?: string[];
  answer?: string;
  marks: number;
  explanation?: string;
  image?: string;
  status: BankQuestionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sanitized question representation for student candidates.
 * Strips correct answers, answer arrays, and pedagogical solutions.
 */
export interface SanitizedExamQuestion {
  id: string;
  type: QuestionType;
  q: string;
  options?: string[];
  image?: string;
  marks: number;
}

export interface FirestoreExamDoc {
  id: string;
  schoolId: string;
  title: string;
  subject: string;
  type: string;
  duration: number;
  attempts: number;
  status: 'active' | 'draft' | 'scheduled' | 'closed';
  start?: string;
  targetClasses: string[];
  totalMarks?: number;
  instructions?: string;
  questions: SanitizedExamQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Confidential answer key stored in isolated subcollection schools/{schoolId}/examKeys/{examId}
 * Exclusively readable/accessible by Cloud Functions and School Administrators.
 */
export interface FirestoreExamKeyDoc {
  examId: string;
  schoolId: string;
  keys: Array<{
    qIndex: number;
    type: QuestionType;
    ans?: number | boolean;
    answers?: string[];
    answer?: string;
    marks: number;
  }>;
  updatedAt: string;
}

export interface FirestoreAttemptDoc {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  schoolId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';
  startTime: string;
  startedAt?: string;
  expiryTime: string;
  submittedAt?: string;
  answers: Record<number, any>;
  currentQuestionIndex: number;
  violationsCount: number;
  lastHeartbeat: number;
  gradingStatus?: 'pending' | 'in_progress' | 'graded';
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreResultDoc {
  id: string;
  examId: string;
  studentId: string;
  schoolId: string;
  subject: string;
  type: string;
  raw: number;
  rawMax: number;
  scaled: number | null;
  max: number | null;
  percentage: number;
  grade: string;
  remark: string;
  gradingStatus?: 'final' | 'pending_manual';
  breakdown?: any[];
  teacherFeedback?: string;
  finalizedBy?: string;
  attempt: number;
  attemptsAllowed: number;
  violations: number;
  submittedAt: string;
  gradedAt: string;
}

export interface FirestoreAttendanceDoc {
  id: string;
  schoolId: string;
  studentId: string;
  class: string;
  days: number;
  present: number;
  absent: number;
  percent: number;
  term?: string;
  session?: string;
  updatedAt: string;
}

export interface FirestoreAnnouncementDoc {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  targetRoles: Array<'student' | 'teacher' | 'admin'>;
  createdBy: string;
  createdAt: string;
}

export interface FirestoreAssessmentDoc {
  id: string;
  schoolId: string;
  studentId: string;
  studentUid?: string;
  studentName?: string;
  classId: string;
  subjectId: string;
  academicSessionId: string;
  termId: string;
  assessmentType: 'CA1' | 'CA2';
  score: number;
  maximumScore: number;
  status: 'draft' | 'submitted' | 'locked';
  enteredBy: {
    uid?: string;
    id?: string;
    name: string;
    email?: string;
    role: string;
  };
  enteredAt: string;
  updatedBy?: {
    uid?: string;
    id?: string;
    name: string;
    email?: string;
    role: string;
  };
  updatedAt?: string;
}

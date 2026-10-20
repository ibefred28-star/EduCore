export type Role = 'student' | 'teacher' | 'admin' | 'superadmin';

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  status?: 'active' | 'suspended';
}

export interface UserBase {
  id: string;
  name: string;
  uid?: string;
  email?: string;
  password?: string;
}

export interface Student extends UserBase {
  class: string;
  photo?: string;
  reportTerm?: string;
  reportSession?: string;
  position?: string;
  nextTerm?: string;
  teacherName?: string;
  teacherComment?: string;
  principalComment?: string;
  teacherSignature?: string;
  principalSignature?: string;
  ca1TeacherComment?: string;
  ca1PrincipalComment?: string;
  ca1Position?: string;
  ca2TeacherComment?: string;
  ca2PrincipalComment?: string;
  ca2Position?: string;
  aflTeacherComment?: string;
  aflPrincipalComment?: string;
}

export interface Teacher extends UserBase {
  subjects: string[];
  classes: string[];
  pupils?: string[];
}

export interface Admin extends UserBase {}

export type User = Student | Teacher | Admin;

export type QuestionType = 'mcq' | 'fill_blank' | 'true_false' | 'diagram';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type BankQuestionStatus = 'active' | 'draft' | 'archived';

export interface BankQuestion {
  id: string;
  type: QuestionType;
  q: string;
  subject: string;
  class: string;
  topic: string;
  subtopic: string;
  difficulty: QuestionDifficulty;
  tags: string[];
  options?: string[];
  ans?: number | boolean;
  answers?: string[];
  answer?: string;
  explanation?: string;
  image?: string;
  marks: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: BankQuestionStatus;
}

export interface Question {
  id?: string;
  bankQuestionId?: string;
  type: QuestionType;
  q: string;
  options?: string[];
  ans?: number | boolean;
  answers?: string[];
  answer?: string;
  image?: string;
  marks?: number;
  explanation?: string;
  subject?: string;
  class?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: QuestionDifficulty;
}

export interface Exam {
  id: string | number;
  title: string;
  subject: string;
  type: string;
  duration: number;
  attempts: number;
  status: 'active' | 'draft' | 'scheduled' | 'closed';
  start?: string;
  targetClasses?: string[];
  questions: Question[];
  createdBy: string;
}

export interface Result {
  id: string | number;
  studentId: string;
  examId: string | number;
  subject: string;
  type: string;
  raw: number;
  rawMax: number;
  scaled: number | null;
  max: number | null;
  percentage?: number;
  grade?: string;
  remark?: string;
  gradingStatus?: 'final' | 'pending_manual';
  breakdown?: any[];
  teacherFeedback?: string;
  finalizedBy?: string;
  gradedAt?: string;
  violations: number;
  answers: Record<number, any>;
  attempt: number;
  attemptsAllowed: number;
  submittedAt: string;
}

export interface Attendance {
  studentId: string;
  days: number;
  present: number;
  absent: number;
  percent: number;
}

export type AssessmentType = 'CA1' | 'CA2';
export type AssessmentStatus = 'draft' | 'submitted' | 'locked';

export interface AssessmentRecord {
  id: string; // deterministic: `${studentId}_${subjectId}_${assessmentType}_${academicSessionId}_${termId}`
  schoolId: string;
  studentId: string;
  studentUid?: string;
  studentName?: string;
  classId: string;
  subjectId: string;
  academicSessionId: string;
  termId: string;
  assessmentType: AssessmentType;
  score: number; // 0 to 20
  maximumScore: number; // 20
  status: AssessmentStatus;
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

export type LearningResourceType = 'document' | 'pdf' | 'image' | 'diagram' | 'book' | 'link' | 'notes';

export interface LearningResource {
  id: string;
  title: string;
  description?: string;
  type: LearningResourceType;
  subject: string;
  targetClass: string; // 'All' or specific class e.g. 'JSS 1', 'SS 2'
  topic?: string;
  tags?: string[];
  content?: string; // Text content, chapter text, transcript, study guide notes - used for Read Aloud
  linkUrl?: string; // For web links / external references
  fileUrl?: string; // Base64 data URL or external URL for images/diagrams/PDFs/books
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdBy: string;
  teacherId?: string;
  teacherName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppData {
  students: Student[];
  teachers: Teacher[];
  admins: Admin[];
  subjects: string[];
  exams: Exam[];
  results: Result[];
  attendance: Attendance[];
  questions: BankQuestion[];
  assessments?: AssessmentRecord[];
  learningResources?: LearningResource[];
}

export interface Branding {
  schoolName: string;
  motto: string;
  address: string;
  phone: string;
  principal: string;
  primary: string;
  secondary: string;
  accent: string;
  logo: string;
}

export interface Grade {
  min: number;
  grade: string;
  remark: string;
}

export interface Config {
  ca1: number;
  ca2: number;
  exam: number;
  violationLimit: number;
  grades: Grade[];
}

export interface SyncConfig {
  url: string;
  key: string;
}

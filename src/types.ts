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
}

export interface Teacher extends UserBase {
  subjects: string[];
  classes: string[];
}

export interface Admin extends UserBase {}

export type User = Student | Teacher | Admin;

export type QuestionType = 'mcq' | 'fill_blank' | 'true_false' | 'diagram';

export interface Question {
  type: QuestionType;
  q: string;
  options?: string[];
  ans?: number | boolean;
  answers?: string[];
  answer?: string;
  image?: string;
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

export interface AppData {
  students: Student[];
  teachers: Teacher[];
  admins: Admin[];
  subjects: string[];
  exams: Exam[];
  results: Result[];
  attendance: Attendance[];
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

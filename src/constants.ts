import { AppData, Branding, Config } from './types';

export const DEFAULT_BRANDING: Branding = {
  schoolName: 'EduCore School',
  motto: 'Excellence Through Learning',
  address: '123 Education St, Lagos',
  phone: '',
  principal: 'Dr. A. Bello',
  primary: '#1e3a8a',
  secondary: '#f59e0b',
  accent: '#10b981',
  logo: ''
};

export const DEFAULT_CONFIG: Config = {
  ca1: 20,
  ca2: 20,
  exam: 60,
  violationLimit: 3,
  grades: [
    { min: 75, grade: 'A', remark: 'Excellent' },
    { min: 65, grade: 'B', remark: 'Very Good' },
    { min: 55, grade: 'C', remark: 'Good' },
    { min: 45, grade: 'D', remark: 'Fair' },
    { min: 40, grade: 'E', remark: 'Pass' },
    { min: 0, grade: 'F', remark: 'Fail' }
  ]
};

export const DEFAULT_DATA: AppData = {
  students: [
    { id: 'STU001', name: 'Aisha Bello', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU002', name: 'Chukwudi Eze', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU003', name: 'Fatima Ibrahim', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU004', name: 'Emmanuel Adeyemi', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU005', name: 'Zainab Danjuma', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU006', name: 'David Adeleke', class: 'JSS2', password: 'pass', photo: '' }
  ],
  teachers: [
    { id: 'teacher1', name: 'Mr. Okafor', password: 'pass', subjects: ['Math', 'English', 'Basic Science'], classes: ['Primary 5'] },
    { id: 'teacher2', name: 'Mrs. Adewale', password: 'pass', subjects: ['Math'], classes: ['JSS2'] }
  ],
  admins: [{ id: 'admin', name: 'Administrator', password: 'admin' }],
  subjects: ['Math', 'English', 'Basic Science'],
  exams: [
    {
      id: 'EXAM1',
      title: 'Primary 5 Mathematics Assessment',
      subject: 'Math',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['Primary 5'],
      createdBy: 'teacher1',
      questions: [
        { type: 'mcq', q: 'What is 15 + 27?', options: ['32', '42', '52', '40'], ans: 1 },
        { type: 'mcq', q: 'What is 8 x 7?', options: ['54', '56', '64', '48'], ans: 1 }
      ]
    },
    {
      id: 'EXAM_JSS2',
      title: 'JSS2 Mathematics Test',
      subject: 'Math',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['JSS2'],
      createdBy: 'teacher2',
      questions: [
        { type: 'mcq', q: 'Solve for x: 2x + 4 = 10', options: ['2', '3', '4', '5'], ans: 1 }
      ]
    }
  ],
  results: [
    { id: 'RES1', studentId: 'STU001', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 20, rawMax: 20, scaled: 20, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES2', studentId: 'STU002', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 18, rawMax: 20, scaled: 18, max: 20, violations: 0, answers: { 0: 1, 1: 0 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES3', studentId: 'STU003', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 19, rawMax: 20, scaled: 19, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES4', studentId: 'STU004', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 16, rawMax: 20, scaled: 16, max: 20, violations: 0, answers: { 0: 1, 1: 0 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES5', studentId: 'STU005', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 20, rawMax: 20, scaled: 20, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES6', studentId: 'STU006', examId: 'EXAM_JSS2', subject: 'Math', type: 'CA 1', raw: 15, rawMax: 20, scaled: 15, max: 20, violations: 0, answers: { 0: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' }
  ],
  attendance: [
    { studentId: 'STU001', days: 60, present: 58, absent: 2, percent: 96.67 },
    { studentId: 'STU002', days: 60, present: 57, absent: 3, percent: 95.0 },
    { studentId: 'STU003', days: 60, present: 60, absent: 0, percent: 100.0 },
    { studentId: 'STU004', days: 60, present: 55, absent: 5, percent: 91.67 },
    { studentId: 'STU005', days: 60, present: 59, absent: 1, percent: 98.33 },
    { studentId: 'STU006', days: 60, present: 50, absent: 10, percent: 83.33 }
  ]
};

export const CLASS_OPTIONS = [
  'Creche', 'Nursery 1', 'Nursery 2', 'Nursery 3',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3', 'Other'
];

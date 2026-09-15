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
  students: [{ id: 'STU001', name: 'Aisha Bello', class: 'JSS2', password: 'pass', photo: '' }],
  teachers: [{ id: 'teacher1', name: 'Mr. Okafor', password: 'pass', subjects: ['Math'], classes: ['JSS2'] }],
  admins: [{ id: 'admin', name: 'Administrator', password: 'admin' }],
  subjects: ['Math', 'English', 'Basic Science'],
  exams: [],
  results: [],
  attendance: []
};

export const CLASS_OPTIONS = [
  'Creche', 'Nursery 1', 'Nursery 2', 'Nursery 3',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3', 'Other'
];

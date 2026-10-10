import { db } from './firebase';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { Exam, Student } from '../types';

export type LiveConnectionStatus = 'active' | 'disconnected' | 'offline' | 'submitted' | 'not_started';

export interface LiveStudentSession {
  schoolId: string;
  examId: string | number;
  studentId: string;
  studentName: string;
  studentClass: string;
  photo?: string;
  progressPercent: number;
  answeredCount: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  attemptStatus: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted';
  startTime: string;
  expiryTime: string;
  lastHeartbeat: number;
  violationsCount: number;
  submissionStatus: 'pending' | 'submitted' | 'auto_submitted';
  submittedAt?: string;
  updatedAt: number;
  connectionStatus?: LiveConnectionStatus;
  answersSynced?: boolean;
  gradingStatus?: 'pending' | 'in_progress' | 'graded';
  finalScore?: number;
  finalPercentage?: number;
}

export function getLiveSessionDocId(
  schoolId: string | null | undefined,
  examId: string | number,
  studentId: string
): string {
  const cleanSchool = (schoolId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExam = String(examId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanStudent = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanSchool}__${cleanExam}__${cleanStudent}`;
}

export function computeConnectionStatus(
  session: LiveStudentSession | undefined,
  currentTime: number = Date.now()
): LiveConnectionStatus {
  if (!session) return 'not_started';
  if (session.submissionStatus === 'submitted' || session.attemptStatus === 'submitted') {
    return 'submitted';
  }
  if (session.submissionStatus === 'auto_submitted' || session.attemptStatus === 'auto_submitted') {
    return 'submitted';
  }
  if (session.attemptStatus === 'not_started') {
    return 'not_started';
  }

  const diff = currentTime - (session.lastHeartbeat || 0);
  if (diff <= 30000) {
    return 'active'; // within 30 seconds
  }
  if (diff <= 75000) {
    return 'disconnected'; // temporarily disconnected (between 30s and 75s)
  }
  return 'offline'; // no heartbeat for > 75 seconds
}

/**
 * Initializes a student's live exam session document in Firestore
 */
export async function startStudentLiveSession(
  schoolId: string | null | undefined,
  exam: Exam,
  student: Student
): Promise<void> {
  try {
    const docId = getLiveSessionDocId(schoolId, exam.id, student.id);
    const docRef = doc(db, 'live_exam_sessions', docId);

    const totalQuestions = exam.questions?.length || 0;
    const now = Date.now();
    const durationMin = Number(exam.duration) || 30;

    const payload: LiveStudentSession = {
      schoolId: schoolId || 'default',
      examId: String(exam.id),
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class || '',
      photo: student.photo || '',
      progressPercent: 0,
      answeredCount: 0,
      totalQuestions,
      currentQuestionIndex: 0,
      attemptStatus: 'in_progress',
      startTime: new Date(now).toISOString(),
      expiryTime: new Date(now + durationMin * 60 * 1000).toISOString(),
      lastHeartbeat: now,
      violationsCount: 0,
      submissionStatus: 'pending',
      updatedAt: now
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn('Could not initialize student live session:', err);
  }
}

/**
 * Updates a student's answer progress and current question location
 */
export async function updateStudentLiveProgress(
  schoolId: string | null | undefined,
  examId: string | number,
  studentId: string,
  progress: {
    answeredCount: number;
    totalQuestions: number;
    currentQuestionIndex: number;
  }
): Promise<void> {
  try {
    const docId = getLiveSessionDocId(schoolId, examId, studentId);
    const docRef = doc(db, 'live_exam_sessions', docId);
    const now = Date.now();
    const progressPercent = progress.totalQuestions > 0
      ? Math.round((progress.answeredCount / progress.totalQuestions) * 100)
      : 0;

    await setDoc(
      docRef,
      {
        progressPercent,
        answeredCount: progress.answeredCount,
        totalQuestions: progress.totalQuestions,
        currentQuestionIndex: progress.currentQuestionIndex,
        lastHeartbeat: now,
        updatedAt: now
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not update student live progress:', err);
  }
}

/**
 * Lightweight heartbeat ping sent every 15-20 seconds
 */
export async function sendStudentLiveHeartbeat(
  schoolId: string | null | undefined,
  examId: string | number,
  studentId: string
): Promise<void> {
  try {
    const docId = getLiveSessionDocId(schoolId, examId, studentId);
    const docRef = doc(db, 'live_exam_sessions', docId);
    const now = Date.now();

    await setDoc(
      docRef,
      {
        lastHeartbeat: now,
        updatedAt: now
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not send live heartbeat:', err);
  }
}

/**
 * Reports an anti-cheat security violation event in real time
 */
export async function reportStudentLiveViolation(
  schoolId: string | null | undefined,
  examId: string | number,
  studentId: string,
  violationsCount: number
): Promise<void> {
  try {
    const docId = getLiveSessionDocId(schoolId, examId, studentId);
    const docRef = doc(db, 'live_exam_sessions', docId);
    const now = Date.now();

    await setDoc(
      docRef,
      {
        violationsCount,
        lastHeartbeat: now,
        updatedAt: now
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not report student live violation:', err);
  }
}

/**
 * Marks student's live exam session as completed/submitted
 */
export async function completeStudentLiveSession(
  schoolId: string | null | undefined,
  examId: string | number,
  studentId: string,
  autoSubmitted: boolean = false
): Promise<void> {
  try {
    const docId = getLiveSessionDocId(schoolId, examId, studentId);
    const docRef = doc(db, 'live_exam_sessions', docId);
    const now = Date.now();

    const statusVal = autoSubmitted ? 'auto_submitted' : 'submitted';

    await setDoc(
      docRef,
      {
        attemptStatus: statusVal,
        submissionStatus: statusVal,
        submittedAt: new Date(now).toISOString(),
        lastHeartbeat: now,
        updatedAt: now
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not complete student live session:', err);
  }
}

/**
 * Teacher/Admin real-time listener for all students in an active examination
 */
export function subscribeToExamLiveSessions(
  schoolId: string | null | undefined,
  examId: string | number,
  onUpdate: (sessions: LiveStudentSession[]) => void
): Unsubscribe {
  const safeSchoolId = schoolId || 'default';
  const q = query(
    collection(db, 'live_exam_sessions'),
    where('schoolId', '==', safeSchoolId),
    where('examId', '==', String(examId))
  );

  return onSnapshot(
    q,
    snapshot => {
      const list: LiveStudentSession[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as LiveStudentSession);
      });
      onUpdate(list);
    },
    error => {
      console.warn('Live exam sessions listener error:', error);
    }
  );
}

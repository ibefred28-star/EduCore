import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths } from '../paths';
import { FirestoreAttemptDoc } from '../models';

export const AttemptRepository = {
  /**
   * Retrieves an attempt session by ID
   */
  async getAttempt(schoolId: string, attemptId: string): Promise<FirestoreAttemptDoc | null> {
    if (!schoolId || !attemptId) return null;
    const ref = doc(db, FirestorePaths.attempt(schoolId, attemptId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreAttemptDoc;
  },

  /**
   * Retrieves all attempts by a student for a specific exam
   */
  async getStudentAttempts(
    schoolId: string,
    examId: string | number,
    studentId: string
  ): Promise<FirestoreAttemptDoc[]> {
    if (!schoolId || !examId || !studentId) return [];
    const colRef = collection(db, FirestorePaths.attempts(schoolId));
    const q = query(
      colRef,
      where('examId', '==', String(examId)),
      where('studentId', '==', studentId),
      orderBy('attemptNumber', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreAttemptDoc);
  },

  /**
   * Creates a new attempt session with authoritative start & expiry time
   */
  async createAttempt(
    schoolId: string,
    attempt: Omit<FirestoreAttemptDoc, 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const ref = doc(db, FirestorePaths.attempt(schoolId, attempt.id));
    const now = new Date().toISOString();
    const payload: FirestoreAttemptDoc = {
      ...attempt,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(ref, payload);
  },

  /**
   * Autosaves candidate answer selections and updates heartbeat
   */
  async autosaveAttempt(
    schoolId: string,
    attemptId: string,
    data: {
      answers: Record<number, any>;
      currentQuestionIndex: number;
      violationsCount: number;
    }
  ): Promise<void> {
    const ref = doc(db, FirestorePaths.attempt(schoolId, attemptId));
    await updateDoc(ref, {
      answers: data.answers,
      currentQuestionIndex: data.currentQuestionIndex,
      violationsCount: data.violationsCount,
      lastHeartbeat: Date.now(),
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Finalizes the attempt status upon submission
   */
  async finalizeAttempt(
    schoolId: string,
    attemptId: string,
    status: 'submitted' | 'auto_submitted'
  ): Promise<void> {
    const ref = doc(db, FirestorePaths.attempt(schoolId, attemptId));
    await updateDoc(ref, {
      status,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Realtime listener for teacher proctoring of student attempts
   */
  subscribeExamAttempts(
    schoolId: string,
    examId: string | number,
    callback: (attempts: FirestoreAttemptDoc[]) => void
  ): Unsubscribe {
    if (!schoolId || !examId) return () => {};
    const colRef = collection(db, FirestorePaths.attempts(schoolId));
    const q = query(colRef, where('examId', '==', String(examId)));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreAttemptDoc);
      callback(list);
    }, (error) => {
      console.warn('AttemptRepository.subscribeExamAttempts error:', error);
    });
  }
};

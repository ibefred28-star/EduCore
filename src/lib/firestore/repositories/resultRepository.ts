import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths } from '../paths';
import { FirestoreResultDoc } from '../models';

export const ResultRepository = {
  /**
   * Retrieves official assessment results for a student candidate
   */
  async getResultsByStudent(schoolId: string, studentId: string): Promise<FirestoreResultDoc[]> {
    if (!schoolId || !studentId) return [];
    const colRef = collection(db, FirestorePaths.results(schoolId));
    const q = query(
      colRef,
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreResultDoc);
  },

  /**
   * Retrieves all results for an exam (Staff access only)
   */
  async getResultsByExam(schoolId: string, examId: string | number): Promise<FirestoreResultDoc[]> {
    if (!schoolId || !examId) return [];
    const colRef = collection(db, FirestorePaths.results(schoolId));
    const q = query(
      colRef,
      where('examId', '==', String(examId)),
      orderBy('percentage', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreResultDoc);
  },

  /**
   * Persists an official graded result document (Immutable to student candidates)
   */
  async recordGradedResult(
    schoolId: string,
    result: FirestoreResultDoc
  ): Promise<void> {
    const ref = doc(db, FirestorePaths.result(schoolId, result.id));
    await setDoc(ref, result, { merge: true });
  },

  /**
   * Realtime subscription for a candidate's results
   */
  subscribeStudentResults(
    schoolId: string,
    studentId: string,
    callback: (results: FirestoreResultDoc[]) => void
  ): Unsubscribe {
    if (!schoolId || !studentId) return () => {};
    const colRef = collection(db, FirestorePaths.results(schoolId));
    const q = query(
      colRef,
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreResultDoc);
      callback(list);
    }, (error) => {
      console.warn('ResultRepository.subscribeStudentResults error:', error);
    });
  }
};

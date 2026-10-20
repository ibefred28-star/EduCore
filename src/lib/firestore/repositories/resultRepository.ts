import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
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
   * Deletes a graded result document from Firestore (Staff access)
   */
  async deleteResult(
    schoolId: string,
    resultId: string | number
  ): Promise<void> {
    if (!schoolId || !resultId) return;
    const ref = doc(db, FirestorePaths.result(schoolId, String(resultId)));
    await deleteDoc(ref);
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
      where('studentId', '==', studentId)
    );

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreResultDoc);
      callback(list);
    }, (error) => {
      console.warn('ResultRepository.subscribeStudentResults error:', error);
    });
  },

  /**
   * Realtime subscription for all school results across all students
   */
  subscribeSchoolResults(
    schoolId: string,
    callback: (results: FirestoreResultDoc[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.results(schoolId));
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreResultDoc);
      callback(list);
    }, (error) => {
      console.warn('ResultRepository.subscribeSchoolResults error:', error);
    });
  },

  /**
   * Migrates any legacy AFL results to CA 1 in Firestore
   */
  async migrateAflResultsToCA1(schoolId: string): Promise<void> {
    if (!schoolId) return;
    try {
      const colRef = collection(db, FirestorePaths.results(schoolId));
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        const data = d.data();
        if (String(data.type || '').trim().toUpperCase() === 'AFL') {
          await setDoc(d.ref, { type: 'CA 1' }, { merge: true });
        }
      }
    } catch (e) {
      console.warn('Could not migrate AFL results to CA 1 in Firestore:', e);
    }
  }
};

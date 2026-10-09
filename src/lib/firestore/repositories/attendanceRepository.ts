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
import { FirestoreAttendanceDoc } from '../models';

export const AttendanceRepository = {
  /**
   * Retrieves attendance records for a school class
   */
  async getAttendanceByClass(schoolId: string, classFilter: string): Promise<FirestoreAttendanceDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.attendance(schoolId));
    let q = query(colRef, orderBy('studentId', 'asc'));

    if (classFilter && classFilter !== 'all') {
      q = query(colRef, where('class', '==', classFilter), orderBy('studentId', 'asc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreAttendanceDoc);
  },

  /**
   * Retrieves attendance for an individual student
   */
  async getAttendanceByStudent(schoolId: string, studentId: string): Promise<FirestoreAttendanceDoc | null> {
    if (!schoolId || !studentId) return null;
    const ref = doc(db, FirestorePaths.attendanceDoc(schoolId, studentId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreAttendanceDoc;
  },

  /**
   * Upserts a student attendance record idempotently
   */
  async upsertAttendance(schoolId: string, record: FirestoreAttendanceDoc): Promise<void> {
    const docId = record.id || record.studentId;
    const ref = doc(db, FirestorePaths.attendanceDoc(schoolId, docId));
    await setDoc(ref, {
      ...record,
      schoolId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  },

  /**
   * Realtime subscription for class attendance records
   */
  subscribeAttendance(
    schoolId: string,
    callback: (records: FirestoreAttendanceDoc[]) => void,
    classFilter?: string
  ) {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.attendance(schoolId));
    let q = query(colRef, orderBy('studentId', 'asc'));

    if (classFilter && classFilter !== 'all') {
      q = query(colRef, where('class', '==', classFilter), orderBy('studentId', 'asc'));
    }

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreAttendanceDoc);
      callback(list);
    }, (error) => {
      console.warn('AttendanceRepository.subscribeAttendance error:', error);
    });
  }
};

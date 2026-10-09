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
import { FirestoreStudentDoc } from '../models';

export const StudentRepository = {
  /**
   * Retrieves all students belonging to a school, optionally filtered by class
   */
  async getStudents(schoolId: string, classFilter?: string): Promise<FirestoreStudentDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.students(schoolId));
    
    let q = query(colRef, orderBy('name', 'asc'));
    if (classFilter && classFilter !== 'all') {
      q = query(colRef, where('class', '==', classFilter), orderBy('name', 'asc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreStudentDoc);
  },

  /**
   * Retrieves an individual student profile by ID
   */
  async getStudentById(schoolId: string, studentId: string): Promise<FirestoreStudentDoc | null> {
    if (!schoolId || !studentId) return null;
    const ref = doc(db, FirestorePaths.student(schoolId, studentId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreStudentDoc;
  },

  /**
   * Persists or updates a student profile idempotently using stable studentId
   */
  async upsertStudent(schoolId: string, student: Omit<FirestoreStudentDoc, 'schoolId' | 'updatedAt' | 'createdAt'>): Promise<void> {
    if (!schoolId || !student.id) throw new Error('Missing schoolId or student ID');
    const ref = doc(db, FirestorePaths.student(schoolId, student.id));
    const snap = await getDoc(ref);

    const now = new Date().toISOString();
    const payload: FirestoreStudentDoc = {
      ...student,
      schoolId,
      createdAt: snap.exists() ? (snap.data() as FirestoreStudentDoc).createdAt : now,
      updatedAt: now
    };

    await setDoc(ref, payload, { merge: true });
  },

  /**
   * Removes a student record
   */
  async deleteStudent(schoolId: string, studentId: string): Promise<void> {
    if (!schoolId || !studentId) return;
    const ref = doc(db, FirestorePaths.student(schoolId, studentId));
    await deleteDoc(ref);
  },

  /**
   * Realtime subscription to the student list
   */
  subscribeStudents(
    schoolId: string,
    callback: (students: FirestoreStudentDoc[]) => void,
    classFilter?: string
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.students(schoolId));

    let q = query(colRef, orderBy('name', 'asc'));
    if (classFilter && classFilter !== 'all') {
      q = query(colRef, where('class', '==', classFilter), orderBy('name', 'asc'));
    }

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreStudentDoc);
      callback(list);
    }, (error) => {
      console.warn('StudentRepository.subscribeStudents error:', error);
    });
  }
};

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths } from '../paths';
import { FirestoreTeacherDoc } from '../models';

export const TeacherRepository = {
  /**
   * Retrieves all faculty teachers belonging to a school
   */
  async getTeachers(schoolId: string): Promise<FirestoreTeacherDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.teachers(schoolId));
    const q = query(colRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreTeacherDoc);
  },

  /**
   * Retrieves a specific teacher by ID
   */
  async getTeacherById(schoolId: string, teacherId: string): Promise<FirestoreTeacherDoc | null> {
    if (!schoolId || !teacherId) return null;
    const ref = doc(db, FirestorePaths.teacher(schoolId, teacherId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreTeacherDoc;
  },

  /**
   * Idempotently saves or updates a teacher record using stable teacherId
   */
  async upsertTeacher(
    schoolId: string,
    teacher: Omit<FirestoreTeacherDoc, 'schoolId' | 'updatedAt' | 'createdAt'>
  ): Promise<void> {
    if (!schoolId || !teacher.id) throw new Error('Missing schoolId or teacher ID');
    const ref = doc(db, FirestorePaths.teacher(schoolId, teacher.id));
    const snap = await getDoc(ref);

    const now = new Date().toISOString();
    const payload: FirestoreTeacherDoc = {
      ...teacher,
      schoolId,
      createdAt: snap.exists() ? (snap.data() as FirestoreTeacherDoc).createdAt : now,
      updatedAt: now
    };

    await setDoc(ref, payload, { merge: true });
  },

  /**
   * Deletes a teacher record
   */
  async deleteTeacher(schoolId: string, teacherId: string): Promise<void> {
    if (!schoolId || !teacherId) return;
    const ref = doc(db, FirestorePaths.teacher(schoolId, teacherId));
    await deleteDoc(ref);
  },

  /**
   * Realtime subscription to the teacher roster
   */
  subscribeTeachers(
    schoolId: string,
    callback: (teachers: FirestoreTeacherDoc[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.teachers(schoolId));
    const q = query(colRef, orderBy('name', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreTeacherDoc);
      callback(list);
    }, (error) => {
      console.warn('TeacherRepository.subscribeTeachers error:', error);
    });
  }
};

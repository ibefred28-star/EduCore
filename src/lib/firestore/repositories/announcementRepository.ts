import {
  collection,
  doc,
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
import { FirestoreAnnouncementDoc } from '../models';

export const AnnouncementRepository = {
  /**
   * Retrieves active announcements tailored to a specific user role
   */
  async getAnnouncements(
    schoolId: string,
    role: 'student' | 'teacher' | 'admin'
  ): Promise<FirestoreAnnouncementDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.announcements(schoolId));
    const q = query(
      colRef,
      where('targetRoles', 'array-contains', role),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FirestoreAnnouncementDoc);
  },

  /**
   * Creates a school-wide announcement (Staff only)
   */
  async createAnnouncement(
    schoolId: string,
    announcement: Omit<FirestoreAnnouncementDoc, 'schoolId' | 'createdAt'>
  ): Promise<void> {
    const ref = doc(db, FirestorePaths.announcement(schoolId, announcement.id));
    const payload: FirestoreAnnouncementDoc = {
      ...announcement,
      schoolId,
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, payload);
  },

  /**
   * Deletes an announcement
   */
  async deleteAnnouncement(schoolId: string, announcementId: string): Promise<void> {
    const ref = doc(db, FirestorePaths.announcement(schoolId, announcementId));
    await deleteDoc(ref);
  },

  /**
   * Realtime subscription for school announcements
   */
  subscribeAnnouncements(
    schoolId: string,
    role: 'student' | 'teacher' | 'admin',
    callback: (announcements: FirestoreAnnouncementDoc[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.announcements(schoolId));
    const q = query(
      colRef,
      where('targetRoles', 'array-contains', role),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreAnnouncementDoc);
      callback(list);
    }, (error) => {
      console.warn('AnnouncementRepository.subscribeAnnouncements error:', error);
    });
  }
};

import {
  collection,
  doc,
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
import { LearningResource } from '../../../types';

export const LearningResourceRepository = {
  /**
   * Retrieves all learning resources for a school
   */
  async getResources(schoolId: string): Promise<LearningResource[]> {
    if (!schoolId) return [];
    try {
      const colRef = collection(db, FirestorePaths.learningResources(schoolId));
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as LearningResource);
    } catch (err) {
      console.warn('LearningResourceRepository.getResources error:', err);
      return [];
    }
  },

  /**
   * Saves or updates a learning resource
   */
  async saveResource(schoolId: string, resource: LearningResource): Promise<void> {
    if (!schoolId || !resource.id) return;
    const ref = doc(db, FirestorePaths.learningResource(schoolId, resource.id));
    await setDoc(ref, resource, { merge: true });
  },

  /**
   * Deletes a learning resource
   */
  async deleteResource(schoolId: string, resourceId: string): Promise<void> {
    if (!schoolId || !resourceId) return;
    const ref = doc(db, FirestorePaths.learningResource(schoolId, resourceId));
    await deleteDoc(ref);
  },

  /**
   * Subscribes to realtime updates for learning resources
   */
  subscribeResources(
    schoolId: string,
    callback: (resources: LearningResource[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    try {
      const colRef = collection(db, FirestorePaths.learningResources(schoolId));
      const q = query(colRef, orderBy('createdAt', 'desc'));

      return onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map(d => d.data() as LearningResource);
          callback(list);
        },
        (error) => {
          console.warn('LearningResourceRepository.subscribeResources error:', error);
        }
      );
    } catch (err) {
      console.warn('LearningResourceRepository.subscribeResources setup error:', err);
      return () => {};
    }
  }
};

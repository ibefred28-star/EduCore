import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FirestorePaths } from '../firestore/paths';
import { FirestoreUserDoc } from '../firestore/types';
import { Role } from '../../types';

export const UserService = {
  /**
   * Retrieves authoritative user profile from Firestore by schoolId and username
   */
  async getUserProfile(schoolId: string, username: string): Promise<FirestoreUserDoc | null> {
    const cleanSchool = schoolId || 'global';
    const userRef = doc(db, FirestorePaths.user(cleanSchool, username));
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUserDoc;
    }

    // Fallback: If student was created in the school roster, reconcile profile
    try {
      const studentRef = doc(db, FirestorePaths.student(cleanSchool, username));
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const sData = studentSnap.data();
        return {
          uid: sData.uid || '',
          schoolId: cleanSchool,
          username: (sData.id || username).toLowerCase(),
          name: sData.name || username,
          email: `${cleanSchool}.student.${username.toLowerCase()}@educore.internal`,
          role: 'student',
          classes: sData.class ? [sData.class] : ['Primary 5'],
          status: 'active',
          createdAt: sData.createdAt || new Date().toISOString(),
          updatedAt: sData.updatedAt || new Date().toISOString()
        };
      }
    } catch (e) {
      // Ignore permission or network errors in fallback
    }

    return null;
  },

  /**
   * Creates or updates authoritative user profile document in Firestore
   */
  async upsertUserProfile(
    schoolId: string,
    profile: {
      uid: string;
      username: string;
      name: string;
      email: string;
      role: Role | 'superadmin';
      classes?: string[];
      status?: 'active' | 'disabled';
    }
  ): Promise<FirestoreUserDoc> {
    const cleanSchool = schoolId || 'global';
    const userRef = doc(db, FirestorePaths.user(cleanSchool, profile.username));
    const existingSnap = await getDoc(userRef);
    
    const now = new Date().toISOString();
    const docData: FirestoreUserDoc = {
      uid: profile.uid,
      schoolId: cleanSchool,
      username: profile.username.toLowerCase(),
      name: profile.name,
      email: profile.email,
      role: profile.role,
      classes: profile.classes || [],
      status: profile.status || 'active',
      createdAt: existingSnap.exists() ? (existingSnap.data() as FirestoreUserDoc).createdAt : now,
      updatedAt: now
    };

    await setDoc(userRef, docData, { merge: true });
    return docData;
  },

  /**
   * Updates an account's operational status
   */
  async setUserStatus(schoolId: string, username: string, status: 'active' | 'disabled'): Promise<void> {
    const cleanSchool = schoolId || 'global';
    const userRef = doc(db, FirestorePaths.user(cleanSchool, username));
    await updateDoc(userRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  }
};

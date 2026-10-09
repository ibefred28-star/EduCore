import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FirestorePaths } from './paths';
import { FirestoreGlobalTenantDoc, FirestoreSchoolDoc, FirestoreSettingsDoc } from './types';
import { Branding, Config, Tenant } from '../../types';

/**
 * Tenant and School repository managing multi-school foundation in Cloud Firestore
 */
export const TenantRepository = {
  /**
   * Fetches global tenant profile for Super Admin
   */
  async getTenant(schoolId: string): Promise<Tenant | null> {
    const ref = doc(db, FirestorePaths.globalTenant(schoolId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreGlobalTenantDoc;
    return {
      id: data.id,
      name: data.name,
      status: data.status,
      createdAt: data.createdAt
    };
  },

  /**
   * Subscribes to all active school tenants for the Super Admin dashboard
   */
  subscribeAllTenants(callback: (tenants: Tenant[]) => void): Unsubscribe {
    const colRef = collection(db, FirestorePaths.globalTenants());
    return onSnapshot(colRef, (snapshot) => {
      const list: Tenant[] = snapshot.docs.map(docSnap => {
        const d = docSnap.data() as FirestoreGlobalTenantDoc;
        return {
          id: d.id || docSnap.id,
          name: d.name,
          status: d.status,
          createdAt: d.createdAt
        };
      });
      callback(list);
    }, (error) => {
      console.warn('Failed to listen to globalTenants collection:', error);
    });
  },

  /**
   * Retrieves a school's public branding profile
   */
  async getSchoolBranding(schoolId: string): Promise<Branding | null> {
    const ref = doc(db, FirestorePaths.school(schoolId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreSchoolDoc;
    return {
      schoolName: data.schoolName || '',
      motto: data.motto || '',
      address: data.address || '',
      phone: data.phone || '',
      principal: data.principal || '',
      logo: data.logo || '',
      primary: data.primary || '#4f46e5',
      secondary: data.secondary || '#818cf8',
      accent: data.accent || '#f59e0b'
    };
  },

  /**
   * Saves/updates a school's branding profile
   */
  async updateSchoolBranding(schoolId: string, branding: Branding): Promise<void> {
    const ref = doc(db, FirestorePaths.school(schoolId));
    const payload: FirestoreSchoolDoc = {
      schoolName: branding.schoolName,
      motto: branding.motto,
      address: branding.address,
      phone: branding.phone,
      principal: branding.principal,
      logo: branding.logo,
      primary: branding.primary,
      secondary: branding.secondary,
      accent: branding.accent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
  },

  /**
   * Retrieves school settings
   */
  async getSchoolSettings(schoolId: string): Promise<Config | null> {
    const ref = doc(db, FirestorePaths.settingsDoc(schoolId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data() as FirestoreSettingsDoc;
    return {
      ca1: d.ca1 ?? 20,
      ca2: d.ca2 ?? 20,
      exam: d.exam ?? 60,
      violationLimit: d.violationLimit ?? 3,
      grades: d.grades || []
    };
  },

  /**
   * Updates school settings
   */
  async updateSchoolSettings(schoolId: string, config: Config): Promise<void> {
    const ref = doc(db, FirestorePaths.settingsDoc(schoolId));
    const payload: FirestoreSettingsDoc = {
      ca1: config.ca1,
      ca2: config.ca2,
      exam: config.exam,
      violationLimit: config.violationLimit,
      grades: config.grades,
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
  }
};

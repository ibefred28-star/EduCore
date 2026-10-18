import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FirestorePaths } from './paths';
import { FirestoreGlobalTenantDoc, FirestoreSchoolDoc, FirestoreSettingsDoc } from './types';
import { Branding, Config, Tenant } from '../../types';

export interface ResolvedSchool {
  exists: boolean;
  schoolId: string;
  name: string;
  status: 'active' | 'suspended';
  branding?: Branding;
  error?: string;
}

/**
 * Tenant and School repository managing multi-school foundation in Cloud Firestore
 */
export const TenantRepository = {
  /**
   * Fetches all registered tenants from Firestore (both app_state/GLOBAL_TENANTS and globalTenants collection)
   */
  async fetchAllTenants(): Promise<Tenant[]> {
    const list: Tenant[] = [];
    const seen = new Set<string>();

    // 1. Fetch from app_state/GLOBAL_TENANTS
    try {
      const snap = await getDoc(doc(db, 'app_state', 'GLOBAL_TENANTS'));
      if (snap.exists() && Array.isArray(snap.data()?.tenants)) {
        for (const t of snap.data().tenants) {
          if (t && t.id && !seen.has(t.id.toLowerCase())) {
            seen.add(t.id.toLowerCase());
            list.push({
              id: t.id,
              name: t.name || t.id,
              status: t.status || 'active',
              createdAt: t.createdAt
            });
          }
        }
      }
    } catch (e) {
      console.warn('Could not read app_state/GLOBAL_TENANTS:', e);
    }

    // 2. Fetch from globalTenants collection
    try {
      const snap = await getDocs(collection(db, FirestorePaths.globalTenants()));
      for (const d of snap.docs) {
        const data = d.data() as FirestoreGlobalTenantDoc;
        const id = data.id || d.id;
        if (id && !seen.has(id.toLowerCase())) {
          seen.add(id.toLowerCase());
          list.push({
            id,
            name: data.name || id,
            status: data.status || 'active',
            createdAt: data.createdAt
          });
        }
      }
    } catch (e) {
      // Permission or collection not initialized
    }

    return list;
  },

  /**
   * Robust multi-device resolution of a school ID against Firestore and backend.
   * Tolerates hyphens, spaces, letter casing, or name searches.
   */
  async resolveSchoolTenant(rawInput: string): Promise<ResolvedSchool> {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) {
      return { exists: false, schoolId: '', name: '', status: 'active', error: 'Please enter a School ID.' };
    }

    const cleanInput = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const normInput = cleanInput.replace(/[^a-z0-9]/g, '');

    // 1. Built-in Demo school
    if (cleanInput === 'demo' || normInput === 'demo') {
      return {
        exists: true,
        schoolId: 'demo',
        name: 'Demo International Academy',
        status: 'active',
        branding: {
          schoolName: 'Demo International Academy',
          motto: 'Excellence, Character & Wisdom',
          primary: '#1e3a8a',
          secondary: '#818cf8',
          accent: '#f59e0b',
          address: '',
          phone: '',
          principal: '',
          logo: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&q=80'
        }
      };
    }

    // 2. Authoritative check in all registered tenants
    try {
      const tenants = await this.fetchAllTenants();
      const matched = tenants.find(t => {
        const tId = (t.id || '').toLowerCase();
        const tNorm = tId.replace(/[^a-z0-9]/g, '');
        const nameNorm = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return tId === cleanInput ||
               tNorm === normInput ||
               nameNorm === normInput ||
               (normInput.length >= 4 && (tNorm.includes(normInput) || normInput.includes(tNorm) || nameNorm.includes(normInput)));
      });

      if (matched) {
        if (matched.status === 'suspended') {
          return {
            exists: true,
            schoolId: matched.id,
            name: matched.name,
            status: 'suspended',
            error: 'This school account is currently suspended. Please contact platform administration.'
          };
        }

        // Try reading branding
        const branding = await this.getSchoolBranding(matched.id);
        return {
          exists: true,
          schoolId: matched.id,
          name: matched.name,
          status: 'active',
          branding: branding || undefined
        };
      }
    } catch (e) {
      console.warn('Tenant list resolution error:', e);
    }

    // 3. Direct document check on app_state/{cleanInput} and app_state/{normInput}
    for (const testId of [cleanInput, normInput]) {
      if (!testId) continue;
      try {
        const appStateSnap = await getDoc(doc(db, 'app_state', testId));
        if (appStateSnap.exists()) {
          const d = appStateSnap.data();
          const branding = d.branding || undefined;
          const name = branding?.schoolName || testId;
          return {
            exists: true,
            schoolId: testId,
            name,
            status: 'active',
            branding
          };
        }
      } catch (e) {
        // Continue
      }
    }

    // 4. Direct document check on schools/{cleanInput}
    for (const testId of [cleanInput, normInput]) {
      if (!testId) continue;
      try {
        const schoolSnap = await getDoc(doc(db, 'schools', testId));
        if (schoolSnap.exists()) {
          const d = schoolSnap.data() as FirestoreSchoolDoc;
          return {
            exists: true,
            schoolId: testId,
            name: d.schoolName || testId,
            status: 'active',
            branding: {
              schoolName: d.schoolName || testId,
              motto: d.motto || '',
              primary: d.primary || '#4f46e5',
              secondary: d.secondary || '#818cf8',
              accent: d.accent || '#f59e0b',
              logo: d.logo || '',
              address: d.address || '',
              phone: d.phone || '',
              principal: d.principal || ''
            }
          };
        }
      } catch (e) {
        // Continue
      }
    }

    // 5. Try server endpoint /api/schools/validate as secondary option (safely ignoring any proxy redirects)
    try {
      const res = await fetch(`/api/schools/validate/${cleanInput}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data && data.exists) {
            return {
              exists: true,
              schoolId: data.schoolId || cleanInput,
              name: data.name || cleanInput,
              status: data.status || 'active',
              branding: data.branding,
              error: data.status === 'suspended' ? 'This school account is currently suspended. Please contact platform administration.' : undefined
            };
          }
        }
      }
    } catch (e) {
      // Ignored: proxy or network issue
    }

    return {
      exists: false,
      schoolId: cleanInput,
      name: '',
      status: 'active',
      error: 'School ID not found. Please verify the ID with your school administration.'
    };
  },

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

import { create } from 'zustand';
import { AppData, Branding, Config, Role, SyncConfig, Tenant, User } from './types';
import { DEFAULT_BRANDING, DEFAULT_CONFIG, DEFAULT_DATA } from './constants';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { isStudentInTeacherClasses } from './lib/classUtils';

const SYNC = 'educore_sync_v1';
const SUPERADMIN_PASS = 'admin123'; // Simple default password for super admin

function sanitizeState(incoming: AppData): AppData {
  if (!incoming) return DEFAULT_DATA;
  const copy = { ...incoming };
  
  if (!Array.isArray(copy.students)) copy.students = [];
  if (!Array.isArray(copy.teachers)) copy.teachers = [];
  if (!Array.isArray(copy.results)) copy.results = [];
  if (!Array.isArray(copy.attendance)) copy.attendance = [];
  if (!Array.isArray(copy.exams)) copy.exams = [];
  
  // Ensure the 5 registered Primary 5 students exist
  const primary5Students = copy.students.filter(s => isStudentInTeacherClasses(s.class, ['Primary 5']));
  if (primary5Students.length < 5) {
    DEFAULT_DATA.students.forEach(defStu => {
      if (!copy.students.some(s => s.id === defStu.id)) {
        copy.students.push(defStu);
      }
    });
  }

  // Ensure default exams for Primary 5 are present if none exist
  DEFAULT_DATA.exams.forEach(defEx => {
    if (!copy.exams.some(e => String(e.id) === String(defEx.id))) {
      copy.exams.push(defEx);
    }
  });

  // Ensure results for Primary 5 students exist if missing
  DEFAULT_DATA.results.forEach(defRes => {
    if (!copy.results.some(r => r.id === defRes.id)) {
      copy.results.push(defRes);
    }
  });

  // Ensure attendance for Primary 5 students exist if missing
  DEFAULT_DATA.attendance.forEach(defAtt => {
    if (!copy.attendance.some(a => a.studentId === defAtt.studentId)) {
      copy.attendance.push(defAtt);
    }
  });

  // Ensure teacher1 (or any teacher dedicated to Primary 5) does not have JSS2 polluting their class list
  const t1 = copy.teachers.find(t => (t.id || '').trim().toLowerCase() === 'teacher1');
  if (t1) {
    if (!t1.classes || t1.classes.length === 0) {
      t1.classes = ['Primary 5'];
    } else {
      // If teacher has Primary 5, remove JSS2 so it does not mix into their dashboard
      if (t1.classes.some(c => isStudentInTeacherClasses('Primary 5', [c]))) {
        t1.classes = t1.classes.filter(c => {
          const cl = c.toLowerCase().replace(/\s+/g, '');
          return cl !== 'jss2' && cl !== 'jss02';
        });
      }
    }
  }

  return copy;
}

interface StoreState {
  schoolId: string | null;
  currentUser: User | null;
  currentRole: Role | null;
  activeExamId: string | number | null;
  data: AppData;
  branding: Branding;
  config: Config;
  syncConfig: SyncConfig | null;
  globalTenants: Tenant[];
  
  // Internal tracking
  unsubscribeSnapshot: (() => void) | null;
  unsubscribeTenants: (() => void) | null;
  
  // Actions
  setSchoolId: (id: string | null) => void;
  login: (role: Role, id: string, pass: string) => boolean;
  loginSuperAdmin: (pass: string) => boolean;
  logout: () => void;
  updateData: (updater: (draft: AppData) => AppData | void) => void;
  updateBranding: (branding: Branding) => void;
  updateConfig: (config: Config) => void;
  updateSyncConfig: (syncConfig: SyncConfig | null) => void;
  initSync: () => void;
  createTenant: (id: string, name: string, adminId: string, adminPass: string) => Promise<{success: boolean, error?: string}>;
  deleteTenant: (id: string) => Promise<boolean>;
  toggleTenantStatus: (id: string) => Promise<boolean>;
}

const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
};

export const useStore = create<StoreState>((set, get) => {
  const initialSchoolId = localStorage.getItem('educore_school_id') || null;
  const DATA_KEY = initialSchoolId ? `educore_data_${initialSchoolId}` : 'educore_data_v2';
  const BRAND_KEY = initialSchoolId ? `educore_brand_${initialSchoolId}` : 'educore_brand_v2';
  const CONFIG_KEY = initialSchoolId ? `educore_config_${initialSchoolId}` : 'educore_config_v2';
  const USER_KEY = initialSchoolId ? `educore_current_user_${initialSchoolId}` : 'educore_current_user';
  const ROLE_KEY = initialSchoolId ? `educore_current_role_${initialSchoolId}` : 'educore_current_role';

  return {
    schoolId: initialSchoolId,
    currentUser: safeParse<User | null>(USER_KEY, null),
    currentRole: safeParse<Role | null>(ROLE_KEY, null),
    activeExamId: null,
    data: sanitizeState(safeParse<AppData>(DATA_KEY, DEFAULT_DATA)),
    branding: safeParse<Branding>(BRAND_KEY, DEFAULT_BRANDING),
    config: safeParse<Config>(CONFIG_KEY, DEFAULT_CONFIG),
    syncConfig: safeParse<SyncConfig | null>(SYNC, { enabled: true } as any),
    globalTenants: [],
    unsubscribeSnapshot: null,
    unsubscribeTenants: null,

    setSchoolId: (id) => {
      if (id) {
        localStorage.setItem('educore_school_id', id);
        const DATA_KEY = `educore_data_${id}`;
        const BRAND_KEY = `educore_brand_${id}`;
        const CONFIG_KEY = `educore_config_${id}`;
        
        set({
          schoolId: id,
          data: sanitizeState(safeParse<AppData>(DATA_KEY, DEFAULT_DATA)),
          branding: safeParse<Branding>(BRAND_KEY, DEFAULT_BRANDING),
          config: safeParse<Config>(CONFIG_KEY, DEFAULT_CONFIG),
          currentUser: null,
          currentRole: null
        });
        localStorage.removeItem(`educore_current_user_${id}`);
        localStorage.removeItem(`educore_current_role_${id}`);
        get().initSync();
      } else {
        localStorage.removeItem('educore_school_id');
        set({ schoolId: null, currentUser: null, currentRole: null });
        const unsub = get().unsubscribeSnapshot;
        if (unsub) unsub();
        set({ unsubscribeSnapshot: null });
      }
    },

    login: (role, id, pass) => {
      const data = get().data;
      const cleanId = id.trim().toLowerCase();
      
      const students = data.students || DEFAULT_DATA.students;
      const teachers = data.teachers || DEFAULT_DATA.teachers;
      const admins = data.admins || DEFAULT_DATA.admins;

      const checkRole = (r: Role) => {
        if (r === 'admin') return admins.find(u => (u.id || '').toLowerCase() === cleanId && u.password === pass);
        if (r === 'teacher') return teachers.find(u => (u.id || '').toLowerCase() === cleanId && u.password === pass);
        if (r === 'student') return students.find(u => (u.id || '').toLowerCase() === cleanId && u.password === pass);
        return undefined;
      };

      let user = checkRole(role);
      let actualRole = role;

      // Auto-correct role if the user forgot to change the dropdown
      if (!user) {
        if (checkRole('admin')) { user = checkRole('admin'); actualRole = 'admin'; }
        else if (checkRole('teacher')) { user = checkRole('teacher'); actualRole = 'teacher'; }
        else if (checkRole('student')) { user = checkRole('student'); actualRole = 'student'; }
      }

      if (user) {
        const state = get();
        if (actualRole === 'teacher') {
          const freshTeacher = data.teachers?.find(t => (t.id || '').trim().toLowerCase() === cleanId);
          if (freshTeacher) {
            user = { ...freshTeacher };
            if (Array.isArray((user as any).classes) && (user as any).classes.some((c: string) => isStudentInTeacherClasses('Primary 5', [c]))) {
              (user as any).classes = (user as any).classes.filter((c: string) => {
                const cl = c.toLowerCase().replace(/\s+/g, '');
                return cl !== 'jss2' && cl !== 'jss02';
              });
            }
          }
        }
        if (state.schoolId) {
          localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(user));
          localStorage.setItem(`educore_current_role_${state.schoolId}`, JSON.stringify(actualRole));
        } else {
          localStorage.setItem('educore_current_user', JSON.stringify(user));
          localStorage.setItem('educore_current_role', JSON.stringify(actualRole));
        }
        set({ currentUser: user, currentRole: actualRole });
        get().initSync();
        return true;
      }
      return false;
    },

    loginSuperAdmin: (pass) => {
      if (pass === SUPERADMIN_PASS) {
        const user = { id: 'superadmin', name: 'Super Administrator' } as User;
        localStorage.setItem('educore_current_user', JSON.stringify(user));
        localStorage.setItem('educore_current_role', JSON.stringify('superadmin'));
        set({ 
          currentRole: 'superadmin', 
          currentUser: user,
          schoolId: null 
        });
        get().initSync(); // This will fetch the global tenants since role is superadmin
        return true;
      }
      return false;
    },

    logout: () => {
      const state = get();
      if (state.schoolId) {
        localStorage.removeItem(`educore_current_user_${state.schoolId}`);
        localStorage.removeItem(`educore_current_role_${state.schoolId}`);
      } else {
        localStorage.removeItem('educore_current_user');
        localStorage.removeItem('educore_current_role');
      }
      set({ currentUser: null, currentRole: null });
      const unsub = get().unsubscribeSnapshot;
      if (unsub) unsub();
      
      const unsubT = get().unsubscribeTenants;
      if (unsubT) unsubT();
      
      set({ unsubscribeSnapshot: null, unsubscribeTenants: null });
      // We don't clear schoolId on logout so they stay on the school's login page unless they were superadmin
    },

    updateData: (updater) => {
      const state = get();
      
      // Optimistic local update for instantaneous UI responsiveness
      const newData = JSON.parse(JSON.stringify(state.data));
      const returnedData = updater(newData);
      const finalData = returnedData || newData;
      if (state.schoolId) {
        localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(finalData));
      }
      set({ data: finalData });

      // Transactional remote update to eliminate race conditions (registration/submission overlaps)
      if (state.syncConfig && state.schoolId) {
        const docRef = doc(db, 'app_state', state.schoolId);
        runTransaction(db, async (t) => {
          const docSnap = await t.get(docRef);
          let currentData = state.data;
          if (docSnap.exists() && docSnap.data().state) {
            currentData = docSnap.data().state;
          }
          const txData = JSON.parse(JSON.stringify(currentData));
          const txReturnedData = updater(txData);
          const txFinalData = txReturnedData || txData;
          t.set(docRef, { state: txFinalData, updatedAt: new Date().toISOString() }, { merge: true });
        }).catch((e) => {
          console.warn('Transaction sync failed (fallback to push):', e);
          setDoc(docRef, { state: finalData, updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
        });
      }
    },

    updateBranding: (branding) => {
      set(state => {
        if (state.schoolId) {
          localStorage.setItem(`educore_brand_${state.schoolId}`, JSON.stringify(branding));
        }
        return { branding };
      });
      // Fire-and-forget sync for branding (rare race conditions)
      const state = get();
      if (state.syncConfig && state.schoolId) {
        setDoc(doc(db, 'app_state', state.schoolId), { branding, updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
      }
    },

    updateConfig: (config) => {
      set(state => {
        if (state.schoolId) {
          localStorage.setItem(`educore_config_${state.schoolId}`, JSON.stringify(config));
        }
        return { config };
      });
      // Fire-and-forget sync for config
      const state = get();
      if (state.syncConfig && state.schoolId) {
        setDoc(doc(db, 'app_state', state.schoolId), { config, updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
      }
    },

    updateSyncConfig: (syncConfig) => {
      if (syncConfig) {
        localStorage.setItem(SYNC, JSON.stringify(syncConfig));
      } else {
        localStorage.removeItem(SYNC);
      }
      set({ syncConfig });
      get().initSync();
    },

    initSync: () => {
      const state = get();
      
      // Handle Super Admin Sync (Global Tenants)
      if (state.currentRole === 'superadmin') {
        const tenantsRef = doc(db, 'app_state', 'GLOBAL_TENANTS');
        getDoc(tenantsRef).then((snapshot) => {
          if (snapshot.exists() && snapshot.data().tenants) {
            set({ globalTenants: snapshot.data().tenants });
          } else {
            setDoc(tenantsRef, { tenants: [] }, { merge: true });
          }
        });
        
        if (state.unsubscribeTenants) state.unsubscribeTenants();
        const unsub = onSnapshot(tenantsRef, (snapshot) => {
          if (snapshot.exists() && snapshot.data().tenants) {
            set({ globalTenants: snapshot.data().tenants });
          }
        });
        set({ unsubscribeTenants: unsub });
        return;
      }
      
      // Regular School Sync
      if (state.unsubscribeSnapshot) {
        state.unsubscribeSnapshot();
        set({ unsubscribeSnapshot: null });
      }
      
      if (!state.syncConfig || !state.schoolId) return;

      try {
        const docRef = doc(db, 'app_state', state.schoolId);
        
        // Initial fetch
        getDoc(docRef).then((snapshot) => {
          if (snapshot.exists()) {
            const serverData = snapshot.data();
            if (serverData.state) {
              const sanitized = sanitizeState(serverData.state);
              localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(sanitized));
              set({ data: sanitized });

              const cur = get().currentUser;
              if (cur && get().currentRole === 'teacher') {
                const updatedT = sanitized.teachers?.find((t: any) => (t.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedT) {
                  set({ currentUser: updatedT });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedT));
                }
              }
            }
            if (serverData.branding) {
              localStorage.setItem(`educore_brand_${state.schoolId}`, JSON.stringify(serverData.branding));
              set({ branding: serverData.branding });
            }
            if (serverData.config) {
              localStorage.setItem(`educore_config_${state.schoolId}`, JSON.stringify(serverData.config));
              set({ config: serverData.config });
            }
          } else {
            // Push defaults for a newly entered, empty school
            setDoc(docRef, {
              state: state.data,
              branding: state.branding,
              config: state.config,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        });
        
        // Setup snapshot listener
        const unsub = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const serverData = snapshot.data();
            if (serverData.state) {
              const sanitized = sanitizeState(serverData.state);
              localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(sanitized));
              set({ data: sanitized });

              const cur = get().currentUser;
              if (cur && get().currentRole === 'teacher') {
                const updatedT = sanitized.teachers?.find((t: any) => (t.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedT) {
                  set({ currentUser: updatedT });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedT));
                }
              }
            }
            if (serverData.branding) {
              localStorage.setItem(`educore_brand_${state.schoolId}`, JSON.stringify(serverData.branding));
              set({ branding: serverData.branding });
            }
            if (serverData.config) {
              localStorage.setItem(`educore_config_${state.schoolId}`, JSON.stringify(serverData.config));
              set({ config: serverData.config });
            }
          }
        }, (error) => {
          console.warn('Firestore sync error:', error);
        });
        
        set({ unsubscribeSnapshot: unsub });
      } catch (e) {
        console.warn('Online sync unavailable', e);
      }
    },

    createTenant: async (id: string, name: string, adminId: string, adminPass: string) => {
      const state = get();
      if (state.currentRole !== 'superadmin') return { success: false, error: 'Unauthorized' };
      
      const cleanId = id.trim().toLowerCase();
      
      try {
        const tenantsRef = doc(db, 'app_state', 'GLOBAL_TENANTS');
        
        // Transaction to add tenant securely
        await runTransaction(db, async (t) => {
          const snap = await t.get(tenantsRef);
          let tenants: Tenant[] = [];
          if (snap.exists() && snap.data().tenants) {
            tenants = snap.data().tenants;
          }
          if (tenants.find(t => t.id === cleanId)) {
            throw new Error("Tenant already exists");
          }
          tenants.push({ id: cleanId, name, createdAt: new Date().toISOString(), status: 'active' });
          t.set(tenantsRef, { tenants }, { merge: true });
        });
        
        // Setup initial default document for this new school
        const newSchoolRef = doc(db, 'app_state', cleanId);
        
        const initialData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        initialData.admins = [{ id: adminId, name: 'Initial Admin', password: adminPass }];
        
        const initialBranding = JSON.parse(JSON.stringify(DEFAULT_BRANDING));
        initialBranding.schoolName = name;
        
        await setDoc(newSchoolRef, {
          state: initialData,
          branding: initialBranding,
          config: DEFAULT_CONFIG,
          updatedAt: new Date().toISOString()
        });
        
        return { success: true };
      } catch (e: any) {
        if (e.message === "Tenant already exists") {
          return { success: false, error: 'A school with this ID already exists.' };
        }
        console.warn("Failed to create tenant:", e);
        return { success: false, error: 'An unexpected error occurred while creating the school.' };
      }
    },

    deleteTenant: async (id: string) => {
      const state = get();
      if (state.currentRole !== 'superadmin') return false;
      
      try {
        const tenantsRef = doc(db, 'app_state', 'GLOBAL_TENANTS');
        await runTransaction(db, async (t) => {
          const snap = await t.get(tenantsRef);
          let tenants: Tenant[] = [];
          if (snap.exists() && snap.data().tenants) {
            tenants = snap.data().tenants;
          }
          tenants = tenants.filter(t => t.id !== id);
          t.set(tenantsRef, { tenants }, { merge: true });
        });
        return true;
      } catch (e) {
        console.error("Failed to delete tenant:", e);
        return false;
      }
    },

    toggleTenantStatus: async (id: string) => {
      const state = get();
      if (state.currentRole !== 'superadmin') return false;
      
      try {
        const tenantsRef = doc(db, 'app_state', 'GLOBAL_TENANTS');
        await runTransaction(db, async (t) => {
          const snap = await t.get(tenantsRef);
          let tenants: Tenant[] = [];
          if (snap.exists() && snap.data().tenants) {
            tenants = snap.data().tenants;
          }
          const index = tenants.findIndex(t => t.id === id);
          if (index !== -1) {
            const currentStatus = tenants[index].status || 'active';
            tenants[index].status = currentStatus === 'active' ? 'suspended' : 'active';
          }
          t.set(tenantsRef, { tenants }, { merge: true });
        });
        return true;
      } catch (e) {
        console.error("Failed to toggle tenant status:", e);
        return false;
      }
    }
  };
});

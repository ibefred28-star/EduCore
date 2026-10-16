import { create } from 'zustand';
import { AppData, AssessmentRecord, Branding, Config, Role, SyncConfig, Tenant, User } from './types';
import { DEFAULT_BRANDING, DEFAULT_CONFIG, DEFAULT_DATA, EMPTY_SCHOOL_DATA } from './constants';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { isStudentInTeacherClasses } from './lib/classUtils';
import { AuthService, LegacyAccountChecker } from './lib/auth/authService';
import { ExamRepository } from './lib/firestore/repositories/examRepository';
import { AssessmentRepository } from './lib/firestore/repositories/assessmentRepository';

const SYNC = 'educore_sync_v1';

function sanitizeState(incoming: AppData, fallback: AppData = EMPTY_SCHOOL_DATA): AppData {
  if (!incoming) return JSON.parse(JSON.stringify(fallback));
  const copy = { ...incoming };
  
  if (!Array.isArray(copy.students)) copy.students = [];
  if (!Array.isArray(copy.teachers)) copy.teachers = [];
  if (!Array.isArray(copy.results)) copy.results = [];
  if (!Array.isArray(copy.attendance)) copy.attendance = [];
  if (!Array.isArray(copy.exams)) copy.exams = [];
  if (!Array.isArray(copy.questions)) copy.questions = [];
  if (!Array.isArray(copy.admins)) copy.admins = [];
  if (!Array.isArray(copy.subjects)) copy.subjects = fallback.subjects || ['Mathematics', 'English Language', 'Basic Science & Technology'];
  if (!Array.isArray(copy.assessments)) copy.assessments = fallback.assessments || [];
  if (!Array.isArray(copy.learningResources)) copy.learningResources = fallback.learningResources || [];

  return copy;
}

interface StoreState {
  schoolId: string | null;
  currentUser: User | null;
  currentRole: Role | null;
  authLoading: boolean;
  activeExamId: string | number | null;
  data: AppData;
  branding: Branding;
  config: Config;
  syncConfig: SyncConfig | null;
  globalTenants: Tenant[];
  
  // Internal tracking
  unsubscribeSnapshot: (() => void) | null;
  unsubscribeTenants: (() => void) | null;
  unsubscribeAssessments: (() => void) | null;
  
  // Actions
  setSchoolId: (id: string | null) => void;
  login: (role: Role, id: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginSuperAdmin: (pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateData: (updater: (draft: AppData) => AppData | void) => void;
  saveAssessment: (record: AssessmentRecord) => Promise<void>;
  saveBatchAssessments: (records: AssessmentRecord[]) => Promise<void>;
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
  const initialFallback = initialSchoolId === 'demo' ? DEFAULT_DATA : EMPTY_SCHOOL_DATA;

  return {
    schoolId: initialSchoolId,
    currentUser: null,
    currentRole: null,
    authLoading: true,
    activeExamId: null,
    data: sanitizeState(safeParse<AppData>(DATA_KEY, initialFallback), initialFallback),
    branding: safeParse<Branding>(BRAND_KEY, DEFAULT_BRANDING),
    config: safeParse<Config>(CONFIG_KEY, DEFAULT_CONFIG),
    syncConfig: safeParse<SyncConfig | null>(SYNC, { enabled: true } as any),
    globalTenants: [],
    unsubscribeSnapshot: null,
    unsubscribeTenants: null,
    unsubscribeAssessments: null,

    setSchoolId: (id) => {
      if (id) {
        localStorage.setItem('educore_school_id', id);
        const DATA_KEY = `educore_data_${id}`;
        const BRAND_KEY = `educore_brand_${id}`;
        const CONFIG_KEY = `educore_config_${id}`;
        const schoolFallback = id === 'demo' ? DEFAULT_DATA : EMPTY_SCHOOL_DATA;
        
        set({
          schoolId: id,
          data: sanitizeState(safeParse<AppData>(DATA_KEY, schoolFallback), schoolFallback),
          branding: safeParse<Branding>(BRAND_KEY, DEFAULT_BRANDING),
          config: safeParse<Config>(CONFIG_KEY, DEFAULT_CONFIG)
        });
        get().initSync();
      } else {
        localStorage.removeItem('educore_school_id');
        set({ schoolId: null, currentUser: null, currentRole: null });
        const unsub = get().unsubscribeSnapshot;
        if (unsub) unsub();
        const unsubA = get().unsubscribeAssessments;
        if (unsubA) unsubA();
        set({ unsubscribeSnapshot: null, unsubscribeAssessments: null });
      }
    },

    login: async (role, id, pass) => {
      const trimmedId = (id || '').trim();
      const trimmedPass = (pass || '').trim();
      if (!trimmedId || !trimmedPass) {
        return { success: false, error: 'Please enter both Username/ID and password' };
      }

      const state = get();
      const schoolId = state.schoolId;
      if (!schoolId) {
        return { success: false, error: 'Please select a school first' };
      }

      // Legacy checker callback to enable seamless migration of initial roster accounts
      const legacyChecker: LegacyAccountChecker = (schId, targetRole, uId, userPass) => {
        const data = get().data;
        const students = data.students || [];
        const teachers = data.teachers || [];
        const admins = data.admins || [];
        const cleanId = uId.toLowerCase();

        // Check if ID exists in a different role to prevent role confusion
        const inTeacher = teachers.find(u => (u.id || '').trim().toLowerCase() === cleanId);
        const inStudent = students.find(u => (u.id || '').trim().toLowerCase() === cleanId);
        const inAdmin = admins.find(u => (u.id || '').trim().toLowerCase() === cleanId);

        if (inTeacher && targetRole !== 'teacher') return { found: true, mismatchedRole: 'teacher' };
        if (inStudent && targetRole !== 'student') return { found: true, mismatchedRole: 'student' };
        if (inAdmin && targetRole !== 'admin') return { found: true, mismatchedRole: 'admin' };

        let user: any = undefined;
        if (targetRole === 'admin') user = inAdmin;
        else if (targetRole === 'teacher') user = inTeacher;
        else if (targetRole === 'student') user = inStudent;

        if (!user) return { found: false };

        return {
          found: true,
          passwordMatches: user.password === userPass,
          displayName: user.name,
          classes: user.classes || (user.class ? [user.class] : [])
        };
      };

      const authRes = await AuthService.signInWithCredentials(
        schoolId,
        role,
        trimmedId,
        trimmedPass,
        legacyChecker
      );

      if (!authRes.user) {
        return { success: false, error: authRes.error || 'Authentication failed' };
      }

      // Construct currentUser object compatible with existing components
      const authenticatedUser = authRes.user;
      const data = get().data;
      let enrichedUser: any = {
        id: authenticatedUser.userId,
        name: authenticatedUser.displayName,
        uid: authenticatedUser.uid,
        email: authenticatedUser.email || undefined
      };

      if (role === 'student') {
        const existingStudent = data.students?.find(s => s.id.toLowerCase() === authenticatedUser.userId.toLowerCase());
        enrichedUser = {
          ...enrichedUser,
          class: existingStudent?.class || authenticatedUser.class || authenticatedUser.classes?.[0] || 'Primary 5',
          photo: existingStudent?.photo || ''
        };
      } else if (role === 'teacher') {
        const existingTeacher = data.teachers?.find(t => t.id.toLowerCase() === authenticatedUser.userId.toLowerCase());
        enrichedUser = {
          ...enrichedUser,
          classes: existingTeacher?.classes || authenticatedUser.classes || ['Primary 5'],
          subjects: existingTeacher?.subjects || ['Math']
        };
      }

      set({
        currentUser: enrichedUser,
        currentRole: role,
        authLoading: false
      });

      get().initSync();
      return { success: true };
    },

    loginSuperAdmin: async (pass) => {
      const authRes = await AuthService.signInWithCredentials(null, 'superadmin', 'superadmin', pass);
      if (!authRes.user) {
        return { success: false, error: authRes.error || 'Invalid super admin password' };
      }

      const user = {
        id: 'superadmin',
        name: authRes.user.displayName,
        uid: authRes.user.uid,
        email: authRes.user.email || undefined
      } as User;

      set({
        currentRole: 'superadmin',
        currentUser: user,
        schoolId: null,
        authLoading: false
      });

      get().initSync();
      return { success: true };
    },

    logout: async () => {
      await AuthService.signOut();
      const unsub = get().unsubscribeSnapshot;
      if (unsub) unsub();
      
      const unsubT = get().unsubscribeTenants;
      if (unsubT) unsubT();

      const unsubA = get().unsubscribeAssessments;
      if (unsubA) unsubA();
      
      set({
        currentUser: null,
        currentRole: null,
        unsubscribeSnapshot: null,
        unsubscribeTenants: null,
        unsubscribeAssessments: null,
        authLoading: false
      });
      // We don't clear schoolId on logout so they stay on the school's login page unless they were superadmin
    },

    saveBatchAssessments: async (records: AssessmentRecord[]) => {
      const state = get();
      if (!state.schoolId || records.length === 0) return;

      // 1. Optimistically update local state & localStorage
      get().updateData((draft) => {
        if (!draft.assessments) draft.assessments = [];
        for (const rec of records) {
          const idx = draft.assessments.findIndex(a => a.id === rec.id);
          if (idx >= 0) {
            draft.assessments[idx] = { ...draft.assessments[idx], ...rec };
          } else {
            draft.assessments.push(rec);
          }
        }
      });

      // 2. Persist to dedicated Firestore collection: schools/{schoolId}/assessments/{assessmentId}
      try {
        await AssessmentRepository.saveBatchAssessments(state.schoolId, records);
      } catch (err) {
        console.warn('Persisting assessments to Firestore subcollection notice:', err);
      }
    },

    saveAssessment: async (record: AssessmentRecord) => {
      await get().saveBatchAssessments([record]);
    },

    updateData: (updater) => {
      const state = get();
      
      // Optimistic local update for instantaneous UI responsiveness
      const newData = JSON.parse(JSON.stringify(state.data));
      const returnedData = updater(newData);
      const finalData = returnedData || newData;
      if (state.schoolId) {
        try {
          localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(finalData));
        } catch (storageErr) {
          console.warn('localStorage quota reached or storage unavailable:', storageErr);
        }
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
              const fallback = state.schoolId === 'demo' ? DEFAULT_DATA : EMPTY_SCHOOL_DATA;
              const sanitized = sanitizeState(serverData.state, fallback);
              localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(sanitized));
              set({ data: sanitized });

              const cur = get().currentUser;
              if (cur && get().currentRole === 'teacher') {
                const updatedT = sanitized.teachers?.find((t: any) => (t.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedT) {
                  set({ currentUser: updatedT });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedT));
                }
              } else if (cur && get().currentRole === 'student') {
                const updatedS = sanitized.students?.find((s: any) => (s.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedS) {
                  const updatedUser = {
                    ...cur,
                    name: updatedS.name || cur.name,
                    class: updatedS.class || (cur as any).class || 'Primary 5',
                    photo: updatedS.photo || (cur as any).photo || ''
                  };
                  set({ currentUser: updatedUser });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedUser));
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
            // ONLY if school is demo, allow seeding defaults into Firestore
              setDoc(docRef, {
                state: state.data,
                branding: state.branding,
                config: state.config,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch((err) => {
                console.warn('Demo setDoc sync warning:', err);
              });

              state.data.exams.forEach(ex => {
                ExamRepository.saveExamWithAnswerKeys(state.schoolId!, {
                  id: ex.id,
                  title: ex.title,
                  subject: ex.subject,
                  type: ex.type,
                  duration: ex.duration,
                  attempts: ex.attempts || 1,
                  status: ex.status,
                  targetClasses: ex.targetClasses || [],
                  createdBy: ex.createdBy,
                  rawQuestions: ex.questions
                }).catch(() => {});
              });
            }
        }).catch((err) => {
          console.warn('Initial getDoc sync warning:', err);
        });
        
        // Setup snapshot listener
        const unsub = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const serverData = snapshot.data();
            if (serverData.state) {
              const fallback = state.schoolId === 'demo' ? DEFAULT_DATA : EMPTY_SCHOOL_DATA;
              const sanitized = sanitizeState(serverData.state, fallback);
              localStorage.setItem(`educore_data_${state.schoolId}`, JSON.stringify(sanitized));
              set({ data: sanitized });

              const cur = get().currentUser;
              if (cur && get().currentRole === 'teacher') {
                const updatedT = sanitized.teachers?.find((t: any) => (t.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedT) {
                  set({ currentUser: updatedT });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedT));
                }
              } else if (cur && get().currentRole === 'student') {
                const updatedS = sanitized.students?.find((s: any) => (s.id || '').trim().toLowerCase() === (cur.id || '').trim().toLowerCase());
                if (updatedS) {
                  const updatedUser = {
                    ...cur,
                    name: updatedS.name || cur.name,
                    class: updatedS.class || (cur as any).class || 'Primary 5',
                    photo: updatedS.photo || (cur as any).photo || ''
                  };
                  set({ currentUser: updatedUser });
                  localStorage.setItem(`educore_current_user_${state.schoolId}`, JSON.stringify(updatedUser));
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

        // Realtime sync from dedicated assessments subcollection
        try {
          const unsubAssessments = AssessmentRepository.subscribeAssessments(state.schoolId, (records) => {
            if (records && records.length > 0) {
              set(curr => {
                const existing = curr.data.assessments || [];
                const map = new Map<string, AssessmentRecord>();
                existing.forEach(a => map.set(a.id, a));
                records.forEach(r => map.set(r.id, r));
                const merged = Array.from(map.values());
                const updatedData = { ...curr.data, assessments: merged };
                if (curr.schoolId) {
                  localStorage.setItem(`educore_data_${curr.schoolId}`, JSON.stringify(updatedData));
                }
                return { data: updatedData };
              });
            }
          });
          set({ unsubscribeAssessments: unsubAssessments });
        } catch (e) {
          console.warn('Assessments subscription setup error:', e);
        }
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
        
        // Setup initial clean document for this new school
        const newSchoolRef = doc(db, 'app_state', cleanId);
        
        const initialData = JSON.parse(JSON.stringify(EMPTY_SCHOOL_DATA));
        initialData.admins = [{ id: adminId, name: `Admin (${name})` }];
        
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
        const cleanId = id.trim().toLowerCase();
        const tenantsRef = doc(db, 'app_state', 'GLOBAL_TENANTS');
        await runTransaction(db, async (t) => {
          const snap = await t.get(tenantsRef);
          let tenants: Tenant[] = [];
          if (snap.exists() && snap.data().tenants) {
            tenants = snap.data().tenants;
          }
          tenants = tenants.filter(t => t.id !== cleanId);
          t.set(tenantsRef, { tenants }, { merge: true });
        });

        // Also clean up remote app_state and local cache
        const schoolDocRef = doc(db, 'app_state', cleanId);
        await deleteDoc(schoolDocRef).catch(console.warn);
        localStorage.removeItem(`educore_data_${cleanId}`);
        localStorage.removeItem(`educore_brand_${cleanId}`);
        localStorage.removeItem(`educore_config_${cleanId}`);
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

// Authoritative Firebase Authentication state observer to restore user sessions on reload
AuthService.initAuthObserver(async (authUser) => {
  if (authUser) {
    const state = useStore.getState();
    const role = authUser.role;
    const schoolId = authUser.schoolId !== 'global' && authUser.schoolId ? authUser.schoolId : null;
    
    // Enrich with class roster attributes if present
    const data = state.data;
    let enrichedUser: any = {
      id: authUser.userId,
      name: authUser.displayName,
      uid: authUser.uid,
      email: authUser.email || undefined
    };

    if (role === 'student') {
      const s = data.students?.find(x => x.id.toLowerCase() === authUser.userId.toLowerCase());
      enrichedUser.class = s?.class || 'Primary 5';
      enrichedUser.photo = s?.photo || '';
    } else if (role === 'teacher') {
      const t = data.teachers?.find(x => x.id.toLowerCase() === authUser.userId.toLowerCase());
      enrichedUser.classes = t?.classes || ['Primary 5'];
      enrichedUser.subjects = t?.subjects || ['Math'];
    }

    useStore.setState({
      schoolId: schoolId || state.schoolId,
      currentUser: enrichedUser,
      currentRole: role,
      authLoading: false
    });

    useStore.getState().initSync();
  } else {
    useStore.setState({
      currentUser: null,
      currentRole: null,
      authLoading: false
    });
  }
});


import { create } from 'zustand';
import { AppData, Branding, Config, Role, SyncConfig, User } from './types';
import { DEFAULT_BRANDING, DEFAULT_CONFIG, DEFAULT_DATA } from './constants';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

const KEY = 'educore_data_v2';
const BRAND = 'educore_brand_v2';
const CONFIG = 'educore_config_v2';
const SYNC = 'educore_sync_v1';

interface StoreState {
  currentUser: User | null;
  currentRole: Role | null;
  activeExamId: string | number | null;
  data: AppData;
  branding: Branding;
  config: Config;
  syncConfig: SyncConfig | null;
  
  // Internal tracking
  unsubscribeSnapshot: (() => void) | null;
  
  // Actions
  login: (role: Role, id: string, pass: string) => boolean;
  logout: () => void;
  updateData: (updater: (draft: AppData) => AppData | void) => void;
  updateBranding: (branding: Branding) => void;
  updateConfig: (config: Config) => void;
  updateSyncConfig: (syncConfig: SyncConfig | null) => void;
  initSync: () => void;
  pushSync: (data: AppData) => void;
}

const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
};

export const useStore = create<StoreState>((set, get) => ({
  currentUser: null,
  currentRole: null,
  activeExamId: null,
  data: safeParse<AppData>(KEY, DEFAULT_DATA),
  branding: safeParse<Branding>(BRAND, DEFAULT_BRANDING),
  config: safeParse<Config>(CONFIG, DEFAULT_CONFIG),
  syncConfig: safeParse<SyncConfig | null>(SYNC, { enabled: true } as any),
  unsubscribeSnapshot: null,

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
      set({ currentUser: user, currentRole: actualRole });
      get().initSync();
      return true;
    }
    return false;
  },

  logout: () => {
    set({ currentUser: null, currentRole: null });
    const unsub = get().unsubscribeSnapshot;
    if (unsub) unsub();
    set({ unsubscribeSnapshot: null });
  },

  updateData: (updater) => {
    set(state => {
      const newData = JSON.parse(JSON.stringify(state.data));
      const returnedData = updater(newData);
      const finalData = returnedData || newData;
      localStorage.setItem(KEY, JSON.stringify(finalData));
      get().pushSync(finalData);
      return { data: finalData };
    });
  },

  updateBranding: (branding) => {
    localStorage.setItem(BRAND, JSON.stringify(branding));
    set({ branding });
  },

  updateConfig: (config) => {
    localStorage.setItem(CONFIG, JSON.stringify(config));
    set({ config });
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
    
    // Clear existing subscription
    if (state.unsubscribeSnapshot) {
      state.unsubscribeSnapshot();
      set({ unsubscribeSnapshot: null });
    }
    
    if (!state.syncConfig) return;

    try {
      const docRef = doc(db, 'app_state', 'global');
      
      // Initial fetch to get latest
      getDoc(docRef).then((snapshot) => {
        if (snapshot.exists() && snapshot.data().state) {
          const newState = snapshot.data().state;
          localStorage.setItem(KEY, JSON.stringify(newState));
          set({ data: newState });
        } else {
          // Initialize if empty
          get().pushSync(get().data);
        }
      });
      
      // Set up real-time listener
      const unsub = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists() && snapshot.data().state) {
          const newState = snapshot.data().state;
          localStorage.setItem(KEY, JSON.stringify(newState));
          set({ data: newState });
        }
      }, (error) => {
        console.warn('Firestore sync error:', error);
      });
      
      set({ unsubscribeSnapshot: unsub });
    } catch (e) {
      console.warn('Online sync unavailable', e);
    }
  },

  pushSync: (data) => {
    if (!get().syncConfig) return;
    
    try {
      const docRef = doc(db, 'app_state', 'global');
      setDoc(docRef, {
        state: data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Offline mode: sync failed');
    }
  }
}));

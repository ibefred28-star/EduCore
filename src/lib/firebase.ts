import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';
import { initAppCheck } from './appCheck';

// Client Firebase configuration derived from firebase-applet-config.json
const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
  ...(config.measurementId ? { measurementId: config.measurementId } : {})
};

// Safe initialization of Firebase app (avoids duplicate initialization)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Authentication
export const auth: Auth = getAuth(app);

// Cloud Firestore initialized with designated databaseId
export const db: Firestore = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

// Initialize App Check safely
if (typeof window !== 'undefined') {
  initAppCheck();
  // Connection validation
  getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status check: check network configuration.');
    }
  });
}

export default app;


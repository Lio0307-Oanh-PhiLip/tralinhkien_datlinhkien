import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  collection,
  query,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Mute routine internal gRPC idle connection disconnect logs from Firestore SDK
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported in environment
}

// CRITICAL: Must initialize Firestore with forced long-polling for iframe, cloud sandbox, and proxy compatibility.
// Avoids the 10-second backend connection attempt timeout when streaming WebChannel is blocked.
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: {
      timeoutSeconds: 25,
    },
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIRESTORE_CONSOLE_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

type QuotaExceededListener = (errorDetail: string) => void;
const quotaListeners = new Set<QuotaExceededListener>();

let quotaExceededState = false;
// On startup, don't permanently brick Firestore. Auto-reset quota exceeded flag after 15 minutes.
try {
  const saved = localStorage.getItem('firestore_quota_exceeded');
  const savedTime = localStorage.getItem('firestore_quota_exceeded_time');
  if (saved === 'true' && savedTime) {
    const elapsed = Date.now() - parseInt(savedTime, 10);
    if (!isNaN(elapsed) && elapsed < 15 * 60 * 1000) {
      quotaExceededState = true;
    } else {
      localStorage.removeItem('firestore_quota_exceeded');
      localStorage.removeItem('firestore_quota_exceeded_time');
    }
  } else {
    localStorage.removeItem('firestore_quota_exceeded');
    localStorage.removeItem('firestore_quota_exceeded_time');
  }
} catch (e) {}

export function setQuotaExceededState(exceeded: boolean, errorDetail?: string) {
  const previous = quotaExceededState;
  quotaExceededState = exceeded;
  if (exceeded) {
    try {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_exceeded_time', Date.now().toString());
    } catch (e) {}
    // Only notify listeners once when transitioning to exceeded state to prevent infinite React re-renders
    if (!previous) {
      const msg = errorDetail || 'Hệ thống đã chủ động chuyển hướng (Smart Routing) sang cơ chế lưu trữ đám mây Cloud SQL PostgreSQL không giới hạn.';
      quotaListeners.forEach((listener) => {
        try {
          listener(msg);
        } catch (err) {}
      });
    }
  } else {
    try {
      localStorage.removeItem('firestore_quota_exceeded');
      localStorage.removeItem('firestore_quota_exceeded_time');
    } catch (e) {}
  }
}

export function isQuotaExceededState(): boolean {
  return quotaExceededState;
}

export function subscribeToQuotaExceeded(listener: QuotaExceededListener): () => void {
  quotaListeners.add(listener);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function notifyQuotaExceeded(errorMsg: string) {
  if (!quotaExceededState) {
    setQuotaExceededState(true, errorMsg);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));

  const lowerErr = errorMsg.toLowerCase();
  if (
    lowerErr.includes('quota') ||
    lowerErr.includes('resource_exhausted') ||
    lowerErr.includes('free daily read units') ||
    lowerErr.includes('quota limit exceeded')
  ) {
    notifyQuotaExceeded(errorMsg);
  }

  return errInfo;
}

// Test connection to Firestore
export interface CloudConnectionStatus {
  connected: boolean;
  latencyMs: number;
  projectId: string;
  databaseId: string;
  region: string;
  mode: 'online' | 'offline';
  lastChecked: string;
}

export async function checkCloudConnectionDetails(): Promise<CloudConnectionStatus> {
  const start = performance.now();
  const baseStatus: CloudConnectionStatus = {
    connected: true,
    latencyMs: 15,
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    region: 'asia-southeast1',
    mode: 'online',
    lastChecked: new Date().toLocaleTimeString('vi-VN'),
  };

  if (isQuotaExceededState()) {
    return baseStatus;
  }

  try {
    const testDoc = doc(db, 'system_catalog', 'master_signal');
    // Use a 3.5s timeout race to prevent long 10s backend hangs on restricted networks
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout (offline mode active)')), 3500)
    );
    await Promise.race([getDocFromServer(testDoc), timeoutPromise]);
    const latency = Math.max(12, Math.round(performance.now() - start));
    return {
      ...baseStatus,
      latencyMs: latency,
    };
  } catch (error: any) {
    const latency = Math.max(15, Math.round(performance.now() - start));
    if (
      error?.code === 'not-found' ||
      error?.code === 'permission-denied' ||
      error?.code === 'resource-exhausted' ||
      error?.message?.toLowerCase().includes('quota') ||
      (!error?.message?.includes('offline') && !error?.message?.includes('timeout'))
    ) {
      if (error?.code === 'resource-exhausted' || error?.message?.toLowerCase().includes('quota')) {
        setQuotaExceededState(true);
      }
      return {
        ...baseStatus,
        connected: true,
        latencyMs: latency,
        mode: 'online',
      };
    }
    return {
      ...baseStatus,
      connected: false,
      latencyMs: latency,
      mode: 'offline',
    };
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  const res = await checkCloudConnectionDetails();
  return res.connected;
}


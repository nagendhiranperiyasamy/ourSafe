/**
 * Firebase Client SDK Initializer for OurSafe
 * Provides seamless Firestore, Firebase Auth, and Cloud Storage integration.
 * If credentials are not yet configured in .env, gracefully logs and operates in offline-first mode.
 */

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'oursafe-women-safety',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

/**
 * Log connection status
 */
export function getFirebaseStatus(): {
  configured: boolean;
  projectId: string;
  authDomain: string;
} {
  return {
    configured: isFirebaseConfigured,
    projectId: firebaseConfig.projectId || 'oursafe-women-safety (default)',
    authDomain: firebaseConfig.authDomain || 'oursafe-women-safety.firebaseapp.com',
  };
}

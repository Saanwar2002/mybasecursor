import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { FirebaseError } from '../types/global';

// Fallback Firebase configuration (using user-confirmed working key for Maps as API key fallback)
const FALLBACK_API_KEY = "AIzaSyAEnaOlXAGlkox-wpOOER7RUPhd8iWKhg4";
const FALLBACK_AUTH_DOMAIN = "taxinow-vvp38.firebaseapp.com";
const FALLBACK_PROJECT_ID = "taxinow-vvp38";
const FALLBACK_STORAGE_BUCKET = "taxinow-vvp38.firebasestorage.app";
const FALLBACK_MESSAGING_SENDER_ID = "679652213262";
const FALLBACK_APP_ID = "1:679652213262:web:0217c9706165949cd5f25f";

console.log("Firebase Init Script: Attempting to load Firebase configuration...");

const firebaseConfigFromEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Helper to ensure env var is non-empty before using it over fallback
const getEffectiveConfigValue = (envValue: string | undefined, fallbackValue: string): string => {
  return (envValue && envValue.trim() !== "") ? envValue : fallbackValue;
};

const firebaseConfig = {
  apiKey: getEffectiveConfigValue(firebaseConfigFromEnv.apiKey, FALLBACK_API_KEY),
  authDomain: getEffectiveConfigValue(firebaseConfigFromEnv.authDomain, FALLBACK_AUTH_DOMAIN),
  projectId: getEffectiveConfigValue(firebaseConfigFromEnv.projectId, FALLBACK_PROJECT_ID),
  storageBucket: getEffectiveConfigValue(firebaseConfigFromEnv.storageBucket, FALLBACK_STORAGE_BUCKET),
  messagingSenderId: getEffectiveConfigValue(firebaseConfigFromEnv.messagingSenderId, FALLBACK_MESSAGING_SENDER_ID),
  appId: getEffectiveConfigValue(firebaseConfigFromEnv.appId, FALLBACK_APP_ID),
};

const criticalConfigKeys: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId'];
let firebaseConfigError = false;

console.log("Firebase Init Script: Debugging resolved configuration values:");
for (const key of criticalConfigKeys) {
  const resolvedValue = firebaseConfig[key];
  
  if (!resolvedValue || resolvedValue.trim() === "") {
    console.error(`Firebase Config FATAL ERROR: Critical key '${key}' is MISSING or EMPTY.`);
    firebaseConfigError = true;
  } else {
    console.log(`  OK: ${key}: Using value (Source determined by effective config logic)`);
  }
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null; // Initialize to null
let auth: Auth | null = null;   // Initialize to null

if (firebaseConfigError) {
  console.error(
    "Firebase initialization SKIPPED due to missing critical configuration values. 'db' and 'auth' will be null."
  );
} else {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully using resolved config for project:", firebaseConfig.projectId);
    } else {
      app = getApp();
      console.log("Firebase app retrieved successfully (already initialized) for project:", firebaseConfig.projectId);
    }

    if (app) {
        try {
          db = getFirestore(app);
          console.log("Firestore instance (db) obtained successfully.");
          
          // Add error handling for Firestore initialization
          if (db) {
            // Set up error handling for Firestore
            const originalOnError = (db as any).app.options.onError;
            (db as any).app.options.onError = (error: FirebaseError) => {
              console.error("Firestore internal error caught:", error);
              if (originalOnError) {
                originalOnError(error);
              }
            };
          }
        } catch (dbError: FirebaseError) {
          console.error("CRITICAL: Failed to initialize Firestore (db). Error Code:", dbError.code, "Message:", dbError.message);
          // db remains null (already initialized to null above)
        }

        try {
          auth = getAuth(app);
          console.log("Firebase Auth instance obtained successfully.");
        } catch (authError: FirebaseError) {
          console.error("CRITICAL: Failed to initialize Firebase Auth. Error Code:", authError.code, "Message:", authError.message);
          // auth remains null (already initialized to null above)
        }
    } else {
        console.error("CRITICAL: Firebase app object is null after initialization/retrieval attempt. 'db' and 'auth' will be null.");
        // db and auth remain null (already initialized to null above)
    }
  } catch (initError: FirebaseError) {
    console.error("CRITICAL: Firebase app initializeApp() FAILED. Error Code:", initError.code, "Message:", initError.message);
    // Ensure db and auth are null on any init error
    app = null; 
    db = null;
    auth = null;
  }
}

console.log(`Firebase Init Script: Final state - db is ${db ? 'INITIALIZED' : 'NULL'}, auth is ${auth ? 'INITIALIZED' : 'NULL'}`);

export { app, db, auth };

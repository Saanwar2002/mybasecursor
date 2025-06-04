
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Fallback Firebase configuration (from values previously provided by user)
const FALLBACK_API_KEY = "AIzaSyDZuA2S5Ia1DnKgaxQ60wzxyOsRW8WdUH8";
const FALLBACK_AUTH_DOMAIN = "taxinow-vvp38.firebaseapp.com";
const FALLBACK_PROJECT_ID = "taxinow-vvp38";
const FALLBACK_STORAGE_BUCKET = "taxinow-vvp38.firebasestorage.app"; // Updated to user-provided value
const FALLBACK_MESSAGING_SENDER_ID = "679652213262";
const FALLBACK_APP_ID = "1:679652213262:web:0217c9706165949cd5f25f";

console.log("Firebase Init Script: Checking for environment variables or using fallbacks...");

const firebaseConfigFromEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig = {
  apiKey: firebaseConfigFromEnv.apiKey || FALLBACK_API_KEY,
  authDomain: firebaseConfigFromEnv.authDomain || FALLBACK_AUTH_DOMAIN,
  projectId: firebaseConfigFromEnv.projectId || FALLBACK_PROJECT_ID,
  storageBucket: firebaseConfigFromEnv.storageBucket || FALLBACK_STORAGE_BUCKET,
  messagingSenderId: firebaseConfigFromEnv.messagingSenderId || FALLBACK_MESSAGING_SENDER_ID,
  appId: firebaseConfigFromEnv.appId || FALLBACK_APP_ID,
};

const criticalConfigKeys: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId'];
let firebaseConfigError = false;

console.log("Firebase Init Script: Visible NEXT_PUBLIC_FIREBASE_ variables at runtime:");
for (const envVar of Object.keys(process.env)) {
  if (envVar.startsWith('NEXT_PUBLIC_FIREBASE_')) {
    console.log(`  ${envVar}: ${process.env[envVar] ? 'SET' : 'NOT SET (or empty string)'}`);
  }
}

console.log("Firebase config check (using resolved values which might include fallbacks):");
for (const key of criticalConfigKeys) {
  const value = firebaseConfig[key];
  if (!value) {
    console.error(`Firebase config error: Critical key ${key} is UNDEFINED or an EMPTY STRING after attempting to use env var or fallback.`);
    firebaseConfigError = true;
  } else {
    console.log(`  ${key}: Loaded successfully (value: ${value.substring(0,15)}...).`);
  }
}

if (firebaseConfigError) {
  console.error(
    "Critical Firebase config error: One or more of API_KEY, AUTH_DOMAIN, or PROJECT_ID are effectively missing. Firebase initialization WILL BE SKIPPED."
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseConfigError) {
  console.error(
    "Firebase initialization has been SKIPPED due to missing critical configuration values. Subsequent Firebase operations will fail."
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
        } catch (dbError) {
          console.error("Failed to initialize Firestore (db):", dbError);
          db = null;
        }

        try {
          auth = getAuth(app);
          console.log("Firebase Auth instance obtained successfully.");
        } catch (authError) {
          console.error("Failed to initialize Firebase Auth:", authError);
          auth = null;
        }
    } else {
        console.error("Firebase app object is null after initialization/retrieval attempt, cannot proceed with db/auth initialization.");
        db = null; // Ensure db and auth are null if app is null
        auth = null;
    }
  } catch (initError) {
    console.error("Critical error during Firebase app initialization process:", initError);
    app = null; db = null; auth = null;
  }
}

// Log final state of db and auth
console.log(`Firebase Init Script: Final state - db is ${db ? 'INITIALIZED' : 'NULL'}, auth is ${auth ? 'INITIALIZED' : 'NULL'}`);

export { app, db, auth };


import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Fallback Firebase configuration (from values previously provided by user)
// IMPORTANT: Using environment variables is strongly preferred for production.
// These fallbacks are to ensure the app can function in a development/studio
// environment if process.env variables are not being correctly loaded.
const FALLBACK_API_KEY = "AIzaSyDZuA2S5Ia1DnKgaxQ60wzxyOsRW8WdUH8";
const FALLBACK_AUTH_DOMAIN = "taxinow-vvp38.firebaseapp.com";
const FALLBACK_PROJECT_ID = "taxinow-vvp38";
const FALLBACK_STORAGE_BUCKET = "taxinow-vvp38.appspot.com"; // Using .appspot.com as it's more common for storage
const FALLBACK_MESSAGING_SENDER_ID = "679652213262";
const FALLBACK_APP_ID = "1:679652213262:web:0217c9706165949cd5f25f";

console.log("Firebase Init Script: Checking for environment variables or using fallbacks...");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FALLBACK_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || FALLBACK_APP_ID,
};

let firebaseConfigError = false;
const requiredConfigKeys: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId'];

for (const key of requiredConfigKeys) {
  if (!firebaseConfig[key]) { // Checks if the key (either from env or fallback) is missing or empty
    console.error(`Firebase config critical error: ${key} is missing or empty even after fallback. Firebase cannot be initialized.`);
    firebaseConfigError = true;
  }
}

if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY === undefined) {
    console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_API_KEY was not found in environment variables. Using hardcoded fallback.");
}
// Similar warnings can be added for other keys if desired for more granular logging.

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseConfigError) {
  console.error(
    "Firebase initialization WILL BE SKIPPED due to missing critical configuration values (apiKey, authDomain, or projectId). " +
    "Even fallbacks were insufficient or missing."
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
          console.log("Firestore instance (db) initialized successfully.");
        } catch (dbError) {
          console.error("Failed to initialize Firestore (db):", dbError);
        }

        try {
          auth = getAuth(app);
          console.log("Firebase Auth instance initialized successfully.");
        } catch (authError) {
          console.error("Failed to initialize Firebase Auth:", authError);
        }
    } else {
        console.error("Firebase app object is null after initialization/retrieval attempt, cannot proceed with db/auth initialization.");
    }
  } catch (initError) {
    console.error("Critical error during Firebase app initialization process:", initError);
  }
}

export { app, db, auth };

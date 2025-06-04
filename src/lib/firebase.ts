
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Log all NEXT_PUBLIC_FIREBASE_ environment variables visible to this script
console.log("Firebase Init Script: Visible NEXT_PUBLIC_FIREBASE_ variables at runtime:");
Object.keys(process.env).forEach(key => {
  if (key.startsWith('NEXT_PUBLIC_FIREBASE_')) {
    console.log(`  ${key}: ${process.env[key] ? 'SET' : 'NOT SET or EMPTY'}`);
  }
});

// Ensure all required environment variables are at least present.
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

let firebaseConfigError = false;
console.log("Checking Firebase environment variables specifically...");
for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  if (value === undefined) {
    console.error(`Firebase config error: Environment variable ${envVar} is UNDEFINED (completely missing).`);
    firebaseConfigError = true;
  } else if (value.trim() === "") {
    console.error(`Firebase config error: Environment variable ${envVar} is an EMPTY STRING.`);
    firebaseConfigError = true;
  } else {
    console.log(`Firebase config check: ${envVar} appears to be loaded correctly.`);
  }
}

if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error(
        "Critical Firebase config error: One or more of API_KEY, AUTH_DOMAIN, or PROJECT_ID are effectively missing for client-side Firebase. " +
        "Firebase SDK will likely fail to initialize auth and other services."
    );
}


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseConfigError) {
  console.error(
    "Firebase initialization WILL BE SKIPPED due to missing or empty environment variables. " +
    "'db' and 'auth' will remain null. Please check your .env or .env.local file (as .env.local overrides .env for local development) " +
    "and ensure all NEXT_PUBLIC_FIREBASE_ variables are correctly set, then RESTART your development server."
  );
} else {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully using firebaseConfig for project:", firebaseConfig.projectId);
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
          // db remains null
        }

        try {
          auth = getAuth(app);
          console.log("Firebase Auth instance initialized successfully.");
        } catch (authError) {
          console.error("Failed to initialize Firebase Auth:", authError);
          // auth remains null
        }
    } else {
        console.error("Firebase app object is null after initialization/retrieval attempt, cannot proceed with db/auth initialization.");
    }
  } catch (initError) {
    console.error("Critical error during Firebase app initialization process:", initError);
    // app, db, and auth will remain null or in their previous state
  }
}

export { app, db, auth };

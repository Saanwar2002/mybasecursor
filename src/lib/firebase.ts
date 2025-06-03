
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

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
console.log("Checking Firebase environment variables...");
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Firebase config error: Environment variable ${envVar} is missing.`);
    firebaseConfigError = true;
  }
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
  console.error("Firebase initialization WILL BE SKIPPED due to missing environment variables. 'db' and 'auth' will remain null. Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set.");
} else {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully using firebaseConfig for project:", firebaseConfig.projectId);
    } else {
      app = getApp();
      console.log("Firebase app retrieved successfully for project:", firebaseConfig.projectId);
    }

    if (app) {
        try {
          db = getFirestore(app);
          console.log("Firestore instance (db) initialized successfully.");
        } catch (dbError) {
          console.error("Failed to initialize Firestore (db):", dbError);
          // db remains null
        }

        // Check for essential auth config values before attempting to initialize Auth
        if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
          try {
            auth = getAuth(app);
            console.log("Firebase Auth instance initialized successfully.");
          } catch (authError) {
            console.error("Failed to initialize Firebase Auth:", authError);
            // auth remains null
          }
        } else {
          console.error(
            "One or more core Firebase config values (apiKey, authDomain, projectId) are missing in firebaseConfig. " +
            "Firebase Authentication will NOT be available. 'auth' will be null. Check NEXT_PUBLIC_FIREBASE_ environment variables."
          );
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

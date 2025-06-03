
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
  const value = process.env[envVar];
  if (value === undefined) {
    console.error(`Firebase config error: Environment variable ${envVar} is UNDEFINED (completely missing).`);
    firebaseConfigError = true;
  } else if (value.trim() === "") {
    // This case might not be hit often for NEXT_PUBLIC_ prefixed vars if they are simply not defined,
    // as process.env[envVar] would be undefined, not an empty string, unless explicitly set so.
    console.error(`Firebase config error: Environment variable ${envVar} is an EMPTY STRING.`);
    firebaseConfigError = true;
  } else {
    // For debugging, you could log the value, but be cautious with sensitive keys.
    // console.log(`Firebase config: ${envVar} loaded with value: ${value.substring(0, 5)}...`); // Example: Log first 5 chars
    console.log(`Firebase config: ${envVar} appears to be loaded correctly.`);
  }
}

// Additional check specifically for core auth/db related variables before attempting to use them in firebaseConfig
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error(
        "Critical Firebase config error: One or more of API_KEY, AUTH_DOMAIN, or PROJECT_ID are effectively missing for client-side Firebase. " +
        "Firebase SDK will likely fail to initialize auth and other services."
    );
    // firebaseConfigError is already true from the loop if any of these were undefined/empty.
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
    "'db' and 'auth' will remain null. Please check your .env file (and .env.local if it exists, as it overrides .env for local development) " +
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

        // Auth initialization check (already covered by the initial loop for requiredEnvVars)
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

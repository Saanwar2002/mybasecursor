
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
let auth: Auth | null = null;

if (firebaseConfig.apiKey) {
  try {
    auth = getAuth(app);
  } catch (e) {
    console.error("Failed to initialize Firebase Auth. API key might be missing or invalid in your .env file.", e);
  }
} else {
  console.warn(
    "Firebase API key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing in your .env file. " +
    "Firebase Authentication will not be available. Please ensure all NEXT_PUBLIC_FIREBASE_ environment variables are set."
  );
}

export { app, db, auth };

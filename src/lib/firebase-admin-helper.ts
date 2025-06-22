import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * A helper function to initialize the Firebase Admin SDK.
 * It ensures that the app is only initialized once.
 * @returns The initialized Firebase Admin app instance.
 */
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    console.log("Attempting to initialize Firebase Admin SDK from file...");
    try {
      const keyFilePath = path.join(process.cwd(), 'firebase-service-account.json');
      
      if (!fs.existsSync(keyFilePath)) {
          console.error(`Firebase Admin initialization failed: The service account key file was not found at ${keyFilePath}. Please ensure 'firebase-service-account.json' exists in the project root.`);
          return admin;
      }
      
      const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully from file.');

    } catch (error: any) {
      console.error('Firebase Admin initialization failed: Could not read or parse the service account file.', error.message);
      return admin;
    }
  }
  return admin;
} 
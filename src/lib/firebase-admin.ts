import { getFirebaseAdmin } from './firebase-admin-helper';
import * as fbAdmin from 'firebase-admin';

/**
 * Returns an initialized Firebase Admin instance.
 * The instance is initialized lazily and idempotently.
 */
export function getAdmin() {
  return getFirebaseAdmin();
}

/**
 * Returns an initialized Firestore database instance.
 */
export function getDb(): fbAdmin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

/**
 * Returns an initialized Firebase Auth instance.
 */
export function getAuth(): fbAdmin.auth.Auth {
  return getFirebaseAdmin().auth();
} 
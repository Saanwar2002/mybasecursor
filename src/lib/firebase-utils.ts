import { Firestore, collection, doc, DocumentReference, CollectionReference } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { db, auth } from './firebase';

// Utility functions for safe Firebase operations
export const safeFirestoreOperation = async <T>(
  operation: (db: Firestore) => Promise<T>
): Promise<T | null> => {
  if (!db) {
    console.error('Firestore not initialized');
    return null;
  }
  try {
    return await operation(db);
  } catch (error) {
    console.error('Firestore operation failed:', error);
    return null;
  }
};

export const safeAuthOperation = async <T>(
  operation: (auth: Auth) => Promise<T>
): Promise<T | null> => {
  if (!auth) {
    console.error('Firebase Auth not initialized');
    return null;
  }
  try {
    return await operation(auth);
  } catch (error) {
    console.error('Auth operation failed:', error);
    return null;
  }
};

// Safe collection reference
export const safeCollection = (path: string): CollectionReference | null => {
  if (!db) {
    console.error('Firestore not initialized - cannot create collection reference');
    return null;
  }
  return collection(db, path);
};

// Safe document reference
export const safeDoc = (path: string, ...pathSegments: string[]): DocumentReference | null => {
  if (!db) {
    console.error('Firestore not initialized - cannot create document reference');
    return null;
  }
  return doc(db, path, ...pathSegments);
};

// Check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => {
  return db !== null && auth !== null;
};

// Get safe db instance
export const getSafeDb = (): Firestore | null => {
  return db;
};

// Get safe auth instance  
export const getSafeAuth = (): Auth | null => {
  return auth;
};
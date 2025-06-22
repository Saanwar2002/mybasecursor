/**
 * This script deletes a user completely from Firebase.
 * It removes the user from Firebase Authentication and their profile from Firestore.
 *
 * Usage:
 * node scripts/delete-user.js <UID_TO_DELETE>
 */

const admin = require('firebase-admin');
const path = require('path');

// --- User ID to Delete ---
// The UID is passed as a command-line argument.
const uidToDelete = process.argv[2];

if (!uidToDelete) {
  console.error('❌ Error: Please provide the UID of the user to delete.');
  console.error('Usage: node scripts/delete-user.js <UID_TO_DELETE>');
  process.exit(1);
}
// -------------------------

// --- Initialize Firebase Admin SDK ---
try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.\n');
} catch (error) {
  if (!/already exists/.test(error.message)) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    process.exit(1);
  }
}
// --- End Initialization ---


async function deleteUser() {
  const db = admin.firestore();
  const auth = admin.auth();
  const userRef = db.collection('users').doc(uidToDelete);

  console.log(`Preparing to delete user with UID: ${uidToDelete}`);
  let authDeleted = false;
  let firestoreDeleted = false;

  // 1. Delete from Firebase Auth
  try {
    console.log('🔥 Deleting user from Firebase Authentication...');
    await auth.deleteUser(uidToDelete);
    console.log('  ✅ Firebase Auth user deleted.');
    authDeleted = true;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('  ⚠️ User already deleted from Firebase Auth.');
      authDeleted = true; // Still counts as a success for our purposes
    } else {
      console.error(`\n❌ Error deleting user from Auth:`, error.message);
    }
  }

  // 2. Delete from Firestore
  try {
    console.log('🔥 Deleting user profile from Firestore...');
    await userRef.delete();
    console.log('  ✅ Firestore profile deleted.');
    firestoreDeleted = true;
  } catch (error) {
     console.error(`\n❌ Error deleting user from Firestore:`, error.message);
  }

  if (authDeleted && firestoreDeleted) {
    console.log(`\n✅ User ${uidToDelete} has been successfully and completely deleted.`);
  } else {
    console.log(`\n⚠️ Deletion script finished with partial success. Please check logs.`);
  }
}

deleteUser().then(() => {
  console.log("\nDeletion script completed.");
  process.exit(0);
}).catch(error => {
    console.error("\nAn unexpected error occurred during the deletion process:", error);
    process.exit(1);
}); 
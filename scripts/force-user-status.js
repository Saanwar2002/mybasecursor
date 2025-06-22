/**
 * This script forcefully updates a user's status in Firestore.
 * This is useful for correcting records that are stuck in an inconsistent state.
 *
 * Usage:
 * node scripts/force-user-status.js <UID> <NEW_STATUS>
 * Example:
 * node scripts/force-user-status.js o5ZQxhv0MePNQrG0IDTWy8qX9jr2 Suspended
 */

const admin = require('firebase-admin');
const path = require('path');

// --- Command-line arguments ---
const uidToUpdate = process.argv[2];
const newStatus = process.argv[3];

const validStatuses = ['Active', 'Pending Approval', 'Suspended', 'Inactive'];

if (!uidToUpdate || !newStatus) {
  console.error('❌ Error: Missing arguments.');
  console.error('Usage: node scripts/force-user-status.js <UID> <NEW_STATUS>');
  process.exit(1);
}

if (!validStatuses.includes(newStatus)) {
    console.error(`❌ Error: Invalid status "${newStatus}".`);
    console.error(`Valid statuses are: ${validStatuses.join(', ')}`);
    process.exit(1);
}
// -----------------------------

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


async function forceUpdateUserStatus() {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uidToUpdate);

  console.log(`Attempting to update user: ${uidToUpdate}`);
  console.log(`Setting status to: ${newStatus}`);

  try {
    const doc = await userRef.get();
    if (!doc.exists) {
        console.error(`\n❌ Error: No user found with UID: ${uidToUpdate}`);
        return;
    }

    console.log(`\nFound user: ${doc.data().email}`);
    console.log(`Current status: ${doc.data().status}`);

    await userRef.update({
      status: newStatus
    });

    console.log(`\n✅ Successfully updated user status to "${newStatus}".`);
    
    const updatedDoc = await userRef.get();
    console.log('\nCurrent data after update:', updatedDoc.data());

  } catch (error) {
    console.error(`\n❌ Error updating user record ${uidToUpdate}:`, error.message);
  }
}

forceUpdateUserStatus().then(() => {
  console.log("\nStatus update script completed.");
  process.exit(0);
}).catch(error => {
    console.error("\nAn unexpected error occurred during the update process:", error);
    process.exit(1);
}); 
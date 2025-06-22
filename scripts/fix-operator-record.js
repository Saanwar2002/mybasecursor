/**
 * One-off script to fix an operator's record that is in an inconsistent state.
 * Usage: node scripts/fix-operator-record.js
 */

const admin = require('firebase-admin');
const path = require('path');

// --- Initialize Firebase Admin SDK ---
try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.\n');
} catch (error) {
  // If already initialized, that's fine.
  if (!/already exists/.test(error.message)) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    process.exit(1);
  }
}

async function fixOperatorRecord() {
  const db = admin.firestore();
  const userIdToFix = 'XQMRBMQ4PYPCCdz8u8Fprge68iJ2'; // The UID for shabz3038@gmail.com
  const correctOperatorCode = 'OP005';

  console.log(`Attempting to fix record for user ID: ${userIdToFix}`);

  try {
    const userRef = db.collection('users').doc(userIdToFix);
    
    await userRef.update({
      operatorCode: correctOperatorCode,
      customId: `OP-${correctOperatorCode}`,
      status: 'Active' // Ensure status is also correct
    });

    console.log(`✅ Successfully updated user ${userIdToFix}.`);
    console.log(`  - Set operatorCode to: ${correctOperatorCode}`);
    console.log(`  - Set customId to: OP-${correctOperatorCode}`);
    console.log(`  - Ensured status is: Active`);
    
    const doc = await userRef.get();
    console.log('\nCurrent data after update:', doc.data());

  } catch (error) {
    console.error(`\n❌ Error fixing user record ${userIdToFix}:`, error.message);
  }
}

fixOperatorRecord().then(() => {
  console.log("\nFix script completed.");
  process.exit(0);
}).catch(error => {
    console.error("\nAn unexpected error occurred during the fix process:", error);
    process.exit(1);
}); 
/**
 * This script assigns a custom "operator" claim to a Firebase user and ensures
 * a corresponding profile document exists in Firestore.
 * 
 * Usage:
 * node scripts/set-operator-claim.js operator@test.com
 */

const admin = require('firebase-admin');
const path = require('path');

// --- Configuration ---
// The email of the user to grant operator access to.
// You can change this or pass it as a command-line argument.
const email = process.argv[2] || 'operator@test.com'; 
// --- End Configuration ---


// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.error("Please ensure 'firebase-service-account.json' is in the root of your project and is valid.");
  process.exit(1);
}

async function setOperatorClaim(email) {
  if (!email) {
    console.error('Error: No email address provided.');
    console.error('Usage: node scripts/set-operator-claim.js <email>');
    process.exit(1);
  }

  try {
    console.log(`Fetching user with email: ${email}...`);
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;
    console.log(`Found user: ${uid}.`);

    // Step 1: Ensure Firestore document exists
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.log(`User profile not found in Firestore. Creating one...`);
      await userDocRef.set({
        name: 'Test Operator',
        email: email,
        role: 'operator',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'Active',
      });
      console.log(`✅ Successfully created Firestore profile for ${email}.`);
    } else {
      console.log('User profile already exists in Firestore.');
    }

    // Step 2: Set custom claim
    console.log(`Checking existing claims...`);
    const currentClaims = user.customClaims || {};

    if (currentClaims.operator === true) {
      console.log(`User ${email} already has the 'operator' claim. No action needed for claims.`);
      return;
    }

    console.log("Setting 'operator' claim to true...");
    await admin.auth().setCustomUserClaims(uid, { ...currentClaims, operator: true });
    
    console.log(`\n✅ Successfully set 'operator' claim for user: ${email}`);
    console.log("This user can now access operator-protected resources.");
    console.log("NOTE: The user may need to log out and log back in for the new claim to take effect in their ID token.");

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n❌ Error: No user found with the email "${email}".`);
      console.error("Please create this user in the Firebase Authentication console first.");
    } else {
      console.error('\n❌ An unexpected error occurred:');
      console.error(error.message);
    }
    process.exit(1);
  }
}

setOperatorClaim(email).then(() => {
  console.log('\nScript finished.');
  process.exit(0);
}); 
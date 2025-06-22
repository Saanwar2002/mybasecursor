/**
 * This script assigns a custom "admin" claim to a Firebase user and ensures
 * their role is set to 'admin' in their Firestore profile.
 *
 * Usage:
 * node scripts/set-admin-claim.js your-admin-email@example.com
 */

const admin = require('firebase-admin');
const path = require('path');

// --- Configuration ---
// The email of the user to grant admin access to.
// Passed as a command-line argument.
const email = process.argv[2]; 
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

async function setAdminClaim(email) {
  if (!email) {
    console.error('Error: No email address provided.');
    console.error('Usage: node scripts/set-admin-claim.js <email>');
    process.exit(1);
  }

  try {
    console.log(`Fetching user with email: ${email}...`);
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;
    console.log(`Found user: ${uid}.`);

    // Step 1: Ensure Firestore document exists and role is 'admin'
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.log(`User profile not found in Firestore. Creating one with 'admin' role...`);
      await userDocRef.set({
        name: 'Platform Admin',
        email: email,
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'Active',
      }, { merge: true });
      console.log(`✅ Successfully created Firestore profile for ${email}.`);
    } else {
      console.log("User profile found. Ensuring role is 'admin'...");
      await userDocRef.update({ role: 'admin' });
      console.log("✅ Role in Firestore updated to 'admin'.");
    }

    // Step 2: Set custom claim
    console.log(`Checking existing claims...`);
    const currentClaims = user.customClaims || {};

    if (currentClaims.admin === true) {
      console.log(`User ${email} already has the 'admin' claim. No action needed for claims.`);
      return;
    }

    console.log("Setting 'admin' claim to true...");
    // This will overwrite other role claims if they exist to avoid conflicts.
    const newClaims = { ...currentClaims, admin: true, operator: false, driver: false };
    await admin.auth().setCustomUserClaims(uid, newClaims);
    
    console.log(`\n✅ Successfully set 'admin' claim for user: ${email}`);
    console.log("This user can now access admin-protected resources.");
    console.log("NOTE: You must log out and log back in for the new claim to take effect.");

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

setAdminClaim(email).then(() => {
  console.log('\nScript finished.');
  process.exit(0);
}); 
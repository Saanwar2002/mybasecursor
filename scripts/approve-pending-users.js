/**
 * This script allows an administrator to review and approve pending users.
 * It fetches users with a 'Pending Approval' status from Firestore,
 * prompts the admin to approve or skip them, and upon approval,
 * sets their status to 'Active' and assigns the appropriate custom auth claim.
 * For operators, it also assigns a sequential operator code (OP002, OP003, etc.).
 *
 * Usage:
 * node scripts/approve-pending-users.js
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

// --- Helper to ask questions in the terminal ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};
// --- End Helper ---

const IGNORED_UIDS = ['o5ZQxhv0MePNQrG0IDTWy8qX9jr2'];

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

// Helper function to get the next available operator code
async function getNextOperatorCode() {
  const db = admin.firestore();
  
  // Get all users with operator role (simpler query)
  const operatorsSnapshot = await db.collection('users')
    .where('role', '==', 'operator')
    .get();

  const existingCodes = operatorsSnapshot.docs
    .map(doc => doc.data().operatorCode)
    .filter(code => code && code.startsWith('OP'))
    .map(code => parseInt(code.substring(2)))
    .sort((a, b) => a - b);

  // Find the next available number
  let nextNumber = 2; // Start from OP002 (OP001 is platform operator)
  for (const code of existingCodes) {
    if (code >= nextNumber) {
      nextNumber = code + 1;
    }
  }

  return `OP${String(nextNumber).padStart(3, '0')}`;
}

async function approvePendingUsers() {
  const db = admin.firestore();
  const usersRef = db.collection('users');
  
  console.log("Fetching users with status 'Pending Approval'...");
  const pendingUsersSnapshot = await usersRef.where('status', '==', 'Pending Approval').get();

  const pendingDocs = pendingUsersSnapshot.docs.filter(doc => !IGNORED_UIDS.includes(doc.id));

  if (pendingDocs.length === 0) {
    console.log("✅ No users are currently pending approval. Exiting.");
    rl.close();
    return;
  }

  console.log(`Found ${pendingDocs.length} user(s) pending approval.\n`);

  for (const doc of pendingDocs) {
    const userData = doc.data();
    const uid = doc.id;
    const { name, email, role, createdAt } = userData;

    console.log('--------------------------------------------------');
    console.log(`  UID:        ${uid}`);
    console.log(`  Name:       ${name || 'N/A'}`);
    console.log(`  Email:      ${email}`);
    console.log(`  Role:       ${role.toUpperCase()}`);
    console.log(`  Registered: ${new Date(createdAt._seconds * 1000).toLocaleString()}`);
    console.log('--------------------------------------------------');

    let decision = '';
    while (!['y', 'n', 's'].includes(decision.toLowerCase())) {
      decision = await askQuestion('Approve this user? (y/n/s) (y=yes, n=no, s=skip): ');
    }

    if (decision.toLowerCase() === 'y') {
      try {
        console.log(`Approving ${email}...`);
        await admin.auth().setCustomUserClaims(uid, { [role]: true });
        await usersRef.doc(uid).update({ status: 'Active' });

        if (role === 'operator') {
            const operatorCode = await getNextOperatorCode();
            await usersRef.doc(uid).update({ operatorCode: operatorCode, customId: `OP-${operatorCode}` });
            console.log(`Assigned Operator Code: ${operatorCode}`);
        }

        console.log(`✅ User ${email} approved and is now Active.\n`);
      } catch (error) {
        console.error(`\n❌ Error approving user ${email}:`, error.message);
      }
    } else if (decision.toLowerCase() === 'n') {
        console.log(`User ${email} was NOT approved. Their status remains 'Pending Approval'.\n`);
    } else {
        console.log(`Skipping user ${email}.\n`);
    }
  }

  console.log("\nAll pending users have been reviewed.");
  rl.close();
}

approvePendingUsers().catch(err => {
  console.error("\nAn unexpected error occurred:", err);
  rl.close();
  process.exit(1);
}); 
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// CHANGE THIS to the correct OP001 operator email
const OP001_EMAIL = 'shabz3038@gmail.com';

async function fixOp001Uid() {
  try {
    // 1. Find the Auth user for OP001
    const userRecord = await auth.getUserByEmail(OP001_EMAIL);
    const authUid = userRecord.uid;
    console.log(`Found Auth user for ${OP001_EMAIL}: UID = ${authUid}`);

    // 2. Find the existing Firestore doc for OP001 (by operatorCode)
    const usersRef = db.collection('users');
    const query = usersRef.where('operatorCode', '==', 'OP001').where('role', '==', 'operator');
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.error('No Firestore user found for OP001.');
      return;
    }
    let oldDoc = null;
    snapshot.forEach(doc => {
      if (doc.id !== authUid) oldDoc = doc;
    });
    if (!oldDoc) {
      console.log('Firestore user for OP001 already has correct UID. No action needed.');
      return;
    }
    const oldData = oldDoc.data();
    // 3. Copy to new doc with Auth UID
    await usersRef.doc(authUid).set(oldData, { merge: true });
    console.log('Copied OP001 Firestore user to new doc with correct UID.');
    // 4. Delete old doc
    await oldDoc.ref.delete();
    console.log('Deleted old Firestore doc for OP001.');
    console.log('Fix complete!');
  } catch (err) {
    console.error('Error fixing OP001 Firestore UID:', err);
  }
}

fixOp001Uid().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); }); 
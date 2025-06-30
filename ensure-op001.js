const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials (or service account if needed)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function ensurePlatformOperator() {
  const operatorsRef = db.collection('users');
  const query = operatorsRef.where('role', '==', 'operator').where('operatorCode', '==', 'OP001');
  const snapshot = await query.get();

  if (!snapshot.empty) {
    // Update existing OP001 operator
    const doc = snapshot.docs[0];
    await doc.ref.update({
      status: 'Active',
      name: 'MyBase App',
      email: 'platform@mybase.com', // update or set a default email
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Updated existing OP001 operator to Active.');
  } else {
    // Create new OP001 operator
    await operatorsRef.add({
      role: 'operator',
      operatorCode: 'OP001',
      status: 'Active',
      name: 'MyBase App',
      email: 'platform@mybase.com',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Created new OP001 operator.');
  }
}

ensurePlatformOperator().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); }); 
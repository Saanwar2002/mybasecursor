const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

async function ensureCommissionSettings() {
  const docRef = db.collection('companySettings').doc('commission');
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    console.log('Commission settings document already exists.');
    console.log(docSnap.data());
    return;
  }
  // Set default commission rates (15% direct, 10% operator-affiliated)
  await docRef.set({
    directDriverRate: 0.15,
    operatorAffiliatedDriverRate: 0.10,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('Commission settings document created with default values.');
}

ensureCommissionSettings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); }); 
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

const OPERATOR_CODE = 'OP001';
const DRIVER_ID_PREFIX = `${OPERATOR_CODE}/DR`;

async function getNextDriverNumber(counterRef) {
  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNum = 1;
    if (counterDoc.exists) {
      const data = counterDoc.data();
      if (data && typeof data.currentId === 'number') {
        nextNum = data.currentId + 1;
      }
    }
    transaction.set(counterRef, { currentId: nextNum }, { merge: true });
    return nextNum;
  });
}

async function fixDriverIds() {
  const usersRef = db.collection('users');
  const driversSnap = await usersRef
    .where('role', '==', 'driver')
    .where('operatorCode', '==', OPERATOR_CODE)
    .get();

  const drivers = driversSnap.docs.filter(doc => {
    const d = doc.data();
    return !d.driverIdentifier || d.driverIdentifier.startsWith('DR-mock');
  });

  if (drivers.length === 0) {
    console.log('No drivers with missing or mock driverIdentifier found.');
    return;
  }

  const counterRef = db.collection('counters').doc(`driverId_${OPERATOR_CODE}`);
  for (const doc of drivers) {
    const nextNum = await getNextDriverNumber(counterRef);
    const newId = `${DRIVER_ID_PREFIX}${nextNum.toString().padStart(4, '0')}`;
    await doc.ref.update({ driverIdentifier: newId, customId: newId });
    console.log(`Updated driver ${doc.id} (${doc.data().email}) to driverIdentifier: ${newId}`);
  }
  console.log('Driver ID fix complete.');
}

fixDriverIds().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); }); 
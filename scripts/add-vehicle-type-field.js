const admin = require('firebase-admin');

const serviceAccount = require('../firebase-service-account.json');
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  if (!/already exists/i.test(error.message)) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();

async function addVehicleTypeField() {
  const driverId = 'BrhVHRPoZBXbHtHnhsonvUHGjFT2'; // The ID of our test driver
  const driverRef = db.collection('users').doc(driverId);

  try {
    console.log(`Fetching driver ${driverId}...`);
    const doc = await driverRef.get();

    if (!doc.exists) {
      console.log('Test driver not found.');
      return;
    }

    const driverData = doc.data();
    const vehicleTypeFromMap = driverData.vehicle?.type;

    if (!vehicleTypeFromMap) {
        console.log('Driver has no vehicle.type field in the vehicle map. Cannot add top-level field.');
        return;
    }

    console.log(`Updating driver ${driverId} to add top-level 'vehicleType' field.`);

    await driverRef.update({
      vehicleType: vehicleTypeFromMap
    });

    console.log('Successfully added vehicleType field!');
    const updatedDoc = await driverRef.get();
    console.log('Updated driver data:', updatedDoc.data());

  } catch (error) {
    console.error('Error updating driver:', error);
  } finally {
    // No process.exit() to allow for potential future script runner use
  }
}

addVehicleTypeField().then(() => {
  // Allow time for logs to flush before exit.
  setTimeout(() => process.exit(0), 1000);
}); 
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDrivers() {
  try {
    console.log('Checking all drivers in the database...\n');
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('role', '==', 'driver').get();
    
    if (snapshot.empty) {
      console.log('No drivers found in the database.');
      return;
    }
    
    console.log(`Found ${snapshot.size} driver(s):\n`);
    
    snapshot.forEach(doc => {
      const driver = doc.data();
      console.log(`Driver ID: ${doc.id}`);
      console.log(`Name: ${driver.firstName || 'N/A'} ${driver.lastName || 'N/A'}`);
      console.log(`Status: ${driver.status || 'N/A'}`);
      console.log(`Operator ID: ${driver.operatorId || 'N/A'}`);
      console.log(`Vehicle Type: ${driver.vehicle?.type || 'N/A'}`);
      console.log(`Vehicle Details: ${JSON.stringify(driver.vehicle || 'N/A')}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking drivers:', error);
  } finally {
    process.exit(0);
  }
}

checkDrivers(); 
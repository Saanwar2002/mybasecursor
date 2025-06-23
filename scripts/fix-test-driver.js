const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixTestDriver() {
  try {
    console.log('Fixing test driver data...\n');
    
    // Find the driver with vehicle data
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('role', '==', 'driver').get();
    
    let testDriverId = null;
    let testDriver = null;
    
    snapshot.forEach(doc => {
      const driver = doc.data();
      if (driver.vehicle && driver.vehicle.type) {
        testDriverId = doc.id;
        testDriver = driver;
      }
    });
    
    if (!testDriverId) {
      console.log('No driver with vehicle data found. Creating a new test driver...');
      
      // Create a new test driver
      const newDriverData = {
        role: 'driver',
        status: 'available',
        operatorId: 'OP001',
        firstName: 'Test',
        lastName: 'Driver',
        email: 'testdriver@example.com',
        phone: '+44123456789',
        vehicle: {
          type: 'car',
          make: 'Toyota',
          model: 'Prius',
          year: 2021,
          color: 'Blue',
          licensePlate: 'YX21 ABC'
        },
        currentLocation: {
          latitude: 53.6450,
          longitude: -1.7830
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const newDriverRef = await usersRef.add(newDriverData);
      console.log(`Created new test driver with ID: ${newDriverRef.id}`);
      console.log('Driver data:', newDriverData);
      
    } else {
      console.log(`Found existing driver with ID: ${testDriverId}`);
      console.log('Current data:', testDriver);
      
      // Update the existing driver
      const updates = {
        status: 'available',
        operatorId: 'OP001',
        vehicle: {
          ...testDriver.vehicle,
          type: 'car' // Change from 'standard' to 'car'
        },
        currentLocation: {
          latitude: 53.6450,
          longitude: -1.7830
        }
      };
      
      await usersRef.doc(testDriverId).update(updates);
      console.log('Updated driver with:', updates);
    }
    
    console.log('\nTest driver is now available for bookings!');
    
  } catch (error) {
    console.error('Error fixing test driver:', error);
  } finally {
    process.exit(0);
  }
}

fixTestDriver(); 
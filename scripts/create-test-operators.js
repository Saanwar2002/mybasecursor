/**
 * This script creates test operators in the database for testing the driver registration dropdown.
 * 
 * Usage:
 * node scripts/create-test-operators.js
 */

const admin = require('firebase-admin');
const path = require('path');

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
  process.exit(1);
}

const testOperators = [
  {
    name: "City Taxis Ltd",
    email: "info@citytaxis.com",
    operatorCode: "CT001",
    phoneNumber: "+44123456789"
  },
  {
    name: "Speedy Cabs",
    email: "dispatch@speedycabs.com", 
    operatorCode: "SC002",
    phoneNumber: "+44123456790"
  },
  {
    name: "Metro Transport",
    email: "contact@metrotransport.com",
    operatorCode: "MT003", 
    phoneNumber: "+44123456791"
  },
  {
    name: "Express Taxi Services",
    email: "hello@expresstaxi.com",
    operatorCode: "ET004",
    phoneNumber: "+44123456792"
  }
];

async function createTestOperators() {
  const db = admin.firestore();
  const auth = admin.auth();
  
  console.log("Creating test operators...\n");

  for (const operatorData of testOperators) {
    try {
      // Check if operator already exists
      const existingUser = await auth.getUserByEmail(operatorData.email).catch(() => null);
      
      if (existingUser) {
        console.log(`Operator ${operatorData.name} (${operatorData.email}) already exists. Skipping.`);
        continue;
      }

      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: operatorData.email,
        password: 'TestPass123!', // Default password for testing
        displayName: operatorData.name,
        phoneNumber: operatorData.phoneNumber
      });

      // Set operator custom claim
      await auth.setCustomUserClaims(userRecord.uid, { operator: true });

      // Create Firestore profile
      await db.collection('users').doc(userRecord.uid).set({
        name: operatorData.name,
        email: operatorData.email,
        role: 'operator',
        operatorCode: operatorData.operatorCode,
        phoneNumber: operatorData.phoneNumber,
        phoneVerified: true,
        status: 'Active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        customId: `OP-${operatorData.operatorCode}`
      });

      console.log(`✅ Created operator: ${operatorData.name} (${operatorData.operatorCode})`);
      console.log(`   Email: ${operatorData.email}`);
      console.log(`   Password: TestPass123!`);
      console.log(`   UID: ${userRecord.uid}\n`);

    } catch (error) {
      console.error(`❌ Error creating operator ${operatorData.name}:`, error.message);
    }
  }

  console.log("Test operators creation completed!");
}

createTestOperators().then(() => {
  console.log('\nScript finished.');
  process.exit(0);
}).catch(error => {
  console.error('\nAn unexpected error occurred:', error);
  process.exit(1);
}); 
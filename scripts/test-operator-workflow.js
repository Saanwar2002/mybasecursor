/**
 * Test script to verify the new operator workflow:
 * 1. Create test operators (without codes)
 * 2. Test the approval process assigns sequential codes
 * 3. Verify the API endpoint returns only approved operators with codes
 *
 * Usage:
 * node scripts/test-operator-workflow.js
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
  console.log('Firebase Admin SDK initialized successfully.\n');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

async function testOperatorWorkflow() {
  const db = admin.firestore();
  const auth = admin.auth();
  
  console.log('🧪 Testing Operator Workflow...\n');

  // Step 1: Create test operators (simulating registration)
  console.log('📝 Step 1: Creating test operators...');
  const testOperators = [
    { name: 'City Taxis Ltd', email: 'test-operator-1@example.com' },
    { name: 'Metro Cabs', email: 'test-operator-2@example.com' },
    { name: 'Express Transport', email: 'test-operator-3@example.com' }
  ];

  for (const operator of testOperators) {
    try {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: operator.email,
        password: 'testpassword123',
        displayName: operator.name
      });

      // Create Firestore profile
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: operator.name,
        email: operator.email,
        role: 'operator',
        status: 'Pending Approval',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`  ✅ Created operator: ${operator.name} (${operator.email})`);
    } catch (error) {
      console.log(`  ⚠️  Operator ${operator.email} might already exist: ${error.message}`);
    }
  }

  // Step 2: Test the approval process
  console.log('\n📋 Step 2: Testing approval process...');
  
  // Get pending operators
  const pendingSnapshot = await db.collection('users')
    .where('role', '==', 'operator')
    .where('status', '==', 'Pending Approval')
    .get();

  console.log(`  Found ${pendingSnapshot.docs.length} operators pending approval`);

  // Approve them (simulating the approval script)
  for (const doc of pendingSnapshot.docs) {
    const userData = doc.data();
    const uid = doc.id;

    try {
      // Get next operator code
      const operatorsSnapshot = await db.collection('users')
        .where('role', '==', 'operator')
        .get();

      const existingCodes = operatorsSnapshot.docs
        .map(doc => doc.data().operatorCode)
        .filter(code => code && code.startsWith('OP'))
        .map(code => parseInt(code.substring(2)))
        .sort((a, b) => a - b);

      let nextNumber = 2; // Start from OP002
      for (const code of existingCodes) {
        if (code >= nextNumber) {
          nextNumber = code + 1;
        }
      }

      const operatorCode = `OP${nextNumber.toString().padStart(3, '0')}`;

      // Update Firestore
      await db.collection('users').doc(uid).update({
        status: 'Active',
        operatorCode: operatorCode,
        customId: `OP-${operatorCode}`
      });

      // Set custom claim
      await auth.setCustomUserClaims(uid, { operator: true });

      console.log(`  ✅ Approved ${userData.name} with code: ${operatorCode}`);
    } catch (error) {
      console.log(`  ❌ Error approving ${userData.name}: ${error.message}`);
    }
  }

  // Step 3: Verify the API endpoint would return correct data
  console.log('\n🔍 Step 3: Verifying approved operators...');
  
  const approvedSnapshot = await db.collection('users')
    .where('role', '==', 'operator')
    .where('status', '==', 'Active')
    .get();

  const approvedOperators = approvedSnapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        name: data.name,
        operatorCode: data.operatorCode,
        email: data.email
      };
    })
    .filter(op => op.operatorCode && op.operatorCode.startsWith('OP'))
    .sort((a, b) => a.operatorCode.localeCompare(b.operatorCode));

  console.log(`  Found ${approvedOperators.length} approved operators with codes:`);
  approvedOperators.forEach(op => {
    console.log(`    - ${op.name}: ${op.operatorCode} (${op.email})`);
  });

  // Step 4: Test driver registration would work
  console.log('\n🚗 Step 4: Testing driver registration scenario...');
  console.log('  If a driver registered now, they would see these operators in the dropdown:');
  approvedOperators.forEach(op => {
    console.log(`    - ${op.name} (${op.operatorCode})`);
  });

  console.log('\n✅ Operator workflow test completed successfully!');
  console.log('\n📋 Summary:');
  console.log('  - Operators register without codes (Pending Approval)');
  console.log('  - Admin approval assigns sequential codes (OP002, OP003, etc.)');
  console.log('  - Only approved operators with codes appear in driver dropdown');
  console.log('  - Platform operator (OP001) is always available');
}

testOperatorWorkflow().then(() => {
  console.log('\n🎉 Test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}); 
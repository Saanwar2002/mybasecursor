const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, Timestamp } = require('firebase/firestore');

// --- Configuration ---
const TEST_ACCOUNT_EMAIL = "test-passenger@example.com";
const TEST_ACCOUNT_PASSWORD = "password123"; // Simple password for local testing

const firebaseConfig = {
  apiKey: "AIzaSyAEnaOlXAGlkox-wpOOER7RUPhd8iWKhg4",
  authDomain: "taxinow-vvp38.firebaseapp.com",
  projectId: "taxinow-vvp38",
  storageBucket: "taxinow-vvp38.firebasestorage.app",
  messagingSenderId: "679652213262",
  appId: "1:679652213262:web:0217c9706165949cd5f25f"
};

// --- Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Main Function ---
async function createRideForTestPassenger() {
  console.log("🚀 Starting test ride creation script...");

  try {
    // 1. Authenticate as the test user
    let userCredential;
    try {
      console.log(`Attempting to sign in as ${TEST_ACCOUNT_EMAIL}...`);
      userCredential = await signInWithEmailAndPassword(auth, TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD);
      console.log("✅ Successfully signed in as existing test user.");
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        console.log("🤔 Test user not found. Attempting to create a new one...");
        userCredential = await createUserWithEmailAndPassword(auth, TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD);
        
        console.log("✍️ Creating user profile in Firestore...");
        const userProfile = {
          name: "Test Passenger",
          email: TEST_ACCOUNT_EMAIL,
          role: "passenger",
          status: "Active",
          createdAt: Timestamp.now(),
          phoneVerified: true,
          phoneNumber: "+15555555555"
        };
        await setDoc(doc(db, "users", userCredential.user.uid), userProfile);
        console.log("✅ Successfully created and signed in as new test user.");

      } else {
        // For other errors, we should stop
        throw error;
      }
    }

    const userId = userCredential.user.uid;
    console.log(`👤 User ID: ${userId}`);

    // 2. Define the active ride data
    const rideId = `ride-${Date.now()}`;
    const activeRideData = {
      id: rideId,
      passengerId: userId,
      passengerName: "Test Passenger",
      pickupLocation: {
        address: "Huddersfield Railway Station, St George's Square, Huddersfield HD1 1JF",
        latitude: 53.6450,
        longitude: -1.7830,
        doorOrFlat: "Main Entrance"
      },
      dropoffLocation: {
        address: "University of Huddersfield, Queensgate, Huddersfield HD1 3DH",
        latitude: 53.6480,
        longitude: -1.7780,
        doorOrFlat: "Student Central"
      },
      status: "driver_assigned", // Active status
      driverId: "driver-test-001",
      driverName: "John Doe",
      driverAvatar: "https://placehold.co/48x48.png?text=JD",
      driverVehicleDetails: "Toyota Prius - Blue - YX68 ABC",
      driverCurrentLocation: { lat: 53.6465, lng: -1.7845, heading: 90 },
      driverEtaMinutes: 4,
      vehicleType: "standard",
      passengers: 1,
      fareEstimate: 7.80,
      paymentMethod: "card",
      bookingTimestamp: Timestamp.now(),
      displayBookingId: `T-PASS/${rideId.slice(0, 4).toUpperCase()}`
    };

    // 3. Create the booking document in Firestore
    console.log(`Creating booking document with ID: ${rideId}...`);
    await setDoc(doc(db, "bookings", rideId), activeRideData);
    console.log("✅ Booking document created successfully in Firestore.");
    
    // 4. Log instructions for the user
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Test Ride Created Successfully! 🎉");
    console.log("=".repeat(50));
    console.log("You can now test the 'Track Ride' page.");
    console.log("\nUse these credentials to log in:");
    console.log(`📧 Email:    ${TEST_ACCOUNT_EMAIL}`);
    console.log(`🔑 Password: ${TEST_ACCOUNT_PASSWORD}`);
    console.log("\nAfter logging in, navigate to the 'Track Ride' dashboard page.");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("\n❌ An error occurred during the script execution:");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Please check your Firebase rules and configuration.");
  } finally {
    // The script will exit automatically as there are no more async operations pending.
    // No need to explicitly call process.exit() which can be abrupt.
  }
}

createRideForTestPassenger(); 
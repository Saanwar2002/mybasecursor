// Seed script to populate Firestore with sample data
// Run with: node scripts/seed-data.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, Timestamp } = require('firebase/firestore');

// Firebase configuration (same as in src/lib/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyAEnaOlXAGlkox-wpOOER7RUPhd8iWKhg4",
  authDomain: "taxinow-vvp38.firebaseapp.com",
  projectId: "taxinow-vvp38",
  storageBucket: "taxinow-vvp38.firebasestorage.app",
  messagingSenderId: "679652213262",
  appId: "1:679652213262:web:0217c9706165949cd5f25f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data
const sampleUsers = [
  {
    id: 'passenger-1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    role: 'passenger',
    status: 'Active',
    phoneNumber: '+44123456789',
    phoneVerified: true,
    createdAt: Timestamp.now(),
    acceptsPetFriendlyJobs: false,
    acceptsPlatformJobs: true,
    acceptsAccountJobs: true
  },
  {
    id: 'driver-1',
    name: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    role: 'driver',
    status: 'Active',
    phoneNumber: '+44987654321',
    phoneVerified: true,
    createdAt: Timestamp.now(),
    vehicleCategory: 'standard',
    vehicleMakeModel: 'Toyota Prius',
    vehicleRegistration: 'AB12 CDE',
    vehicleColor: 'Silver',
    acceptsPetFriendlyJobs: true,
    acceptsPlatformJobs: true,
    acceptsAccountJobs: true,
    maxJourneyDistance: '50',
    dispatchMode: 'auto'
  },
  {
    id: 'operator-1',
    name: 'City Taxis Ltd',
    email: 'info@citytaxis.co.uk',
    role: 'operator',
    status: 'Active',
    phoneNumber: '+44123456788',
    phoneVerified: true,
    createdAt: Timestamp.now(),
    operatorCode: 'CT001',
    acceptsPlatformJobs: true,
    acceptsAccountJobs: true,
    dispatchMode: 'auto'
  },
  {
    id: 'operator-2',
    name: 'Speedy Cabs',
    email: 'bookings@speedycabs.co.uk',
    role: 'operator',
    status: 'Active',
    phoneNumber: '+44123456787',
    phoneVerified: true,
    createdAt: Timestamp.now(),
    operatorCode: 'SC002',
    acceptsPlatformJobs: true,
    acceptsAccountJobs: true,
    dispatchMode: 'manual'
  }
];

const sampleBookings = [
  {
    id: 'booking-1',
    passengerId: 'passenger-1',
    driverId: 'driver-1',
    operatorId: 'operator-1',
    pickupLocation: {
      address: 'Huddersfield Railway Station',
      coordinates: { lat: 53.6450, lng: -1.7830 }
    },
    dropoffLocation: {
      address: 'University of Huddersfield',
      coordinates: { lat: 53.6480, lng: -1.7780 }
    },
    status: 'completed',
    fare: 8.50,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
    paymentMethod: 'card',
    rating: 5,
    feedback: 'Great service, very professional driver'
  },
  {
    id: 'booking-2',
    passengerId: 'passenger-1',
    driverId: null,
    operatorId: 'operator-1',
    pickupLocation: {
      address: 'Huddersfield Town Centre',
      coordinates: { lat: 53.6450, lng: -1.7830 }
    },
    dropoffLocation: {
      address: 'Huddersfield Royal Infirmary',
      coordinates: { lat: 53.6500, lng: -1.7800 }
    },
    status: 'pending',
    estimatedFare: 6.00,
    createdAt: Timestamp.now(),
    paymentMethod: 'card'
  }
];

const sampleMapHazards = [
  {
    id: 'hazard-1',
    hazardType: 'road_closure',
    location: { lat: 53.6450, lng: -1.7830 },
    reportedAt: Timestamp.now(),
    status: 'active',
    description: 'Road closure due to construction work'
  },
  {
    id: 'hazard-2',
    hazardType: 'traffic_jam',
    location: { lat: 53.6480, lng: -1.7780 },
    reportedAt: Timestamp.now(),
    status: 'active',
    description: 'Heavy traffic on main road'
  }
];

async function seedData() {
  console.log('Starting to seed Firestore database...');

  try {
    // Seed users
    console.log('Seeding users...');
    for (const user of sampleUsers) {
      await setDoc(doc(db, 'users', user.id), user);
      console.log(`Created user: ${user.name}`);
    }

    // Seed bookings
    console.log('Seeding bookings...');
    for (const booking of sampleBookings) {
      await setDoc(doc(db, 'bookings', booking.id), booking);
      console.log(`Created booking: ${booking.id}`);
    }

    // Seed map hazards
    console.log('Seeding map hazards...');
    for (const hazard of sampleMapHazards) {
      await setDoc(doc(db, 'mapHazards', hazard.id), hazard);
      console.log(`Created hazard: ${hazard.id}`);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('You can now test the app with sample data.');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run the seed function
seedData(); 
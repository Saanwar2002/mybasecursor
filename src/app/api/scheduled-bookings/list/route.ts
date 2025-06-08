
// src/app/api/scheduled-bookings/list/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase';
// import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}
interface ScheduledBookingFromDB {
  id: string;
  passengerId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number;
  driverNotes?: string;
  paymentMethod: "card" | "cash";
  daysOfWeek: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  pickupTime: string;
  isReturnJourneyScheduled: boolean;
  returnPickupTime?: string;
  isWaitAndReturnOutbound?: boolean;
  estimatedWaitTimeMinutesOutbound?: number;
  isActive: boolean;
  pausedDates?: string[];
  nextRunDate?: string;
  createdAt: FirestoreTimestamp; // Serialized for client
  updatedAt: FirestoreTimestamp; // Serialized for client
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}


// Mock data for demonstration
const mockScheduledBookings: ScheduledBookingFromDB[] = [
  {
    id: 'sched_1',
    passengerId: 'guest-passenger-mock', // Replace with actual passenger ID for testing
    label: 'Daily Commute to Work',
    pickupLocation: { address: '123 Main St, Anytown', latitude: 0, longitude: 0 },
    dropoffLocation: { address: '789 Business Park, Anytown', latitude: 0, longitude: 0 },
    vehicleType: 'Car',
    passengers: 1,
    paymentMethod: 'card',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    pickupTime: '08:00',
    isReturnJourneyScheduled: true,
    returnPickupTime: '17:30',
    isActive: true,
    createdAt: { _seconds: Date.now() / 1000 - 86400 * 5, _nanoseconds: 0 }, // 5 days ago
    updatedAt: { _seconds: Date.now() / 1000 - 86400, _nanoseconds: 0 }, // 1 day ago
    estimatedFareOneWay: 15.50,
    estimatedFareReturn: 15.50,
  },
  {
    id: 'sched_2',
    passengerId: 'guest-passenger-mock',
    label: 'Weekend Gym Trips',
    pickupLocation: { address: '45 Fitness Ave, Anytown', latitude: 0, longitude: 0 },
    dropoffLocation: { address: 'Iron Paradise Gym, Anytown', latitude: 0, longitude: 0 },
    vehicleType: 'Car',
    passengers: 1,
    paymentMethod: 'cash',
    daysOfWeek: ['saturday', 'sunday'],
    pickupTime: '10:00',
    isReturnJourneyScheduled: false,
    isActive: false, // Paused
    pausedDates: ['2024-08-17'], // Example paused date
    createdAt: { _seconds: Date.now() / 1000 - 86400 * 2, _nanoseconds: 0 },
    updatedAt: { _seconds: Date.now() / 1000 - 86400 * 2, _nanoseconds: 0 },
    estimatedFareOneWay: 8.75,
  },
];


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId');

  if (!passengerId) {
    return NextResponse.json({ message: 'passengerId query parameter is required.' }, { status: 400 });
  }
  
  // TODO: Implement user authentication to ensure only the owner can fetch their schedules.
  // const authenticatedUserId = await getUserIdFromRequest(request);
  // if (passengerId !== authenticatedUserId) {
  //   return NextResponse.json({ message: 'Unauthorized to fetch schedules for this user.' }, { status: 403 });
  // }

  try {
    // const schedulesRef = collection(db, 'scheduledBookings');
    // const q = query(
    //   schedulesRef,
    //   where('passengerId', '==', passengerId),
    //   orderBy('createdAt', 'desc') // Or label, or nextRunDate
    // );
    // const querySnapshot = await getDocs(q);
    // const schedules = querySnapshot.docs.map(doc => ({
    //   id: doc.id,
    //   ...doc.data(),
    //   createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString(),
    //   updatedAt: (doc.data().updatedAt as Timestamp)?.toDate().toISOString(),
    //   // Ensure nextRunDate is also serialized if it's a Timestamp
    //   nextRunDate: doc.data().nextRunDate ? (doc.data().nextRunDate as Timestamp).toDate().toISOString().split('T')[0] : undefined,
    // }));
    
    // Using mock data for now
    const userSchedules = mockScheduledBookings.filter(s => s.passengerId === passengerId || passengerId.startsWith('guest-passenger'));
     userSchedules.forEach(s => {
        if (s.createdAt && typeof s.createdAt !== 'string') {
            s.createdAt = new Date(s.createdAt._seconds * 1000).toISOString();
        }
        if (s.updatedAt && typeof s.updatedAt !== 'string') {
            s.updatedAt = new Date(s.updatedAt._seconds * 1000).toISOString();
        }
    });


    // return NextResponse.json({ schedules }, { status: 200 });
    return NextResponse.json({ schedules: userSchedules }, { status: 200 });

  } catch (error) {
    console.error('Error fetching scheduled bookings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch scheduled bookings', details: errorMessage }, { status: 500 });
  }
}


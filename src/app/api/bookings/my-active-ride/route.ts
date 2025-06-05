
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash";
}

function serializeTimestamp(timestamp: Timestamp | undefined | null): SerializedTimestamp | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId');

  if (!passengerId) {
    return NextResponse.json({ message: 'passengerId query parameter is required.' }, { status: 400 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    const q = query(
      bookingsRef,
      where('passengerId', '==', passengerId),
      where('status', 'not-in', ['completed', 'cancelled']), // Use lowercase
      // orderBy('status'), // Removed this line to simplify the query
      orderBy('bookingTimestamp', 'desc'), // Then by most recent
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(null, { status: 200 }); // No active ride found
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    const activeRide: Ride = {
      id: doc.id,
      passengerName: data.passengerName,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      vehicleType: data.vehicleType,
      fareEstimate: data.fareEstimate,
      status: data.status,
      driver: data.driverName, // Assuming driverName is stored
      driverAvatar: data.driverAvatar, // Assuming driverAvatar is stored
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      // rating can be added if you track it for active rides
    };

    return NextResponse.json(activeRide, { status: 200 });

  } catch (error) {
    console.error('Error fetching active ride:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
       if ((error as any).code === 'failed-precondition') {
        errorMessage = `Query requires a Firestore index. Please check the console for a link to create it. Details: ${error.message}`;
      }
    }
    return NextResponse.json({ message: 'Failed to fetch active ride', details: errorMessage }, { status: 500 });
  }
}


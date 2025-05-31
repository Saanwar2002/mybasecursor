
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';

interface Booking {
  id: string;
  passengerId: string;
  passengerName: string;
  pickupLocation: { address: string; latitude: number; longitude: number };
  dropoffLocation: { address: string; latitude: number; longitude: number };
  stops: Array<{ address: string; latitude: number; longitude: number }>;
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
  status: string;
  bookingTimestamp: Timestamp; // Firestore Timestamp
  // Add any other fields you expect from your booking documents
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
      orderBy('bookingTimestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const rides: Booking[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Ensure bookingTimestamp is converted correctly if needed, or handle if it might be missing
      const bookingTimestamp = data.bookingTimestamp instanceof Timestamp ? data.bookingTimestamp : Timestamp.now();
      
      rides.push({
        id: doc.id,
        ...(data as Omit<Booking, 'id' | 'bookingTimestamp'>), // Cast other fields
        bookingTimestamp, // Ensure it's a Firestore Timestamp
      });
    });

    return NextResponse.json(rides, { status: 200 });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to fetch bookings', details: errorMessage }, { status: 500 });
  }
}

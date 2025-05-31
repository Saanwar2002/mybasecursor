
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
  bookingTimestamp: Timestamp; // Firestore Timestamp on server
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
      // Ensure bookingTimestamp is a Firestore Timestamp before sending
      const bookingTimestamp = data.bookingTimestamp instanceof Timestamp ? data.bookingTimestamp : Timestamp.fromDate(new Date(data.bookingTimestamp?.seconds * 1000 || Date.now()));
      
      rides.push({
        id: doc.id,
        ...(data as Omit<Booking, 'id' | 'bookingTimestamp'>),
        bookingTimestamp,
      });
    });

    return NextResponse.json(rides, { status: 200 });
  } catch (error) {
    console.error('Error fetching bookings (API Route):', error); // Log the full error object

    let errorMessage = 'An unknown server error occurred.';
    let errorDetails = '';

    if (error instanceof Error) {
        errorMessage = error.message; 
        // Check for Firestore specific errors that might indicate an index issue
        // Firestore error codes are typically strings like 'firestore/failed-precondition'
        const firebaseError = error as any; // Cast to access potential 'code' property
        if (firebaseError.code === 'failed-precondition') {
             errorDetails = `Firestore query failed. This often indicates a missing composite index. Please check the server-side logs (terminal running 'npm run dev') for a Firestore error message, which may include a URL to create the required index. Firestore error code: ${firebaseError.code}.`;
        } else {
            errorDetails = error.toString();
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    }
    
    return NextResponse.json({ 
      message: 'Failed to retrieve your rides. Please check server logs for more details, especially regarding Firestore indexes.', 
      details: `${errorMessage} ${errorDetails}`.trim() 
    }, { status: 500 });
  }
}


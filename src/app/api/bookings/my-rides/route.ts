
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

// Helper to convert Firestore Timestamp to a serializable format for JSON response
function serializeTimestamp(timestamp: Timestamp): { _seconds: number; _nanoseconds: number } {
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const passengerId = searchParams.get('passengerId');

    if (!passengerId) {
      return NextResponse.json({ message: 'passengerId query parameter is required.' }, { status: 400 });
    }
    
    console.log(`API /my-rides: Received request for passengerId: ${passengerId}`);

    // Moved the core logic into its own try-catch to maintain specific error messages if needed
    // while the outer try-catch handles more general errors.
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('passengerId', '==', passengerId),
        orderBy('bookingTimestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      console.log(`API /my-rides: Found ${querySnapshot.size} bookings for passengerId: ${passengerId}`);
      
      const rides: any[] = []; 
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`API /my-rides: Processing doc ${doc.id}, raw bookingTimestamp from Firestore:`, data.bookingTimestamp);

        let processedTimestamp: Timestamp;
        if (data.bookingTimestamp instanceof Timestamp) {
          processedTimestamp = data.bookingTimestamp;
        } else if (data.bookingTimestamp && typeof data.bookingTimestamp.seconds === 'number' && typeof data.bookingTimestamp.nanoseconds === 'number') {
          console.warn(`API /my-rides: doc ${doc.id} bookingTimestamp is an object, converting to Firestore Timestamp.`);
          processedTimestamp = new Timestamp(data.bookingTimestamp.seconds, data.bookingTimestamp.nanoseconds);
        } else {
          console.warn(`API /my-rides: doc ${doc.id} has missing or malformed bookingTimestamp. Using current time as fallback. Value was:`, data.bookingTimestamp);
          processedTimestamp = Timestamp.now(); 
        }
        
        rides.push({
          id: doc.id,
          ...data,
          bookingTimestamp: serializeTimestamp(processedTimestamp), 
        });
      });

      return NextResponse.json(rides, { status: 200 });
    } catch (dbError) {
      console.error('Error fetching bookings (API Route - DB Operation):', dbError);

      let errorMessage = 'An unknown server error occurred during database operation.';
      let errorDetails = '';

      if (dbError instanceof Error) {
          errorMessage = dbError.message;
          const firebaseError = dbError as any; 
          if (firebaseError.code === 'failed-precondition' || (firebaseError.message && firebaseError.message.toLowerCase().includes('index'))) {
               errorDetails = `The query requires an index. You can create it here: ${firebaseError.message.substring(firebaseError.message.indexOf('https://'))} Firestore query failed. This often indicates a missing composite index. Please check the server-side logs (terminal running 'npm run dev') for a Firestore error message, which may include a URL to create the required index. Firestore error code: ${firebaseError.code || 'N/A'}.`;
          } else {
              errorDetails = dbError.toString();
          }
      } else if (typeof dbError === 'string') {
          errorMessage = dbError;
          errorDetails = dbError;
      }
      
      return NextResponse.json({
        message: 'Failed to retrieve your rides. Please check server logs for more details, especially regarding Firestore indexes.',
        details: `${errorMessage} ${errorDetails}`.trim()
      }, { status: 500 });
    }
  } catch (error) {
    // This is the top-level catch for any other unexpected errors
    console.error('Critical error in /api/bookings/my-rides GET handler:', error);
    let genericErrorMessage = 'An unexpected server error occurred.';
    if (error instanceof Error) {
      genericErrorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to process request.', details: genericErrorMessage }, { status: 500 });
  }
}

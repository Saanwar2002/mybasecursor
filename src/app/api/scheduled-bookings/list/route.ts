
// src/app/api/scheduled-bookings/list/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'; // Removed orderBy

// Interface for data as it is stored/retrieved directly from Firestore
interface ScheduledBookingFirestoreData {
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
  nextRunDate?: string; // Could be string or Timestamp from Firestore
  createdAt: Timestamp;
  updatedAt: Timestamp;
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

// Interface for the data structure being sent to the client
interface ScheduledBookingAPIResponse {
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
  nextRunDate?: string; // "YYYY-MM-DD"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId');
  console.log(`API /scheduled-bookings/list: Received request for passengerId: ${passengerId}`);


  if (!passengerId) {
    console.log("API /scheduled-bookings/list: passengerId query parameter is missing.");
    return NextResponse.json({ message: 'passengerId query parameter is required.' }, { status: 400 });
  }
  
  try {
    if (!db) { 
      console.error("API /scheduled-bookings/list: Firestore (db) is not initialized!");
      return NextResponse.json({ message: 'Database service not available.', details: "Firestore (db) is null." }, { status: 500 });
    }

    const schedulesRef = collection(db, 'scheduledBookings');
    // Removed orderBy('createdAt', 'desc') from the query to avoid index error.
    const q = query(
      schedulesRef,
      where('passengerId', '==', passengerId)
    );
    console.log(`API /scheduled-bookings/list: Querying Firestore for passengerId: ${passengerId}`);
    const querySnapshot = await getDocs(q);
    console.log(`API /scheduled-bookings/list: Firestore query returned ${querySnapshot.size} documents.`);
    
    if (querySnapshot.empty) {
      console.log(`API /scheduled-bookings/list: No documents found for passengerId ${passengerId}. Returning empty array.`);
    }

    const schedules: ScheduledBookingAPIResponse[] = querySnapshot.docs.map(doc => {
      const data = doc.data() as ScheduledBookingFirestoreData;
      console.log(`API /scheduled-bookings/list: Processing doc ${doc.id}, raw createdAt:`, data.createdAt);
      
      let nextRunDateString: string | undefined = undefined;
      if (data.nextRunDate) {
        if (data.nextRunDate instanceof Timestamp) {
          nextRunDateString = data.nextRunDate.toDate().toISOString().split('T')[0];
        } else if (typeof data.nextRunDate === 'string') {
          // Assuming it's already in YYYY-MM-DD format if it's a string
          nextRunDateString = data.nextRunDate;
        }
      }

      const responseItem: ScheduledBookingAPIResponse = {
        id: doc.id,
        passengerId: data.passengerId,
        label: data.label,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        stops: data.stops || [],
        vehicleType: data.vehicleType,
        passengers: data.passengers,
        driverNotes: data.driverNotes,
        paymentMethod: data.paymentMethod,
        daysOfWeek: data.daysOfWeek,
        pickupTime: data.pickupTime,
        isReturnJourneyScheduled: data.isReturnJourneyScheduled,
        returnPickupTime: data.returnPickupTime,
        isWaitAndReturnOutbound: data.isWaitAndReturnOutbound,
        estimatedWaitTimeMinutesOutbound: data.estimatedWaitTimeMinutesOutbound,
        isActive: data.isActive,
        pausedDates: data.pausedDates || [],
        estimatedFareOneWay: data.estimatedFareOneWay,
        estimatedFareReturn: data.estimatedFareReturn,
        // Robust timestamp conversion with fallback
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
        nextRunDate: nextRunDateString,
      };
      return responseItem;
    });
    
    // Sort in JavaScript after fetching
    schedules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    console.log(`API /scheduled-bookings/list: Returning ${schedules.length} schedules after mapping and sorting.`);

    return NextResponse.json({ schedules }, { status: 200 });

  } catch (error) {
    console.error('Error fetching scheduled bookings:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
        if ((error as any).code === 'failed-precondition') {
            errorMessage = `Query requires a Firestore index. Firestore error: ${error.message}. Please check the Firebase console for a link to create the missing index.`;
        }
    }
    return NextResponse.json({ message: 'Failed to fetch scheduled bookings', details: errorMessage }, { status: 500 });
  }
}

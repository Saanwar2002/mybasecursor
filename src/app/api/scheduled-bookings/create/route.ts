
// src/app/api/scheduled-bookings/create/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Assuming firebase admin is configured
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; 
// import { type ScheduledBookingPayload } from './interfaces'; // Define this interface

interface LocationPointPayload {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface ScheduledBookingPayload {
  passengerId: string;
  passengerName: string; // Added this
  label: string;
  pickupLocation: LocationPointPayload;
  dropoffLocation: LocationPointPayload;
  stops?: LocationPointPayload[];
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
  isActive: boolean; // Should default to true
  // nextRunDate will be calculated on save
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}


export async function POST(request: NextRequest) {
  console.log("API /scheduled-bookings/create: Received request.");
  // TODO: Implement user authentication to ensure only logged-in users can create schedules.
  // const authenticatedUserId = await getUserIdFromRequest(request);
  // if (!authenticatedUserId) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const payload: ScheduledBookingPayload = await request.json();
    console.log("API /scheduled-bookings/create: Parsed payload:", JSON.stringify(payload, null, 2));


    // TODO: Add Zod validation for the payload
    if (!payload.passengerId /*|| payload.passengerId !== authenticatedUserId */) {
       console.error("API /scheduled-bookings/create: Validation Error - Missing or invalid passengerId in payload.");
      return NextResponse.json({ message: 'Invalid passenger ID or mismatch.' }, { status: 400 });
    }
     if (!payload.passengerName) {
      console.error("API /scheduled-bookings/create: Validation Error - Missing passengerName in payload.");
      return NextResponse.json({ message: 'Passenger name is required.' }, { status: 400 });
    }


    const newScheduleData = {
      ...payload,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      createdAt: serverTimestamp() as Timestamp, // Corrected usage of Timestamp
      updatedAt: serverTimestamp() as Timestamp, // Corrected usage of Timestamp
      // TODO: Calculate initial nextRunDate based on daysOfWeek and pickupTime
      // nextRunDate: calculateNextRunDate(payload.daysOfWeek, payload.pickupTime), 
    };

    console.log("API /scheduled-bookings/create: About to save newScheduleData to Firestore:", JSON.stringify(newScheduleData, null, 2));

    const docRef = await addDoc(collection(db, 'scheduledBookings'), newScheduleData);
    console.log(`API /scheduled-bookings/create: Successfully saved to Firestore. Document ID: ${docRef.id}`);
    
    const responseData = {
        id: docRef.id,
        ...newScheduleData,
        createdAt: new Date().toISOString(), // Serialize for response
        updatedAt: new Date().toISOString(), // Serialize for response
        // nextRunDate: newScheduleData.nextRunDate ? newScheduleData.nextRunDate.toDate().toISOString().split('T')[0] : undefined // Example if nextRunDate was a Timestamp
    }

    return NextResponse.json({ message: 'Scheduled booking created successfully.', id: docRef.id, data: responseData }, { status: 201 });

  } catch (error) {
    console.error('API /scheduled-bookings/create: Error creating scheduled booking:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to create scheduled booking', details: errorMessage }, { status: 500 });
  }
}


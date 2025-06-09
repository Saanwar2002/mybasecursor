
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Helper to serialize Timestamp for the response
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return {
      _seconds: timestamp.seconds,
      _nanoseconds: timestamp.nanoseconds,
    };
  }
  // Handle cases where it might already be an object like { seconds: ..., nanoseconds: ... } from other parts of app
  if (typeof timestamp === 'object' && timestamp !== null && ('_seconds'in timestamp || 'seconds' in timestamp)) {
     return {
      _seconds: (timestamp as any)._seconds ?? (timestamp as any).seconds,
      _nanoseconds: (timestamp as any)._nanoseconds ?? (timestamp as any).nanoseconds ?? 0,
    };
  }
  return null;
}


const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  status: z.string().optional(), // More specific statuses can be an enum later
  vehicleType: z.string().optional(),
  driverVehicleDetails: z.string().optional(),
  // Add other fields that might be updated by the operator/driver action
  action: z.string().optional(), // For actions like 'notify_arrival', 'start_ride', etc.
  finalFare: z.number().optional(),
  notifiedPassengerArrivalTimestamp: z.boolean().optional(), // Special handling for this
  rideStartedAt: z.boolean().optional(), // Special handling for this
  completedAt: z.boolean().optional(), // Special handling for this
  passengerAcknowledgedArrivalTimestamp: z.boolean().optional(), // Special handling
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.string().optional(),
  waitAndReturn: z.boolean().optional(),
  estimatedAdditionalWaitTimeMinutes: z.number().min(0).optional().nullable(),
});

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

interface PostContext {
  params: {
    bookingId: string;
  };
}

export async function POST(request: NextRequest, context: PostContext) {
  const { bookingId } = context.params;
  console.log(`API POST /api/operator/bookings/${bookingId}: Handler entered.`);

  if (!db) {
    console.error(`API POST Error /api/operator/bookings/${bookingId}: Firestore (db) is not initialized.`);
    return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized. Booking update failed.' }, { status: 500 });
  }

  if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    console.log(`API POST /api/operator/bookings/${bookingId}: Received payload:`, JSON.stringify(payload, null, 2));
    const parsedPayload = bookingUpdateSchema.safeParse(payload);

    if (!parsedPayload.success) {
      console.error(`API POST /api/operator/bookings/${bookingId}: Payload validation failed.`, parsedPayload.error.format());
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      console.warn(`API POST /api/operator/bookings/${bookingId}: Booking not found.`);
      return NextResponse.json({ message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
    }

    const updatePayloadFirestore: any = { ...updateDataFromPayload };
    delete updatePayloadFirestore.action; // 'action' is for logic, not direct storage here

    // Handle specific timestamp updates based on boolean flags in payload
    if (updateDataFromPayload.notifiedPassengerArrivalTimestamp === true) {
      updatePayloadFirestore.notifiedPassengerArrivalTimestamp = Timestamp.now();
      // Remove the boolean flag after converting to timestamp
      delete updatePayloadFirestore.notifiedPassengerArrivalTimestamp;
      updatePayloadFirestore.notifiedPassengerArrivalTimestampActual = Timestamp.now();
    }
    if (updateDataFromPayload.passengerAcknowledgedArrivalTimestamp === true) {
      updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp = Timestamp.now();
      delete updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp;
      updatePayloadFirestore.passengerAcknowledgedArrivalTimestampActual = Timestamp.now();

    }
    if (updateDataFromPayload.rideStartedAt === true) {
      updatePayloadFirestore.rideStartedAt = Timestamp.now();
      delete updatePayloadFirestore.rideStartedAt;
      updatePayloadFirestore.rideStartedAtActual = Timestamp.now();
    }
    if (updateDataFromPayload.completedAt === true) {
      updatePayloadFirestore.completedAt = Timestamp.now();
      delete updatePayloadFirestore.completedAt;
      updatePayloadFirestore.completedAtActual = Timestamp.now();
    }
    
    // Handle null explicitly for estimatedAdditionalWaitTimeMinutes
    if (updateDataFromPayload.estimatedAdditionalWaitTimeMinutes === null) {
      updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = null;
    } else if (updateDataFromPayload.estimatedAdditionalWaitTimeMinutes !== undefined) {
      updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = updateDataFromPayload.estimatedAdditionalWaitTimeMinutes;
    }


    updatePayloadFirestore.updatedAt = Timestamp.now();

    console.log(`API POST /api/operator/bookings/${bookingId}: Updating Firestore with:`, JSON.stringify(updatePayloadFirestore, null, 2));
    await updateDoc(bookingRef, updatePayloadFirestore);

    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedData = updatedBookingSnap.data();

    if (!updatedData) {
        console.error(`API POST /api/operator/bookings/${bookingId}: Failed to retrieve updated document after update.`);
        return NextResponse.json({ message: 'Failed to confirm booking update.' }, { status: 500 });
    }
    
    // Ensure all relevant timestamps from updatedData are serialized for the response
    const responseData = {
        id: updatedBookingSnap.id,
        ...updatedData,
        bookingTimestamp: serializeTimestamp(updatedData.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: updatedData.scheduledPickupAt || null,
        updatedAt: serializeTimestamp(updatedData.updatedAt as Timestamp | undefined),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(updatedData.notifiedPassengerArrivalTimestampActual as Timestamp | undefined),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(updatedData.passengerAcknowledgedArrivalTimestampActual as Timestamp | undefined),
        rideStartedAt: serializeTimestamp(updatedData.rideStartedAtActual as Timestamp | undefined),
        completedAt: serializeTimestamp(updatedData.completedAtActual as Timestamp | undefined),
    };

    console.log(`API POST /api/operator/bookings/${bookingId}: Update successful. Returning:`, JSON.stringify(responseData, null, 2));
    return NextResponse.json({ message: 'Booking updated successfully', booking: responseData }, { status: 200 });

  } catch (error: any) {
    console.error(`API POST Error /api/operator/bookings/${bookingId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error during booking update.';
    return NextResponse.json({ message: 'Failed to update booking', details: errorMessage, errorRaw: error.toString() }, { status: 500 });
  }
}

// GET handler
interface GetContext {
  params: {
    bookingId: string;
  };
}
export async function GET(request: NextRequest, context: GetContext) {
  const { bookingId } = context.params;
  console.log(`API GET /api/operator/bookings/${bookingId}: Handler entered.`);
  
  if (!db) {
    console.error(`API GET Error /api/operator/bookings/${bookingId}: Firestore (db) is not initialized.`);
    return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized.' }, { status: 500 });
  }
   if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ error: true, message: 'A valid Booking ID path parameter is required for GET.' }, { status: 400 });
  }
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
    }
    const data = bookingSnap.data();
     const responseData = {
        id: bookingSnap.id,
        ...data,
        bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: data.scheduledPickupAt || null,
        updatedAt: serializeTimestamp(data.updatedAt as Timestamp | undefined),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(data.notifiedPassengerArrivalTimestampActual as Timestamp | undefined),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(data.passengerAcknowledgedArrivalTimestampActual as Timestamp | undefined),
        rideStartedAt: serializeTimestamp(data.rideStartedAtActual as Timestamp | undefined),
        completedAt: serializeTimestamp(data.completedAtActual as Timestamp | undefined),
    };
    return NextResponse.json({ booking: responseData }, { status: 200 });
  } catch (error: any) {
    console.error(`Error in GET /api/operator/bookings/${bookingId || 'UNKNOWN'}`, error);
    return NextResponse.json({ error: true, message: "Error in GET handler." }, { status: 500 });
  }
}

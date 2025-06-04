
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, deleteField } from 'firebase/firestore';
import { z } from 'zod';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return {
      _seconds: timestamp.seconds,
      _nanoseconds: timestamp.nanoseconds,
    };
  }
  // Handle cases where it might already be an object { seconds: ..., nanoseconds: ... }
  if (typeof timestamp === 'object' && timestamp !== null && ('_seconds' in timestamp || 'seconds' in timestamp)) {
    return {
      _seconds: (timestamp as any)._seconds ?? (timestamp as any).seconds,
      _nanoseconds: (timestamp as any)._nanoseconds ?? (timestamp as any).nanoseconds ?? 0,
    };
  }
  console.warn("serializeTimestamp received an invalid non-Timestamp object:", timestamp);
  return null;
}

interface GetContext {
  params: {
    bookingId: string;
  };
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function GET(request: NextRequest, context: GetContext) {
  const { bookingId } = context.params;
  try {
    if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
      return new NextResponse(JSON.stringify({ message: 'A valid Booking ID path parameter is required.' }), { status: 400, headers: jsonHeaders });
    }

    if (!db) {
      console.error("API Error in /api/operator/bookings/[bookingId] GET: Firestore (db) is not initialized.");
      return new NextResponse(JSON.stringify({ message: 'Server configuration error: Firestore (db) is not initialized.' }), { status: 500, headers: jsonHeaders });
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return new NextResponse(JSON.stringify({ message: `Booking with ID ${bookingId} not found.` }), { status: 404, headers: jsonHeaders });
    }

    const bookingData = bookingSnap.data();
    const serializedBooking = {
      id: bookingSnap.id,
      ...bookingData,
      bookingTimestamp: serializeTimestamp(bookingData.bookingTimestamp as Timestamp | undefined | null),
      scheduledPickupAt: bookingData.scheduledPickupAt ? bookingData.scheduledPickupAt : null,
      updatedAt: serializeTimestamp(bookingData.updatedAt as Timestamp | undefined | null),
      cancelledAt: serializeTimestamp(bookingData.cancelledAt as Timestamp | undefined | null),
      operatorUpdatedAt: serializeTimestamp(bookingData.operatorUpdatedAt as Timestamp | undefined | null),
      driverAssignedAt: serializeTimestamp(bookingData.driverAssignedAt as Timestamp | undefined | null),
      notifiedPassengerArrivalTimestamp: serializeTimestamp(bookingData.notifiedPassengerArrivalTimestamp as Timestamp | undefined | null),
      passengerAcknowledgedArrivalTimestamp: serializeTimestamp(bookingData.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined | null),
      completedAt: serializeTimestamp(bookingData.completedAt as Timestamp | undefined | null),
    };
    
    return new NextResponse(JSON.stringify(serializedBooking), { status: 200, headers: jsonHeaders });

  } catch (error: any) {
    console.error(`Unhandled error in API /api/operator/bookings/[bookingId]/route.ts (GET handler for bookingId ${bookingId}):`, error);
    const errorPayload = {
      message: 'An unexpected server error occurred while fetching booking.',
      errorType: error.name || 'UnknownError',
      errorMessage: error.message || 'No error message available.',
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
    return new NextResponse(JSON.stringify(errorPayload), { status: 500, headers: jsonHeaders });
  }
}

const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driverAvatar: z.string().url().optional(),
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned']).optional(),
  vehicleType: z.string().optional(),
  fareEstimate: z.number().optional(),
  notes: z.string().optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride']).optional(),
}).min(1, { message: "At least one field or action must be provided for update." });

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  const { bookingId } = context.params; 

  try {
    if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
      return new NextResponse(JSON.stringify({ message: 'A valid Booking ID path parameter is required.' }), { status: 400, headers: jsonHeaders });
    }

    if (!db) {
      console.error(`API Error in /api/operator/bookings/${bookingId} POST: Firestore (db) is not initialized.`);
      return new NextResponse(JSON.stringify({ message: 'Server configuration error: Firestore (db) is not initialized.' }), { status: 500, headers: jsonHeaders });
    }

    let body;
    try {
        body = await request.json();
    } catch (jsonParseError: any) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Failed to parse JSON body:`, jsonParseError);
        return new NextResponse(JSON.stringify({ message: 'Invalid JSON request body.', details: jsonParseError.message || String(jsonParseError) }), { status: 400, headers: jsonHeaders });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      return new NextResponse(JSON.stringify({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }), { status: 400, headers: jsonHeaders });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return new NextResponse(JSON.stringify({ message: `Booking with ID ${bookingId} not found.` }), { status: 404, headers: jsonHeaders });
    }

    const updateData: any = { 
      operatorUpdatedAt: Timestamp.now(),
    };

    if (updateDataFromPayload.action === 'notify_arrival') {
      updateData.status = 'arrived_at_pickup';
      updateData.notifiedPassengerArrivalTimestamp = Timestamp.now();
    } else if (updateDataFromPayload.action === 'acknowledge_arrival') {
      updateData.passengerAcknowledgedArrivalTimestamp = Timestamp.now();
    } else if (updateDataFromPayload.action === 'start_ride') {
      updateData.status = 'In Progress'; 
      updateData.rideStartedAt = Timestamp.now();
    } else if (updateDataFromPayload.action === 'complete_ride') {
       updateData.status = 'Completed';
       updateData.completedAt = Timestamp.now();
    } else {
      // Handle direct status updates or other field updates
      if (updateDataFromPayload.status) updateData.status = updateDataFromPayload.status;
      if (updateDataFromPayload.driverId) updateData.driverId = updateDataFromPayload.driverId;
      if (updateDataFromPayload.driverName) updateData.driverName = updateDataFromPayload.driverName;
      if (updateDataFromPayload.driverAvatar) updateData.driverAvatar = updateDataFromPayload.driverAvatar;
      if (updateDataFromPayload.vehicleType) updateData.vehicleType = updateDataFromPayload.vehicleType;
      if (updateDataFromPayload.fareEstimate !== undefined) updateData.fareEstimate = updateDataFromPayload.fareEstimate;
      if (updateDataFromPayload.notes) updateData.notes = updateDataFromPayload.notes;

      // Specific timestamp logic for certain status transitions
      if (updateDataFromPayload.status === 'Assigned' && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Completed') {
        updateData.completedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Cancelled') {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = 'operator'; 
      }
    }
    
    await updateDoc(bookingRef, updateData);
    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedBookingDataResult = updatedBookingSnap.data();

    const serializedUpdatedBooking = {
        id: updatedBookingSnap.id,
        ...updatedBookingDataResult,
        bookingTimestamp: serializeTimestamp(updatedBookingDataResult?.bookingTimestamp as Timestamp | undefined | null),
        scheduledPickupAt: updatedBookingDataResult?.scheduledPickupAt ? updatedBookingDataResult.scheduledPickupAt : null,
        updatedAt: serializeTimestamp(updatedBookingDataResult?.updatedAt as Timestamp | undefined | null),
        operatorUpdatedAt: serializeTimestamp(updatedBookingDataResult?.operatorUpdatedAt as Timestamp | undefined | null),
        driverAssignedAt: serializeTimestamp(updatedBookingDataResult?.driverAssignedAt as Timestamp | undefined | null),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(updatedBookingDataResult?.notifiedPassengerArrivalTimestamp as Timestamp | undefined | null),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(updatedBookingDataResult?.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined | null),
        rideStartedAt: serializeTimestamp(updatedBookingDataResult?.rideStartedAt as Timestamp | undefined | null),
        completedAt: serializeTimestamp(updatedBookingDataResult?.completedAt as Timestamp | undefined | null),
        cancelledAt: serializeTimestamp(updatedBookingDataResult?.cancelledAt as Timestamp | undefined | null),
    };

    return new NextResponse(JSON.stringify({ message: 'Booking updated successfully', booking: serializedUpdatedBooking }), { status: 200, headers: jsonHeaders });

  } catch (error: any) {
    console.error(`Unhandled error in API /api/operator/bookings/[bookingId]/route.ts (POST handler for bookingId ${bookingId}):`, error);
    const errorPayload = {
      message: 'An unexpected server error occurred while updating booking.',
      errorType: error.name || 'UnknownError',
      errorMessage: error.message || 'No error message available.',
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
    return new NextResponse(JSON.stringify(errorPayload), { status: 500, headers: jsonHeaders });
  }
}

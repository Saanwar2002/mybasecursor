
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
  if (typeof timestamp === 'object' && timestamp !== null && ('_seconds'in timestamp || 'seconds' in timestamp)) {
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

export async function GET(request: NextRequest, context: GetContext) {
  const { bookingId } = context.params;
  try {
    if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
      return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
    }

    if (!db) {
      console.error("API Error in /api/operator/bookings/[bookingId] GET: Firestore (db) is not initialized.");
      return NextResponse.json({ message: 'Server configuration error: Firestore (db) is not initialized.' }, { status: 500 });
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
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
    
    return NextResponse.json(serializedBooking, { status: 200 });

  } catch (error: any) {
    console.error(`Unhandled error in API /api/operator/bookings/[bookingId]/route.ts (GET handler for bookingId ${bookingId}):`, error);
    const errorPayload = {
      message: 'An unexpected server error occurred while fetching booking.',
      errorType: error.name || 'UnknownError',
      errorMessage: error.message || 'No error message available.',
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
    return NextResponse.json(errorPayload, { status: 500 });
  }
}

const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driverAvatar: z.string().url().optional(),
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'completed', 'Cancelled', 'cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned']).optional(),
  vehicleType: z.string().optional(), // Added from client payload
  driverVehicleDetails: z.string().optional(), // Added from client payload
  fareEstimate: z.number().optional(),
  notes: z.string().optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride']).optional(),
}).min(1, { message: "At least one field or action must be provided for update." });

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  const { bookingId } = context.params; 

  try {
    if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
      return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
    }

    if (!db) {
      console.error(`API Error in /api/operator/bookings/${bookingId} POST: Firestore (db) is not initialized.`);
      return NextResponse.json({ message: 'Server configuration error: Firestore (db) is not initialized.' }, { status: 500 });
    }

    let body;
    try {
        body = await request.json();
    } catch (jsonParseError: any) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Failed to parse JSON body:`, jsonParseError);
        return NextResponse.json({ message: 'Invalid JSON request body.', details: jsonParseError.message || String(jsonParseError) }, { status: 400 });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
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
      updateData.status = 'in_progress'; // Standardized to lowercase
      updateData.rideStartedAt = Timestamp.now();
    } else if (updateDataFromPayload.action === 'complete_ride') {
       updateData.status = 'completed'; // Standardized to lowercase
       updateData.completedAt = Timestamp.now();
       if (body.finalFare !== undefined && typeof body.finalFare === 'number') {
           updateData.fareEstimate = body.finalFare; // Update fareEstimate to finalFare on completion
       }
    } else {
      // Handle direct status updates or other field updates
      if (updateDataFromPayload.status) {
        // Normalize common statuses to lowercase
        const statusLower = updateDataFromPayload.status.toLowerCase();
        if (statusLower === 'completed') updateData.status = 'completed';
        else if (statusLower === 'cancelled') updateData.status = 'cancelled';
        else updateData.status = updateDataFromPayload.status; // Keep as is for others like 'Assigned', 'pending_assignment' etc.
      }

      if (updateDataFromPayload.driverId) updateData.driverId = updateDataFromPayload.driverId;
      if (updateDataFromPayload.driverName) updateData.driverName = updateDataFromPayload.driverName;
      if (updateDataFromPayload.driverAvatar) updateData.driverAvatar = updateDataFromPayload.driverAvatar;
      if (updateDataFromPayload.vehicleType) updateData.vehicleType = updateDataFromPayload.vehicleType;
      if (updateDataFromPayload.driverVehicleDetails) updateData.driverVehicleDetails = updateDataFromPayload.driverVehicleDetails; // Store this field
      if (updateDataFromPayload.fareEstimate !== undefined) updateData.fareEstimate = updateDataFromPayload.fareEstimate;
      if (updateDataFromPayload.notes) updateData.notes = updateDataFromPayload.notes;

      // Specific timestamp logic for certain status transitions
      if ((updateData.status === 'Assigned' || updateData.status === 'driver_assigned') && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateData.status === 'completed') { // lowercase
        updateData.completedAt = Timestamp.now();
      } else if (updateData.status === 'cancelled') { // lowercase
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = body.cancelledBy || 'operator'; // Store who cancelled if provided
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

    return NextResponse.json({ message: 'Booking updated successfully', booking: serializedUpdatedBooking }, { status: 200 });

  } catch (error: any) {
    console.error(`Critical Unhandled error in API /api/operator/bookings/[bookingId]/route.ts (POST handler for bookingId ${bookingId}):`, error);
    // Ensure absolutely nothing complex is done here that could fail serialization
    let errName = "UnknownError";
    let errMsg = "An unspecified error occurred on the server.";
    if (error && typeof error === 'object') {
        if (error.name && typeof error.name === 'string') errName = error.name;
        if (error.message && typeof error.message === 'string') errMsg = error.message;
    } else if (typeof error === 'string') {
        errMsg = error;
    }

    const minimalErrorPayload = {
        error: true,
        message: "Failed to process booking update.",
        details: `Error processing booking ${bookingId}. Type: ${errName}. Message: ${errMsg.substring(0,150)}`, // Keep details brief
    };
    return NextResponse.json(minimalErrorPayload, { status: 500 });
  }
}

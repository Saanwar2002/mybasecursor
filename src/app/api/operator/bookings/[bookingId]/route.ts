
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
      return NextResponse.json({ error: true, message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
    }

    if (!db) {
      console.error("API Error in /api/operator/bookings/[bookingId] GET: Firestore (db) is not initialized.");
      return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized.' }, { status: 500 });
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: true, message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
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
      rideStartedAt: serializeTimestamp(bookingData.rideStartedAt as Timestamp | undefined | null),
      completedAt: serializeTimestamp(bookingData.completedAt as Timestamp | undefined | null),
    };
    
    return NextResponse.json(serializedBooking, { status: 200 });

  } catch (error: any) {
    const bookingIdForError = (typeof bookingId === 'string' && bookingId) ? bookingId : 'UNKNOWN_BOOKING_ID';
    console.error(`Unhandled error in API /api/operator/bookings/[bookingId]/route.ts (GET handler for bookingId ${bookingIdForError}):`, String(error));
    
    const safeErrorPayload = {
        error: true,
        message: "An unexpected server error occurred while fetching the booking.",
        bookingId: bookingIdForError,
        errorType: error && typeof error.name === 'string' ? error.name : 'UnknownError',
        errorMessageHint: error && typeof error.message === 'string' && error.message.length < 200 ? error.message : 'Details logged on server.'
    };
    console.error("Full error details for server log (GET):", error);
    return NextResponse.json(safeErrorPayload, { status: 500 });
  }
}

const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driverAvatar: z.string().url().optional(),
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'completed', 'Cancelled', 'cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned']).optional(),
  vehicleType: z.string().optional(),
  driverVehicleDetails: z.string().optional(),
  fareEstimate: z.number().optional(),
  notes: z.string().optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride', 'cancel_active']).optional(),
}).min(1, { message: "At least one field or action must be provided for update." });


export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  // Early check for bookingId validity from context
  if (!context || !context.params || typeof context.params.bookingId !== 'string' || context.params.bookingId.trim() === '') {
    console.error("API Error in /api/operator/bookings/[bookingId] POST: Invalid or missing bookingId in context. Context:", context);
    const errorPayload = { error: true, message: 'A valid Booking ID path parameter is required and was not found in context.' };
    return new Response(JSON.stringify(errorPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    });
  }
  const { bookingId } = context.params; 

  if (!db) {
    console.error(`API Error in /api/operator/bookings/${bookingId} POST: Firestore (db) is not initialized.`);
    const errorPayload = { error: true, message: 'Server configuration error: Firestore (db) is not initialized.' };
    return new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let body;
    try {
        body = await request.json();
    } catch (jsonParseError: any) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Failed to parse JSON body:`, jsonParseError);
        const errorPayload = { error: true, message: 'Invalid JSON request body.', details: String(jsonParseError.message || jsonParseError) };
        return new Response(JSON.stringify(errorPayload), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      const errorPayload = { error: true, message: 'Invalid update payload.', errors: parsedPayload.error.format() };
      return new Response(JSON.stringify(errorPayload), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
      });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      const errorPayload = { error: true, message: `Booking with ID ${bookingId} not found.` };
      return new Response(JSON.stringify(errorPayload), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
      });
    }

    const currentBookingData = bookingSnap.data();

    if (updateDataFromPayload.action === 'cancel_active' && 
        !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress'].includes(currentBookingData.status)) {
        const errorPayload = { error: true, message: `Cannot cancel ride with status: ${currentBookingData.status}.`};
        return new Response(JSON.stringify(errorPayload), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const updateData: { [key: string]: any } = { 
      operatorUpdatedAt: Timestamp.now(),
    };

    if (updateDataFromPayload.action) {
        switch (updateDataFromPayload.action) {
            case 'notify_arrival':
                updateData.status = 'arrived_at_pickup';
                updateData.notifiedPassengerArrivalTimestamp = Timestamp.now();
                break;
            case 'acknowledge_arrival':
                updateData.passengerAcknowledgedArrivalTimestamp = Timestamp.now();
                break;
            case 'start_ride':
                updateData.status = 'in_progress'; 
                updateData.rideStartedAt = Timestamp.now();
                break;
            case 'complete_ride':
                updateData.status = 'completed'; 
                updateData.completedAt = Timestamp.now();
                if (body.finalFare !== undefined && typeof body.finalFare === 'number') {
                    updateData.fareEstimate = body.finalFare; 
                }
                break;
            case 'cancel_active':
                updateData.status = 'cancelled';
                updateData.cancelledAt = Timestamp.now();
                updateData.cancelledBy = body.cancelledBy || 'driver';
                break;
        }
    } else {
      if (updateDataFromPayload.status) {
        const statusLower = updateDataFromPayload.status.toLowerCase();
        if (statusLower === 'completed') updateData.status = 'completed';
        else if (statusLower === 'cancelled') updateData.status = 'cancelled';
        else updateData.status = updateDataFromPayload.status; 
      }

      const optionalFields: (keyof BookingUpdatePayload)[] = ['driverId', 'driverName', 'driverAvatar', 'vehicleType', 'driverVehicleDetails', 'fareEstimate', 'notes'];
      optionalFields.forEach(field => {
        if (updateDataFromPayload[field] !== undefined) {
          updateData[field] = updateDataFromPayload[field];
        }
      });
      
      if ((updateData.status === 'Assigned' || updateData.status === 'driver_assigned') && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateData.status === 'completed' && !updateData.completedAt) {
        updateData.completedAt = Timestamp.now();
      } else if (updateData.status === 'cancelled' && !updateData.cancelledAt) {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = body.cancelledBy || 'operator';
      }
    }
    
    if (Object.keys(updateData).length > 1) {
        await updateDoc(bookingRef, updateData);
    } else {
        console.log(`No substantive data changes for booking ${bookingId}, only operatorUpdatedAt.`);
    }
    
    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedBookingDataResult = updatedBookingSnap.data();

    if (!updatedBookingDataResult) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Data missing after update.`);
        const errorPayload = { error: true, message: "Failed to retrieve booking data after update." };
        return new Response(JSON.stringify(errorPayload), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const bookingResponseObject = {
        id: updatedBookingSnap.id,
        passengerName: updatedBookingDataResult.passengerName,
        pickupLocation: updatedBookingDataResult.pickupLocation,
        dropoffLocation: updatedBookingDataResult.dropoffLocation,
        stops: updatedBookingDataResult.stops || [],
        vehicleType: updatedBookingDataResult.vehicleType,
        fareEstimate: updatedBookingDataResult.fareEstimate,
        status: updatedBookingDataResult.status,
        driverId: updatedBookingDataResult.driverId,
        driverName: updatedBookingDataResult.driverName,
        driverAvatar: updatedBookingDataResult.driverAvatar,
        driverVehicleDetails: updatedBookingDataResult.driverVehicleDetails,
        paymentMethod: updatedBookingDataResult.paymentMethod,
        isSurgeApplied: updatedBookingDataResult.isSurgeApplied,
        notes: updatedBookingDataResult.notes,
        passengers: updatedBookingDataResult.passengers,
        bookingTimestamp: serializeTimestamp(updatedBookingDataResult.bookingTimestamp as Timestamp | undefined | null),
        scheduledPickupAt: updatedBookingDataResult.scheduledPickupAt || null,
        operatorUpdatedAt: serializeTimestamp(updatedBookingDataResult.operatorUpdatedAt as Timestamp | undefined | null),
        driverAssignedAt: serializeTimestamp(updatedBookingDataResult.driverAssignedAt as Timestamp | undefined | null),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(updatedBookingDataResult.notifiedPassengerArrivalTimestamp as Timestamp | undefined | null),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(updatedBookingDataResult.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined | null),
        rideStartedAt: serializeTimestamp(updatedBookingDataResult.rideStartedAt as Timestamp | undefined | null),
        completedAt: serializeTimestamp(updatedBookingDataResult.completedAt as Timestamp | undefined | null),
        cancelledAt: serializeTimestamp(updatedBookingDataResult.cancelledAt as Timestamp | undefined | null),
        cancelledBy: updatedBookingDataResult.cancelledBy,
    };

    return NextResponse.json({ message: 'Booking updated successfully', booking: bookingResponseObject }, { status: 200 });

  } catch (error) {
    const bookingIdForError = String(bookingId || 'UNKNOWN_BOOKING_ID');
    console.error(`GLOBAL CATCH in API /api/operator/bookings/[bookingId]/route.ts (POST handler for bookingId ${bookingIdForError}):`, error);

    let errorMsg = "An unexpected server error occurred during booking update.";
    let errType = "UnknownError";
    let errStack = "";

    if (error instanceof Error) {
        errorMsg = String(error.message); 
        errType = String(error.name); 
        errStack = String(error.stack || "").substring(0, 500); 
    } else if (typeof error === 'string') {
        errorMsg = error;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        errorMsg = String(error.message);
        if ('name' in error && typeof error.name === 'string') errType = String(error.name);
    }

    const safeErrorPayload = {
        error: true,
        message: "An unexpected server error occurred. Please check server logs for more details.",
        bookingIdAttempted: bookingIdForError,
        errorType: errType,
        errorMessageServerHint: errorMsg.substring(0, 250)
    };
    console.error("Full error stack for server log (POST):", errStack);
    
    // Use manual Response object for utmost safety in error reporting
    try {
        return new Response(JSON.stringify(safeErrorPayload), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (responseError) {
        console.error("CRITICAL: Failed to construct manual JSON error response:", responseError);
        return new Response("Critical server error: Unable to formulate JSON error response.", {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    }
  }
}

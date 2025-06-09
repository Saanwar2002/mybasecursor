
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, deleteField, DocumentData } from 'firebase/firestore';
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
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'completed', 'Cancelled', 'cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned', 'pending_driver_wait_and_return_approval', 'in_progress_wait_and_return']).optional(),
  vehicleType: z.string().optional(),
  driverVehicleDetails: z.string().optional(),
  fareEstimate: z.number().optional(),
  finalFare: z.number().optional(),
  notes: z.string().max(500).optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride', 'cancel_active', 'request_wait_and_return', 'accept_wait_and_return', 'decline_wait_and_return']).optional(),
  cancelledBy: z.string().optional(),
  estimatedAdditionalWaitTimeMinutes: z.number().int().min(0).optional(),
}).min(1, { message: "At least one field or action must be provided for update." });


export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  console.log("!!!! API POST /api/operator/bookings/[bookingId] - HANDLER ENTERED !!!!");
  let bookingIdForHandler: string | undefined;

  try {
    if (!context || !context.params || typeof context.params.bookingId !== 'string' || context.params.bookingId.trim() === '') {
      const contextErrorMsg = "Critical error: Booking ID missing, invalid, or context.params is not structured as expected in request path.";
      console.error("API POST Error (Context Validation):", contextErrorMsg);
      // Avoid stringifying potentially problematic context directly in response
      if (typeof context === 'object' && context !== null) {
        console.error("Problematic Context (keys only):", Object.keys(context));
        if (context.params) console.error("Problematic Context.params (keys only):", Object.keys(context.params));
      } else {
        console.error("Problematic Context (raw):", String(context));
      }
      return NextResponse.json({ error: true, message: contextErrorMsg, details: "Invalid request path parameters structure." }, { status: 400 });
    }
    bookingIdForHandler = context.params.bookingId;
    console.log(`API POST /api/operator/bookings/[bookingId] - Successfully extracted bookingId: ${bookingIdForHandler}`);

    if (!db) {
      console.error(`API POST Error /api/operator/bookings/${bookingIdForHandler}: Firestore (db) is not initialized.`);
      return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized. Booking update failed.' }, { status: 500 });
    }
    console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Firestore 'db' instance confirmed available.`);

    let body;
    try {
      body = await request.json();
      // Stringify only if debugging, avoid in production for large payloads
      // console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Parsed JSON body. Payload:`, JSON.stringify(body));
    } catch (jsonParseError: any) {
      console.error(`API POST Error /api/operator/bookings/${bookingIdForHandler}: Failed to parse JSON body. Error:`, jsonParseError.message);
      return NextResponse.json({ error: true, message: 'Invalid JSON request body provided.', details: String(jsonParseError.message || jsonParseError) }, { status: 400 });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);
    if (!parsedPayload.success) {
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Payload validation failed (Zod):`, parsedPayload.error.issues); // Log issues instead of full format
      return NextResponse.json({ error: true, message: 'Invalid update payload structure or content. Please check inputs.', details: "Validation failed (see server logs for specific Zod issues)." }, { status: 400 });
    }
    const updateDataFromPayload = parsedPayload.data;
    console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Zod parsed payload is valid.`);

    const bookingRef = doc(db, 'bookings', bookingIdForHandler);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Booking document not found in Firestore.`);
      return NextResponse.json({ error: true, message: `Booking with ID ${bookingIdForHandler} not found.` }, { status: 404 });
    }
    const currentBookingData = bookingSnap.data();
    console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Current booking status: ${currentBookingData.status}`);

    // Business logic for status checks and update payload construction
    if (updateDataFromPayload.action === 'cancel_active' && 
        !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress', 'pending_driver_wait_and_return_approval', 'in_progress_wait_and_return'].includes(currentBookingData.status)) {
        console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Invalid status for cancellation: ${currentBookingData.status}`);
        return NextResponse.json({ error: true, message: `Cannot cancel ride with status: ${currentBookingData.status}.`}, { status: 400 });
    }
     if (updateDataFromPayload.action === 'request_wait_and_return' && currentBookingData.status !== 'in_progress') {
        return NextResponse.json({ error: true, message: `Can only request Wait & Return for rides currently 'in_progress'. Current status: ${currentBookingData.status}`}, { status: 400 });
    }
    if ((updateDataFromPayload.action === 'accept_wait_and_return' || updateDataFromPayload.action === 'decline_wait_and_return') && currentBookingData.status !== 'pending_driver_wait_and_return_approval') {
        return NextResponse.json({ error: true, message: `Cannot accept/decline Wait & Return unless status is 'pending_driver_wait_and_return_approval'. Current status: ${currentBookingData.status}`}, { status: 400 });
    }

    const updateData: { [key: string]: any } = { operatorUpdatedAt: Timestamp.now() };

    if (updateDataFromPayload.action) {
        console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Processing action: ${updateDataFromPayload.action}`);
        switch (updateDataFromPayload.action) {
            case 'notify_arrival': updateData.status = 'arrived_at_pickup'; updateData.notifiedPassengerArrivalTimestamp = Timestamp.now(); break;
            case 'acknowledge_arrival': updateData.passengerAcknowledgedArrivalTimestamp = Timestamp.now(); break;
            case 'start_ride': updateData.status = currentBookingData.waitAndReturn ? 'in_progress_wait_and_return' : 'in_progress'; updateData.rideStartedAt = Timestamp.now(); break;
            case 'complete_ride': updateData.status = 'completed'; updateData.completedAt = Timestamp.now(); if (updateDataFromPayload.finalFare !== undefined) updateData.fareEstimate = updateDataFromPayload.finalFare; break;
            case 'cancel_active': updateData.status = 'cancelled'; updateData.cancelledAt = Timestamp.now(); updateData.cancelledBy = updateDataFromPayload.cancelledBy || 'driver'; break;
            case 'request_wait_and_return': if (updateDataFromPayload.estimatedAdditionalWaitTimeMinutes === undefined) return NextResponse.json({ error: true, message: 'estimatedAdditionalWaitTimeMinutes required.'}, { status: 400 }); updateData.status = 'pending_driver_wait_and_return_approval'; updateData.estimatedAdditionalWaitTimeMinutes = updateDataFromPayload.estimatedAdditionalWaitTimeMinutes; updateData.waitAndReturn = true; break;
            case 'accept_wait_and_return': const originalFare = currentBookingData.fareEstimate || 0; const requestedWait = currentBookingData.estimatedAdditionalWaitTimeMinutes || 0; const chargeableWaitMinutes = Math.max(0, requestedWait - 10); const waitingCharge = chargeableWaitMinutes * 0.20; updateData.fareEstimate = parseFloat((originalFare * 1.70 + waitingCharge).toFixed(2)); updateData.status = 'in_progress_wait_and_return'; updateData.waitAndReturn = true; break;
            case 'decline_wait_and_return': updateData.status = 'in_progress'; updateData.estimatedAdditionalWaitTimeMinutes = deleteField(); updateData.waitAndReturn = false; break;
        }
    } else {
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Processing direct field updates.`);
      if (updateDataFromPayload.status) { const statusLower = updateDataFromPayload.status.toLowerCase(); if (statusLower === 'completed') updateData.status = 'completed'; else if (statusLower === 'cancelled') updateData.status = 'cancelled'; else updateData.status = updateDataFromPayload.status; }
      const optionalFields: (keyof BookingUpdatePayload)[] = ['driverId', 'driverName', 'driverAvatar', 'vehicleType', 'driverVehicleDetails', 'fareEstimate', 'notes'];
      for (const field of optionalFields) { const value = updateDataFromPayload[field]; if (value !== undefined) updateData[field] = value; }
      if ((updateData.status === 'Assigned' || updateData.status === 'driver_assigned') && updateDataFromPayload.driverId) updateData.driverAssignedAt = Timestamp.now();
      else if (updateData.status === 'completed' && !updateData.completedAt) updateData.completedAt = Timestamp.now();
      else if (updateData.status === 'cancelled' && !updateData.cancelledAt) { updateData.cancelledAt = Timestamp.now(); updateData.cancelledBy = updateDataFromPayload.cancelledBy || 'operator'; }
    }

    const substantiveKeys = Object.keys(updateData).filter(key => key !== 'operatorUpdatedAt');
    if (substantiveKeys.length > 0) {
      await updateDoc(bookingRef, updateData);
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Firestore updateDoc successful with ${substantiveKeys.length} changes.`);
    } else {
       console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - No substantive data changes. Firestore updateDoc skipped.`);
    }
    
    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedBookingDataResult = updatedBookingSnap.data();
    if (!updatedBookingDataResult) {
      console.error(`API POST Error /api/operator/bookings/${bookingIdForHandler}: Data missing after update/check.`);
      throw new Error("Data unexpectedly missing after Firestore operation.");
    }
    
    const bookingResponseObject = {
        id: bookingIdForHandler, passengerName: updatedBookingDataResult.passengerName,
        pickupLocation: updatedBookingDataResult.pickupLocation, dropoffLocation: updatedBookingDataResult.dropoffLocation,
        stops: updatedBookingDataResult.stops || [], vehicleType: updatedBookingDataResult.vehicleType,
        fareEstimate: updatedBookingDataResult.fareEstimate, status: updatedBookingDataResult.status,
        driverId: updatedBookingDataResult.driverId, driverName: updatedBookingDataResult.driverName,
        driverAvatar: updatedBookingDataResult.driverAvatar, driverVehicleDetails: updatedBookingDataResult.driverVehicleDetails,
        paymentMethod: updatedBookingDataResult.paymentMethod, isSurgeApplied: updatedBookingDataResult.isSurgeApplied,
        notes: updatedBookingDataResult.notes, passengers: updatedBookingDataResult.passengers,
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
        waitAndReturn: updatedBookingDataResult.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: updatedBookingDataResult.estimatedAdditionalWaitTimeMinutes,
    };

    console.log(`API POST /api/operator/bookings/${bookingIdForHandler} - Successfully processed. Sending 200 response.`);
    return NextResponse.json({ message: 'Booking updated successfully', booking: bookingResponseObject }, { status: 200 });

  } catch (error: any) {
    const bookingIdForErrorLog = String(bookingIdForHandler || context?.params?.bookingId || 'UNKNOWN_BOOKING_ID_IN_CATCH');
    console.error(`!!! CRITICAL SERVER ERROR in API POST /api/operator/bookings/${bookingIdForErrorLog} !!!`);
    console.error("Error Name:", String(error?.name || "UnknownErrorType"));
    console.error("Error Message:", String(error?.message || "No specific message available."));
    if (error.stack) console.error("Error Stack:", error.stack);
    
    return NextResponse.json({
        error: true,
        message: "A critical server error occurred. Please check server logs for specific details.",
        errorCode: "API_POST_CRITICAL_FAILURE",
        bookingIdAttempted: bookingIdForErrorLog,
        errorHint: error instanceof Error ? error.constructor.name : "UnknownErrorObject"
    }, { status: 500 });
  }
}

    
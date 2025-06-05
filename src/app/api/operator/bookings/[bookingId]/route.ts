
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
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'completed', 'Cancelled', 'cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned']).optional(),
  vehicleType: z.string().optional(),
  driverVehicleDetails: z.string().optional(),
  fareEstimate: z.number().optional(),
  notes: z.string().max(500).optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride', 'cancel_active']).optional(),
  finalFare: z.number().optional(),
  cancelledBy: z.string().optional(),
}).min(1, { message: "At least one field or action must be provided for update." });


export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  if (!context || !context.params || typeof context.params.bookingId !== 'string' || context.params.bookingId.trim() === '') {
    console.error("API POST Error: Invalid or missing bookingId in context. Context:", JSON.stringify(context));
    return new Response(JSON.stringify({ error: true, message: 'A valid Booking ID path parameter is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const { bookingId } = context.params; 

  if (!db) {
    console.error(`API POST Error /api/operator/bookings/${bookingId}: Firestore (db) is not initialized.`);
    return new Response(JSON.stringify({ error: true, message: 'Server configuration error: Firestore (db) is not initialized.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  console.log(`API POST /api/operator/bookings/${bookingId} - Request received.`);

  try {
    let body;
    try {
        body = await request.json();
        console.log(`API POST /api/operator/bookings/${bookingId} - Received raw body:`, JSON.stringify(body, null, 2).substring(0, 1000)); // Log first 1KB
    } catch (jsonParseError: any) {
        console.error(`API POST Error /api/operator/bookings/${bookingId}: Failed to parse JSON body:`, jsonParseError);
        return new Response(JSON.stringify({ error: true, message: 'Invalid JSON request body.', details: String(jsonParseError.message || jsonParseError) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      console.log(`API POST /api/operator/bookings/${bookingId} - Payload validation failed:`, JSON.stringify(parsedPayload.error.format(), null, 2));
      return new Response(JSON.stringify({ error: true, message: 'Invalid update payload.', errors: parsedPayload.error.format() }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const updateDataFromPayload = parsedPayload.data;
    console.log(`API POST /api/operator/bookings/${bookingId} - Parsed Zod payload:`, JSON.stringify(updateDataFromPayload, null, 2));

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef); // Initial fetch

    if (!bookingSnap.exists()) {
      console.log(`API POST /api/operator/bookings/${bookingId} - Booking not found.`);
      return new Response(JSON.stringify({ error: true, message: `Booking with ID ${bookingId} not found.` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const currentBookingData = bookingSnap.data();
    console.log(`API POST /api/operator/bookings/${bookingId} - Current booking status: ${currentBookingData.status}`);

    if (updateDataFromPayload.action === 'cancel_active' && 
        !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress'].includes(currentBookingData.status)) {
        console.log(`API POST /api/operator/bookings/${bookingId} - Invalid status for cancellation: ${currentBookingData.status}`);
        return new Response(JSON.stringify({ error: true, message: `Cannot cancel ride with status: ${currentBookingData.status}.`}), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const updateData: { [key: string]: any } = { 
      operatorUpdatedAt: Timestamp.now(),
    };

    if (updateDataFromPayload.action) {
        console.log(`API POST /api/operator/bookings/${bookingId} - Processing action: ${updateDataFromPayload.action}`);
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
                if (updateDataFromPayload.finalFare !== undefined) {
                    updateData.fareEstimate = updateDataFromPayload.finalFare; 
                }
                break;
            case 'cancel_active':
                updateData.status = 'cancelled';
                updateData.cancelledAt = Timestamp.now();
                updateData.cancelledBy = updateDataFromPayload.cancelledBy || 'driver';
                break;
        }
    } else {
      console.log(`API POST /api/operator/bookings/${bookingId} - Processing direct field updates.`);
      if (updateDataFromPayload.status) {
        const statusLower = updateDataFromPayload.status.toLowerCase();
        if (statusLower === 'completed') updateData.status = 'completed';
        else if (statusLower === 'cancelled') updateData.status = 'cancelled';
        else updateData.status = updateDataFromPayload.status; 
      }

      const optionalFields: (keyof BookingUpdatePayload)[] = ['driverId', 'driverName', 'driverAvatar', 'vehicleType', 'driverVehicleDetails', 'fareEstimate', 'notes'];
      for (const field of optionalFields) {
        const value = updateDataFromPayload[field];
        if (value !== undefined) {
          updateData[field] = value;
        }
      }
      
      if ((updateData.status === 'Assigned' || updateData.status === 'driver_assigned') && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateData.status === 'completed' && !updateData.completedAt) {
        updateData.completedAt = Timestamp.now();
      } else if (updateData.status === 'cancelled' && !updateData.cancelledAt) {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = updateDataFromPayload.cancelledBy || 'operator';
      }
    }
    
    console.log(`API POST /api/operator/bookings/${bookingId} - Constructed updateData for Firestore:`, JSON.stringify(updateData, null, 2));

    let updatedBookingDataResult: DocumentData | undefined;
    try {
        console.log(`API POST /api/operator/bookings/${bookingId} - Attempting Firestore updateDoc...`);
        const substantiveKeys = Object.keys(updateData).filter(key => key !== 'operatorUpdatedAt');
        if (substantiveKeys.length > 0) {
            await updateDoc(bookingRef, updateData);
            console.log(`API POST /api/operator/bookings/${bookingId} - Firestore updateDoc successful.`);
        } else {
            console.log(`API POST /api/operator/bookings/${bookingId} - No substantive data changes, only operatorUpdatedAt or no changes. Skipping updateDoc for main fields.`);
        }
        
        const updatedBookingSnap = await getDoc(bookingRef);
        updatedBookingDataResult = updatedBookingSnap.data();
        console.log(`API POST /api/operator/bookings/${bookingId} - Firestore getDoc after update/check successful.`);

        if (!updatedBookingDataResult) {
            console.error(`API POST Error /api/operator/bookings/${bookingId}: Data missing after update/check.`);
            throw new Error("Data inexplicably missing after Firestore operation.");
        }
    } catch (firestoreError: any) {
        console.error(`API POST Error /api/operator/bookings/${bookingId} - Firestore operation error:`, firestoreError);
        throw new Error(`Firestore operation failed: ${firestoreError.message || String(firestoreError)}`);
    }
    
    const bookingResponseObject = {
        id: bookingId,
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
    console.log(`API POST /api/operator/bookings/${bookingId} - Successfully processed. Sending response.`);
    return NextResponse.json({ message: 'Booking updated successfully', booking: bookingResponseObject }, { status: 200 });

  } catch (error) {
    const bookingIdForError = String(bookingId || 'UNKNOWN_BOOKING_ID');
    console.error(`GLOBAL CATCH in API POST /api/operator/bookings/[bookingId]/route.ts for bookingId ${bookingIdForError}:`, error);

    const errorResponsePayload = {
        error: true,
        message: "An unexpected server error occurred. Please check server logs.",
        bookingIdAttempted: String(bookingIdForError),
        errorName: error instanceof Error ? String(error.name) : "UnknownErrorType",
        errorMessageBrief: error instanceof Error ? String(error.message).substring(0, 100) : "No specific error message."
    };
    
    try {
        return new Response(JSON.stringify(errorResponsePayload), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (responseError) {
        console.error("CRITICAL: Failed to construct manual JSON error response:", responseError);
        return new Response("Critical server error: Unable to formulate JSON error response.", {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
  }
}

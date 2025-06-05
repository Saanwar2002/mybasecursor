
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
    return NextResponse.json({ 
        error: true, 
        message: 'A valid Booking ID path parameter is required and was not found in context.' 
    }, { status: 400 });
  }
  const { bookingId } = context.params; 

  try {
    if (!db) {
      console.error(`API Error in /api/operator/bookings/${bookingId} POST: Firestore (db) is not initialized.`);
      return NextResponse.json({ 
          error: true, 
          message: 'Server configuration error: Firestore (db) is not initialized.' 
      }, { status: 500 });
    }

    let body;
    try {
        body = await request.json();
    } catch (jsonParseError: any) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Failed to parse JSON body:`, jsonParseError);
        return NextResponse.json({ 
            error: true, 
            message: 'Invalid JSON request body.', 
            details: String(jsonParseError.message || jsonParseError) 
        }, { status: 400 });
    }
    
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      return NextResponse.json({ 
          error: true, 
          message: 'Invalid update payload.', 
          errors: parsedPayload.error.format() 
      }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: true, message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
    }

    const currentBookingData = bookingSnap.data();

    // Example of a business logic check (can be expanded)
    if (updateDataFromPayload.action === 'cancel_active' && 
        !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress'].includes(currentBookingData.status)) {
        return NextResponse.json({ error: true, message: `Cannot cancel ride with status: ${currentBookingData.status}.`}, { status: 400});
    }

    const updateData: { [key: string]: any } = { 
      operatorUpdatedAt: Timestamp.now(),
    };

    // Handle actions first
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
                updateData.cancelledBy = body.cancelledBy || 'driver'; // Default to driver if not specified
                break;
        }
    } else {
      // Handle direct field updates if no action is specified
      if (updateDataFromPayload.status) {
        const statusLower = updateDataFromPayload.status.toLowerCase();
        if (statusLower === 'completed') updateData.status = 'completed';
        else if (statusLower === 'cancelled') updateData.status = 'cancelled';
        else updateData.status = updateDataFromPayload.status; 
      }

      // Safely assign optional fields
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
    
    if (Object.keys(updateData).length > 1) { // Ensure there's more than just operatorUpdatedAt
        await updateDoc(bookingRef, updateData);
    } else {
        // No actual data change other than timestamp, could skip updateDoc or just proceed
        console.log(`No substantive data changes for booking ${bookingId}, only operatorUpdatedAt.`);
    }
    
    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedBookingDataResult = updatedBookingSnap.data();

    if (!updatedBookingDataResult) {
        console.error(`API Error in /api/operator/bookings/${bookingId} POST: Data missing after update.`);
        return NextResponse.json({ error: true, message: "Failed to retrieve booking data after update." }, { status: 500 });
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
    console.error(`GLOBAL CATCH in API /api/operator/bookings/[bookingId]/route.ts (POST handler for bookingId ${String(bookingId || 'UNKNOWN_BOOKING_ID')}):`, error);
    
    let errorMsg = "An unexpected server error occurred during booking update.";
    let errType = "UnknownError";
    
    if (error instanceof Error) {
        errorMsg = error.message;
        errType = error.name;
    } else if (typeof error === 'string') {
        errorMsg = error;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        errorMsg = error.message;
        if ('name' in error && typeof error.name === 'string') errType = error.name;
    }
    
    const safeErrorPayload = {
        error: true,
        message: "An unexpected server error occurred. Please check server logs for more details.",
        bookingIdAttempted: String(bookingId || 'UNKNOWN_BOOKING_ID'), // Ensure string
        errorType: String(errType), // Ensure string
        errorMessageServerHint: String(errorMsg).substring(0, 250) // Ensure string and limit length
    };
    
    return NextResponse.json(safeErrorPayload, { status: 500 });
  }
}


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
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.enum(['auto_system', 'manual_operator', 'priority_override']).optional(),
}).min(1, { message: "At least one field or action must be provided for update." });


export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  console.log("!!!! API POST /api/operator/bookings/[bookingId] - SIMPLIFIED HANDLER ENTERED !!!!");
  let bookingIdFromContext: string | undefined = undefined;

  try {
    // Try to access bookingId very carefully from context.params
    if (context && context.params && typeof context.params.bookingId === 'string' && context.params.bookingId.trim() !== '') {
      bookingIdFromContext = context.params.bookingId;
      console.log(`SIMPLIFIED: Successfully extracted bookingId: ${bookingIdFromContext}`);
    } else {
      console.error("SIMPLIFIED CRITICAL: bookingId could not be extracted from context. Context object:", context);
      // Attempt to log keys if context or context.params are objects
      if (context && typeof context === 'object') console.error("SIMPLIFIED Context keys:", Object.keys(context));
      if (context && context.params && typeof context.params === 'object') console.error("SIMPLIFIED Context.params keys:", Object.keys(context.params));
      
      return NextResponse.json({ error: true, message: 'Critical error: Booking ID missing or invalid in request path context. Cannot proceed.' }, { status: 400 });
    }

    // If bookingId extraction was successful, immediately return a test JSON response.
    // This bypasses all other logic (db checks, body parsing, etc.)
    return NextResponse.json({
      message: `Simplified test response for bookingId: ${bookingIdFromContext}`,
      bookingIdReceived: bookingIdFromContext,
      status: "ok_from_simplified_handler"
    }, { status: 200 });

  } catch (error: any) {
    // This catch block is for truly unexpected errors during the simplified extraction or response sending.
    console.error(`!!! UNHANDLED CRITICAL ERROR IN SIMPLIFIED API POST /api/operator/bookings/[bookingId=${bookingIdFromContext || 'UNKNOWN'}] !!!`, error);
    return NextResponse.json({
        error: true,
        message: "A severe unexpected server error occurred very early in the simplified request handler.",
        bookingIdAttempted: bookingIdFromContext || "ExtractionFailed",
        errorName: error?.name || "UnknownError",
        errorMessage: error?.message || "No specific error message.",
    }, { status: 500 });
  }
}

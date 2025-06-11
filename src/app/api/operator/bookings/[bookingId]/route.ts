
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, serverTimestamp, deleteField } from 'firebase/firestore';
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
  if (typeof timestamp === 'object' && timestamp !== null && ('_seconds'in timestamp || 'seconds' in timestamp)) {
     return {
      _seconds: (timestamp as any)._seconds ?? (timestamp as any).seconds,
      _nanoseconds: (timestamp as any)._nanoseconds ?? (timestamp as any).nanoseconds ?? 0,
    };
  }
  return null;
}

const locationPointSchema = z.object({
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  doorOrFlat: z.string().optional(),
});

const offerDetailsSchema = z.object({
  id: z.string(), // mock offer ID
  pickupLocation: z.string(),
  pickupCoords: z.object({ lat: z.number(), lng: z.number() }),
  dropoffLocation: z.string(),
  dropoffCoords: z.object({ lat: z.number(), lng: z.number() }),
  fareEstimate: z.number(),
  passengerCount: z.number(),
  passengerId: z.string(),
  passengerName: z.string().optional(),
  passengerPhone: z.string().optional(),
  notes: z.string().optional(),
  requiredOperatorId: z.string().optional(),
  distanceMiles: z.number().optional(),
  paymentMethod: z.enum(['card', 'cash', 'account']).optional(),
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.enum(['auto_system', 'manual_operator', 'priority_override']).optional(),
  accountJobPin: z.string().optional(),
});


const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  status: z.string().optional(),
  vehicleType: z.string().optional(),
  driverVehicleDetails: z.string().optional(),
  action: z.string().optional(),
  finalFare: z.number().optional(),
  notifiedPassengerArrivalTimestamp: z.boolean().optional(),
  rideStartedAt: z.boolean().optional(),
  completedAt: z.boolean().optional(),
  passengerAcknowledgedArrivalTimestamp: z.boolean().optional(),
  offerDetails: offerDetailsSchema.optional(),
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.string().optional(),
  waitAndReturn: z.boolean().optional(),
  estimatedAdditionalWaitTimeMinutes: z.number().min(0).optional().nullable(),
  driverCurrentLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  accountJobPin: z.string().optional(),
  noShowFeeApplicable: z.boolean().optional(),
  cancellationFeeApplicable: z.boolean().optional(),
  cancellationType: z.string().optional(),
});

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

interface PostContext {
  params: {
    bookingId: string;
  };
}

// Function to generate a random 4-digit PIN
function generateFourDigitPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(request: NextRequest, context: PostContext) {
  let bookingIdForHandler: string = "UNKNOWN_BOOKING_ID_CONTEXT_ERROR";
  try {
    if (!context || !context.params || typeof context.params.bookingId !== 'string' || context.params.bookingId.trim() === '') {
        console.error("API POST /api/operator/bookings/[bookingId]: Critical error - bookingId not found in context.params. Context:", JSON.stringify(context, null, 2));
        return NextResponse.json({ message: 'Booking ID is missing in the request path or context is malformed.' }, { status: 400 });
    }
    bookingIdForHandler = context.params.bookingId;
    console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Handler entered. Extracted bookingId: ${bookingIdForHandler}`);
  } catch (contextError: any) {
    console.error("API POST /api/operator/bookings/[bookingId]: Error processing context parameters:", contextError);
    return NextResponse.json({ message: 'Failed to process request parameters.', details: contextError.message || String(contextError) }, { status: 500 });
  }

  if (!db) {
    console.error(`API POST Error /api/operator/bookings/${bookingIdForHandler}: Firestore (db) is not initialized.`);
    return NextResponse.json({ message: 'Server configuration error: Firestore (db) is not initialized. Booking update failed.' , details: 'Database service unavailable.'}, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Received raw payload:`, JSON.stringify(payload, null, 2));

    const parsedPayload = bookingUpdateSchema.safeParse(payload);

    if (!parsedPayload.success) {
      console.error(`API POST /api/operator/bookings/${bookingIdForHandler}: Top-level payload validation failed. Errors:`, JSON.stringify(parsedPayload.error.format(), null, 2));
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format(), details: 'The main request body does not match the expected structure.' }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    if (bookingIdForHandler.startsWith('mock-offer-')) {
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Handling as mock offer acceptance. Validating offerDetails from raw payload.`);
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Raw payload.offerDetails:`, JSON.stringify(payload.offerDetails, null, 2));

      const offerDetailsParseResult = offerDetailsSchema.safeParse(payload.offerDetails);
      if (!offerDetailsParseResult.success) {
          console.error(`API POST /api/operator/bookings/${bookingIdForHandler}: CRITICAL - payload.offerDetails (raw) FAILED Zod validation. Errors:`, JSON.stringify(offerDetailsParseResult.error.format(), null, 2));
          return NextResponse.json({ message: 'Offer details are malformed or missing required fields for mock offer processing.', details: 'The nested offerDetails object is invalid.', errors: offerDetailsParseResult.error.format() }, { status: 400 });
      }

      const offer = offerDetailsParseResult.data;
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Successfully parsed offerDetails for mock offer. Proceeding to create booking. Parsed offer:`, JSON.stringify(offer, null, 2));

      const newBookingData: any = {
        // Fields directly from offer
        passengerId: offer.passengerId,
        passengerName: offer.passengerName || 'Passenger',
        passengerPhone: offer.passengerPhone || null,
        pickupLocation: { 
            address: offer.pickupLocation, 
            latitude: offer.pickupCoords.lat, 
            longitude: offer.pickupCoords.lng 
        },
        dropoffLocation: { 
            address: offer.dropoffLocation, 
            latitude: offer.dropoffCoords.lat, 
            longitude: offer.dropoffCoords.lng 
        },
        fareEstimate: offer.fareEstimate,
        passengers: offer.passengerCount,
        paymentMethod: offer.paymentMethod || 'card',
        notes: offer.notes || null,
        requiredOperatorId: offer.requiredOperatorId || null,
        isPriorityPickup: offer.isPriorityPickup ?? (updateDataFromPayload.isPriorityPickup ?? false),
        priorityFeeAmount: offer.priorityFeeAmount ?? (updateDataFromPayload.priorityFeeAmount ?? 0),
        dispatchMethod: offer.dispatchMethod || 'auto_system',
        accountJobPin: offer.accountJobPin || null,
        distanceMiles: offer.distanceMiles || null,
        
        // Fields from updateDataFromPayload (driver info & status)
        driverId: updateDataFromPayload.driverId || null,
        driverName: updateDataFromPayload.driverName || null,
        status: updateDataFromPayload.status || 'driver_assigned',
        vehicleType: updateDataFromPayload.vehicleType || null,
        driverVehicleDetails: updateDataFromPayload.driverVehicleDetails || null,
        driverCurrentLocation: updateDataFromPayload.driverCurrentLocation || null,

        // Firestore Timestamps
        bookingTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Data to be written to Firestore (addDoc):`, JSON.stringify(newBookingData, null, 2));

      try {
        const docRef = await addDoc(collection(db, 'bookings'), newBookingData);
        console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: New booking created with ID: ${docRef.id} from mock offer.`);
        
        const newBookingSnap = await getDoc(docRef);
        const newBookingSavedData = newBookingSnap.data();
        const responseData = {
            id: newBookingSnap.id,
            ...newBookingSavedData,
            bookingTimestamp: serializeTimestamp(newBookingSavedData?.bookingTimestamp as Timestamp | undefined),
            updatedAt: serializeTimestamp(newBookingSavedData?.updatedAt as Timestamp | undefined),
        };
        return NextResponse.json({ message: 'Mock offer accepted, new booking created.', booking: responseData }, { status: 201 });

      } catch (addDocError: any) {
        console.error(`API POST /api/operator/bookings/${bookingIdForHandler}: Firestore addDoc FAILED. Error Code: ${addDocError.code}, Message: ${addDocError.message}`, addDocError);
        return NextResponse.json({ 
            message: 'Failed to create new booking in database.', 
            details: `Firestore addDoc error: ${addDocError.message}`, 
            code: addDocError.code || 'FIRESTORE_ADD_DOC_ERROR' 
        }, { status: 500 });
      }
    } else {
      // This is an update to an existing booking
      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Handling as update to existing booking.`);
      const bookingRef = doc(db, 'bookings', bookingIdForHandler);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        console.warn(`API POST /api/operator/bookings/${bookingIdForHandler}: Booking not found for update.`);
        return NextResponse.json({ message: `Booking with ID ${bookingIdForHandler} not found.`, details: `No document exists at bookings/${bookingIdForHandler}` }, { status: 404 });
      }

      const updatePayloadFirestore: any = { ...updateDataFromPayload };
      delete updatePayloadFirestore.action;
      delete updatePayloadFirestore.offerDetails; 

      const existingBookingDbData = bookingSnap.data();

      if (updateDataFromPayload.driverId && !existingBookingDbData?.driverId) {
        updatePayloadFirestore.dispatchMethod = 'manual_operator';
        console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Manual assignment by operator - setting dispatchMethod to 'manual_operator'.`);
      }

      if (updateDataFromPayload.action === 'notify_arrival') {
          updatePayloadFirestore.status = 'arrived_at_pickup';
          updatePayloadFirestore.notifiedPassengerArrivalTimestampActual = Timestamp.now();
      } else if (updateDataFromPayload.action === 'start_ride') {
          if (existingBookingDbData?.waitAndReturn === true && (existingBookingDbData?.status === 'pending_driver_wait_and_return_approval' || existingBookingDbData?.status === 'in_progress_wait_and_return' || existingBookingDbData?.status === 'arrived_at_pickup')) {
            updatePayloadFirestore.status = 'in_progress_wait_and_return';
          } else {
            updatePayloadFirestore.status = 'in_progress';
          }
          updatePayloadFirestore.rideStartedAtActual = Timestamp.now();
      } else if (updateDataFromPayload.action === 'complete_ride') {
          updatePayloadFirestore.status = 'completed';
          updatePayloadFirestore.completedAtActual = Timestamp.now();
          if (updateDataFromPayload.finalFare !== undefined) {
              updatePayloadFirestore.fareEstimate = updateDataFromPayload.finalFare;
          }
      } else if (updateDataFromPayload.action === 'cancel_active') {
          updatePayloadFirestore.status = 'cancelled_by_driver';
          updatePayloadFirestore.cancelledAt = Timestamp.now();
      } else if (updateDataFromPayload.action === 'report_no_show') {
          updatePayloadFirestore.status = 'cancelled_no_show';
          updatePayloadFirestore.cancellationType = 'passenger_no_show';
          updatePayloadFirestore.noShowFeeApplicable = true;
          updatePayloadFirestore.cancelledAt = Timestamp.now();
      } else if (updateDataFromPayload.action === 'accept_wait_and_return') {
          updatePayloadFirestore.status = 'in_progress_wait_and_return';
          updatePayloadFirestore.waitAndReturn = true;
      } else if (updateDataFromPayload.action === 'decline_wait_and_return') {
          updatePayloadFirestore.status = 'in_progress';
          updatePayloadFirestore.waitAndReturn = false;
          updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = null;
      } else if (updateDataFromPayload.action === 'operator_cancel_pending') {
          if (existingBookingDbData?.status !== 'pending_assignment') {
            return NextResponse.json({ message: 'Only "Pending Assignment" rides can be cancelled by the operator this way.' }, { status: 400 });
          }
          updatePayloadFirestore.status = 'cancelled_by_operator';
          updatePayloadFirestore.cancelledAt = Timestamp.now();
      } else if (updateDataFromPayload.status) {
          updatePayloadFirestore.status = updateDataFromPayload.status;
      }


      if (updatePayloadFirestore.notifiedPassengerArrivalTimestamp === true) delete updatePayloadFirestore.notifiedPassengerArrivalTimestamp;
      if (updatePayloadFirestore.rideStartedAt === true) delete updatePayloadFirestore.rideStartedAt;
      if (updatePayloadFirestore.completedAt === true) delete updatePayloadFirestore.completedAt;
      if (updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp === true) {
          updatePayloadFirestore.passengerAcknowledgedArrivalTimestampActual = Timestamp.now();
          delete updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp;
      }


      updatePayloadFirestore.updatedAt = Timestamp.now();

      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Updating Firestore with (after action logic):`, JSON.stringify(updatePayloadFirestore, null, 2));
      await updateDoc(bookingRef, updatePayloadFirestore);

      const updatedBookingSnap = await getDoc(bookingRef);
      const updatedData = updatedBookingSnap.data();

      if (!updatedData) {
          console.error(`API POST /api/operator/bookings/${bookingIdForHandler}: Failed to retrieve updated document after update.`);
          return NextResponse.json({ message: 'Failed to confirm booking update.', details: 'Could not re-fetch document post-update.' }, { status: 500 });
      }

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
          driverCurrentLocation: updatedData.driverCurrentLocation,
      };

      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Update successful. Returning:`, JSON.stringify(responseData, null, 2));
      return NextResponse.json({ message: 'Booking updated successfully', booking: responseData }, { status: 200 });
    }

  } catch (error: any) {
    console.error(`API POST Error /api/operator/bookings/${bookingIdForHandler}:`, error);

    let errorMessage = 'An unexpected error occurred during booking update.';
    let errorDetails = '';

    if (error instanceof Error) {
        errorMessage = error.message;
        if ((error as any).code) {
          errorDetails = `Firebase Error Code: ${(error as any).code}. ${error.stack || error.toString()}`;
        } else {
          errorDetails = error.stack || error.toString();
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error);
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } else {
        errorDetails = String(error);
    }

    return NextResponse.json({
        message: "Server Error Encountered During Update",
        details: errorMessage,
        rawErrorDetails: errorDetails
    }, { status: 500 });
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
    return NextResponse.json({ message: 'Server configuration error: Firestore (db) is not initialized.', details: 'Database service unavailable.' }, { status: 500 });
  }
   if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ message: 'A valid Booking ID path parameter is required for GET.', details: 'Booking ID was empty or invalid.' }, { status: 400 });
  }
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: 'Booking not found.' , details: `No booking found with ID ${bookingId}`}, { status: 404 });
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
        driverCurrentLocation: data.driverCurrentLocation,
    };
    return NextResponse.json({ booking: responseData }, { status: 200 });
  } catch (error: any) {
    console.error(`Error in GET /api/operator/bookings/${bookingId || 'UNKNOWN'}`, error);
    const errorMessage = error.message || 'An unexpected error occurred while fetching booking.';
    const errorDetails = error.details || (error.cause ? String(error.cause) : error.toString());
    return NextResponse.json({ message: "Server Error During GET", details: errorMessage, rawError: errorDetails }, { status: 500 });
  }
}

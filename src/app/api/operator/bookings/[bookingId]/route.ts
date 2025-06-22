
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, serverTimestamp, deleteField, GeoPoint } from 'firebase/firestore';
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
  id: z.string(), 
  pickupLocation: z.string(),
  pickupCoords: z.object({ lat: z.number(), lng: z.number() }),
  dropoffLocation: z.string(),
  dropoffCoords: z.object({ lat: z.number(), lng: z.number() }),
  stops: z.array(z.object({ 
    address: z.string(),
    coords: z.object({ lat: z.number(), lng: z.number() }),
  })).optional(),
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
  updatedLegDetails: z.object({
    newLegIndex: z.number().int().min(0),
    currentLegEntryTimestamp: z.boolean().optional(),
    previousStopIndex: z.number().int().min(0).optional(),
    waitingChargeForPreviousStop: z.number().min(0).optional(),
  }).optional(),
});

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

interface PostContext {
  params: {
    bookingId: string;
  };
}

function generateFourDigitPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const PLATFORM_OPERATOR_CODE_FOR_ID = "OP001"; // Helper
const PLATFORM_OPERATOR_ID_PREFIX = "001"; // Helper

function getOperatorPrefix(operatorCode?: string | null): string { 
  if (operatorCode && operatorCode.startsWith("OP") && operatorCode.length >= 5) {
    const numericPart = operatorCode.substring(2);
    if (/^\d{3,}$/.test(numericPart)) {
      return numericPart.slice(0, 3); // Return first 3 digits of the numeric part
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
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
      
      const originatingOperatorId = offer.requiredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
      


      const newBookingData: any = {
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
        stops: offer.stops ? offer.stops.map(s => ({
          address: s.address,
          latitude: s.coords.lat,
          longitude: s.coords.lng,
        })) : [],
        fareEstimate: offer.fareEstimate,
        passengers: offer.passengerCount,
        paymentMethod: offer.paymentMethod ?? 'card',
        notes: offer.notes ?? null,
        requiredOperatorId: offer.requiredOperatorId ?? null,
        isPriorityPickup: offer.isPriorityPickup ?? (updateDataFromPayload.isPriorityPickup ?? false),
        priorityFeeAmount: offer.priorityFeeAmount ?? (updateDataFromPayload.priorityFeeAmount ?? 0),
        dispatchMethod: offer.dispatchMethod ?? 'auto_system',
        accountJobPin: offer.accountJobPin ?? null,
        distanceMiles: offer.distanceMiles ?? null,
        driverId: updateDataFromPayload.driverId ?? null,
        driverName: updateDataFromPayload.driverName ?? null,
        status: updateDataFromPayload.status ?? 'driver_assigned',
        vehicleType: updateDataFromPayload.vehicleType ?? null,
        driverVehicleDetails: updateDataFromPayload.driverVehicleDetails ?? null,
        driverCurrentLocation: updateDataFromPayload.driverCurrentLocation
          ? new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng)
          : null,
        bookingTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        originatingOperatorId: originatingOperatorId, 
        driverCurrentLegIndex: 0,
        currentLegEntryTimestamp: null,
        completedStopWaitCharges: {},
      };
      
      if(newBookingData.paymentMethod === 'account' && !newBookingData.accountJobPin) {
        newBookingData.accountJobPin = generateFourDigitPin();
      }

      console.log(`API POST /api/operator/bookings/${bookingIdForHandler} (MOCK OFFER): Data to be written to Firestore (addDoc):`, JSON.stringify(newBookingData, null, 2));

      try {
        const docRef = await addDoc(collection(db, 'bookings'), newBookingData);
        const newFirestoreId = docRef.id;
        
        const displayBookingIdPrefix = getOperatorPrefix(originatingOperatorId);
        const timestampPart = Date.now().toString().slice(-4);
        const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const numericSuffix = `${timestampPart}${randomPart}`;
        const finalDisplayBookingId = `${displayBookingIdPrefix}/${numericSuffix}`;


        // Update the new booking with its displayBookingId
        await updateDoc(doc(db, 'bookings', newFirestoreId), {
          displayBookingId: finalDisplayBookingId
        });

        console.log(`API POST /api/operator/bookings/${bookingIdForHandler} (MOCK OFFER): New booking created with ID: ${newFirestoreId}, Display ID: ${finalDisplayBookingId} from mock offer.`);

        const newBookingSnap = await getDoc(docRef);
        const newBookingSavedData = newBookingSnap.data();
        const responseData = {
            id: newBookingSnap.id,
            ...newBookingSavedData,
            bookingTimestamp: serializeTimestamp(newBookingSavedData?.bookingTimestamp as Timestamp | undefined),
            updatedAt: serializeTimestamp(newBookingSavedData?.updatedAt as Timestamp | undefined),
            currentLegEntryTimestamp: serializeTimestamp(newBookingSavedData?.currentLegEntryTimestamp as Timestamp | undefined),
        };
        console.log(`API POST /api/operator/bookings/${bookingIdForHandler} (MOCK OFFER): Returning response:`, JSON.stringify({ message: 'Mock offer accepted, new booking created.', booking: responseData }, null, 2));
        return NextResponse.json({ message: 'Mock offer accepted, new booking created.', booking: responseData }, { status: 201 });

      } catch (addDocError: any) {
        console.error(`API POST /api/operator/bookings/${bookingIdForHandler} (MOCK OFFER): Firestore addDoc FAILED. Raw Error:`, addDocError);
        let details = 'Firestore addDoc operation failed.';
        if (addDocError.message) {
            details += ` Message: ${addDocError.message}.`;
        }
        if (addDocError.code) {
            details += ` Code: ${addDocError.code}.`;
        }
        if (addDocError.stack) {
            console.error("addDocError STACK:", addDocError.stack);
        }
        return NextResponse.json({
            message: 'Failed to create new booking in database.',
            details: details,
            code: addDocError.code || 'FIRESTORE_ADD_DOC_ERROR_UNKNOWN'
        }, { status: 500 });
      }
    } else {
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
          if (updateDataFromPayload.driverCurrentLocation) {
            updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
          }
      } else if (updateDataFromPayload.action === 'start_ride') {
          console.log(`API: Processing 'start_ride' for booking ${bookingIdForHandler}. Payload updatedLegDetails:`, updateDataFromPayload.updatedLegDetails);
          if (existingBookingDbData?.waitAndReturn === true && (existingBookingDbData?.status === 'pending_driver_wait_and_return_approval' || existingBookingDbData?.status === 'in_progress_wait_and_return' || existingBookingDbData?.status === 'arrived_at_pickup')) {
            updatePayloadFirestore.status = 'in_progress_wait_and_return';
          } else {
            updatePayloadFirestore.status = 'in_progress';
          }
          updatePayloadFirestore.rideStartedAtActual = Timestamp.now();
          if (updateDataFromPayload.updatedLegDetails && updateDataFromPayload.updatedLegDetails.newLegIndex !== undefined) {
              updatePayloadFirestore.driverCurrentLegIndex = updateDataFromPayload.updatedLegDetails.newLegIndex;
              console.log(`API: Set driverCurrentLegIndex to ${updatePayloadFirestore.driverCurrentLegIndex} for 'start_ride'`);
          } else {
              updatePayloadFirestore.driverCurrentLegIndex = 1;
              console.warn(`API: 'start_ride' - updatedLegDetails.newLegIndex not provided by client for ${bookingIdForHandler}. Defaulting driverCurrentLegIndex to 1.`);
          }
          if (updateDataFromPayload.updatedLegDetails?.currentLegEntryTimestamp === true || !existingBookingDbData?.currentLegEntryTimestamp) {
              updatePayloadFirestore.currentLegEntryTimestamp = Timestamp.now();
              console.log(`API: Set currentLegEntryTimestamp for 'start_ride' for leg ${updatePayloadFirestore.driverCurrentLegIndex}`);
          }
          if (updateDataFromPayload.driverCurrentLocation) {
            updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
          }
      } else if (updateDataFromPayload.action === 'proceed_to_next_leg') {
          console.log(`API: Processing 'proceed_to_next_leg' for booking ${bookingIdForHandler}. Payload updatedLegDetails:`, updateDataFromPayload.updatedLegDetails);
          if (updateDataFromPayload.updatedLegDetails && updateDataFromPayload.updatedLegDetails.newLegIndex !== undefined) {
              updatePayloadFirestore.driverCurrentLegIndex = updateDataFromPayload.updatedLegDetails.newLegIndex;
              if(updateDataFromPayload.updatedLegDetails.currentLegEntryTimestamp === true) {
                  updatePayloadFirestore.currentLegEntryTimestamp = Timestamp.now();
              }
              console.log(`API: Set driverCurrentLegIndex to ${updatePayloadFirestore.driverCurrentLegIndex} and currentLegEntryTimestamp for 'proceed_to_next_leg'`);

              if (updateDataFromPayload.updatedLegDetails.previousStopIndex !== undefined && updateDataFromPayload.updatedLegDetails.waitingChargeForPreviousStop !== undefined) {
                const chargeKey = `completedStopWaitCharges.${updateDataFromPayload.updatedLegDetails.previousStopIndex}`;
                updatePayloadFirestore[chargeKey] = updateDataFromPayload.updatedLegDetails.waitingChargeForPreviousStop;
                console.log(`API: Storing waiting charge for previous stop ${updateDataFromPayload.updatedLegDetails.previousStopIndex}: £${updateDataFromPayload.updatedLegDetails.waitingChargeForPreviousStop}`);
              }
          } else {
              console.warn(`API: 'proceed_to_next_leg' - updatedLegDetails or newLegIndex not provided by client for ${bookingIdForHandler}. Leg index not updated.`);
          }
          if (updateDataFromPayload.driverCurrentLocation) {
            updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
          }
      } else if (updateDataFromPayload.action === 'complete_ride') {
          updatePayloadFirestore.status = 'completed';
          updatePayloadFirestore.completedAtActual = Timestamp.now();
          if (updateDataFromPayload.finalFare !== undefined) {
              updatePayloadFirestore.fareEstimate = updateDataFromPayload.finalFare; // Store the final calculated fare
              updatePayloadFirestore.finalCalculatedFare = updateDataFromPayload.finalFare; // Store final for consistency if a dedicated field is used
          }
          updatePayloadFirestore.currentLegEntryTimestamp = deleteField();
      } else if (updateDataFromPayload.action === 'cancel_active') {
          updatePayloadFirestore.status = 'cancelled_by_driver';
          updatePayloadFirestore.cancelledAt = Timestamp.now();
          updatePayloadFirestore.currentLegEntryTimestamp = deleteField();
      } else if (updateDataFromPayload.action === 'report_no_show') {
          updatePayloadFirestore.status = 'cancelled_no_show';
          updatePayloadFirestore.cancellationType = 'passenger_no_show';
          updatePayloadFirestore.noShowFeeApplicable = true;
          updatePayloadFirestore.cancelledAt = Timestamp.now();
          updatePayloadFirestore.currentLegEntryTimestamp = deleteField();
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

      if (updateDataFromPayload.driverCurrentLocation && !updatePayloadFirestore.driverCurrentLocation) {
        updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
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
          currentLegEntryTimestamp: serializeTimestamp(updatedData.currentLegEntryTimestamp as Timestamp | undefined),
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

    let displayBookingId = data.displayBookingId;
    const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
    
    if (!displayBookingId || (displayBookingId.includes('/') && displayBookingId.split('/')[1].length > 10 && !/^\d+$/.test(displayBookingId.split('/')[1]))) {
      const prefix = getOperatorPrefix(rideOriginatingOperatorId);
      const shortSuffix = bookingSnap.id.substring(0, 6).toUpperCase();
      displayBookingId = `${prefix}/${shortSuffix}`;
    }

     const responseData = {
        id: bookingSnap.id,
        displayBookingId: displayBookingId,
        originatingOperatorId: rideOriginatingOperatorId,
        ...data,
        bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: data.scheduledPickupAt || null,
        updatedAt: serializeTimestamp(data.updatedAt as Timestamp | undefined),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(data.notifiedPassengerArrivalTimestampActual as Timestamp | undefined),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(data.passengerAcknowledgedArrivalTimestampActual as Timestamp | undefined),
        rideStartedAt: serializeTimestamp(data.rideStartedAtActual as Timestamp | undefined),
        completedAt: serializeTimestamp(data.completedAtActual as Timestamp | undefined),
        currentLegEntryTimestamp: serializeTimestamp(data.currentLegEntryTimestamp as Timestamp | undefined),
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

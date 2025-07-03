import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp, FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

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
  pickupWaitingCharge: z.number().optional(),
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
  return "001";
}

// Function to generate sequential booking ID for an operator
async function generateBookingId(operatorCode: string): Promise<string> {
  const counterRef = db.collection('counters').doc(`bookingId_${operatorCode}`);
  
  const result = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    if (!counterDoc.exists) {
      // Initialize counter if it doesn't exist
      transaction.set(counterRef, { currentId: 1 });
      return 1;
    }
    const counterData = counterDoc.data();
    if (!counterData) throw new Error('Counter document data missing');
    const currentId = counterData.currentId;
    transaction.update(counterRef, { currentId: currentId + 1 });
    return currentId + 1;
  });
  
  return `${operatorCode}/${result.toString().padStart(8, '0')}`;
}

// Helper to calculate distance between two lat/lng points (Haversine formula)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number): number => x * Math.PI / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
        bookingTimestamp: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
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
        const docRef = await db.collection('bookings').add(newBookingData);
        const newFirestoreId = docRef.id;
        
        // Generate sequential display booking ID
        const finalDisplayBookingId = await generateBookingId(originatingOperatorId);

        // Update the new booking with its displayBookingId
        await db.collection('bookings').doc(newFirestoreId).update({
          displayBookingId: finalDisplayBookingId
        });

        console.log(`API POST /api/operator/bookings/${bookingIdForHandler} (MOCK OFFER): New booking created with ID: ${newFirestoreId}, Display ID: ${finalDisplayBookingId} from mock offer.`);

        const newBookingSnap = await docRef.get();
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
      const bookingRef = db.collection('bookings').doc(bookingIdForHandler);
      const bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists) {
        console.warn(`API POST /api/operator/bookings/${bookingIdForHandler}: Booking not found for update.`);
        return NextResponse.json({ message: `Booking with ID ${bookingIdForHandler} not found.`, details: `No document exists at bookings/${bookingIdForHandler}` }, { status: 404 });
      }

      const updatePayloadFirestore: any = { ...updateDataFromPayload };
      delete updatePayloadFirestore.action;
      delete updatePayloadFirestore.offerDetails;

      const existingBookingDbData = bookingSnap.data();
      if (!existingBookingDbData) {
        return NextResponse.json({ message: `Booking with ID ${bookingIdForHandler} has no data.` }, { status: 404 });
      }

      // Always create a ride offer if a driver is assigned and status is 'driver_assigned'
      if (
        updateDataFromPayload.driverId && 
        updatePayloadFirestore.status === 'driver_assigned'
      ) {
        console.log('[DEBUG] Creating ride offer:', {
          driverId: updateDataFromPayload.driverId,
          bookingId: bookingIdForHandler,
          status: updatePayloadFirestore.status
        });
        // Expire any previous rideOffers for this booking
        const existingOffersSnap = await db.collection('rideOffers').where('bookingId', '==', bookingIdForHandler).where('status', '==', 'pending').get();
        for (const offerDoc of existingOffersSnap.docs) {
          await offerDoc.ref.update({ status: 'expired', expiredAt: FieldValue.serverTimestamp() });
        }
        // Create a new ride offer for the assigned driver
        try {
          const rideOffer = {
            bookingId: bookingIdForHandler,
            driverId: updateDataFromPayload.driverId,
            offerDetails: {
              pickupLocation: existingBookingDbData.pickupLocation?.address ?? null,
              pickupCoords: {
                lat: existingBookingDbData.pickupLocation?.latitude ?? null,
                lng: existingBookingDbData.pickupLocation?.longitude ?? null
              },
              dropoffLocation: existingBookingDbData.dropoffLocation?.address ?? null,
              dropoffCoords: {
                lat: existingBookingDbData.dropoffLocation?.latitude ?? null,
                lng: existingBookingDbData.dropoffLocation?.longitude ?? null
              },
              stops: existingBookingDbData.stops || [],
              fareEstimate: existingBookingDbData.fareEstimate ?? null,
              passengerCount: existingBookingDbData.passengers ?? null,
              passengerId: existingBookingDbData.passengerId ?? null,
              passengerName: existingBookingDbData.passengerName ?? null,
              passengerPhone: existingBookingDbData.passengerPhone || existingBookingDbData.customerPhoneNumber || null,
              notes: existingBookingDbData.notes || existingBookingDbData.driverNotes || null,
              paymentMethod: existingBookingDbData.paymentMethod ?? null,
              isPriorityPickup: existingBookingDbData.isPriorityPickup ?? null,
              priorityFeeAmount: existingBookingDbData.priorityFeeAmount ?? null,
              distanceMiles: existingBookingDbData.distanceMiles ?? null,
              requiredOperatorId: existingBookingDbData.originatingOperatorId ?? null,
              accountJobPin: existingBookingDbData.accountJobPin ?? null
            },
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 30000)) // 30s expiry
          };
          await db.collection('rideOffers').add(rideOffer);
          console.log(`Ride offer created for driver ${updateDataFromPayload.driverId} for booking ${bookingIdForHandler}`);
        } catch (offerErr) {
          console.error('Failed to create ride offer document:', offerErr);
        }
      }

      if (updateDataFromPayload.action === 'notify_arrival') {
          updatePayloadFirestore.status = 'arrived_at_pickup';
          updatePayloadFirestore.notifiedPassengerArrivalTimestampActual = Timestamp.fromDate(new Date());
          if (updateDataFromPayload.driverCurrentLocation) {
            updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
          }
      } else if (updateDataFromPayload.action === 'start_ride') {
          console.log(`API: Processing 'start_ride' for booking ${bookingIdForHandler}. Payload updatedLegDetails:`, updateDataFromPayload.updatedLegDetails);
          if (existingBookingDbData.waitAndReturn === true && (existingBookingDbData.status === 'pending_driver_wait_and_return_approval' || existingBookingDbData.status === 'in_progress_wait_and_return' || existingBookingDbData.status === 'arrived_at_pickup')) {
            updatePayloadFirestore.status = 'in_progress_wait_and_return';
          } else {
            updatePayloadFirestore.status = 'in_progress';
          }
          updatePayloadFirestore.rideStartedAtActual = FieldValue.serverTimestamp();
          if (updateDataFromPayload.updatedLegDetails && updateDataFromPayload.updatedLegDetails.newLegIndex !== undefined) {
              updatePayloadFirestore.driverCurrentLegIndex = updateDataFromPayload.updatedLegDetails.newLegIndex;
              console.log(`API: Set driverCurrentLegIndex to ${updatePayloadFirestore.driverCurrentLegIndex} for 'start_ride'`);
          } else {
              updatePayloadFirestore.driverCurrentLegIndex = 1;
              console.warn(`API: 'start_ride' - updatedLegDetails.newLegIndex not provided by client for ${bookingIdForHandler}. Defaulting driverCurrentLegIndex to 1.`);
          }
          if (updateDataFromPayload.updatedLegDetails?.currentLegEntryTimestamp === true || !existingBookingDbData.currentLegEntryTimestamp) {
              updatePayloadFirestore.currentLegEntryTimestamp = FieldValue.serverTimestamp();
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
                  updatePayloadFirestore.currentLegEntryTimestamp = FieldValue.serverTimestamp();
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
          updatePayloadFirestore.completedAtActual = FieldValue.serverTimestamp();
          if (updateDataFromPayload.finalFare !== undefined) {
              updatePayloadFirestore.fareEstimate = updateDataFromPayload.finalFare; // Store the final calculated fare
              updatePayloadFirestore.finalCalculatedFare = updateDataFromPayload.finalFare; // Store final for consistency if a dedicated field is used
          }
          // Add pickupWaitingCharge if provided
          if (typeof updateDataFromPayload.pickupWaitingCharge === 'number') {
              updatePayloadFirestore['pickupWaitingCharge'] = updateDataFromPayload.pickupWaitingCharge;
          }
          updatePayloadFirestore.currentLegEntryTimestamp = FieldValue.delete();

          // --- CREDIT ACCOUNT UPDATE LOGIC START ---
          // If payment method is 'account', update the credit account balance
          if ((existingBookingDbData.paymentMethod === 'account' || updatePayloadFirestore.paymentMethod === 'account') && existingBookingDbData.passengerId) {
            try {
              // Fetch all credit accounts
              const creditAccountsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/operator/credit-accounts`);
              if (creditAccountsRes.ok) {
                const creditAccountsData = await creditAccountsRes.json();
                // Find the account with associatedUserId matching passengerId
                const creditAccount = creditAccountsData.accounts.find((acc: any) => acc.associatedUserId === existingBookingDbData.passengerId);
                if (creditAccount) {
                  // Deduct the fare from the account balance
                  const newBalance = (creditAccount.balance || 0) - (updateDataFromPayload.finalFare || existingBookingDbData.finalCalculatedFare || 0);
                  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/operator/credit-accounts`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: creditAccount.id, balance: newBalance })
                  });
                }
              }
            } catch (creditUpdateErr) {
              console.error('Failed to update credit account balance:', creditUpdateErr);
            }
          }
          // --- CREDIT ACCOUNT UPDATE LOGIC END ---
      } else if (updateDataFromPayload.action === 'cancel_active') {
          updatePayloadFirestore.status = 'cancelled_by_driver';
          updatePayloadFirestore.cancelledAt = FieldValue.serverTimestamp();
          updatePayloadFirestore.currentLegEntryTimestamp = FieldValue.delete();
      } else if (updateDataFromPayload.action === 'report_no_show') {
          updatePayloadFirestore.status = 'cancelled_no_show';
          updatePayloadFirestore.cancellationType = 'passenger_no_show';
          updatePayloadFirestore.noShowFeeApplicable = true;
          updatePayloadFirestore.cancelledAt = FieldValue.serverTimestamp();
          updatePayloadFirestore.currentLegEntryTimestamp = FieldValue.delete();
      } else if (updateDataFromPayload.action === 'accept_wait_and_return') {
          updatePayloadFirestore.status = 'in_progress_wait_and_return';
          updatePayloadFirestore.waitAndReturn = true;
      } else if (updateDataFromPayload.action === 'decline_wait_and_return') {
          updatePayloadFirestore.status = 'in_progress';
          updatePayloadFirestore.waitAndReturn = false;
          updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = null;
      } else if (updateDataFromPayload.action === 'operator_cancel_pending') {
          if (existingBookingDbData.status !== 'pending_assignment') {
            return NextResponse.json({ message: 'Only "Pending Assignment" rides can be cancelled by the operator this way.' }, { status: 400 });
          }
          updatePayloadFirestore.status = 'cancelled_by_operator';
          updatePayloadFirestore.cancelledAt = FieldValue.serverTimestamp();
      } else if (updateDataFromPayload.status) {
          updatePayloadFirestore.status = updateDataFromPayload.status;
      }

      if (updateDataFromPayload.driverCurrentLocation && !updatePayloadFirestore.driverCurrentLocation) {
        updatePayloadFirestore.driverCurrentLocation = new GeoPoint(updateDataFromPayload.driverCurrentLocation.lat, updateDataFromPayload.driverCurrentLocation.lng);
      }

      // --- AUTOMATIC DRIVER MATCHING LOGIC ---
      if (updateDataFromPayload.action === 'auto_assign_driver') {
        // 1. Get the booking's pickup location
        const pickup = existingBookingDbData.pickupLocation;
        if (!pickup || typeof pickup.latitude !== 'number' || typeof pickup.longitude !== 'number') {
          return NextResponse.json({ message: 'Booking does not have a valid pickup location.' }, { status: 400 });
        }

        // 1.5. Check operator's dispatchMode
        const preferredOperatorId = existingBookingDbData.preferredOperatorId || existingBookingDbData.originatingOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
        let dispatchMode = 'auto'; // default fallback
        try {
          const operatorSettingsSnap = await db.collection('operatorSettings').doc(preferredOperatorId).get();
          if (operatorSettingsSnap.exists) {
            const operatorSettings = operatorSettingsSnap.data();
            if (operatorSettings && typeof operatorSettings.dispatchMode === 'string') {
              dispatchMode = operatorSettings.dispatchMode;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch operatorSettings for dispatchMode, defaulting to auto:', err);
        }
        if (dispatchMode !== 'auto') {
          return NextResponse.json({ message: `Auto-assign is disabled for this operator. Manual assignment required.`, dispatchMode }, { status: 200 });
        }

        // 2. Determine which operator to filter by
        const driversRef = db.collection('drivers');
        let driversQuery;
        
        if (preferredOperatorId) {
          // Filter by both status and operator code
          driversQuery = driversRef.where('status', '==', 'Active').where('operatorCode', '==', preferredOperatorId);
          console.log(`Auto-assign: Filtering drivers by operator ${preferredOperatorId}`);
        } else {
          // No operator preference, get all active drivers
          driversQuery = driversRef.where('status', '==', 'Active');
          console.log(`Auto-assign: No operator preference, considering all active drivers`);
        }
        
        const driversSnapshot = await driversQuery.get();
        let nearestDriver: any = null;
        let minDistance = Infinity;
        
        driversSnapshot.forEach(docSnap => {
          const driver = docSnap.data();
          if (driver.location && typeof driver.location.lat === 'number' && typeof driver.location.lng === 'number') {
            const dist = haversineDistance(pickup.latitude, pickup.longitude, driver.location.lat, driver.location.lng);
            if (dist < minDistance) {
              minDistance = dist;
              nearestDriver = { id: docSnap.id, ...driver };
            }
          }
        });
        
        if (!nearestDriver) {
          const errorMessage = preferredOperatorId 
            ? `No available drivers found for operator ${preferredOperatorId} in your area.`
            : 'No available drivers found in your area.';
          return NextResponse.json({ message: errorMessage }, { status: 404 });
        }
        
        console.log(`Auto-assign: Selected driver ${nearestDriver.id} (${nearestDriver.name}) at distance ${(minDistance/1000).toFixed(2)}km`);
        
        // 4. Assign the ride to the nearest driver
        updatePayloadFirestore.driverId = nearestDriver.id;
        updatePayloadFirestore.status = 'driver_assigned';
        updatePayloadFirestore.dispatchMethod = 'auto_system';
        
        // Add driver details
        updatePayloadFirestore.driverName = nearestDriver.name;
        updatePayloadFirestore.driverVehicleDetails = nearestDriver.vehicleCategory || '';
        
        // Create a ride offer for the selected driver
        try {
          const rideOffer = {
            bookingId: bookingIdForHandler,
            driverId: nearestDriver.id,
            offerDetails: {
              pickupLocation: existingBookingDbData.pickupLocation?.address ?? null,
              pickupCoords: {
                lat: existingBookingDbData.pickupLocation?.latitude ?? null,
                lng: existingBookingDbData.pickupLocation?.longitude ?? null
              },
              dropoffLocation: existingBookingDbData.dropoffLocation?.address ?? null,
              dropoffCoords: {
                lat: existingBookingDbData.dropoffLocation?.latitude ?? null,
                lng: existingBookingDbData.dropoffLocation?.longitude ?? null
              },
              stops: existingBookingDbData.stops || [],
              fareEstimate: existingBookingDbData.fareEstimate ?? null,
              passengerCount: existingBookingDbData.passengers ?? null,
              passengerId: existingBookingDbData.passengerId ?? null,
              passengerName: existingBookingDbData.passengerName ?? null,
              passengerPhone: existingBookingDbData.passengerPhone || existingBookingDbData.customerPhoneNumber || null,
              notes: existingBookingDbData.notes || existingBookingDbData.driverNotes || null,
              paymentMethod: existingBookingDbData.paymentMethod ?? null,
              isPriorityPickup: existingBookingDbData.isPriorityPickup ?? null,
              priorityFeeAmount: existingBookingDbData.priorityFeeAmount ?? null,
              distanceMiles: existingBookingDbData.distanceMiles ?? null,
              requiredOperatorId: existingBookingDbData.originatingOperatorId ?? null,
              accountJobPin: existingBookingDbData.accountJobPin ?? null
            },
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 30000)) // 30s expiry
          };
          await db.collection('rideOffers').add(rideOffer);
          console.log(`Auto-assign: Ride offer created for driver ${nearestDriver.id} for booking ${bookingIdForHandler}`);
        } catch (offerErr) {
          console.error('Auto-assign: Failed to create ride offer document:', offerErr);
        }
      }

      if (updatePayloadFirestore.notifiedPassengerArrivalTimestamp === true) delete updatePayloadFirestore.notifiedPassengerArrivalTimestamp;
      if (updatePayloadFirestore.rideStartedAt === true) delete updatePayloadFirestore.rideStartedAt;
      if (updatePayloadFirestore.completedAt === true) delete updatePayloadFirestore.completedAt;
      if (updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp === true) {
          updatePayloadFirestore.passengerAcknowledgedArrivalTimestampActual = FieldValue.serverTimestamp();
          delete updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp;
      }

      // Add audit fields to all booking updates
      const operatorUserId = 'system';
      const operatorUserRole = 'api';
      const updateSource = request.headers.get('user-agent') || 'unknown';
      updatePayloadFirestore.updatedAt = FieldValue.serverTimestamp();
      updatePayloadFirestore.updatedBy = operatorUserId;
      updatePayloadFirestore.updatedByRole = operatorUserRole;
      updatePayloadFirestore.updateSource = updateSource;

      console.log(`API POST /api/operator/bookings/${bookingIdForHandler}: Updating Firestore with (after action logic):`, JSON.stringify(updatePayloadFirestore, null, 2));
      await bookingRef.update(updatePayloadFirestore);

      const updatedBookingSnap = await bookingRef.get();
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

    if (updateDataFromPayload.driverId && updateDataFromPayload.status === 'driver_assigned') {
      console.log(`LOG: Booking ${bookingIdForHandler} is being updated to driver_assigned by operator. Payload:`, JSON.stringify(updateDataFromPayload, null, 2));
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
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ message: 'Booking not found.' , details: `No booking found with ID ${bookingId}`}, { status: 404 });
    }
    const data = bookingSnap.data();

    if (!data) {
      return NextResponse.json({ message: 'Booking data not found.' }, { status: 404 });
    }

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


import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore'; // Added addDoc, collection, serverTimestamp
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
  passengerName: z.string().optional(),
  notes: z.string().optional(),
  requiredOperatorId: z.string().optional(),
  distanceMiles: z.number().optional(),
  paymentMethod: z.enum(['card', 'cash']).optional(),
  passengerId: z.string(),
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.enum(['auto_system', 'manual_operator', 'priority_override']).optional(),
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
  offerDetails: offerDetailsSchema.optional(), // Added to receive mock offer details
  isPriorityPickup: z.boolean().optional(),
  priorityFeeAmount: z.number().optional(),
  dispatchMethod: z.string().optional(),
  waitAndReturn: z.boolean().optional(),
  estimatedAdditionalWaitTimeMinutes: z.number().min(0).optional().nullable(),
});

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

interface PostContext {
  params: {
    bookingId: string;
  };
}

export async function POST(request: NextRequest, context: PostContext) {
  const bookingIdFromPath = context.params.bookingId;
  console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Handler entered. Extracted bookingId: ${bookingIdFromPath}`);

  if (!db) {
    console.error(`API POST Error /api/operator/bookings/${bookingIdFromPath}: Firestore (db) is not initialized.`);
    return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized. Booking update failed.' }, { status: 500 });
  }

  if (!bookingIdFromPath || typeof bookingIdFromPath !== 'string' || bookingIdFromPath.trim() === '') {
    return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Received payload:`, JSON.stringify(payload, null, 2));
    const parsedPayload = bookingUpdateSchema.safeParse(payload);

    if (!parsedPayload.success) {
      console.error(`API POST /api/operator/bookings/${bookingIdFromPath}: Payload validation failed.`, parsedPayload.error.format());
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;

    if (bookingIdFromPath.startsWith('mock-offer-')) {
      // This is a mock offer being accepted, create a new booking
      console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Handling as mock offer acceptance. Creating new booking.`);
      if (!updateDataFromPayload.offerDetails) {
        return NextResponse.json({ message: 'Offer details are required to create a booking from a mock offer.' }, { status: 400 });
      }
      const offer = updateDataFromPayload.offerDetails;
      const newBookingData: any = {
        passengerId: offer.passengerId,
        passengerName: offer.passengerName || 'Passenger',
        pickupLocation: { address: offer.pickupLocation, latitude: offer.pickupCoords.lat, longitude: offer.pickupCoords.lng },
        dropoffLocation: { address: offer.dropoffLocation, latitude: offer.dropoffCoords.lat, longitude: offer.dropoffCoords.lng },
        // stops: offer.stops, // Assuming offerDetails might contain stops
        fareEstimate: offer.fareEstimate,
        passengers: offer.passengerCount,
        paymentMethod: offer.paymentMethod || 'card',
        notes: offer.notes,
        requiredOperatorId: offer.requiredOperatorId,
        isPriorityPickup: offer.isPriorityPickup || false,
        priorityFeeAmount: offer.priorityFeeAmount || 0,
        dispatchMethod: offer.dispatchMethod || 'auto_system',
        
        driverId: updateDataFromPayload.driverId,
        driverName: updateDataFromPayload.driverName,
        status: updateDataFromPayload.status || 'driver_assigned',
        vehicleType: updateDataFromPayload.vehicleType,
        driverVehicleDetails: updateDataFromPayload.driverVehicleDetails,
        
        bookingTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'bookings'), newBookingData);
      console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: New booking created with ID: ${docRef.id} from mock offer.`);
      
      const newBookingSnap = await getDoc(docRef);
      const newBookingSavedData = newBookingSnap.data();
       const responseData = {
        id: newBookingSnap.id,
        ...newBookingSavedData,
        bookingTimestamp: serializeTimestamp(newBookingSavedData?.bookingTimestamp as Timestamp | undefined),
        updatedAt: serializeTimestamp(newBookingSavedData?.updatedAt as Timestamp | undefined),
      };
      return NextResponse.json({ message: 'Mock offer accepted, new booking created.', booking: responseData }, { status: 201 });

    } else {
      // This is an update to an existing booking
      console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Handling as update to existing booking.`);
      const bookingRef = doc(db, 'bookings', bookingIdFromPath);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        console.warn(`API POST /api/operator/bookings/${bookingIdFromPath}: Booking not found for update.`);
        return NextResponse.json({ message: `Booking with ID ${bookingIdFromPath} not found.` }, { status: 404 });
      }

      const updatePayloadFirestore: any = { ...updateDataFromPayload };
      delete updatePayloadFirestore.action; 
      delete updatePayloadFirestore.offerDetails; // Not needed for existing booking update

      if (updateDataFromPayload.notifiedPassengerArrivalTimestamp === true) {
        updatePayloadFirestore.notifiedPassengerArrivalTimestampActual = Timestamp.now();
        delete updatePayloadFirestore.notifiedPassengerArrivalTimestamp;
      }
      if (updateDataFromPayload.passengerAcknowledgedArrivalTimestamp === true) {
        updatePayloadFirestore.passengerAcknowledgedArrivalTimestampActual = Timestamp.now();
        delete updatePayloadFirestore.passengerAcknowledgedArrivalTimestamp;
      }
      if (updateDataFromPayload.rideStartedAt === true) {
        updatePayloadFirestore.rideStartedAtActual = Timestamp.now();
        delete updatePayloadFirestore.rideStartedAt;
      }
      if (updateDataFromPayload.completedAt === true) {
        updatePayloadFirestore.completedAtActual = Timestamp.now();
        delete updatePayloadFirestore.completedAt;
      }
      if (updateDataFromPayload.estimatedAdditionalWaitTimeMinutes === null) {
        updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = null;
      } else if (updateDataFromPayload.estimatedAdditionalWaitTimeMinutes !== undefined) {
        updatePayloadFirestore.estimatedAdditionalWaitTimeMinutes = updateDataFromPayload.estimatedAdditionalWaitTimeMinutes;
      }

      updatePayloadFirestore.updatedAt = Timestamp.now();

      console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Updating Firestore with:`, JSON.stringify(updatePayloadFirestore, null, 2));
      await updateDoc(bookingRef, updatePayloadFirestore);

      const updatedBookingSnap = await getDoc(bookingRef);
      const updatedData = updatedBookingSnap.data();

      if (!updatedData) {
          console.error(`API POST /api/operator/bookings/${bookingIdFromPath}: Failed to retrieve updated document after update.`);
          return NextResponse.json({ message: 'Failed to confirm booking update.' }, { status: 500 });
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
      };

      console.log(`API POST /api/operator/bookings/${bookingIdFromPath}: Update successful. Returning:`, JSON.stringify(responseData, null, 2));
      return NextResponse.json({ message: 'Booking updated successfully', booking: responseData }, { status: 200 });
    }

  } catch (error: any) {
    console.error(`API POST Error /api/operator/bookings/${bookingIdFromPath}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error during booking update.';
    return NextResponse.json({ message: 'Failed to update booking', details: errorMessage, errorRaw: error.toString() }, { status: 500 });
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
    return NextResponse.json({ error: true, message: 'Server configuration error: Firestore (db) is not initialized.' }, { status: 500 });
  }
   if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ error: true, message: 'A valid Booking ID path parameter is required for GET.' }, { status: 400 });
  }
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
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
    };
    return NextResponse.json({ booking: responseData }, { status: 200 });
  } catch (error: any) {
    console.error(`Error in GET /api/operator/bookings/${bookingId || 'UNKNOWN'}`, error);
    return NextResponse.json({ error: true, message: "Error in GET handler." }, { status: 500 });
  }
}



import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

// Define the expected structure of the booking data coming from the client
interface BookingPayload {
  passengerId: string;
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops: LocationPoint[];
  vehicleType: string;
  passengers: number;
  fareEstimate: number; // This will now represent the base fare
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
  scheduledPickupAt?: string | null;
  customerPhoneNumber?: string;
  bookedByOperatorId?: string;
  driverNotes?: string;
  waitAndReturn?: boolean;
  estimatedWaitTimeMinutes?: number; 
  promoCode?: string;
  paymentMethod: "card" | "cash";
  preferredOperatorId?: string;
}

export async function POST(request: NextRequest) {
  let bookingData: BookingPayload;
  try {
    try {
      bookingData = (await request.json()) as BookingPayload;
    } catch (jsonError: any) {
      console.error('Error parsing JSON body in /api/bookings/create:', jsonError);
      return NextResponse.json({ message: 'Invalid JSON request body. Please ensure the request is a valid JSON object.', details: jsonError.message || String(jsonError) }, { status: 400 });
    }

    // Basic validation
    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.passengerName || !bookingData.paymentMethod) {
      return NextResponse.json({ message: 'Missing required booking fields (passengerId, passengerName, pickup, dropoff, paymentMethod).' }, { status: 400 });
    }
    if (bookingData.paymentMethod !== "card" && bookingData.paymentMethod !== "cash") {
      return NextResponse.json({ message: 'Invalid payment method. Must be "card" or "cash".' }, { status: 400 });
    }
    if (bookingData.waitAndReturn && (bookingData.estimatedWaitTimeMinutes === undefined || bookingData.estimatedWaitTimeMinutes < 0)) {
        return NextResponse.json({ message: 'Estimated wait time is required and must be non-negative for Wait & Return journeys.' }, { status: 400 });
    }
    if (bookingData.isPriorityPickup && (bookingData.priorityFeeAmount === undefined || bookingData.priorityFeeAmount <= 0)) {
        return NextResponse.json({ message: 'A positive Priority Fee amount is required if Priority Pickup is selected.' }, { status: 400 });
    }


    // Ensure db is not null before using it
    if (!db) {
      console.error('Firestore (db) is not initialized. This is a server configuration issue. Check Firebase initialization logs.');
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized. Unable to process booking.' }, { status: 500 });
    }

    const newBooking: any = {
      passengerId: bookingData.passengerId,
      passengerName: bookingData.passengerName,
      pickupLocation: {
        address: bookingData.pickupLocation.address,
        latitude: bookingData.pickupLocation.latitude,
        longitude: bookingData.pickupLocation.longitude,
        ...(bookingData.pickupLocation.doorOrFlat && { doorOrFlat: bookingData.pickupLocation.doorOrFlat }),
      },
      dropoffLocation: {
        address: bookingData.dropoffLocation.address,
        latitude: bookingData.dropoffLocation.latitude,
        longitude: bookingData.dropoffLocation.longitude,
        ...(bookingData.dropoffLocation.doorOrFlat && { doorOrFlat: bookingData.dropoffLocation.doorOrFlat }),
      },
      stops: (bookingData.stops || []).map(stop => ({
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        ...(stop.doorOrFlat && { doorOrFlat: stop.doorOrFlat }),
      })),
      vehicleType: bookingData.vehicleType,
      passengers: bookingData.passengers,
      fareEstimate: bookingData.fareEstimate, // Base fare
      isPriorityPickup: bookingData.isPriorityPickup || false,
      priorityFeeAmount: bookingData.isPriorityPickup ? (bookingData.priorityFeeAmount || 0) : 0,
      isSurgeApplied: bookingData.isSurgeApplied,
      surgeMultiplier: bookingData.surgeMultiplier,
      stopSurchargeTotal: bookingData.stopSurchargeTotal,
      status: 'pending_assignment',
      bookingTimestamp: serverTimestamp(),
      paymentMethod: bookingData.paymentMethod,
      waitAndReturn: bookingData.waitAndReturn || false,
    };

    if (bookingData.waitAndReturn && bookingData.estimatedWaitTimeMinutes !== undefined) {
      newBooking.estimatedWaitTimeMinutes = bookingData.estimatedWaitTimeMinutes;
    }

    if (bookingData.scheduledPickupAt) {
      newBooking.scheduledPickupAt = bookingData.scheduledPickupAt;
    }
    if (bookingData.customerPhoneNumber) {
      newBooking.customerPhoneNumber = bookingData.customerPhoneNumber;
    }
    if (bookingData.bookedByOperatorId) {
      newBooking.bookedByOperatorId = bookingData.bookedByOperatorId;
    }
    if (bookingData.driverNotes && bookingData.driverNotes.trim() !== "") {
      newBooking.driverNotes = bookingData.driverNotes.trim();
    }
    if (bookingData.promoCode && bookingData.promoCode.trim() !== "") {
        newBooking.promoCode = bookingData.promoCode.trim();
    }
    if (bookingData.preferredOperatorId) {
        newBooking.preferredOperatorId = bookingData.preferredOperatorId;
    }


    const docRef = await addDoc(collection(db, 'bookings'), newBooking);

    const responseData = { ...newBooking, bookingTimestamp: new Date().toISOString() };

    return NextResponse.json({ message: 'Booking created successfully', bookingId: docRef.id, data: responseData }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/bookings/create (General Catch):', error);
    let errorMessage = 'Internal Server Error during booking creation.';
    let errorDetails = '';
    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.toString();
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    }
    return NextResponse.json({ message: 'Failed to create booking due to an unexpected server error.', details: errorMessage, errorRaw: errorDetails }, { status: 500 });
  }
}

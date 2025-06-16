
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, Timestamp } from 'firebase/firestore'; // Added Timestamp

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface BookingPayload {
  passengerId: string;
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops: LocationPoint[];
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
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
  paymentMethod: "card" | "cash" | "account";
  preferredOperatorId?: string;
}

function generateFourDigitPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const PLATFORM_OPERATOR_CODE_FOR_ID = "OP001";
const PLATFORM_OPERATOR_ID_PREFIX = "001";

function getOperatorPrefix(operatorCode?: string | null): string {
  if (operatorCode && operatorCode.startsWith("OP") && operatorCode.length >= 5) {
    const numericPart = operatorCode.substring(2);
    if (/^\d{3,}$/.test(numericPart)) {
      return numericPart.slice(0, 3); 
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
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

    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.passengerName || !bookingData.paymentMethod) {
      return NextResponse.json({ message: 'Missing required booking fields (passengerId, passengerName, pickup, dropoff, paymentMethod).' }, { status: 400 });
    }
    if (bookingData.paymentMethod !== "card" && bookingData.paymentMethod !== "cash" && bookingData.paymentMethod !== "account") {
      return NextResponse.json({ message: 'Invalid payment method. Must be "card", "cash", or "account".' }, { status: 400 });
    }
    if (bookingData.waitAndReturn && (bookingData.estimatedWaitTimeMinutes === undefined || bookingData.estimatedWaitTimeMinutes < 0)) {
        return NextResponse.json({ message: 'Estimated wait time is required and must be non-negative for Wait & Return journeys.' }, { status: 400 });
    }
    if (bookingData.isPriorityPickup && (bookingData.priorityFeeAmount === undefined || bookingData.priorityFeeAmount <= 0)) {
        return NextResponse.json({ message: 'A positive Priority Fee amount is required if Priority Pickup is selected.' }, { status: 400 });
    }

    if (!db) {
      console.error('Firestore (db) is not initialized. This is a server configuration issue. Check Firebase initialization logs.');
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized. Unable to process booking.' }, { status: 500 });
    }

    const originatingOperatorId = bookingData.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
    const displayBookingIdPrefix = getOperatorPrefix(originatingOperatorId);

    const newBookingForFirestore: any = {
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
      fareEstimate: bookingData.fareEstimate,
      isPriorityPickup: bookingData.isPriorityPickup || false,
      priorityFeeAmount: bookingData.isPriorityPickup ? (bookingData.priorityFeeAmount || 0) : 0,
      isSurgeApplied: bookingData.isSurgeApplied,
      surgeMultiplier: bookingData.surgeMultiplier,
      stopSurchargeTotal: bookingData.stopSurchargeTotal,
      status: 'pending_assignment',
      bookingTimestamp: serverTimestamp(),
      paymentMethod: bookingData.paymentMethod,
      waitAndReturn: bookingData.waitAndReturn || false,
      originatingOperatorId: originatingOperatorId,
    };

    if (bookingData.paymentMethod === "account") {
      newBookingForFirestore.accountJobPin = generateFourDigitPin();
    }
    if (bookingData.waitAndReturn && bookingData.estimatedWaitTimeMinutes !== undefined) {
      newBookingForFirestore.estimatedWaitTimeMinutes = bookingData.estimatedWaitTimeMinutes;
    }
    if (bookingData.scheduledPickupAt) {
      newBookingForFirestore.scheduledPickupAt = bookingData.scheduledPickupAt;
    }
    if (bookingData.customerPhoneNumber) {
      newBookingForFirestore.customerPhoneNumber = bookingData.customerPhoneNumber;
    }
    if (bookingData.bookedByOperatorId) {
      newBookingForFirestore.bookedByOperatorId = bookingData.bookedByOperatorId;
    }
    if (bookingData.driverNotes && bookingData.driverNotes.trim() !== "") {
      newBookingForFirestore.driverNotes = bookingData.driverNotes.trim();
    }
    if (bookingData.promoCode && bookingData.promoCode.trim() !== "") {
        newBookingForFirestore.promoCode = bookingData.promoCode.trim();
    }
    if (bookingData.preferredOperatorId) { 
        newBookingForFirestore.preferredOperatorId = bookingData.preferredOperatorId;
    }

    const docRef = await addDoc(collection(db, 'bookings'), newBookingForFirestore);
    const firestoreDocId = docRef.id;

    // Generate numeric suffix for displayBookingId (shorter version)
    const timestampPart = Date.now().toString().slice(-4); // Last 4 digits of timestamp
    const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 random digits
    const numericSuffix = `${timestampPart}${randomPart}`; // 6-digit numeric suffix
    
    const displayBookingId = `${displayBookingIdPrefix}/${numericSuffix}`;

    await updateDoc(doc(db, 'bookings', firestoreDocId), {
      displayBookingId: displayBookingId,
      originatingOperatorId: originatingOperatorId, 
    });

    const responseData = { 
        ...newBookingForFirestore, 
        bookingTimestamp: new Date().toISOString(), 
        displayBookingId: displayBookingId,
        originatingOperatorId: originatingOperatorId,
    };
    if (newBookingForFirestore.accountJobPin) {
        responseData.accountJobPin = newBookingForFirestore.accountJobPin;
    }

    return NextResponse.json({ 
        message: 'Booking created successfully', 
        bookingId: firestoreDocId, 
        displayBookingId: displayBookingId, 
        originatingOperatorId: originatingOperatorId,
        data: responseData 
    }, { status: 201 });

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

import { NextResponse } from 'next/server';
import { getDb, getAdmin } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';
import { calculateFare, type FareCalculationParams, type VehicleType } from '@/lib/fare-calculator';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface BookingPayload {
  // passengerId & passengerName will come from auth context
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops: LocationPoint[];
  vehicleType: string;
  passengers: number;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied: boolean;
  scheduledPickupAt?: string | null;
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

export const POST = withAuth(async (req, { user }) => {
  const db = getDb();
  const admin = getAdmin();

  try {
    const bookingData: BookingPayload = await req.json();

    if (!bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.paymentMethod) {
      return NextResponse.json({ message: 'Missing required booking fields (pickup, dropoff, paymentMethod).' }, { status: 400 });
    }

    const fareParams: FareCalculationParams = {
      pickupCoords: { lat: bookingData.pickupLocation.latitude, lng: bookingData.pickupLocation.longitude },
      dropoffCoords: { lat: bookingData.dropoffLocation.latitude, lng: bookingData.dropoffLocation.longitude },
      stops: bookingData.stops?.map(s => ({ lat: s.latitude, lng: s.longitude })) || [],
      vehicleType: bookingData.vehicleType as VehicleType,
      passengers: bookingData.passengers,
      isWaitAndReturn: bookingData.waitAndReturn,
      estimatedWaitTimeMinutes: bookingData.estimatedWaitTimeMinutes,
      isPriorityPickup: bookingData.isPriorityPickup,
      priorityFeeAmount: bookingData.priorityFeeAmount,
      isSurgeApplied: bookingData.isSurgeApplied,
    };

    const { fareEstimate, distance, duration, surgeMultiplier } = await calculateFare(fareParams);

    const originatingOperatorId = bookingData.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
    const displayBookingIdPrefix = getOperatorPrefix(originatingOperatorId);

    const newBookingForFirestore: any = {
      passengerId: user.uid,
      passengerName: user.name || 'N/A',
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      stops: bookingData.stops || [],
      vehicleType: bookingData.vehicleType,
      passengers: bookingData.passengers,
      fareEstimate: fareEstimate,
      isPriorityPickup: bookingData.isPriorityPickup || false,
      priorityFeeAmount: bookingData.isPriorityPickup ? (bookingData.priorityFeeAmount || 0) : 0,
      isSurgeApplied: bookingData.isSurgeApplied,
      surgeMultiplier: surgeMultiplier,
      status: 'searching',
      bookingTimestamp: admin.firestore.FieldValue.serverTimestamp(), // Correct server-side timestamp
      paymentMethod: bookingData.paymentMethod,
      waitAndReturn: bookingData.waitAndReturn || false,
      originatingOperatorId: originatingOperatorId,
      driverNotes: bookingData.driverNotes || "",
      promoCode: bookingData.promoCode || "",
      distance: distance,
      duration: duration,
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

    const docRef = await db.collection('bookings').add(newBookingForFirestore);
    const firestoreDocId = docRef.id;

    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const numericSuffix = `${timestampPart}${randomPart}`;
    
    const displayBookingId = `${displayBookingIdPrefix}/${numericSuffix}`;

    await db.collection('bookings').doc(firestoreDocId).update({
      displayBookingId: displayBookingId,
    });

    return NextResponse.json({ 
        message: 'Booking created successfully', 
        bookingId: firestoreDocId, 
        displayBookingId: displayBookingId, 
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/bookings/create:', error);
    return NextResponse.json({ message: 'Failed to create booking due to an unexpected server error.' }, { status: 500 });
  }
});
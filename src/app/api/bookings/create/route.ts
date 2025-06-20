import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

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
  try {
    const bookingData: BookingPayload = await request.json();

    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.passengerName || !bookingData.paymentMethod) {
      return NextResponse.json({ message: 'Missing required booking fields (passengerId, passengerName, pickup, dropoff, paymentMethod).' }, { status: 400 });
    }
    
    if (!db) {
      console.error('Firestore (db) is not initialized.');
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
    }

    const originatingOperatorId = bookingData.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
    const displayBookingIdPrefix = getOperatorPrefix(originatingOperatorId);

    const newBookingForFirestore: any = {
      passengerId: bookingData.passengerId,
      passengerName: bookingData.passengerName,
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      stops: bookingData.stops || [],
      vehicleType: bookingData.vehicleType,
      passengers: bookingData.passengers,
      fareEstimate: bookingData.fareEstimate,
      isPriorityPickup: bookingData.isPriorityPickup || false,
      priorityFeeAmount: bookingData.isPriorityPickup ? (bookingData.priorityFeeAmount || 0) : 0,
      isSurgeApplied: bookingData.isSurgeApplied,
      surgeMultiplier: bookingData.surgeMultiplier,
      stopSurchargeTotal: bookingData.stopSurchargeTotal,
      status: 'searching', // This is the critical fix
      bookingTimestamp: serverTimestamp(),
      paymentMethod: bookingData.paymentMethod,
      waitAndReturn: bookingData.waitAndReturn || false,
      originatingOperatorId: originatingOperatorId,
      driverNotes: bookingData.driverNotes || "",
      promoCode: bookingData.promoCode || "",
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

    const docRef = await addDoc(collection(db, 'rides'), newBookingForFirestore);
    const firestoreDocId = docRef.id;

    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const numericSuffix = `${timestampPart}${randomPart}`;
    
    const displayBookingId = `${displayBookingIdPrefix}/${numericSuffix}`;

    await updateDoc(doc(db, 'rides', firestoreDocId), {
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
}
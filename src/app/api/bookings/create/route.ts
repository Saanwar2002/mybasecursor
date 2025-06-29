import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

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

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Validate required fields
    if (!data.passengerId || !data.pickupLocation || !data.dropoffLocation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Add server-generated fields
    data.createdAt = Timestamp.now();
    data.status = "pending_assignment"; // or "active" if that's your logic
    data.bookingTimestamp = Timestamp.now();
    data.ridePin = generateFourDigitPin();

    // Write to Firestore
    const docRef = await db.collection('bookings').add(data);

    // Log for debugging
    console.log("Booking created:", docRef.id, data);

    // Return consistent response
    return NextResponse.json({ success: true, bookingId: docRef.id });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: 'Failed to create booking', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

import { Timestamp } from 'firebase/firestore';

interface Booking {
  id: string;
  displayBookingId?: string; 
  originatingOperatorId?: string; 
  passengerId: string;
  passengerName: string;
  pickupLocation: { address: string; latitude: number; longitude: number };
  dropoffLocation: { address: string; latitude: number; longitude: number };
  stops: Array<{ address: string; latitude: number; longitude: number }>;
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
  status: string;
  bookingTimestamp: Timestamp; // Firestore Timestamp on server
  // Add any other fields you expect from your booking documents
}

// Helper to convert Firestore Timestamp to a serializable format for JSON response
function serializeTimestamp(timestamp: Timestamp): { _seconds: number; _nanoseconds: number } {
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

const PLATFORM_OPERATOR_CODE_FOR_ID = "OP001";
const PLATFORM_OPERATOR_ID_PREFIX = "001";

function getOperatorPrefix(operatorCode?: string | null): string {
  if (operatorCode && operatorCode.startsWith("OP") && operatorCode.length >= 5) {
    const numericPart = operatorCode.substring(2);
    if (/^\d{3,}$/.test(numericPart)) {
      return numericPart.slice(0, 3); // Return first 3 digits of the numeric part
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const passengerId = searchParams.get('passengerId');
    if (!passengerId) {
      return NextResponse.json({ error: 'Missing passengerId' }, { status: 400 });
    }
    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef.where('passengerId', '==', passengerId).get();
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ rides });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rides', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import type { RideOffer } from '@/components/driver/ride-offer-modal';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

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

interface ActiveDriverRide {
  id: string;
  displayBookingId?: string; 
  originatingOperatorId?: string; 
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string;
  passengerPhone?: string;
  pickupLocation: { address: string; latitude: number; longitude: number; doorOrFlat?: string; };
  dropoffLocation: { address: string; latitude: number; longitude: number; doorOrFlat?: string; };
  stops?: Array<{ address: string; latitude: number; longitude: number; doorOrFlat?: string; }>;
  fareEstimate: number;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  status: string;
  passengerCount: number;
  passengerRating?: number;
  notes?: string;
  driverId?: string;
  bookingTimestamp?: { _seconds: number; _nanoseconds: number } | null;
  scheduledPickupAt?: string | null;
  vehicleType?: string;
  isSurgeApplied?: boolean;
  paymentMethod?: 'card' | 'cash' | 'account';
  notifiedPassengerArrivalTimestamp?: { _seconds: number; _nanoseconds: number } | null;
  passengerAcknowledgedArrivalTimestamp?: { _seconds: number; _nanoseconds: number } | null;
  rideStartedAt?: { _seconds: number; _nanoseconds: number } | null;
  completedAt?: { _seconds: number; _nanoseconds: number } | null;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  driverVehicleDetails?: string;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  requiredOperatorId?: string;
  dispatchMethod?: RideOffer['dispatchMethod'];
  accountJobPin?: string;
  distanceMiles?: number;
  driverCurrentLegIndex?: number; 
  currentLegEntryTimestamp?: { _seconds: number; _nanoseconds: number } | null; 
  completedStopWaitCharges?: Record<number, number>; 
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

export async function GET(req) {
  // Example: Fetch active ride for a driver (replace with your logic)
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');
    if (!driverId) {
      return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
    }
    const ridesRef = db.collection('rides');
    const snapshot = await ridesRef.where('driverId', '==', driverId).where('status', '==', 'active').get();
    if (snapshot.empty) {
      return NextResponse.json({ ride: null });
    }
    const ride = snapshot.docs[0].data();
    return NextResponse.json({ ride });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch active ride', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

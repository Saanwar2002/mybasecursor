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

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

// Define the explicit structure for the API response
interface ActiveRideForPassengerResponse {
  id: string;
  displayBookingId?: string; 
  originatingOperatorId?: string; 
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number;
  driverId?: string;
  fareEstimate: number;
  status: string;
  driver?: string;
  driverAvatar?: string;
  driverVehicleDetails?: string;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash" | "account";
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  accountJobPin?: string;
}

function serializeTimestamp(timestamp: Timestamp | undefined | null): SerializedTimestamp | null {
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
    const snapshot = await bookingsRef
      .where('passengerId', '==', passengerId)
      .where('status', 'in', ['pending_assignment', 'active', 'in_progress'])
      .orderBy('bookingTimestamp', 'desc')
      .limit(1)
      .get();
    const activeRides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ activeRides });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch active rides', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

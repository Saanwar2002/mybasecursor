
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface DriverRide {
  id: string;
  displayBookingId?: string; // Added
  originatingOperatorId?: string; // Added
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  passengerId: string;
  passengerName: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  ratingByPassenger?: number;
  paymentMethod?: "card" | "cash" | "account";
  completedAt?: SerializedTimestamp | null;
  cancelledAt?: SerializedTimestamp | null;
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
      return numericPart;
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json({ message: 'driverId query parameter is required.' }, { status: 400 });
    }

    if (!db) {
        console.error("API Error in /api/driver/ride-history GET: Firestore (db) is not initialized.");
        return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
    }

    const bookingsRef = collection(db, 'bookings');
    const terminalStatuses = ['completed', 'cancelled', 'cancelled_by_driver', 'cancelled_by_passenger', 'cancelled_no_show', 'cancelled_by_operator'];

    const q = query(
      bookingsRef,
      where('driverId', '==', driverId),
      where('status', 'in', terminalStatuses),
      orderBy('bookingTimestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);

    const rides: DriverRide[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      let displayBookingId = data.displayBookingId;
      const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
      if (!displayBookingId) {
        const prefix = getOperatorPrefix(rideOriginatingOperatorId);
        displayBookingId = `${prefix}/${doc.id}`;
      }

      rides.push({
        id: doc.id,
        displayBookingId: displayBookingId,
        originatingOperatorId: rideOriginatingOperatorId,
        passengerId: data.passengerId,
        passengerName: data.passengerName,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        stops: data.stops,
        vehicleType: data.vehicleType,
        fareEstimate: data.fareEstimate,
        status: data.status,
        ratingByPassenger: data.rating,
        paymentMethod: data.paymentMethod,
        bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: data.scheduledPickupAt || null,
        completedAt: serializeTimestamp(data.completedAtActual as Timestamp | undefined),
        cancelledAt: serializeTimestamp(data.cancelledAt as Timestamp | undefined),
      });
    });

    return NextResponse.json(rides, { status: 200 });
  } catch (error) {
    console.error('Error fetching driver ride history:', error);
    let errorMessage = 'An unknown server error occurred.';
    let errorDetails = '';
    if (error instanceof Error) {
        errorMessage = error.message;
        const firebaseError = error as any;
        if (firebaseError.code === 'failed-precondition' || (firebaseError.message && firebaseError.message.toLowerCase().includes('index'))) {
             errorDetails = `The query requires an index. Please check the server-side logs for a Firestore error message which may include a URL to create the required index. Firestore error code: ${firebaseError.code || 'N/A'}. Details: ${firebaseError.message}`;
        } else {
            errorDetails = error.toString();
        }
    }
    return NextResponse.json({
      message: 'Failed to retrieve driver ride history.',
      details: `${errorMessage} ${errorDetails}`.trim()
    }, { status: 500 });
  }
}

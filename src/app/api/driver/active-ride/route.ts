
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import type { RideOffer } from '@/components/driver/ride-offer-modal';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');

  if (!driverId) {
    return NextResponse.json({ message: 'driverId query parameter is required.' }, { status: 400 });
  }

  try {
    if (!db) {
      console.error("API Error in /api/driver/active-ride GET: Firestore (db) is not initialized.");
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
    }

    const bookingsRef = collection(db, 'bookings');
    const activeDriverStatuses = [
      'driver_assigned',
      'arrived_at_pickup',
      'in_progress',
      'pending_driver_wait_and_return_approval',
      'in_progress_wait_and_return'
    ];

    const q = query(
      bookingsRef,
      where('driverId', '==', driverId),
      where('status', 'in', activeDriverStatuses),
      orderBy('bookingTimestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(null, { status: 200 });
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    let displayBookingId = data.displayBookingId;
    const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;

    if (!displayBookingId || (displayBookingId.includes('/') && displayBookingId.split('/')[1].length > 10 && !/^\d+$/.test(displayBookingId.split('/')[1]))) {
      const prefix = getOperatorPrefix(rideOriginatingOperatorId);
      const shortSuffix = doc.id.substring(0, 6).toUpperCase();
      displayBookingId = `${prefix}/${shortSuffix}`;
    }


    const activeRide: ActiveDriverRide = {
      id: doc.id,
      displayBookingId: displayBookingId,
      originatingOperatorId: rideOriginatingOperatorId,
      passengerId: data.passengerId,
      passengerName: data.passengerName || 'N/A',
      passengerAvatar: data.passengerAvatar,
      passengerPhone: data.passengerPhone || data.customerPhoneNumber,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      fareEstimate: data.fareEstimate || 0,
      isPriorityPickup: data.isPriorityPickup || false,
      priorityFeeAmount: data.priorityFeeAmount || 0,
      status: data.status,
      passengerCount: data.passengers || 1,
      passengerRating: data.passengerRating,
      notes: data.driverNotes || data.notes,
      driverId: data.driverId,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      vehicleType: data.vehicleType,
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      notifiedPassengerArrivalTimestamp: serializeTimestamp(data.notifiedPassengerArrivalTimestampActual as Timestamp | undefined),
      passengerAcknowledgedArrivalTimestamp: serializeTimestamp(data.passengerAcknowledgedArrivalTimestampActual as Timestamp | undefined),
      rideStartedAt: serializeTimestamp(data.rideStartedAtActual as Timestamp | undefined),
      completedAt: serializeTimestamp(data.completedAtActual as Timestamp | undefined),
      driverCurrentLocation: data.driverCurrentLocation,
      driverEtaMinutes: data.driverEtaMinutes,
      driverVehicleDetails: data.driverVehicleDetails || `${data.vehicleType || 'Vehicle'} - Reg N/A`,
      waitAndReturn: data.waitAndReturn,
      estimatedAdditionalWaitTimeMinutes: data.estimatedAdditionalWaitTimeMinutes,
      requiredOperatorId: data.requiredOperatorId,
      dispatchMethod: data.dispatchMethod,
      accountJobPin: data.accountJobPin,
      distanceMiles: data.offerDetails?.distanceMiles,
      driverCurrentLegIndex: data.driverCurrentLegIndex, 
      currentLegEntryTimestamp: serializeTimestamp(data.currentLegEntryTimestamp as Timestamp | undefined), 
      completedStopWaitCharges: data.completedStopWaitCharges, 
    };

    return NextResponse.json(activeRide, { status: 200 });

  } catch (error) {
    console.error(`Error in /api/driver/active-ride for driverId ${driverId}:`, error);

    let errorMessage = 'An unknown error occurred while fetching the active ride.';
    const errorDetails = error instanceof Error ? error.message : String(error);
    const statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      const firebaseError = error as any;
      if (firebaseError.code === 'failed-precondition') {
        errorMessage = `Query requires a Firestore index. Please check Firestore console. Details: ${error.message}`;
      } else if (firebaseError.code) {
        errorMessage = `Firebase error (${firebaseError.code}): ${error.message}`;
      }
    }

    if (!(error instanceof Error)) {
        try {
            console.error("Full non-Error object received in /api/driver/active-ride catch block:", JSON.stringify(error, null, 2));
        } catch (e) {
            console.error("Could not stringify non-Error object in /api/driver/active-ride catch block:", error);
        }
    }

    return NextResponse.json({ message: 'Failed to fetch active ride for driver.', details: errorMessage, errorRaw: errorDetails }, { status: statusCode });
  }
}

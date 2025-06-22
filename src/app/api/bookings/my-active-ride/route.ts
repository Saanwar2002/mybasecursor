
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

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


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId');

  if (!passengerId) {
    return NextResponse.json({ message: 'passengerId query parameter is required.' }, { status: 400 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    const activeStatuses = [
      'pending_assignment',
      'driver_assigned',
      'arrived_at_pickup',
      'in_progress',
      'pending_driver_wait_and_return_approval',
      'in_progress_wait_and_return'
    ];

    const q = query(
      bookingsRef,
      where('passengerId', '==', passengerId),
      where('status', 'in', activeStatuses),
      orderBy('bookingTimestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(null, { status: 200 });
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    const processTimestampField = (fieldValue: any): SerializedTimestamp | string | null => {
        if (!fieldValue) return null;
        if (fieldValue instanceof Timestamp) {
            return serializeTimestamp(fieldValue);
        }
        if (typeof fieldValue === 'string') {
            return fieldValue;
        }
         if (typeof fieldValue === 'object' && ('_seconds' in fieldValue || 'seconds' in fieldValue)) {
            return serializeTimestamp(fieldValue as Timestamp);
        }
        return null;
    };

    let displayBookingId = data.displayBookingId;
    const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;

    if (!displayBookingId || (displayBookingId.includes('/') && displayBookingId.split('/')[1].length > 10 && !/^\d+$/.test(displayBookingId.split('/')[1]))) {
      const prefix = getOperatorPrefix(rideOriginatingOperatorId);
      const shortSuffix = doc.id.substring(0, 6).toUpperCase();
      displayBookingId = `${prefix}/${shortSuffix}`;
    }


    const responseRide: ActiveRideForPassengerResponse = {
      id: doc.id,
      displayBookingId: displayBookingId, 
      originatingOperatorId: rideOriginatingOperatorId, 
      passengerName: data.passengerName,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      vehicleType: data.vehicleType,
      passengers: data.passengers || 1,
      driverId: data.driverId,
      fareEstimate: data.fareEstimate,
      status: data.status,
      driver: data.driverName,
      driverAvatar: data.driverAvatar,
      driverVehicleDetails: data.driverVehicleDetails,
      isPriorityPickup: data.isPriorityPickup || false,
      priorityFeeAmount: data.priorityFeeAmount || 0,
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      notifiedPassengerArrivalTimestamp: processTimestampField(data.notifiedPassengerArrivalTimestampActual || data.notifiedPassengerArrivalTimestamp),
      passengerAcknowledgedArrivalTimestamp: processTimestampField(data.passengerAcknowledgedArrivalTimestampActual || data.passengerAcknowledgedArrivalTimestamp),
      rideStartedAt: processTimestampField(data.rideStartedAtActual || data.rideStartedAt),
      driverCurrentLocation: data.driverCurrentLocation,
      driverEtaMinutes: data.driverEtaMinutes,
      waitAndReturn: data.waitAndReturn,
      estimatedAdditionalWaitTimeMinutes: data.estimatedAdditionalWaitTimeMinutes,
      accountJobPin: data.accountJobPin,
    };

    return NextResponse.json(responseRide, { status: 200 });

  } catch (error) {
    console.error('Error fetching active ride:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
       if ((error as any).code === 'failed-precondition') {
        errorMessage = `Query requires a Firestore index. Please check the console for a link to create it. Details: ${error.message}`;
      }
    }
    return NextResponse.json({ message: 'Failed to fetch active ride', details: errorMessage }, { status: 500 });
  }
}

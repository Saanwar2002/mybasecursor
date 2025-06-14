
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
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number; // Added
  driverId?: string; // Added
  fareEstimate: number;
  status: string;
  driver?: string;
  driverAvatar?: string;
  driverVehicleDetails?: string;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash" | "account";
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  driverCurrentLocation?: { lat: number; lng: number }; // Added
  driverEtaMinutes?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  accountJobPin?: string; // Ensured this is here
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


    const responseRide: ActiveRideForPassengerResponse = {
      id: doc.id,
      passengerName: data.passengerName,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      vehicleType: data.vehicleType,
      passengers: data.passengers || 1, // Ensure passengers is included
      driverId: data.driverId, // Ensure driverId is included
      fareEstimate: data.fareEstimate,
      status: data.status,
      driver: data.driverName, 
      driverAvatar: data.driverAvatar,
      driverVehicleDetails: data.driverVehicleDetails,
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      notifiedPassengerArrivalTimestamp: processTimestampField(data.notifiedPassengerArrivalTimestampActual || data.notifiedPassengerArrivalTimestamp),
      passengerAcknowledgedArrivalTimestamp: processTimestampField(data.passengerAcknowledgedArrivalTimestampActual || data.passengerAcknowledgedArrivalTimestamp),
      rideStartedAt: processTimestampField(data.rideStartedAtActual || data.rideStartedAt),
      driverCurrentLocation: data.driverCurrentLocation, // Ensure this is included
      driverEtaMinutes: data.driverEtaMinutes,
      waitAndReturn: data.waitAndReturn,
      estimatedAdditionalWaitTimeMinutes: data.estimatedAdditionalWaitTimeMinutes,
      accountJobPin: data.accountJobPin, // Explicitly include accountJobPin
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

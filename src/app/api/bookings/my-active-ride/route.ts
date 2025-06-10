
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  driver?: string;
  driverAvatar?: string;
  driverVehicleDetails?: string; // Added field
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash";
  // Fields from driver's active ride that might be useful for passenger context too
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  driverEtaMinutes?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
}

function serializeTimestamp(timestamp: Timestamp | undefined | null): SerializedTimestamp | null {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return {
      _seconds: timestamp.seconds,
      _nanoseconds: timestamp.nanoseconds,
    };
  }
   // Handle cases where it might already be an object like { seconds: ..., nanoseconds: ... }
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
      'Assigned', 
      'arrived_at_pickup',
      'in_progress',
      'In Progress',
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

    // Helper to convert potential actual Firestore Timestamps or already serialized string timestamps
    const processTimestampField = (fieldValue: any): SerializedTimestamp | string | null => {
        if (!fieldValue) return null;
        if (fieldValue instanceof Timestamp) {
            return serializeTimestamp(fieldValue);
        }
        if (typeof fieldValue === 'string') { // Assuming ISO string if it's already a string
            return fieldValue;
        }
         if (typeof fieldValue === 'object' && ('_seconds' in fieldValue || 'seconds' in fieldValue)) {
            return serializeTimestamp(fieldValue as Timestamp); // Cast if it matches structure
        }
        return null;
    };


    const activeRide: Ride = {
      id: doc.id,
      passengerName: data.passengerName,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      vehicleType: data.vehicleType,
      fareEstimate: data.fareEstimate,
      status: data.status,
      driver: data.driverName,
      driverAvatar: data.driverAvatar,
      driverVehicleDetails: data.driverVehicleDetails, // Added this line
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      notifiedPassengerArrivalTimestamp: processTimestampField(data.notifiedPassengerArrivalTimestampActual || data.notifiedPassengerArrivalTimestamp),
      passengerAcknowledgedArrivalTimestamp: processTimestampField(data.passengerAcknowledgedArrivalTimestampActual || data.passengerAcknowledgedArrivalTimestamp),
      rideStartedAt: processTimestampField(data.rideStartedAtActual || data.rideStartedAt),
      driverEtaMinutes: data.driverEtaMinutes,
      waitAndReturn: data.waitAndReturn,
      estimatedAdditionalWaitTimeMinutes: data.estimatedAdditionalWaitTimeMinutes,
    };

    return NextResponse.json(activeRide, { status: 200 });

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

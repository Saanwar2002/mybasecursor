
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

// Helper to serialize Timestamp
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
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

interface ActiveDriverRide {
  id: string;
  passengerId: string; 
  passengerName: string;
  passengerAvatar?: string;
  pickupLocation: { address: string; latitude: number; longitude: number; doorOrFlat?: string; };
  dropoffLocation: { address: string; latitude: number; longitude: number; doorOrFlat?: string; };
  stops?: Array<{ address: string; latitude: number; longitude: number; doorOrFlat?: string; }>;
  estimatedTime?: string;
  fareEstimate: number;
  status: string;
  pickupCoords?: { lat: number; lng: number };
  dropoffCoords?: { lat: number; lng: number };
  distanceMiles?: number;
  passengerCount: number;
  passengerPhone?: string;
  passengerRating?: number;
  notes?: string;
  driverId?: string;
  bookingTimestamp?: { _seconds: number; _nanoseconds: number } | null;
  scheduledPickupAt?: string | null;
  vehicleType?: string;
  isSurgeApplied?: boolean;
  paymentMethod?: 'card' | 'cash';
  notifiedPassengerArrivalTimestamp?: { _seconds: number; _nanoseconds: number } | string | null;
  passengerAcknowledgedArrivalTimestamp?: { _seconds: number; _nanoseconds: number } | string | null;
  rideStartedAt?: { _seconds: number; _nanoseconds: number } | string | null;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  driverVehicleDetails?: string;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
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
    // Define statuses that indicate an active ride for a driver comprehensively
    const activeDriverStatuses = [
      'driver_assigned', // Driver is assigned and en route
      'arrived_at_pickup', // Driver has arrived at pickup
      'in_progress', // Ride is ongoing
      'pending_driver_wait_and_return_approval', // Driver needs to act on W&R request
      'in_progress_wait_and_return' // Ride is ongoing with W&R active
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

    const activeRide: ActiveDriverRide = {
      id: doc.id,
      passengerId: data.passengerId, 
      passengerName: data.passengerName || 'N/A',
      passengerAvatar: data.passengerAvatar,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      stops: data.stops,
      estimatedTime: data.estimatedTime,
      fareEstimate: data.fareEstimate || 0,
      status: data.status,
      pickupCoords: data.pickupLocation ? { lat: data.pickupLocation.latitude, lng: data.pickupLocation.longitude } : undefined,
      dropoffCoords: data.dropoffLocation ? { lat: data.dropoffLocation.latitude, lng: data.dropoffLocation.longitude } : undefined,
      distanceMiles: data.distanceMiles,
      passengerCount: data.passengers || 1,
      passengerPhone: data.passengerPhone,
      passengerRating: data.passengerRating,
      notes: data.driverNotes || data.notes, 
      driverId: data.driverId,
      bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: data.scheduledPickupAt || null,
      vehicleType: data.vehicleType,
      isSurgeApplied: data.isSurgeApplied,
      paymentMethod: data.paymentMethod,
      notifiedPassengerArrivalTimestamp: data.notifiedPassengerArrivalTimestamp ? serializeTimestamp(data.notifiedPassengerArrivalTimestamp as Timestamp | undefined) : null,
      passengerAcknowledgedArrivalTimestamp: data.passengerAcknowledgedArrivalTimestamp ? serializeTimestamp(data.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined) : null,
      rideStartedAt: data.rideStartedAt ? serializeTimestamp(data.rideStartedAt as Timestamp | undefined) : null,
      driverCurrentLocation: data.driverCurrentLocation,
      driverEtaMinutes: data.driverEtaMinutes,
      driverVehicleDetails: data.driverVehicleDetails || `${data.vehicleType || 'Vehicle'} - Reg N/A`,
      waitAndReturn: data.waitAndReturn,
      estimatedAdditionalWaitTimeMinutes: data.estimatedAdditionalWaitTimeMinutes
    };

    return NextResponse.json(activeRide, { status: 200 });

  } catch (error) {
    console.error(`Error in /api/driver/active-ride for driverId ${driverId}:`, error); 

    let errorMessage = 'An unknown error occurred while fetching the active ride.';
    let errorDetails = error instanceof Error ? error.message : String(error);
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      const firebaseError = error as any; // Type assertion for Firebase specific error codes
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

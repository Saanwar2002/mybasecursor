
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');

  if (!driverId) {
    return NextResponse.json({ message: 'driverId query parameter is required.' }, { status: 400 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    // Define statuses that indicate an active ride for a driver
    const activeDriverStatuses = ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress'];

    const q = query(
      bookingsRef,
      where('driverId', '==', driverId),
      where('status', 'in', activeDriverStatuses),
      orderBy('bookingTimestamp', 'desc'), // Get the most recent active ride if multiple somehow exist
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(null, { status: 200 }); // No active ride found for this driver
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    // Map Firestore data to the ActiveDriverRide interface, ensuring all fields are handled
    const activeRide: ActiveDriverRide = {
      id: doc.id,
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
      notes: data.driverNotes || data.notes, // Prefer driverNotes if available
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
      driverVehicleDetails: data.driverVehicleDetails || `${data.vehicleType || 'Vehicle'} - Reg N/A`, // Provide fallback
    };

    return NextResponse.json(activeRide, { status: 200 });

  } catch (error) {
    console.error('Error fetching driver active ride:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as any).code === 'failed-precondition') {
        errorMessage = `Query requires a Firestore index. Please check Firestore console for index creation suggestions. Details: ${error.message}`;
      }
    }
    return NextResponse.json({ message: 'Failed to fetch active ride for driver', details: errorMessage }, { status: 500 });
  }
}

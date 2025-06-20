import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface CancelBookingPayload {
  rideId: string;
  passengerId: string; // For verification
}

export async function POST(request: NextRequest) {
  try {
    const { rideId, passengerId } = (await request.json()) as CancelBookingPayload;

    if (!rideId || !passengerId) {
      return NextResponse.json({ message: 'Ride ID and Passenger ID are required.' }, { status: 400 });
    }
    
    if (!db) {
        return NextResponse.json({ message: 'Database connection is not available.' }, { status: 500 });
    }

    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);

    if (!rideSnap.exists()) {
      return NextResponse.json({ message: `Ride with ID ${rideId} not found.` }, { status: 404 });
    }

    const rideData = rideSnap.data();

    // Verify passenger ownership
    if (rideData.passengerId !== passengerId) {
      return NextResponse.json({ message: 'You are not authorized to cancel this ride.' }, { status: 403 });
    }

    // Check if the ride can be cancelled
    const cancellableStatuses = ['searching', 'driver_assigned', 'arrived_at_pickup'];
    if (!cancellableStatuses.includes(rideData.status)) {
        let reason = `This ride cannot be cancelled as it is already ${rideData.status.replace(/_/g, ' ')}.`;
        return NextResponse.json({ message: reason, currentStatus: rideData.status }, { status: 409 });
    }

    // Update the ride status to 'cancelled'
    await updateDoc(rideRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancellationReason: 'Cancelled by passenger',
    });
    
    return NextResponse.json({ message: 'Ride cancelled successfully', rideId }, { status: 200 });

  } catch (error) {
    console.error('Error cancelling ride:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to cancel ride', error: errorMessage }, { status: 500 });
  }
}

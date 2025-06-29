import { NextResponse, NextRequest } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface CancelBookingPayload {
  bookingId: string;
  passengerId: string; // For verification
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId, passengerId } = (await request.json()) as CancelBookingPayload;

    if (!bookingId || !passengerId) {
      return NextResponse.json({ message: 'Booking ID and Passenger ID are required.' }, { status: 400 });
    }

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
    }

    const bookingData = bookingSnap.data();
    if (!bookingData) {
      return NextResponse.json({ message: 'Booking data is missing.' }, { status: 500 });
    }

    // Verify passenger ownership
    if (bookingData.passengerId !== passengerId) {
      return NextResponse.json({ message: 'You are not authorized to cancel this booking.' }, { status: 403 });
    }

    // Check if the booking can be cancelled
    if (bookingData.status !== 'pending_assignment') {
      let reason = 'This booking cannot be cancelled.';
      if (bookingData.status === 'driver_assigned') {
        reason = 'Driver has already been assigned. Booking cannot be cancelled.';
      } else if (bookingData.status === 'in_progress') {
        reason = 'Ride is already in progress. Booking cannot be cancelled.';
      } else if (bookingData.status === 'completed') {
        reason = 'Ride has already been completed.';
      } else if (bookingData.status === 'cancelled') {
        reason = 'Ride has already been cancelled.';
      }
      return NextResponse.json({ message: reason, currentStatus: bookingData.status }, { status: 400 });
    }

    // Update the booking status to 'cancelled'
    await bookingRef.update({
      status: 'cancelled',
      cancelledAt: Timestamp.fromDate(new Date()), // Optionally add a cancellation timestamp
    });
    
    return NextResponse.json({ message: 'Booking cancelled successfully', bookingId }, { status: 200 });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to cancel booking', details: errorMessage }, { status: 500 });
  }
}

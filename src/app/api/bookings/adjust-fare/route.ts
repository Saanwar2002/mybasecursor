import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface AdjustFarePayload {
  bookingId: string;
  driverId: string;
  newFare: number;
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId, driverId, newFare } = (await request.json()) as AdjustFarePayload;
    if (!bookingId || !driverId || typeof newFare !== 'number' || newFare <= 0) {
      return NextResponse.json({ message: 'Missing or invalid fields.' }, { status: 400 });
    }
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
    }
    const bookingData = bookingSnap.data();
    // Only allow fare adjustment if ride is completed or in progress
    if (!['completed', 'in_progress'].includes(bookingData.status)) {
      return NextResponse.json({ message: 'Fare can only be adjusted for completed or in-progress rides.' }, { status: 400 });
    }
    // Optionally: Add logic to notify passenger for approval here
    await updateDoc(bookingRef, {
      finalCalculatedFare: newFare,
      fareAdjustmentRequestedAt: Timestamp.now(),
      fareAdjustmentRequestedBy: driverId
    });
    return NextResponse.json({ message: 'Fare adjustment proposed successfully.', bookingId, newFare }, { status: 200 });
  } catch (error) {
    console.error('Error adjusting fare:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to adjust fare', details: errorMessage }, { status: 500 });
  }
}
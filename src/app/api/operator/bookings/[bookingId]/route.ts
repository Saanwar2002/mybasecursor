
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

interface GetContext {
  params: {
    bookingId: string;
  };
}

export async function GET(request: NextRequest, context: GetContext) {
  // TODO: Implement authentication/authorization for operator role. Ensure only authorized operators can access this.

  const { bookingId } = context.params;

  if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
  }

  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
    }

    const bookingData = bookingSnap.data();
    // Ensure all known and potential timestamp fields are serialized
    const serializedBooking = {
      id: bookingSnap.id,
      ...bookingData,
      bookingTimestamp: serializeTimestamp(bookingData.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: bookingData.scheduledPickupAt ? bookingData.scheduledPickupAt : null, // Already string or null
      updatedAt: serializeTimestamp(bookingData.updatedAt as Timestamp | undefined),
      cancelledAt: serializeTimestamp(bookingData.cancelledAt as Timestamp | undefined),
      // Add any other potential timestamp fields here if they exist in your Firestore documents
      // e.g., driverAssignedAt: serializeTimestamp(bookingData.driverAssignedAt as Timestamp | undefined),
      // completedAt: serializeTimestamp(bookingData.completedAt as Timestamp | undefined),
    };
    
    return NextResponse.json(serializedBooking, { status: 200 });

  } catch (error) {
    console.error(`Error fetching booking ${bookingId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch booking ${bookingId}`, details: errorMessage }, { status: 500 });
  }
}

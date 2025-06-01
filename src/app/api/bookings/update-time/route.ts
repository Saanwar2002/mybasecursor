
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { doc, getDoc, updateDoc, Timestamp, deleteField } from 'firebase/firestore';

interface UpdateTimePayload {
  bookingId: string;
  passengerId: string; // For verification
  newScheduledPickupAt: string | null; // ISO string or null to make it ASAP
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId, passengerId, newScheduledPickupAt } = (await request.json()) as UpdateTimePayload;

    if (!bookingId || !passengerId) {
      return NextResponse.json({ message: 'Booking ID and Passenger ID are required.' }, { status: 400 });
    }

    // Validate newScheduledPickupAt if provided
    if (newScheduledPickupAt) {
      try {
        if(isNaN(new Date(newScheduledPickupAt).getTime())) {
            throw new Error('Invalid date format for newScheduledPickupAt');
        }
      } catch (e) {
        return NextResponse.json({ message: 'Invalid newScheduledPickupAt format. Must be a valid ISO string.' }, { status: 400 });
      }
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
    }

    const bookingData = bookingSnap.data();

    if (bookingData.passengerId !== passengerId) {
      return NextResponse.json({ message: 'You are not authorized to update this booking.' }, { status: 403 });
    }

    if (bookingData.status !== 'pending_assignment') {
      return NextResponse.json({ message: 'Booking time can only be changed if the ride is pending assignment.' }, { status: 400 });
    }

    const updateData: { scheduledPickupAt?: string | null | ReturnType<typeof deleteField>, updatedAt: Timestamp } = {
        updatedAt: Timestamp.now(),
    };

    if (newScheduledPickupAt === null) {
        updateData.scheduledPickupAt = deleteField(); // Remove the field for ASAP bookings
    } else {
        updateData.scheduledPickupAt = newScheduledPickupAt;
    }
    
    await updateDoc(bookingRef, updateData);
    
    return NextResponse.json({ 
        message: 'Booking time updated successfully', 
        bookingId,
        newScheduledPickupAt: newScheduledPickupAt // Return the new value so client can update state
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating booking time:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to update booking time', details: errorMessage }, { status: 500 });
  }
}

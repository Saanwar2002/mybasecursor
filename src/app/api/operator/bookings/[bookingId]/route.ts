
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

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
      operatorUpdatedAt: serializeTimestamp(bookingData.operatorUpdatedAt as Timestamp | undefined),
      driverAssignedAt: serializeTimestamp(bookingData.driverAssignedAt as Timestamp | undefined),
      completedAt: serializeTimestamp(bookingData.completedAt as Timestamp | undefined),
    };
    
    return NextResponse.json(serializedBooking, { status: 200 });

  } catch (error) {
    console.error(`Error fetching booking ${bookingId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch booking ${bookingId}`, details: errorMessage }, { status: 500 });
  }
}

// Schema for validating the update payload
const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(), // Typically, this would be fetched based on driverId or managed by a separate driver assignment flow. For simplicity, allowing operator to set.
  driverAvatar: z.string().url().optional(),
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled', 'pending_assignment']).optional(), // Added 'pending_assignment' to match other usages
  vehicleType: z.string().optional(),
  fareEstimate: z.number().optional(),
  notes: z.string().optional(), // Operator can add notes
}).min(1, { message: "At least one field must be provided for update." });

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  // TODO: Implement authentication/authorization for operator role.

  const { bookingId } = context.params;

  if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
    return NextResponse.json({ message: 'A valid Booking ID path parameter is required.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsedPayload = bookingUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ message: `Booking with ID ${bookingId} not found.` }, { status: 404 });
    }

    const updateData: Partial<BookingUpdatePayload & { operatorUpdatedAt: Timestamp, driverAssignedAt?: Timestamp, completedAt?: Timestamp, cancelledAt?: Timestamp, cancelledBy?: string }> = {
      ...updateDataFromPayload,
      operatorUpdatedAt: Timestamp.now(),
    };

    // Handle specific status changes
    if (updateDataFromPayload.status) {
      if (updateDataFromPayload.status === 'Assigned' && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Completed') {
        updateData.completedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Cancelled') {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = 'operator'; // Indicate who cancelled
      }
    }
    
    // Ensure driverName and driverAvatar are only set if driverId is also present or being set.
    // This logic could be more complex, e.g., fetching driver details if only driverId is given.
    if (updateDataFromPayload.driverId && !updateDataFromPayload.driverName) {
        // Potentially fetch driver name based on ID here if needed
        // For now, if driverId is set but name is not, we don't automatically clear/set it
    }


    await updateDoc(bookingRef, updateData as any); // Cast as any to handle nested objects and Timestamps for updateDoc

    const updatedBookingSnap = await getDoc(bookingRef); // Fetch the updated document
    const updatedBookingData = updatedBookingSnap.data();

    const serializedUpdatedBooking = {
        id: updatedBookingSnap.id,
        ...updatedBookingData,
        bookingTimestamp: serializeTimestamp(updatedBookingData?.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: updatedBookingData?.scheduledPickupAt ? updatedBookingData.scheduledPickupAt : null,
        updatedAt: serializeTimestamp(updatedBookingData?.updatedAt as Timestamp | undefined), // This is passenger update
        operatorUpdatedAt: serializeTimestamp(updatedBookingData?.operatorUpdatedAt as Timestamp | undefined),
        driverAssignedAt: serializeTimestamp(updatedBookingData?.driverAssignedAt as Timestamp | undefined),
        completedAt: serializeTimestamp(updatedBookingData?.completedAt as Timestamp | undefined),
        cancelledAt: serializeTimestamp(updatedBookingData?.cancelledAt as Timestamp | undefined),
    };

    return NextResponse.json({ message: 'Booking updated successfully', booking: serializedUpdatedBooking }, { status: 200 });

  } catch (error) {
    console.error(`Error updating booking ${bookingId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid update payload.', errors: error.format() }, { status: 400 });
    }
    return NextResponse.json({ message: `Failed to update booking ${bookingId}`, details: errorMessage }, { status: 500 });
  }
}

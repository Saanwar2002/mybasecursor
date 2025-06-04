
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, deleteField } from 'firebase/firestore';
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
    const serializedBooking = {
      id: bookingSnap.id,
      ...bookingData,
      bookingTimestamp: serializeTimestamp(bookingData.bookingTimestamp as Timestamp | undefined),
      scheduledPickupAt: bookingData.scheduledPickupAt ? bookingData.scheduledPickupAt : null,
      updatedAt: serializeTimestamp(bookingData.updatedAt as Timestamp | undefined),
      cancelledAt: serializeTimestamp(bookingData.cancelledAt as Timestamp | undefined),
      operatorUpdatedAt: serializeTimestamp(bookingData.operatorUpdatedAt as Timestamp | undefined),
      driverAssignedAt: serializeTimestamp(bookingData.driverAssignedAt as Timestamp | undefined),
      notifiedPassengerArrivalTimestamp: serializeTimestamp(bookingData.notifiedPassengerArrivalTimestamp as Timestamp | undefined),
      passengerAcknowledgedArrivalTimestamp: serializeTimestamp(bookingData.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined),
      completedAt: serializeTimestamp(bookingData.completedAt as Timestamp | undefined),
    };
    
    return NextResponse.json(serializedBooking, { status: 200 });

  } catch (error) {
    console.error(`Error fetching booking ${bookingId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch booking ${bookingId}`, details: errorMessage }, { status: 500 });
  }
}

const bookingUpdateSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driverAvatar: z.string().url().optional(),
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled', 'pending_assignment', 'arrived_at_pickup', 'driver_assigned']).optional(),
  vehicleType: z.string().optional(),
  fareEstimate: z.number().optional(),
  notes: z.string().optional(),
  action: z.enum(['notify_arrival', 'acknowledge_arrival', 'start_ride', 'complete_ride']).optional(), // Added actions
}).min(1, { message: "At least one field or action must be provided for update." });

export type BookingUpdatePayload = z.infer<typeof bookingUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
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

    const currentBookingData = bookingSnap.data();

    const updateData: any = { // Using any for flexibility with Firestore specific types like Timestamp and deleteField
      operatorUpdatedAt: Timestamp.now(), // Always update this timestamp for operator/driver actions
    };

    if (updateDataFromPayload.action === 'notify_arrival') {
      // Add security: check if request is from assigned driver
      updateData.status = 'arrived_at_pickup';
      updateData.notifiedPassengerArrivalTimestamp = Timestamp.now();
    } else if (updateDataFromPayload.action === 'acknowledge_arrival') {
      // Add security: check if request is from passenger
      updateData.passengerAcknowledgedArrivalTimestamp = Timestamp.now();
    } else if (updateDataFromPayload.action === 'start_ride') {
      updateData.status = 'In Progress'; // Or 'in_progress'
      updateData.rideStartedAt = Timestamp.now();
    } else if (updateDataFromPayload.action === 'complete_ride') {
       updateData.status = 'Completed';
       updateData.completedAt = Timestamp.now();
    } else {
      // General updates
      if (updateDataFromPayload.status) updateData.status = updateDataFromPayload.status;
      if (updateDataFromPayload.driverId) updateData.driverId = updateDataFromPayload.driverId;
      if (updateDataFromPayload.driverName) updateData.driverName = updateDataFromPayload.driverName;
      if (updateDataFromPayload.driverAvatar) updateData.driverAvatar = updateDataFromPayload.driverAvatar;
      if (updateDataFromPayload.vehicleType) updateData.vehicleType = updateDataFromPayload.vehicleType;
      if (updateDataFromPayload.fareEstimate !== undefined) updateData.fareEstimate = updateDataFromPayload.fareEstimate;
      if (updateDataFromPayload.notes) updateData.notes = updateDataFromPayload.notes;

      if (updateDataFromPayload.status === 'Assigned' && updateDataFromPayload.driverId) {
        updateData.driverAssignedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Completed') {
        updateData.completedAt = Timestamp.now();
      } else if (updateDataFromPayload.status === 'Cancelled') {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = 'operator'; // Assume operator if no specific actor
      }
    }
    
    await updateDoc(bookingRef, updateData);

    const updatedBookingSnap = await getDoc(bookingRef);
    const updatedBookingDataResult = updatedBookingSnap.data();

    const serializedUpdatedBooking = {
        id: updatedBookingSnap.id,
        ...updatedBookingDataResult,
        bookingTimestamp: serializeTimestamp(updatedBookingDataResult?.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: updatedBookingDataResult?.scheduledPickupAt ? updatedBookingDataResult.scheduledPickupAt : null,
        updatedAt: serializeTimestamp(updatedBookingDataResult?.updatedAt as Timestamp | undefined),
        operatorUpdatedAt: serializeTimestamp(updatedBookingDataResult?.operatorUpdatedAt as Timestamp | undefined),
        driverAssignedAt: serializeTimestamp(updatedBookingDataResult?.driverAssignedAt as Timestamp | undefined),
        notifiedPassengerArrivalTimestamp: serializeTimestamp(updatedBookingDataResult?.notifiedPassengerArrivalTimestamp as Timestamp | undefined),
        passengerAcknowledgedArrivalTimestamp: serializeTimestamp(updatedBookingDataResult?.passengerAcknowledgedArrivalTimestamp as Timestamp | undefined),
        completedAt: serializeTimestamp(updatedBookingDataResult?.completedAt as Timestamp | undefined),
        cancelledAt: serializeTimestamp(updatedBookingDataResult?.cancelledAt as Timestamp | undefined),
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

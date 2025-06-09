
// src/app/api/scheduled-bookings/[scheduleId]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
// import { type PartialScheduledBookingPayload } from '../create/interfaces'; // Define this for updates

interface UpdateScheduledBookingPayload {
  // Allow any field from ScheduledBookingPayload to be optional for PUT
  label?: string;
  pickupLocation?: any; // Define LocationPointPayload if not already
  dropoffLocation?: any;
  stops?: any[];
  vehicleType?: string;
  passengers?: number;
  driverNotes?: string;
  paymentMethod?: "card" | "cash";
  daysOfWeek?: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  pickupTime?: string;
  isReturnJourneyScheduled?: boolean;
  returnPickupTime?: string;
  isWaitAndReturnOutbound?: boolean;
  estimatedWaitTimeMinutesOutbound?: number;
  isActive?: boolean;
  pausedDates?: string[]; // To add/remove specific dates
  // nextRunDate might be recalculated based on changes
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}


interface RouteContext {
  params: {
    scheduleId: string;
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { scheduleId } = context.params;
  // TODO: Implement user authentication
  // const authenticatedUserId = await getUserIdFromRequest(request);

  try {
    const payload: UpdateScheduledBookingPayload = await request.json();
    console.log(`API PUT /scheduled-bookings/${scheduleId}: Received payload`, payload);

    // For this specific use case (toggling isActive), we only expect 'isActive'
    if (typeof payload.isActive !== 'boolean') {
      return NextResponse.json({ message: 'Invalid payload: isActive (boolean) is required.' }, { status: 400 });
    }
    
    // TODO: In a real app, get passengerId from authenticated session
    // For now, we'll assume the client is authorized if it knows the scheduleId.
    // However, it's good practice to verify ownership if possible.
    // const { passengerId } = payload; // If client sends it for verification

    const scheduleRef = doc(db, 'scheduledBookings', scheduleId);
    const scheduleSnap = await getDoc(scheduleRef);

    if (!scheduleSnap.exists()) {
      return NextResponse.json({ message: 'Scheduled booking not found.' }, { status: 404 });
    }

    // const scheduleData = scheduleSnap.data();
    // if (passengerId && scheduleData.passengerId !== passengerId) { // Example verification
    //   return NextResponse.json({ message: 'Unauthorized to update this schedule.' }, { status: 403 });
    // }

    const updatePayload = {
      isActive: payload.isActive,
      updatedAt: serverTimestamp() as Timestamp,
      // Potentially recalculate nextRunDate if status changes from inactive to active
    };
    console.log(`API PUT /scheduled-bookings/${scheduleId}: Updating Firestore with`, updatePayload);
    await updateDoc(scheduleRef, updatePayload);
    
    const updatedDocSnap = await getDoc(scheduleRef); // Fetch again to get server-generated timestamps

    return NextResponse.json({ 
        message: 'Scheduled booking updated successfully.', 
        data: { 
            id: updatedDocSnap.id, 
            ...updatedDocSnap.data(),
            createdAt: (updatedDocSnap.data()?.createdAt as Timestamp)?.toDate().toISOString(),
            updatedAt: (updatedDocSnap.data()?.updatedAt as Timestamp)?.toDate().toISOString(),
        } 
    }, { status: 200 });

  } catch (error) {
    console.error(`Error updating scheduled booking ${scheduleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update scheduled booking', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { scheduleId } = context.params;
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId'); // For verification

  // TODO: Implement user authentication
  // const authenticatedUserId = await getUserIdFromRequest(request);
  // if (!passengerId || passengerId !== authenticatedUserId) {
  //    return NextResponse.json({ message: 'Unauthorized or missing passengerId for verification.' }, { status: 403 });
  // }

  if (!passengerId) { // This check is for the client sending it for verification
     return NextResponse.json({ message: 'passengerId query parameter is required for verification.' }, { status: 400 });
  }

  console.log(`API DELETE /scheduled-bookings/${scheduleId}: Request received for passenger ${passengerId}`);
  try {
    const scheduleRef = doc(db, 'scheduledBookings', scheduleId);
    const scheduleSnap = await getDoc(scheduleRef);

    if (!scheduleSnap.exists()) {
      return NextResponse.json({ message: 'Scheduled booking not found.' }, { status: 404 });
    }
    const scheduleData = scheduleSnap.data();
    if (scheduleData.passengerId !== passengerId) { // Verify ownership
      console.warn(`API DELETE /scheduled-bookings/${scheduleId}: Unauthorized attempt by passenger ${passengerId}. Owner is ${scheduleData.passengerId}.`);
      return NextResponse.json({ message: 'Unauthorized to delete this schedule.' }, { status: 403 });
    }
    await deleteDoc(scheduleRef);
    console.log(`API DELETE /scheduled-bookings/${scheduleId}: Successfully deleted.`);
    
    return NextResponse.json({ message: 'Scheduled booking deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting scheduled booking ${scheduleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to delete scheduled booking', details: errorMessage }, { status: 500 });
  }
}

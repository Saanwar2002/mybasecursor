import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LocationPointPayload {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface UpdateDetailsPayload {
  bookingId: string;
  passengerId: string; 
  pickupLocation: LocationPointPayload;
  dropoffLocation: LocationPointPayload;
  stops: LocationPointPayload[];
  scheduledPickupAt: string | null; // ISO string or null to make it ASAP
  fareEstimate?: number | null; // Added fareEstimate
}

export async function POST(request: NextRequest) {
  try {
    const { 
        bookingId, 
        passengerId, 
        pickupLocation,
        dropoffLocation,
        stops,
        scheduledPickupAt,
        fareEstimate // Destructure fareEstimate
    } = (await request.json()) as UpdateDetailsPayload;

    if (!bookingId || !passengerId || !pickupLocation || !dropoffLocation) {
      return NextResponse.json({ message: 'Booking ID, Passenger ID, Pickup, and Dropoff locations are required.' }, { status: 400 });
    }

    // Validate scheduledPickupAt if provided
    if (scheduledPickupAt) {
      try {
        if(isNaN(new Date(scheduledPickupAt).getTime())) {
            throw new Error('Invalid date format for scheduledPickupAt');
        }
      } catch (e) {
        return NextResponse.json({ message: 'Invalid scheduledPickupAt format. Must be a valid ISO string.' }, { status: 400 });
      }
    }
    
    // Validate location points
    const validateLocation = (loc: LocationPointPayload, name: string) => {
        if (!loc.address || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
            throw new Error(`Invalid ${name} data. Address, latitude, and longitude are required.`);
        }
    };

    try {
        validateLocation(pickupLocation, "pickup location");
        validateLocation(dropoffLocation, "dropoff location");
        stops.forEach((stop, index) => validateLocation(stop, `stop ${index + 1}`));
    } catch(validationError: any) {
        return NextResponse.json({ message: validationError.message }, { status: 400 });
    }


    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
    }

    const bookingData = bookingSnap.data();

    if (!bookingData) {
      return NextResponse.json({ message: 'Booking data not found.' }, { status: 404 });
    }

    if (bookingData.passengerId !== passengerId) {
      return NextResponse.json({ message: 'You are not authorized to update this booking.' }, { status: 403 });
    }

    // Important: Only allow updates if status is 'pending_assignment'
    if (bookingData.status !== 'pending_assignment') {
      return NextResponse.json({ message: 'Booking details can only be changed if the ride is pending assignment.' }, { status: 400 });
    }

    const updateData: any = {
        pickupLocation,
        dropoffLocation,
        stops: stops || [], // Ensure stops is an array, even if empty
        updatedAt: Timestamp.fromDate(new Date()),
    };

    if (fareEstimate !== undefined && fareEstimate !== null) {
        updateData.fareEstimate = fareEstimate;
    }

    if (scheduledPickupAt === null) {
        updateData.scheduledPickupAt = FieldValue.delete(); 
    } else {
        updateData.scheduledPickupAt = scheduledPickupAt;
    }
    
    await bookingRef.update(updateData);
    
    // Fetch the updated document to return the most current data
    const updatedBookingSnap = await bookingRef.get();
    const updatedBookingData = updatedBookingSnap.data();

    return NextResponse.json({ 
        message: 'Booking details updated successfully', 
        bookingId,
        pickupLocation: updatedBookingData?.pickupLocation,
        dropoffLocation: updatedBookingData?.dropoffLocation,
        stops: updatedBookingData?.stops,
        scheduledPickupAt: updatedBookingData?.scheduledPickupAt,
        fareEstimate: updatedBookingData?.fareEstimate // Return the potentially updated fare
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating booking details:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to update booking details', details: errorMessage }, { status: 500 });
  }
}


import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Define the expected structure of the booking data coming from the client
interface BookingPayload {
  passengerId: string;
  passengerName: string;
  pickupLocation: { address: string; latitude: number; longitude: number };
  dropoffLocation: { address: string; latitude: number; longitude: number };
  stops: Array<{ address: string; latitude: number; longitude: number }>;
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
}

export async function POST(request: NextRequest) {
  try {
    const bookingData = (await request.json()) as BookingPayload;

    // Basic validation (more robust validation should be done with Zod or similar)
    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation) {
      return NextResponse.json({ message: 'Missing required booking fields.' }, { status: 400 });
    }
    
    // TODO: Secure this. In a real app, verify the passengerId using an ID token from Firebase Auth
    // For now, we're trusting the client-sent passengerId and passengerName.

    const newBooking = {
      ...bookingData,
      status: 'pending_assignment', // Initial status for a new booking
      bookingTimestamp: serverTimestamp(), // Firestore server-side timestamp
    };

    const docRef = await addDoc(collection(db, 'bookings'), newBooking);
    
    return NextResponse.json({ message: 'Booking created successfully', bookingId: docRef.id, data: newBooking }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to create booking', details: errorMessage }, { status: 500 });
  }
}

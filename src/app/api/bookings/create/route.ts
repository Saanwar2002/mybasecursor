
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Define the expected structure of the booking data coming from the client
interface BookingPayload {
  passengerId: string;
  passengerName: string; // This will be the customer's name if booked by operator
  pickupLocation: { address: string; latitude: number; longitude: number };
  dropoffLocation: { address: string; latitude: number; longitude: number };
  stops: Array<{ address: string; latitude: number; longitude: number }>;
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
  scheduledPickupAt?: string | null; 
  customerPhoneNumber?: string; 
  bookedByOperatorId?: string; 
  driverNotes?: string; // New field for driver notes
}

export async function POST(request: NextRequest) {
  try { // Top-level try
    const bookingData = (await request.json()) as BookingPayload;

    // Basic validation (more robust validation should be done with Zod or similar)
    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.passengerName) {
      return NextResponse.json({ message: 'Missing required booking fields (passengerId, passengerName, pickup, dropoff).' }, { status: 400 });
    }
    
    // In a real app, verify the passengerId/operatorId using an ID token from Firebase Auth
    // For now, we're trusting the client-sent IDs.

    const newBooking: any = { 
      passengerId: bookingData.passengerId,
      passengerName: bookingData.passengerName, 
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      stops: bookingData.stops,
      vehicleType: bookingData.vehicleType,
      passengers: bookingData.passengers,
      fareEstimate: bookingData.fareEstimate,
      isSurgeApplied: bookingData.isSurgeApplied,
      surgeMultiplier: bookingData.surgeMultiplier,
      stopSurchargeTotal: bookingData.stopSurchargeTotal,
      status: 'pending_assignment', 
      bookingTimestamp: serverTimestamp(), 
    };

    if (bookingData.scheduledPickupAt) {
      newBooking.scheduledPickupAt = bookingData.scheduledPickupAt;
    }
    if (bookingData.customerPhoneNumber) {
      newBooking.customerPhoneNumber = bookingData.customerPhoneNumber;
    }
    if (bookingData.bookedByOperatorId) {
      newBooking.bookedByOperatorId = bookingData.bookedByOperatorId;
    }
    if (bookingData.driverNotes && bookingData.driverNotes.trim() !== "") { // Add driverNotes if provided
      newBooking.driverNotes = bookingData.driverNotes.trim();
    }


    const docRef = await addDoc(collection(db, 'bookings'), newBooking);
    
    return NextResponse.json({ message: 'Booking created successfully', bookingId: docRef.id, data: newBooking }, { status: 201 });

  } catch (error) { // Top-level catch
    console.error('Error creating booking (API Route):', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails = '';
    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.toString();
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    }
    // Ensure a JSON response is sent
    return NextResponse.json({ message: 'Failed to create booking', details: errorMessage, errorRaw: errorDetails }, { status: 500 });
  }
}

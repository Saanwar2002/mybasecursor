
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
  scheduledPickupAt?: string | null; 
  customerPhoneNumber?: string; 
  bookedByOperatorId?: string; 
  driverNotes?: string; 
  promoCode?: string;
}

export async function POST(request: NextRequest) {
  let bookingData: BookingPayload;
  try {
    try {
      bookingData = (await request.json()) as BookingPayload;
    } catch (jsonError: any) {
      console.error('Error parsing JSON body in /api/bookings/create:', jsonError);
      return NextResponse.json({ message: 'Invalid JSON request body. Please ensure the request is a valid JSON object.', details: jsonError.message || String(jsonError) }, { status: 400 });
    }

    // Basic validation 
    if (!bookingData.passengerId || !bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.passengerName) {
      return NextResponse.json({ message: 'Missing required booking fields (passengerId, passengerName, pickup, dropoff).' }, { status: 400 });
    }
    
    // Ensure db is not null before using it
    if (!db) {
      console.error('Firestore (db) is not initialized. This is a server configuration issue. Check Firebase initialization logs.');
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized. Unable to process booking.' }, { status: 500 });
    }

    const newBooking: any = { 
      passengerId: bookingData.passengerId,
      passengerName: bookingData.passengerName, 
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      stops: bookingData.stops || [], // Ensure stops is an array
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
    if (bookingData.driverNotes && bookingData.driverNotes.trim() !== "") { 
      newBooking.driverNotes = bookingData.driverNotes.trim();
    }
    if (bookingData.promoCode && bookingData.promoCode.trim() !== "") {
        newBooking.promoCode = bookingData.promoCode.trim();
    }


    const docRef = await addDoc(collection(db, 'bookings'), newBooking);
    
    // For the response, we can't send serverTimestamp directly as it's a sentinel value.
    // Firestore automatically converts it on the server. The client will see the actual timestamp on next read.
    // We can send back the input data or a simplified version.
    const responseData = { ...newBooking, bookingTimestamp: new Date().toISOString() }; // Use current date as placeholder

    return NextResponse.json({ message: 'Booking created successfully', bookingId: docRef.id, data: responseData }, { status: 201 });

  } catch (error) { 
    console.error('Error in POST /api/bookings/create (General Catch):', error);
    let errorMessage = 'Internal Server Error during booking creation.';
    let errorDetails = '';
    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.toString();
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    }
    return NextResponse.json({ message: 'Failed to create booking due to an unexpected server error.', details: errorMessage, errorRaw: errorDetails }, { status: 500 });
  }
}

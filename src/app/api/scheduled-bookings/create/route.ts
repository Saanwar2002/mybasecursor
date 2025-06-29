// src/app/api/scheduled-bookings/create/route.ts
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

interface ScheduledBookingPayload {
  passengerId: string;
  passengerName: string; // Added this
  label: string;
  pickupLocation: LocationPointPayload;
  dropoffLocation: LocationPointPayload;
  stops?: LocationPointPayload[];
  vehicleType: string;
  passengers: number;
  driverNotes?: string;
  paymentMethod: "card" | "cash";
  daysOfWeek: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  pickupTime: string;
  isReturnJourneyScheduled: boolean;
  returnPickupTime?: string;
  isWaitAndReturnOutbound?: boolean;
  estimatedWaitTimeMinutesOutbound?: number;
  isActive: boolean; // Should default to true
  // nextRunDate will be calculated on save
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('scheduledBookings').add(data);
    return NextResponse.json({ message: 'Scheduled booking created successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create scheduled booking', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}


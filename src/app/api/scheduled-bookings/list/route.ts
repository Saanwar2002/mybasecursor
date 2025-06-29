// src/app/api/scheduled-bookings/list/route.ts
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

// Interface for data as it is stored/retrieved directly from Firestore
interface ScheduledBookingFirestoreData {
  passengerId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
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
  isActive: boolean;
  pausedDates?: string[];
  nextRunDate?: string; // Could be string or Timestamp from Firestore
  createdAt: Timestamp;
  updatedAt: Timestamp;
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

// Interface for the data structure being sent to the client
interface ScheduledBookingAPIResponse {
  id: string;
  passengerId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
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
  isActive: boolean;
  pausedDates?: string[];
  nextRunDate?: string; // "YYYY-MM-DD"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('passengerId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId or passengerId' }, { status: 400 });
    }
    const schedulesRef = db.collection('scheduledBookings');
    const snapshot = await schedulesRef.where('passengerId', '==', userId).get();
    const scheduledBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ scheduledBookings });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch scheduled bookings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

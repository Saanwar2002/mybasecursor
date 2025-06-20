import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { withOperatorAuth } from '@/lib/auth-middleware';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

// Define the structure of a Passenger document we expect to fetch/return
interface Passenger {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'passenger';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  // Add other relevant passenger fields if any
}

interface GetContext {
  params: {
    passengerId: string;
  };
}

export const GET = withOperatorAuth(async (req, { params }) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  const { passengerId } = params;

  if (!passengerId || typeof passengerId !== 'string' || passengerId.trim() === '') {
    return NextResponse.json({ message: 'A valid Passenger ID path parameter is required.' }, { status: 400 });
  }

  try {
    const passengerRef = doc(db, 'users', passengerId);
    const passengerSnap = await getDoc(passengerRef);

    if (!passengerSnap.exists()) {
      return NextResponse.json({ message: `Passenger with ID ${passengerId} not found.` }, { status: 404 });
    }

    const passengerData = passengerSnap.data();

    if (passengerData.role !== 'passenger') {
      return NextResponse.json({ message: `User with ID ${passengerId} is not a passenger.` }, { status: 404 });
    }

    const serializedPassenger: Passenger = {
      id: passengerSnap.id,
      name: passengerData.name || 'N/A',
      email: passengerData.email || 'N/A',
      phone: passengerData.phone,
      role: 'passenger',
      createdAt: serializeTimestamp(passengerData.createdAt as Timestamp | undefined),
      lastLogin: serializeTimestamp(passengerData.lastLogin as Timestamp | undefined),
    };
    
    return NextResponse.json(serializedPassenger, { status: 200 });

  } catch (error) {
    console.error(`Error fetching passenger ${passengerId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch passenger ${passengerId}`, details: errorMessage }, { status: 500 });
  }
});

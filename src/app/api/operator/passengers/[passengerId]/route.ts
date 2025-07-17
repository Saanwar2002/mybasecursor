import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

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

export async function GET(req: Request, { params }: { params: { passengerId: string } }) {
  // TODO: Implement authentication/authorization for operator role.
  // const operator = await getAuthenticatedOperator(request);
  // if (!operator) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  const passengerId = params.passengerId;

  if (!passengerId || typeof passengerId !== 'string' || passengerId.trim() === '') {
    return NextResponse.json({ message: 'A valid Passenger ID path parameter is required.' }, { status: 400 });
  }

  try {
    const docRef = db.collection('users').doc(passengerId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Passenger not found' }, { status: 404 });
    }
    const passengerData = docSnap.data();

    if (!passengerData) {
      return NextResponse.json({ error: 'Passenger data not found' }, { status: 404 });
    }

    if (passengerData.role !== 'passenger') {
      return NextResponse.json({ message: `User with ID ${passengerId} is not a passenger.` }, { status: 404 });
    }

    const serializedPassenger: Passenger = {
      id: docSnap.id,
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
    return NextResponse.json({ error: 'Failed to fetch passenger', details: errorMessage }, { status: 500 });
  }
}

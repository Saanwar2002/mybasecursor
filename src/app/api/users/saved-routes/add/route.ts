import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface AddSavedRoutePayload {
  userId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Add createdAt timestamp
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('savedRoutes').add(data);
    return NextResponse.json({ message: 'Saved route added successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add saved route', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

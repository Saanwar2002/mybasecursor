import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET() {
  try {
    const usersRef = db.collection('users');
    const bookingsRef = db.collection('bookings');
    const usersSnapshot = await usersRef.get();
    const bookingsSnapshot = await bookingsRef.get();
    const userCount = usersSnapshot.size;
    const bookingCount = bookingsSnapshot.size;
    return NextResponse.json({ userCount, bookingCount });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch platform summary', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

    
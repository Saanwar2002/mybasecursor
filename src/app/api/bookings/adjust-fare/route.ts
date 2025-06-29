import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }
    const updates = await req.json();
    const docRef = db.collection('bookings').doc(bookingId);
    await docRef.update(updates);
    return NextResponse.json({ message: 'Booking fare adjusted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to adjust booking fare', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
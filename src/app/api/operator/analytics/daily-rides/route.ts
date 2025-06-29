import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef.get();
    // Example: Count rides per day
    const dailyCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const timestamp = data.bookingTimestamp;
      if (timestamp && timestamp.toDate) {
        const dateStr = timestamp.toDate().toISOString().split('T')[0];
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      }
    });
    return NextResponse.json({ dailyCounts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch daily rides', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

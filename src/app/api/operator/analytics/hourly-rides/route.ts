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
    // Example: Count rides per hour
    const hourlyCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const timestamp = data.bookingTimestamp;
      if (timestamp && timestamp.toDate) {
        const hour = timestamp.toDate().getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      }
    });
    return NextResponse.json({ hourlyCounts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch hourly rides', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

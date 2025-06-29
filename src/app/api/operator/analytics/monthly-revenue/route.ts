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
    // Example: Sum up fares for monthly revenue
    let totalRevenue = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (typeof data.fare === 'number') {
        totalRevenue += data.fare;
      }
    });
    return NextResponse.json({ totalRevenue });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch monthly revenue', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

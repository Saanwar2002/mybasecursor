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
    // Example: Count pickup addresses
    const addressCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const address = data.pickupLocation?.address;
      if (address) {
        addressCounts[address] = (addressCounts[address] || 0) + 1;
      }
    });
    // Sort and return top addresses
    const popularAddresses = Object.entries(addressCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([address, count]) => ({ address, count }))
      .slice(0, 10);
    return NextResponse.json({ popularAddresses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch popular pickup addresses', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

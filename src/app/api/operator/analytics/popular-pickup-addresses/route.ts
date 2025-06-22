import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { withOperatorAuth } from '@/lib/auth-middleware';
import { subDays } from 'date-fns';

interface PopularAddress {
  address: string;
  count: number;
}

export const GET = withOperatorAuth(async (req, { user }) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    const cutoffDate = subDays(new Date(), 90); // Look at last 90 days

    const q = query(
      bookingsRef,
      where('operatorId', '==', user.uid), // Secure: filter by authenticated operator
      where('status', '==', 'Completed'),
      where('bookingTimestamp', '>=', Timestamp.fromDate(cutoffDate))
    );

    const querySnapshot = await getDocs(q);

    const addressCounts: Record<string, number> = {};
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const address = data.pickupAddress;
      if (address) {
        addressCounts[address] = (addressCounts[address] || 0) + 1;
      }
    });

    const popularAddresses: PopularAddress[] = Object.entries(addressCounts)
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Return top 10

    return NextResponse.json({ popularAddresses }, { status: 200 });

  } catch (error) {
    console.error('Error fetching popular pickup addresses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch popular addresses', details: errorMessage }, { status: 500 });
  }
});

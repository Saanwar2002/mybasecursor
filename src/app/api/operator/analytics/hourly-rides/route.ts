import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { withOperatorAuth } from '@/lib/auth-middleware';
import { subDays, startOfDay, endOfDay, getHours } from 'date-fns';

interface HourlyData {
    hour: number;
    rides: number;
}

export const GET = withOperatorAuth(async (req, { user }) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    const today = new Date();
    const startOfLookback = startOfDay(subDays(today, 6)); // Last 7 days including today

    const q = query(
        bookingsRef,
        where('operatorId', '==', user.uid),
        where('status', '==', 'Completed'),
        where('bookingTimestamp', '>=', Timestamp.fromDate(startOfLookback))
    );

    const querySnapshot = await getDocs(q);
    
    const hourlyCounts = new Array(24).fill(0);
    querySnapshot.forEach(doc => {
        const timestamp = doc.data().bookingTimestamp.toDate();
        const hour = getHours(timestamp);
        hourlyCounts[hour]++;
    });
    
    const hourlyData: HourlyData[] = hourlyCounts.map((rides, hour) => ({ hour, rides }));

    return NextResponse.json({ hourlyData }, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching hourly ride data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch hourly ride data', details: errorMessage }, { status: 500 });
  }
});

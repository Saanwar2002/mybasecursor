import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { withOperatorAuth } from '@/lib/auth-middleware';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export const GET = withOperatorAuth(async (req, { user }) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  try {
    const bookingsRef = collection(db, 'bookings');
    const monthlyRevenue: MonthlyRevenue[] = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
        const targetMonthDate = subMonths(today, i);
        const startOfTargetMonth = startOfMonth(targetMonthDate);
        const endOfTargetMonth = endOfMonth(targetMonthDate);
        const monthStr = format(targetMonthDate, 'MMM yyyy');

        const q = query(
            bookingsRef,
            where('operatorId', '==', user.uid),
            where('status', '==', 'Completed'),
            where('bookingTimestamp', '>=', Timestamp.fromDate(startOfTargetMonth)),
            where('bookingTimestamp', '<=', Timestamp.fromDate(endOfTargetMonth))
        );
        
        const querySnapshot = await getDocs(q);
        let totalRevenue = 0;
        querySnapshot.forEach(doc => {
            totalRevenue += doc.data().fare || 0;
        });

        monthlyRevenue.push({ month: monthStr, revenue: totalRevenue });
    }

    return NextResponse.json({ monthlyRevenue }, { status: 200 });

  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch monthly revenue', details: errorMessage }, { status: 500 });
  }
});

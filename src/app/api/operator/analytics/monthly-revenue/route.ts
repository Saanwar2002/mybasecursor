
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { z } from 'zod';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

// Zod schema for query parameters
const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

interface MonthlyRevenueData {
  month: string; // Formatted as "MMM yyyy", e.g., "Jan 2023"
  revenue: number;
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization for operator role

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const { months: numMonths } = parsedQuery.data;
  const monthlyRevenueData: MonthlyRevenueData[] = [];

  try {
    const bookingsRef = collection(db, 'bookings');
    const today = new Date();

    for (let i = 0; i < numMonths; i++) {
      const targetMonthDate = subMonths(today, i);
      const startOfTargetMonth = startOfMonth(targetMonthDate);
      const endOfTargetMonth = endOfMonth(targetMonthDate);
      
      const monthStr = format(targetMonthDate, 'MMM yyyy');

      const q = query(
        bookingsRef,
        where('status', '==', 'Completed'),
        where('bookingTimestamp', '>=', Timestamp.fromDate(startOfTargetMonth)),
        where('bookingTimestamp', '<=', Timestamp.fromDate(endOfTargetMonth))
      );
      
      const querySnapshot = await getDocs(q);
      let totalRevenueForMonth = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (typeof data.fareEstimate === 'number') {
          totalRevenueForMonth += data.fareEstimate;
        }
      });
      
      monthlyRevenueData.push({
        month: monthStr,
        revenue: parseFloat(totalRevenueForMonth.toFixed(2)),
      });
    }

    return NextResponse.json({ monthlyRevenue: monthlyRevenueData.reverse() }, { status: 200 });

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
}

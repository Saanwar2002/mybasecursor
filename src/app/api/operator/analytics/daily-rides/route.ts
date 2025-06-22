import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { z } from 'zod';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { withOperatorAuth } from '@/lib/auth-middleware';

// Zod schema for query parameters
const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30), // Coerce to number, default 30 days
});

interface DailyRideCount {
  date: string; // "YYYY-MM-DD"
  name: string; // "Mon", "Tue", etc.
  rides: number;
}

export const GET = withOperatorAuth(async (req, { user }) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const { days } = parsedQuery.data;
  const dailyRideCounts: DailyRideCount[] = [];

  try {
    const bookingsRef = collection(db, 'bookings');
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = subDays(today, i);
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const dayName = format(targetDate, 'E'); // Short day name like "Mon", "Tue"

      const startOfTargetDay = startOfDay(targetDate);
      const endOfTargetDay = endOfDay(targetDate);
      
      const q = query(
        bookingsRef,
        where('operatorId', '==', user.uid), // Secure: filter by authenticated operator
        where('status', '==', 'Completed'),
        where('bookingTimestamp', '>=', Timestamp.fromDate(startOfTargetDay)),
        where('bookingTimestamp', '<=', Timestamp.fromDate(endOfTargetDay))
      );
      
      const snapshot = await getCountFromServer(q);
      dailyRideCounts.push({
        date: dateStr,
        name: dayName,
        rides: snapshot.data().count,
      });
    }

    return NextResponse.json({ dailyRideCounts: dailyRideCounts.reverse() }, { status: 200 });

  } catch (error) {
    console.error('Error fetching daily ride counts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
     if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch daily ride counts', details: errorMessage }, { status: 500 });
  }
});

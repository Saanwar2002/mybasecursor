import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { z } from 'zod';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { withAdminAuth } from '@/lib/auth-middleware';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
});

interface DailyRideData {
  date: string; // YYYY-MM-DD
  name: string; // Short day name e.g., "Mon"
  rides: number;
}

export const GET = withAdminAuth(async (req) => {
  // TODO: Implement authentication/authorization for admin role
  // TODO: Replace mock data with actual Firestore queries

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const { days } = parsedQuery.data;
  const dailyPlatformRides: DailyRideData[] = [];
  const db = getDb();

  try {
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = subDays(today, i);
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const dayName = format(targetDate, 'E');

      const ridesRef = db.collection('rides');
      const startOfTargetDay = startOfDay(targetDate);
      const endOfTargetDay = endOfDay(targetDate);
      
      const q = ridesRef
        .where('status', '==', 'completed') 
        .where('bookingTimestamp', '>=', startOfTargetDay)
        .where('bookingTimestamp', '<=', endOfTargetDay);
        
      const snapshot = await q.count().get();
      const actualRides = snapshot.data().count;
      
      dailyPlatformRides.push({
        date: dateStr,
        name: dayName,
        rides: actualRides,
      });
    }

    return NextResponse.json({ dailyPlatformRides: dailyPlatformRides.reverse() }, { status: 200 });

  } catch (error) {
    console.error('Error fetching daily platform ride counts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch daily platform ride counts', details: errorMessage }, { status: 500 });
  }
});

    
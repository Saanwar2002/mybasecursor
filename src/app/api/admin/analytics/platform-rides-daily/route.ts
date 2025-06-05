
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; // Uncomment when using real data
// import { collection, query, where, Timestamp, getCountFromServer } from 'firebase/firestore';
import { z } from 'zod';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
});

interface DailyRideData {
  date: string; // YYYY-MM-DD
  name: string; // Short day name e.g., "Mon"
  rides: number;
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization for admin role
  // TODO: Replace mock data with actual Firestore queries

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const { days } = parsedQuery.data;
  const dailyPlatformRides: DailyRideData[] = [];

  try {
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = subDays(today, i);
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const dayName = format(targetDate, 'E');

      // --- MOCK DATA ---
      // Simulate daily rides, e.g., more on weekends
      const dayOfWeek = targetDate.getDay(); // 0 (Sun) to 6 (Sat)
      let mockRides = Math.floor(Math.random() * 300) + 400; // Base rides
      if (dayOfWeek === 0 || dayOfWeek === 6) mockRides += Math.floor(Math.random() * 200); // Weekend bonus
      if (dayOfWeek === 5) mockRides += Math.floor(Math.random() * 150); // Friday bonus
      // --- END MOCK DATA ---
      
      /*
      // Example for real data fetching (requires Firestore index on bookingTimestamp and status)
      const bookingsRef = collection(db, 'bookings');
      const startOfTargetDay = startOfDay(targetDate);
      const endOfTargetDay = endOfDay(targetDate);
      
      const q = query(
        bookingsRef,
        where('status', '==', 'Completed'), 
        where('bookingTimestamp', '>=', Timestamp.fromDate(startOfTargetDay)),
        where('bookingTimestamp', '<=', Timestamp.fromDate(endOfTargetDay))
      );
      const snapshot = await getCountFromServer(q);
      const actualRides = snapshot.data().count;
      */
      
      dailyPlatformRides.push({
        date: dateStr,
        name: dayName,
        rides: mockRides, // Replace with actualRides when using real data
      });
    }

    return NextResponse.json({ dailyPlatformRides: dailyPlatformRides.reverse() }, { status: 200 });

  } catch (error) {
    console.error('Error fetching daily platform ride counts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch daily platform ride counts', details: errorMessage }, { status: 500 });
  }
}

    
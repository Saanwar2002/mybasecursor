
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
import { format, startOfDay, endOfDay, parseISO, setHours, getHours } from 'date-fns';

// Zod schema for query parameters
const querySchema = z.object({
  date: z.string().refine((val) => {
    try {
      return !!parseISO(val);
    } catch (e) {
      return false;
    }
  }, { message: "Invalid date format, expected YYYY-MM-DD" }).optional(),
});

interface HourlyRideData {
  hour: string; // HH:00
  rides: number;
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization for operator role

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const targetDateStr = parsedQuery.data.date || format(new Date(), 'yyyy-MM-dd');
  let targetDate: Date;
  try {
    targetDate = parseISO(targetDateStr);
  } catch (e) {
    return NextResponse.json({ message: 'Invalid date format for query.' }, { status: 400 });
  }

  const hourlyActivity: HourlyRideData[] = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    rides: 0,
  }));

  try {
    const bookingsRef = collection(db, 'bookings');
    const startOfTargetDay = startOfDay(targetDate);
    const endOfTargetDay = endOfDay(targetDate);
    
    const q = query(
      bookingsRef,
      where('status', '==', 'Completed'), // Assuming 'Completed' is the correct status string
      where('bookingTimestamp', '>=', Timestamp.fromDate(startOfTargetDay)),
      where('bookingTimestamp', '<=', Timestamp.fromDate(endOfTargetDay))
    );
    
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.bookingTimestamp instanceof Timestamp) {
        const bookingDate = data.bookingTimestamp.toDate();
        const hour = getHours(bookingDate);
        if (hourlyActivity[hour]) {
          hourlyActivity[hour].rides++;
        }
      }
    });

    return NextResponse.json({ hourlyActivity }, { status: 200 });

  } catch (error) {
    console.error('Error fetching hourly ride activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch hourly ride activity', details: errorMessage }, { status: 500 });
  }
}

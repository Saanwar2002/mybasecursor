
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
import { subDays, startOfDay } from 'date-fns';

// Zod schema for query parameters
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

interface PopularAddressData {
  address: string;
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

  const { limit, days } = parsedQuery.data;

  try {
    const bookingsRef = collection(db, 'bookings');
    const lookbackDate = startOfDay(subDays(new Date(), days));
    
    const q = query(
      bookingsRef,
      where('status', '==', 'Completed'),
      where('bookingTimestamp', '>=', Timestamp.fromDate(lookbackDate))
    );
      
    const querySnapshot = await getDocs(q);
    
    const addressCounts: Record<string, number> = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.pickupLocation && typeof data.pickupLocation.address === 'string') {
        const address = data.pickupLocation.address;
        addressCounts[address] = (addressCounts[address] || 0) + 1;
      }
    });

    const sortedAddresses = Object.entries(addressCounts)
      .map(([address, rides]) => ({ address, rides }))
      .sort((a, b) => b.rides - a.rides);
      
    const popularAddresses = sortedAddresses.slice(0, limit);

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
    return NextResponse.json({ message: 'Failed to fetch popular pickup addresses', details: errorMessage }, { status: 500 });
  }
}

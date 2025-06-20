import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; // Uncomment when using real data
// import { collection, query, where, Timestamp, getCountFromServer } from 'firebase/firestore';
import { z } from 'zod';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { withAdminAuth } from '@/lib/auth-middleware';

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

interface MonthlyUserRegistrationData {
  month: string; // "MMM yyyy"
  passengers: number;
  drivers: number;
  operators: number;
  // admins: number; // Optional: if you want to track admin registrations
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

  const { months: numMonths } = parsedQuery.data;
  const monthlyRegistrations: MonthlyUserRegistrationData[] = [];

  try {
    const today = new Date();

    for (let i = 0; i < numMonths; i++) {
      const targetMonthDate = subMonths(today, i);
      const monthStr = format(targetMonthDate, 'MMM yyyy');
      
      // --- MOCK DATA ---
      const mockPassengers = Math.floor(Math.random() * 150) + 50;
      const mockDrivers = Math.floor(Math.random() * 30) + 10;
      const mockOperators = Math.floor(Math.random() * 5) + 1;
      // --- END MOCK DATA ---

      /*
      // Example for real data fetching (requires Firestore index on createdAt and role)
      const usersRef = collection(db, 'users');
      const startOfTargetMonth = startOfMonth(targetMonthDate);
      const endOfTargetMonth = endOfMonth(targetMonthDate);

      const fetchCountForRole = async (role: string) => {
        const q = query(
          usersRef,
          where('role', '==', role),
          where('createdAt', '>=', Timestamp.fromDate(startOfTargetMonth)),
          where('createdAt', '<=', Timestamp.fromDate(endOfTargetMonth))
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
      };
      
      const actualPassengers = await fetchCountForRole('passenger');
      const actualDrivers = await fetchCountForRole('driver');
      const actualOperators = await fetchCountForRole('operator');
      */
      
      monthlyRegistrations.push({
        month: monthStr,
        passengers: mockPassengers, // Replace with actualPassengers
        drivers: mockDrivers,       // Replace with actualDrivers
        operators: mockOperators,   // Replace with actualOperators
      });
    }

    return NextResponse.json({ monthlyRegistrations: monthlyRegistrations.reverse() }, { status: 200 });

  } catch (error) {
    console.error('Error fetching monthly user registrations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch monthly user registrations', details: errorMessage }, { status: 500 });
  }
});

    
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
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
  const db = getDb();

  try {
    const today = new Date();

    for (let i = 0; i < numMonths; i++) {
      const targetMonthDate = subMonths(today, i);
      const monthStr = format(targetMonthDate, 'MMM yyyy');
      
      const usersRef = db.collection('users');
      const startOfTargetMonth = startOfMonth(targetMonthDate);
      const endOfTargetMonth = endOfMonth(targetMonthDate);

      const fetchCountForRole = async (role: string) => {
        const q = usersRef
          .where('role', '==', role)
          .where('createdAt', '>=', startOfTargetMonth)
          .where('createdAt', '<=', endOfTargetMonth);
        
        const snapshot = await q.count().get();
        return snapshot.data().count;
      };
      
      const [actualPassengers, actualDrivers, actualOperators] = await Promise.all([
        fetchCountForRole('passenger'),
        fetchCountForRole('driver'),
        fetchCountForRole('operator')
      ]);
      
      monthlyRegistrations.push({
        month: monthStr,
        passengers: actualPassengers,
        drivers: actualDrivers,
        operators: actualOperators,
      });
    }

    return NextResponse.json({ monthlyRegistrations: monthlyRegistrations.reverse() }, { status: 200 });

  } catch (error) {
    console.error('Error fetching monthly user registrations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch monthly user registrations', details: errorMessage }, { status: 500 });
  }
});

    
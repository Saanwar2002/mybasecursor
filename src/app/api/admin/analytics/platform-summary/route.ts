import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-middleware';
import { getDb } from '@/lib/firebase-admin';
import { collection, getCountFromServer, where, query, Timestamp, getDocs, DocumentData } from 'firebase/firestore';

interface PlatformSummaryStats {
  totalUsers: number;
  totalPassengers: number;
  totalDrivers: number;
  totalOperators: number;
  totalAdmins: number;
  totalRidesLast30Days: number;
  totalRevenueLast30Days: number;
}

export const GET = withAdminAuth(async (req) => {
  // TODO: Implement authentication/authorization for admin role
  // TODO: Replace mock data with actual Firestore queries

  try {
    const db = getDb();
    const usersRef = collection(db, 'users');

    const totalUsersSnap = await getCountFromServer(usersRef);
    const passengersSnap = await getCountFromServer(query(usersRef, where('role', '==', 'passenger')));
    const driversSnap = await getCountFromServer(query(usersRef, where('role', '==', 'driver')));
    const operatorsSnap = await getCountFromServer(query(usersRef, where('role', '==', 'operator')));
    const adminsSnap = await getCountFromServer(query(usersRef, where('role', '==', 'admin')));

    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const ridesQuery = query(collection(db, 'rides'), where('status', '==', 'completed'), where('bookingTimestamp', '>=', thirtyDaysAgo));
    
    const ridesSnapshot = await getDocs(ridesQuery);
    const totalRidesLast30Days = ridesSnapshot.size;
    
    let totalRevenueLast30Days = 0;
    ridesSnapshot.forEach((doc: DocumentData) => {
      totalRevenueLast30Days += doc.data().finalFare || 0;
    });

    const realSummary: PlatformSummaryStats = {
        totalUsers: totalUsersSnap.data().count,
        totalPassengers: passengersSnap.data().count,
        totalDrivers: driversSnap.data().count,
        totalOperators: operatorsSnap.data().count,
        totalAdmins: adminsSnap.data().count,
        totalRidesLast30Days: totalRidesLast30Days,
        totalRevenueLast30Days: parseFloat(totalRevenueLast30Days.toFixed(2)),
    };

    return NextResponse.json(realSummary, { status: 200 });

  } catch (error) {
    console.error('Error fetching platform summary stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch platform summary statistics', details: errorMessage }, { status: 500 });
  }
});

    
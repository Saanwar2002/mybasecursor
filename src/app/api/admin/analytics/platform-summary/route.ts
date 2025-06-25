
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, where, query, getDocs } from 'firebase/firestore';
import { auth } from '@/lib/firebase';

interface PlatformSummaryStats {
  totalUsers: number;
  totalPassengers: number;
  totalDrivers: number;
  totalOperators: number;
  totalAdmins: number;
  totalRidesLast30Days: number;
  totalRevenueLast30Days: number; // Mocked
}

export async function GET(request: NextRequest) {
  // Enforce authentication/authorization for admin role
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }
  const idToken = authHeader.split(' ')[1];
  let decodedToken: any = null;
  try {
    decodedToken = await auth?.verifyIdToken(idToken);
    if (!decodedToken || decodedToken.role !== 'admin') {
      return NextResponse.json({ message: 'Forbidden: Admins only' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token', details: error instanceof Error ? error.message : error }, { status: 401 });
  }

  try {
    // --- REAL DATA ---
    const usersRef = collection(db!, 'users');
    const totalUsersSnap = await getCountFromServer(usersRef);
    const passengersSnap = await getCountFromServer(query(usersRef, where('role', '==', 'passenger')));
    const driversSnap = await getCountFromServer(query(usersRef, where('role', '==', 'driver')));
    const operatorsSnap = await getCountFromServer(query(usersRef, where('role', '==', 'operator')));
    const adminsSnap = await getCountFromServer(query(usersRef, where('role', '==', 'admin')));

    // For rides and revenue, query the 'bookings' collection
    const bookingsRef = collection(db!, 'bookings');
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ridesQuery = query(bookingsRef, where('status', '==', 'Completed'), where('bookingTimestamp', '>=', thirtyDaysAgo));
    const ridesSnap = await getDocs(ridesQuery);
    let totalRevenueLast30Days = 0;
    ridesSnap.forEach(doc => {
      const data = doc.data();
      if (typeof data.fareEstimate === 'number') {
        totalRevenueLast30Days += data.fareEstimate;
      }
    });

    const realSummary: PlatformSummaryStats = {
      totalUsers: totalUsersSnap.data().count,
      totalPassengers: passengersSnap.data().count,
      totalDrivers: driversSnap.data().count,
      totalOperators: operatorsSnap.data().count,
      totalAdmins: adminsSnap.data().count,
      totalRidesLast30Days: ridesSnap.size,
      totalRevenueLast30Days,
    };
    return NextResponse.json(realSummary, { status: 200 });
    // --- END REAL DATA ---
  } catch (error) {
    console.error('Error fetching platform summary stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch platform summary statistics', details: errorMessage }, { status: 500 });
  }
}

    
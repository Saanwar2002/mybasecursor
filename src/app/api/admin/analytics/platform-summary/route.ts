import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET() {
  try {
    const usersRef = db.collection('users');
    const bookingsRef = db.collection('bookings');
    const usersSnapshot = await usersRef.get();
    const bookingsSnapshot = await bookingsRef.get();

    // User role counts
    let totalPassengers = 0, totalDrivers = 0, totalOperators = 0, totalAdmins = 0;
    usersSnapshot.forEach(doc => {
      const role = doc.data().role;
      if (role === 'passenger') totalPassengers++;
      else if (role === 'driver') totalDrivers++;
      else if (role === 'operator') totalOperators++;
      else if (role === 'admin') totalAdmins++;
    });

    // Bookings in last 30 days and revenue
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let totalRidesLast30Days = 0;
    let totalRevenueLast30Days = 0;
    bookingsSnapshot.forEach(doc => {
      const data = doc.data();
      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate();
      }
      if (createdAt && new Date(createdAt) >= thirtyDaysAgo) {
        totalRidesLast30Days++;
        if (typeof data.fare === 'number') totalRevenueLast30Days += data.fare;
      }
    });

    return NextResponse.json({
      totalUsers: usersSnapshot.size,
      totalPassengers,
      totalDrivers,
      totalOperators,
      totalAdmins,
      totalRidesLast30Days,
      totalRevenueLast30Days,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch platform summary', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

    
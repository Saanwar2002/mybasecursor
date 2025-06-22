// src/app/api/scheduled-bookings/list/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, { user }) => {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const passengerId = searchParams.get('passengerId');

  if (!passengerId) {
    return NextResponse.json({ message: 'Passenger ID is required.' }, { status: 400 });
  }

  // Security check: users can only access their own schedules
  if (passengerId !== user.uid && user.role !== 'admin' && user.role !== 'operator') {
    return NextResponse.json({ message: 'Forbidden: You can only access your own schedules.' }, { status: 403 });
  }

  try {
    const schedulesRef = db.collection('scheduledBookings');
    const snapshot = await schedulesRef
      .where('passengerId', '==', passengerId)
      .orderBy('createdAt', 'desc')
      .get();

    const schedules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ schedules }, { status: 200 });

  } catch (error) {
    console.error('Error fetching scheduled bookings:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
});

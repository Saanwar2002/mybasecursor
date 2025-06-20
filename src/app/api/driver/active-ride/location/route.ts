import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
  }
  try {
    const { driverId, latitude, longitude, heading } = await request.json();
    if (!driverId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    // Find the active ride for this driver
    const bookingsRef = collection(db, 'bookings');
    const activeStatuses = [
      'driver_assigned',
      'arrived_at_pickup',
      'in_progress',
      'pending_driver_wait_and_return_approval',
      'in_progress_wait_and_return'
    ];
    const q = query(
      bookingsRef,
      where('driverId', '==', driverId),
      where('status', 'in', activeStatuses),
      orderBy('bookingTimestamp', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'No active ride found for driver' }, { status: 404 });
    }
    const rideDoc = querySnapshot.docs[0];
    await updateDoc(doc(db, 'bookings', rideDoc.id), {
      driverCurrentLocation: { lat: latitude, lng: longitude, heading: typeof heading === 'number' ? heading : null },
      driverLocationUpdatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update driver location' }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Adds a driver to a user's list of favorite drivers in Firestore.
export async function POST(request: Request) {
  try {
    const { userId, driverId, driverName, vehicleInfo } = await request.json();

    if (!userId || !driverId || !driverName || !vehicleInfo) {
      return NextResponse.json({ message: 'Missing user or driver details' }, { status: 400 });
    }

    const db = getDb();
    const userRef = db.collection('users').doc(userId);

    // Using a subcollection 'favoriteDrivers' to store favorite drivers for the user.
    // The document ID within the subcollection will be the driverId to prevent duplicates.
    const favoriteDriverRef = userRef.collection('favoriteDrivers').doc(driverId);

    await favoriteDriverRef.set({
      driverName,
      vehicleInfo,
      addedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Added driver ${driverName} (${driverId}) to favorites for user ${userId}.`);

    return NextResponse.json({
      message: `Driver ${driverName} added to favorites successfully.`,
      driver: { id: driverId, name: driverName, vehicleInfo }
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to add favorite driver:', error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });
  }
} 
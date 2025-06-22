import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

// Removes a driver from a user's list of favorite drivers in Firestore.
export async function POST(request: Request) {
  try {
    const { userId, driverId } = await request.json();

    if (!userId || !driverId) {
      return NextResponse.json({ message: 'Missing user or driver ID' }, { status: 400 });
    }

    const db = getDb();
    const favoriteDriverRef = db.collection('users').doc(userId).collection('favoriteDrivers').doc(driverId);

    await favoriteDriverRef.delete();

    console.log(`Removed driver ${driverId} from favorites for user ${userId}.`);

    return NextResponse.json({
      message: `Driver removed from favorites successfully.`
    }, { status: 200 });

  } catch (error) {
    console.error('Failed to remove favorite driver:', error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });
  }
} 
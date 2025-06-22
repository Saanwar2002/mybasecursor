import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const db = getDb();
    const favoriteDriversRef = db.collection('users').doc(userId).collection('favoriteDrivers');
    const snapshot = await favoriteDriversRef.orderBy('addedAt', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const favorites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(favorites);

  } catch (error) {
    console.error('Failed to list favorite drivers:', error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });
  }
} 
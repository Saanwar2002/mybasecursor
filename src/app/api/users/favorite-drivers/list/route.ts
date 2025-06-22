import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, { user }) => {
  const db = getDb();

  try {
    const favoritesRef = db.collection('users').doc(user.uid).collection('favoriteDrivers');
    const snapshot = await favoritesRef.orderBy('createdAt', 'desc').get();

    const favorites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(favorites, { status: 200 });

  } catch (error) {
    console.error('Error fetching favorite drivers:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}); 
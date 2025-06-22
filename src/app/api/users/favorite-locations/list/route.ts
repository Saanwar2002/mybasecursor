import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, { user }) => {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
  }

  // Security check: users can only access their own favorites
  if (userId !== user.uid && user.role !== 'admin' && user.role !== 'operator') {
    return NextResponse.json({ message: 'Forbidden: You can only access your own favorites.' }, { status: 403 });
  }

  try {
    const favoritesRef = db.collection('users').doc(userId).collection('favoriteLocations');
    const snapshot = await favoritesRef.orderBy('createdAt', 'desc').get();

    const favorites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(favorites, { status: 200 });

  } catch (error) {
    console.error('Error fetching favorite locations:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
});


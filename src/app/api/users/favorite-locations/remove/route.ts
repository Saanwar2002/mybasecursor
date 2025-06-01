
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('userId'); // For verification

  if (!id || !userId) {
    return NextResponse.json({ message: 'Favorite location ID and User ID are required as query parameters.' }, { status: 400 });
  }

  try {
    const favLocationRef = doc(db, 'favoriteLocations', id);
    const favLocationSnap = await getDoc(favLocationRef);

    if (!favLocationSnap.exists()) {
      return NextResponse.json({ message: 'Favorite location not found.' }, { status: 404 });
    }

    const favLocationData = favLocationSnap.data();

    // Verify ownership (in a real app, use authenticated user ID from session)
    if (favLocationData.userId !== userId) {
      return NextResponse.json({ message: 'You are not authorized to remove this favorite location.' }, { status: 403 });
    }

    await deleteDoc(favLocationRef);
    
    return NextResponse.json({ message: 'Favorite location removed successfully', id }, { status: 200 });

  } catch (error) {
    console.error('Error removing favorite location:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to remove favorite location', details: errorMessage }, { status: 500 });
  }
}

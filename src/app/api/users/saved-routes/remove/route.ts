
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id'); // ID of the savedRoute document
  const userId = searchParams.get('userId'); // For verification

  if (!id || !userId) {
    return NextResponse.json({ message: 'Saved route ID and User ID are required as query parameters.' }, { status: 400 });
  }

  try {
    const savedRouteRef = doc(db, 'savedRoutes', id);
    const savedRouteSnap = await getDoc(savedRouteRef);

    if (!savedRouteSnap.exists()) {
      return NextResponse.json({ message: 'Saved route not found.' }, { status: 404 });
    }

    const savedRouteData = savedRouteSnap.data();

    // Verify ownership (in a real app, use authenticated user ID from session/token)
    if (savedRouteData.userId !== userId) {
      return NextResponse.json({ message: 'You are not authorized to remove this saved route.' }, { status: 403 });
    }

    await deleteDoc(savedRouteRef);
    
    return NextResponse.json({ message: 'Saved route removed successfully', id }, { status: 200 });

  } catch (error) {
    console.error('Error removing saved route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to remove saved route', details: errorMessage }, { status: 500 });
  }
}

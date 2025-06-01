
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface AddFavoriteLocationPayload {
  userId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, label, address, latitude, longitude } = (await request.json()) as AddFavoriteLocationPayload;

    if (!userId || !label || !address || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ message: 'User ID, label, address, latitude, and longitude are required.' }, { status: 400 });
    }
    if (label.trim().length === 0) {
        return NextResponse.json({ message: 'Label cannot be empty.' }, { status: 400 });
    }
    if (address.trim().length === 0) {
        return NextResponse.json({ message: 'Address cannot be empty.' }, { status: 400 });
    }

    // In a real app, you'd get userId from the authenticated session, not the payload.
    // For demo purposes, we'll trust the userId from the payload.

    const newFavoriteLocation = {
      userId,
      label,
      address,
      latitude,
      longitude,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'favoriteLocations'), newFavoriteLocation);

    return NextResponse.json({ message: 'Favorite location added successfully', id: docRef.id, data: { ...newFavoriteLocation, createdAt: new Date().toISOString()} }, { status: 201 });

  } catch (error) {
    console.error('Error adding favorite location:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to add favorite location', details: errorMessage }, { status: 500 });
  }
}

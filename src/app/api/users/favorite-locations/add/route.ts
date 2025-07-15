import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface AddFavoriteLocationPayload {
  userId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('favoriteLocations').add(data);
    const docSnap = await docRef.get();
    return NextResponse.json({
      id: docRef.id,
      data: docSnap.data()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add favorite location', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

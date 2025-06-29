import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface FavoriteLocationDoc {
  id: string;
  userId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Timestamp; // Firestore Timestamp on server
}

function deepSerialize(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === 'object') {
    // Firestore Timestamp check (Admin SDK)
    if (obj.constructor && obj.constructor.name === 'Timestamp' && 'seconds' in obj && 'nanoseconds' in obj) {
      return { _seconds: obj.seconds, _nanoseconds: obj.nanoseconds };
    }
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = deepSerialize(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    const favLocationsRef = db.collection('favoriteLocations');
    const snapshot = await favLocationsRef.where('userId', '==', userId).get();
    let favoriteLocations = snapshot.docs.map(doc => deepSerialize({ id: doc.id, ...doc.data() }));
    // Defensive: always return an array
    if (!Array.isArray(favoriteLocations)) favoriteLocations = [];
    return NextResponse.json({ favoriteLocations });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch favorite locations' });
  }
}


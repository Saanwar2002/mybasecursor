import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SavedRouteDoc {
  id: string;
  userId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
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
    const savedRoutesRef = db.collection('savedRoutes');
    const snapshot = await savedRoutesRef.where('userId', '==', userId).get();
    let savedRoutes = snapshot.docs.map(doc => deepSerialize({ id: doc.id, ...doc.data() }));
    // Defensive: always return an array
    if (!Array.isArray(savedRoutes)) savedRoutes = [];
    return NextResponse.json({ savedRoutes });
  } catch (error) {
    let errorDetails = {
      message: (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error),
      code: (error && typeof error === 'object' && 'code' in error) ? (error as any).code : undefined,
      json: undefined as string | undefined,
    };
    try {
      errorDetails.json = JSON.stringify(error);
    } catch (e) {
      errorDetails.json = 'Could not stringify error';
    }
    return NextResponse.json({ error: 'Failed to fetch saved routes', details: errorDetails }, { status: 500 });
  }
}


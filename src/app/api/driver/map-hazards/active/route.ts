import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface MapHazardFromDB {
  hazardType: string;
  location: { latitude: number; longitude: number }; // Firestore GeoPoint is stored as an object
  reportedByDriverId: string;
  reportedAt: Timestamp;
  status: string;
}

interface MapHazardAPIResponse {
  id: string;
  hazardType: string;
  location: { latitude: number; longitude: number };
  reportedAt: string; // ISO string
  status: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    // You may want to add geospatial filtering here
    const hazardsRef = db.collection('mapHazards');
    const snapshot = await hazardsRef.where('status', '==', 'active').get();
    const hazards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ hazards });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch map hazards', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

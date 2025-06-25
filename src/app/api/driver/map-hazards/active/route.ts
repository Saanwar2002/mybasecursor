
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

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

export async function GET(request: NextRequest) {
  // Accept driver's current location as query params: ?lat=...&lng=...
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const driverLat = latParam ? parseFloat(latParam) : null;
  const driverLng = lngParam ? parseFloat(lngParam) : null;
  const RADIUS_METERS = 500;

  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  // TODO: Add driver authentication/authorization if needed, though this data might be public-ish for drivers.

  try {
    if (!db) {
      console.error("API Error in /api/driver/map-hazards/active GET: Firestore (db) is not initialized.");
      return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
    }

    const hazardsRef = collection(db, 'mapHazards');
    const q = query(
      hazardsRef,
      where('status', '==', 'active')
      // TODO: Add orderBy('reportedAt', 'desc') and corresponding index if performance becomes an issue.
      // TODO: Add filtering for expiresAt if that field is implemented.
    );

    const querySnapshot = await getDocs(q);
    const activeHazards: MapHazardAPIResponse[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as MapHazardFromDB;
      activeHazards.push({
        id: doc.id,
        hazardType: data.hazardType,
        location: data.location, // GeoPoint-like object
        reportedAt: data.reportedAt.toDate().toISOString(),
        status: data.status,
      });
    });

    return NextResponse.json({ hazards: activeHazards }, { status: 200 });

  } catch (error) {
    console.error('Error fetching active map hazards:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Check for Firestore index error
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
      return NextResponse.json({
        message: 'Query requires a Firestore index. Please check the Firestore console to create it.',
        details: errorMessage,
      }, { status: 500 });
    }
    return NextResponse.json({ message: 'Failed to fetch active map hazards', details: errorMessage }, { status: 500 });
  }
}


import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface AddSavedRoutePayload {
  userId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
}

export async function POST(request: NextRequest) {
  try {
    const { 
      userId, 
      label, 
      pickupLocation, 
      dropoffLocation, 
      stops 
    } = (await request.json()) as AddSavedRoutePayload;

    if (!userId || !label || !pickupLocation || !dropoffLocation) {
      return NextResponse.json({ message: 'User ID, label, pickup location, and dropoff location are required.' }, { status: 400 });
    }
    if (label.trim().length === 0) {
        return NextResponse.json({ message: 'Label cannot be empty.' }, { status: 400 });
    }
    if (!pickupLocation.address || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number') {
        return NextResponse.json({ message: 'Invalid pickup location data.' }, { status: 400 });
    }
    if (!dropoffLocation.address || typeof dropoffLocation.latitude !== 'number' || typeof dropoffLocation.longitude !== 'number') {
        return NextResponse.json({ message: 'Invalid dropoff location data.' }, { status: 400 });
    }
    if (stops) {
        for (const stop of stops) {
            if (!stop.address || typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') {
                return NextResponse.json({ message: 'Invalid stop data found in stops array.' }, { status: 400 });
            }
        }
    }

    const newSavedRoute = {
      userId,
      label,
      pickupLocation,
      dropoffLocation,
      stops: stops || [], // Ensure stops is an array
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'savedRoutes'), newSavedRoute);

    // Return the saved route data along with the new ID
    // serverTimestamp() will be resolved by Firestore, so we send back what was saved.
    // For createdAt, client will see a pending state or re-fetch.
    // Or, we can send a client-approximated timestamp.
    const savedDataForResponse = {
        ...newSavedRoute,
        id: docRef.id,
        createdAt: new Date().toISOString() // Provide an ISO string for immediate use on client
    };


    return NextResponse.json({ message: 'Saved route added successfully', route: savedDataForResponse }, { status: 201 });

  } catch (error) {
    console.error('Error adding saved route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to add saved route', details: errorMessage }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { AuthenticatedRequest, withAuth } from '@/lib/auth-middleware';
import * as admin from 'firebase-admin';
import { z } from 'zod';

interface LocationPoint {
  latitude: number;
  longitude: number;
}

// This function is duplicated from the create route. For a real app,
// this should be moved into a shared lib/ directory.
async function findBestAvailableDriver(
  db: admin.firestore.Firestore,
  bookingRequest: {
    pickupLocation: LocationPoint;
    vehicleType: string;
    operatorId: string;
  }
): Promise<boolean> {
  const driversRef = db.collection('users');
  const availableDriversQuery = driversRef
    .where('role', '==', 'driver')
    .where('status', '==', 'available')
    .where('operatorId', '==', bookingRequest.operatorId)
    .where('vehicleType', '==', bookingRequest.vehicleType)
    .limit(1);

  try {
    const snapshot = await availableDriversQuery.get();
    console.log(`[QUOTE API] Firestore query for vehicle '${bookingRequest.vehicleType}' found ${snapshot.size} matching driver(s).`);
    return !snapshot.empty;
  } catch (error) {
    console.error("[QUOTE API] Error querying for available drivers:", error);
    return false;
  }
}

const quoteRequestSchema = z.object({
  pickupLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  vehicleType: z.string(),
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const db = getDb();
  try {
    const body = await req.json();
    const parsedData = quoteRequestSchema.safeParse(body);

    if (!parsedData.success) {
      console.error('[QUOTE API] Validation Error:', parsedData.error.format());
      return NextResponse.json({ message: 'Invalid payload', errors: parsedData.error.format() }, { status: 400 });
    }

    const { pickupLocation, vehicleType } = parsedData.data;
    const operatorId = 'OP001'; // Hardcoded for now

    console.log('[QUOTE API] Received Request:', {
      user: req.user,
      pickupLocation,
      vehicleType,
      operatorId,
    });

    const driversAvailable = await findBestAvailableDriver(db, {
      pickupLocation: {
        latitude: pickupLocation.lat,
        longitude: pickupLocation.lng
      },
      vehicleType,
      operatorId,
    });

    console.log('[QUOTE API] Driver Availability Result:', { driversAvailable });

    return NextResponse.json({ driversAvailable });

  } catch (error) {
    console.error('Error in quote endpoint:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
});
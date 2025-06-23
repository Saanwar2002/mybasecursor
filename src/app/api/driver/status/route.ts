import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withDriverAuth } from '@/lib/auth-middleware';
import { z } from 'zod';
import * as fbAdmin from 'firebase-admin';

const statusUpdateSchema = z.object({
  status: z.enum(['available', 'on_job', 'offline']),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

export const POST = withDriverAuth(async (req: NextRequest, { user: driver }: { user: fbAdmin.auth.DecodedIdToken }) => {
  const db = getDb();
  
  try {
    const body = await req.json();
    const parsedData = statusUpdateSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ message: 'Invalid payload', errors: parsedData.error.format() }, { status: 400 });
    }

    const { status, location } = parsedData.data;

    // A driver must provide a location when they become 'available'
    if (status === 'available' && !location) {
      return NextResponse.json({ message: 'Location is required when setting status to "available".' }, { status: 400 });
    }

    const driverRef = db.collection('users').doc(driver.uid);

    const updatePayload: { [key: string]: any } = {
      availabilityStatus: status,
      lastStatusUpdate: new Date(),
    };

    if (location) {
      updatePayload.currentLocation = new fbAdmin.firestore.GeoPoint(location.latitude, location.longitude);
      updatePayload.lastLocationUpdate = new Date();
    }

    await driverRef.update(updatePayload);

    return NextResponse.json({ message: `Driver status successfully updated to ${status}` }, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/driver/status:', error);
    return NextResponse.json({ message: 'Failed to update driver status due to an unexpected server error.' }, { status: 500 });
  }
}); 
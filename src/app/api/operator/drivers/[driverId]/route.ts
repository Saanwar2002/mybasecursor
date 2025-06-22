import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin';
import { withOperatorAuth } from '@/lib/auth-middleware';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended';
  rating?: number;
  totalRides?: number;
  role: 'driver';
  operatorCode?: string;
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  operatorUpdatedAt?: { _seconds: number; _nanoseconds: number } | null;
  statusReason?: string;
}

interface GetContext {
  params: {
    driverId: string;
  };
}

// SECURED GET HANDLER
export const GET = withOperatorAuth(async (request: NextRequest, context: GetContext) => {
  const { driverId } = context.params;

  if (!driverId || typeof driverId !== 'string' || driverId.trim() === '') {
    return NextResponse.json({ message: 'A valid Driver ID path parameter is required.' }, { status: 400 });
  }

  try {
    const db = getDb(); // Use Admin SDK
    const driverRef = db.collection('users').doc(driverId);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();

    if (!driverData || driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver.` }, { status: 404 });
    }

    const serializedDriver: Driver = {
      id: driverSnap.id,
      name: driverData.name || 'N/A',
      email: driverData.email || 'N/A',
      phone: driverData.phone,
      vehicleModel: driverData.vehicleModel,
      licensePlate: driverData.licensePlate,
      status: driverData.status || 'Inactive',
      rating: driverData.rating,
      totalRides: driverData.totalRides,
      role: 'driver',
      operatorCode: driverData.operatorCode || undefined,
      createdAt: serializeTimestamp(driverData.createdAt as Timestamp | undefined),
      lastLogin: serializeTimestamp(driverData.lastLogin as Timestamp | undefined),
      operatorUpdatedAt: serializeTimestamp(driverData.operatorUpdatedAt as Timestamp | undefined),
      statusReason: driverData.statusReason,
    };
    
    return NextResponse.json(serializedDriver, { status: 200 });

  } catch (error) {
    console.error(`Error fetching driver ${driverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch driver ${driverId}`, details: errorMessage }, { status: 500 });
  }
});

// Zod schema for validating the update payload
const driverUpdateSchema = z.object({
  name: z.string().min(2, {message: "Name must be at least 2 characters."}).optional(),
  email: z.string().email({message: "Invalid email format."}).optional(),
  phone: z.string().optional(),
  vehicleModel: z.string().optional(),
  licensePlate: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Pending Approval', 'Suspended']).optional(),
  statusReason: z.string().optional(),
  operatorCode: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { // Ensures at least one field is being updated
  message: "At least one field must be provided for update."
});

export type DriverUpdatePayload = z.infer<typeof driverUpdateSchema>;

// SECURED POST HANDLER
export const POST = withOperatorAuth(async (request: NextRequest, context: GetContext) => {
  const { driverId } = context.params;

  if (!driverId || typeof driverId !== 'string' || driverId.trim() === '') {
    return NextResponse.json({ message: 'A valid Driver ID path parameter is required.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsedPayload = driverUpdateSchema.safeParse(body);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const updateDataFromPayload = parsedPayload.data;
    
    const db = getDb(); // Use Admin SDK
    const auth = getAuth(); // Use Admin SDK
    const driverRef = db.collection('users').doc(driverId);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();
    if (!driverData || driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver and cannot be updated via this endpoint.` }, { status: 403 });
    }

    const updatePayload: any = {
      ...updateDataFromPayload,
      operatorUpdatedAt: Timestamp.now(),
    };
    
    if (updateDataFromPayload.status) {
        updatePayload.statusUpdatedAt = Timestamp.now();
    }

    // CRITICAL LOGIC: If activating a driver, set their custom auth claim
    if (updateDataFromPayload.status === 'Active') {
      try {
        const userRecord = await auth.getUser(driverId);
        const currentClaims = userRecord.customClaims || {};
        if (!currentClaims.driver) {
          await auth.setCustomUserClaims(driverId, { ...currentClaims, driver: true });
          console.log(`Successfully set 'driver:true' custom claim for user ${driverId}`);
        }
      } catch (claimError) {
        console.error(`Failed to set custom claim for driver ${driverId}:`, claimError);
        return NextResponse.json({ message: 'Database updated, but failed to set user auth claim. Please contact support.' }, { status: 500 });
      }
    }

    if (updateDataFromPayload.status && updateDataFromPayload.status !== 'Suspended') {
      updatePayload.statusReason = null; // Use null to delete the field
    }
    
    await driverRef.update(updatePayload);

    const updatedDriverSnap = await driverRef.get();
    const updatedDriverData = updatedDriverSnap.data();

    if (!updatedDriverData) {
      return NextResponse.json({ message: 'Failed to retrieve updated driver profile.' }, { status: 500 });
    }

    const serializedUpdatedDriver: Driver = {
        id: updatedDriverSnap.id,
        name: updatedDriverData.name || 'N/A',
        email: updatedDriverData.email || 'N/A',
        phone: updatedDriverData.phone,
        vehicleModel: updatedDriverData.vehicleModel,
        licensePlate: updatedDriverData.licensePlate,
        status: updatedDriverData.status || 'Inactive',
        rating: updatedDriverData.rating,
        totalRides: updatedDriverData.totalRides,
        role: 'driver',
        operatorCode: updatedDriverData.operatorCode || undefined,
        createdAt: serializeTimestamp(updatedDriverData.createdAt as Timestamp | undefined),
        lastLogin: serializeTimestamp(updatedDriverData.lastLogin as Timestamp | undefined),
        operatorUpdatedAt: serializeTimestamp(updatedDriverData.operatorUpdatedAt as Timestamp | undefined),
        statusReason: updatedDriverData.statusReason,
    };

    return NextResponse.json({ message: 'Driver details updated successfully', driver: serializedUpdatedDriver }, { status: 200 });

  } catch (error) {
    console.error(`Error updating driver ${driverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof z.ZodError) { 
        return NextResponse.json({ message: 'Invalid update payload.', errors: error.format() }, { status: 400 });
    }
    return NextResponse.json({ message: `Failed to update driver ${driverId}`, details: errorMessage }, { status: 500 });
  }
});
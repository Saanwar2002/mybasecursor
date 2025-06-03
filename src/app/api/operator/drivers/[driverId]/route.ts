
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

// Define the structure of a Driver document we expect to fetch/return
interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended'; // Added Suspended
  rating?: number;
  totalRides?: number;
  role: 'driver';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  operatorUpdatedAt?: { _seconds: number; _nanoseconds: number } | null;
  statusReason?: string; // Added for suspension reason
}


interface GetContext {
  params: {
    driverId: string;
  };
}

export async function GET(request: NextRequest, context: GetContext) {
  // TODO: Implement authentication/authorization for operator role.

  const { driverId } = context.params;

  if (!driverId || typeof driverId !== 'string' || driverId.trim() === '') {
    return NextResponse.json({ message: 'A valid Driver ID path parameter is required.' }, { status: 400 });
  }

  try {
    const driverRef = doc(db, 'users', driverId);
    const driverSnap = await getDoc(driverRef);

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();

    if (driverData.role !== 'driver') {
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
}

const driverUpdateSchema = z.object({
  name: z.string().min(2, {message: "Name must be at least 2 characters."}).optional(),
  email: z.string().email({message: "Invalid email format."}).optional(),
  phone: z.string().optional(), 
  vehicleModel: z.string().optional(),
  licensePlate: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Pending Approval', 'Suspended']).optional(),
  statusReason: z.string().optional(), // For suspension reason
}).min(1, { message: "At least one field must be provided for update." });

export type DriverUpdatePayload = z.infer<typeof driverUpdateSchema>;

export async function POST(request: NextRequest, context: GetContext) {
  // TODO: Implement authentication/authorization for operator role.

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
    
    const driverRef = doc(db, 'users', driverId);
    const driverSnap = await getDoc(driverRef);

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();
    if (driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver and cannot be updated via this endpoint.` }, { status: 403 });
    }

    const updatePayload: Partial<DriverUpdatePayload & { operatorUpdatedAt: Timestamp, statusUpdatedAt: Timestamp }> = {
      ...updateDataFromPayload,
      operatorUpdatedAt: Timestamp.now(),
      statusUpdatedAt: Timestamp.now(), // Also update when status itself changes
    };

    // Clear statusReason if status is not 'Suspended'
    if (updateDataFromPayload.status && updateDataFromPayload.status !== 'Suspended') {
      updatePayload.statusReason = undefined; // Or use deleteField() if you prefer to remove it
    } else if (updateDataFromPayload.status === 'Suspended' && !updateDataFromPayload.statusReason) {
      // If suspending and no reason is provided, we might want to set a default or leave it null/undefined.
      // Current Zod schema makes statusReason optional, so it can be undefined.
    }
    
    await updateDoc(driverRef, updatePayload as any);

    const updatedDriverSnap = await getDoc(driverRef);
    const updatedDriverData = updatedDriverSnap.data()!;

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
}

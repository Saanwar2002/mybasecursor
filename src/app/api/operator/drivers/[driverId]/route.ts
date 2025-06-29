import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

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
  operatorCode?: string; // Added operatorCode
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

export async function GET(req: Request, { params }: { params: { driverId: string } }) {
  try {
    const driverId = params.driverId;
    const docRef = db.collection('users').doc(driverId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch driver', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

const driverUpdateSchema = z.object({
  name: z.string().min(2, {message: "Name must be at least 2 characters."}).optional(),
  email: z.string().email({message: "Invalid email format."}).optional(),
  phone: z.string().optional(), 
  vehicleModel: z.string().optional(),
  licensePlate: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Pending Approval', 'Suspended']).optional(),
  statusReason: z.string().optional(),
  operatorCode: z.string().optional(), // Allow updating operatorCode if necessary
}).refine(obj => Object.keys(obj).length > 0, { message: "At least one field must be provided for update." });

export type DriverUpdatePayload = z.infer<typeof driverUpdateSchema>;

export async function POST(request: NextRequest, context: { params: { driverId: string } }) {
  if (!db) {
    return NextResponse.json({ message: 'Database connection failed: Firestore not initialized.' }, { status: 500 });
  }
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
    const driverRef = db.collection('users').doc(driverId);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();
    if (driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver and cannot be updated via this endpoint.` }, { status: 403 });
    }
    // Prevent activating guest drivers
    if (driverData.email && driverData.email.startsWith('guest-') && updateDataFromPayload.status === 'Active') {
      return NextResponse.json({ message: `Guest drivers cannot be activated.` }, { status: 403 });
    }

    const updatePayload: Partial<DriverUpdatePayload & { operatorUpdatedAt: Timestamp, statusUpdatedAt: Timestamp }> = {
      ...updateDataFromPayload,
      operatorUpdatedAt: Timestamp.fromDate(new Date()),
    };
    if (updateDataFromPayload.status) {
      updatePayload.statusUpdatedAt = Timestamp.fromDate(new Date());
    }
    if (updateDataFromPayload.status && updateDataFromPayload.status !== 'Suspended') {
      updatePayload.statusReason = undefined;
    }
    // Remove undefined fields from updatePayload
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });
    await driverRef.update(updatePayload as any);
    const updatedDriverSnap = await driverRef.get();
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
      operatorCode: updatedDriverData.operatorCode || null,
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

export async function DELETE(request: NextRequest, context: GetContext) {
  if (!db) {
    return NextResponse.json({ message: 'Database connection failed: Firestore not initialized.' }, { status: 500 });
  }
  const { driverId } = context.params;
  if (!driverId || typeof driverId !== 'string' || driverId.trim() === '') {
    return NextResponse.json({ message: 'A valid Driver ID path parameter is required.' }, { status: 400 });
  }
  try {
    const driverRef = db.collection('users').doc(driverId);
    const driverSnap = await driverRef.get();
    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }
    const driverData = driverSnap.data();
    if (driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver and cannot be deleted via this endpoint.` }, { status: 403 });
    }
    await driverRef.delete();
    return NextResponse.json({ message: `Driver ${driverId} deleted successfully.` }, { status: 200 });
  } catch (error) {
    console.error('UNHANDLED ERROR in API route:', error);
    return NextResponse.json({ message: 'Unhandled server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

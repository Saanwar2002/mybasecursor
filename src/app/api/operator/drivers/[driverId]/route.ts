import { NextResponse, NextRequest } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
  role: 'driver' | 'admin' | 'operator';
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
    if (!docSnap.exists()) {
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
  customId: z.string().optional(), // <-- allow updating customId
  driverIdentifier: z.string().optional(), // <-- allow updating driverIdentifier
  role: z.enum(['driver', 'admin', 'operator']).optional(), // Allow updating role
  isSuperAdmin: z.boolean().optional(), // Allow setting super admin flag
  approvedAt: z.string().optional(), // Allow setting approval timestamp
  approvedBy: z.string().optional(), // Allow setting who approved
}).refine(obj => Object.keys(obj).length > 0, { message: "At least one field must be provided for update." });

export type DriverUpdatePayload = z.infer<typeof driverUpdateSchema>;

// Function to generate sequential operator ID
async function generateSequentialOperatorId(): Promise<string> {
  const counterRef = db.collection('counters').doc('operatorId');
  let currentId = 1;
  const counterSnap = await counterRef.get();
  if (counterSnap.exists) {
    const data = counterSnap.data();
    if (data && typeof data.currentId === 'number') {
      currentId = data.currentId + 1;
    }
  }
  await counterRef.set({ currentId }, { merge: true });
  return `OP${currentId.toString().padStart(3, '0')}`;
}

// Function to generate sequential driver ID for an operator
async function generateSequentialDriverId(operatorCode: string): Promise<string> {
  const counterRef = db.collection('counters').doc(`driverId_${operatorCode}`);
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists) {
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    return `${operatorCode}/DR${result.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating driver ID:', error);
    throw error;
  }
}

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

    if (!driverSnap.exists) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();
    if (!driverData) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }
    const isOperator = driverData.role === 'operator';
    const entity = isOperator ? 'Operator' : 'Driver';
    if (driverData.role !== 'driver' && driverData.role !== 'admin' && driverData.role !== 'operator') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a ${entity.toLowerCase()}, admin, or operator and cannot be updated via this endpoint.` }, { status: 403 });
    }
    // Prevent activating guest drivers
    if (driverData.role === 'driver' && driverData.email && driverData.email.startsWith('guest-') && updateDataFromPayload.status === 'Active') {
      return NextResponse.json({ message: `Guest drivers cannot be activated.` }, { status: 403 });
    }

    const updatePayload: Partial<DriverUpdatePayload & { operatorUpdatedAt: Timestamp; statusUpdatedAt: Timestamp; statusReason?: string }> = {
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
        const K = key as keyof typeof updatePayload;
      if (updatePayload[K] === undefined) {
        delete updatePayload[K];
      }
    });

    // In POST handler, after confirming operator approval
    if (
      driverData.role === 'operator' &&
      updateDataFromPayload.status === 'Active' &&
      (!driverData.operatorCode && !driverData.customId)
    ) {
      // Generate and assign operator code
      const newOperatorCode = await generateSequentialOperatorId();
      updatePayload.operatorCode = newOperatorCode;
      updatePayload.customId = newOperatorCode;
    }
    // If approving a driver and driverIdentifier is missing, generate and assign it
    if (
      driverData.role === 'driver' &&
      updateDataFromPayload.status === 'Active' &&
      (!driverData.driverIdentifier || driverData.driverIdentifier === '' || typeof driverData.driverIdentifier !== 'string') &&
      driverData.operatorCode
    ) {
      // Generate next driver ID for this operator
      const driverId = await generateSequentialDriverId(driverData.operatorCode);
      updatePayload.driverIdentifier = driverId;
      updatePayload.customId = driverId;
    }

    await driverRef.update(updatePayload);
    const updatedDriverSnap = await driverRef.get();
    const updatedDriverData = updatedDriverSnap.data();

    if(!updatedDriverData) {
        return NextResponse.json({ message: `Could not retrieve updated ${entity.toLowerCase()} data for ID ${driverId}` }, { status: 404 });
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
      role: updatedDriverData.role,
      operatorCode: updatedDriverData.operatorCode || null,
      createdAt: serializeTimestamp(updatedDriverData.createdAt as Timestamp | undefined),
      lastLogin: serializeTimestamp(updatedDriverData.lastLogin as Timestamp | undefined),
      operatorUpdatedAt: serializeTimestamp(updatedDriverData.operatorUpdatedAt as Timestamp | undefined),
      statusReason: updatedDriverData.statusReason,
    };
    return NextResponse.json({ message: `${entity} details updated successfully`, driver: serializedUpdatedDriver }, { status: 200 });
  } catch (error) {
    console.error(`Error updating driver ${driverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    let entity = 'user';
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid update payload.', errors: error.format() }, { status: 400 });
    }
    return NextResponse.json({ 
      message: `Failed to update ${entity} ${driverId}`, 
      details: errorMessage, 
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)) 
    }, { status: 500 });
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
    if (!driverSnap.exists) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }
    const driverData = driverSnap.data();
    if (!driverData || driverData.role !== 'driver') {
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver and cannot be deleted via this endpoint.` }, { status: 403 });
    }
    await driverRef.delete();
    return NextResponse.json({ message: `${entity} ${driverId} deleted successfully.` }, { status: 200 });
  } catch (error) {
    console.error('UNHANDLED ERROR in API route:', error);
    return NextResponse.json({ message: 'Unhandled server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

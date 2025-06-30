import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  startAfter: z.string().optional(), // Document ID to start after
  status: z.enum(['Active', 'Inactive', 'Pending Approval', 'Suspended', 'all']).optional().default('all'), // Default to all if no specific status given
  sortBy: z.enum(['name', 'email', 'status', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  searchName: z.string().optional(),
  operatorCode: z.string().optional(), // New filter
});

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  vehicleCategory?: string; // Added for better vehicle description
  customId?: string; // Typically used for driver's unique ID / registration
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended';
  rating?: number;
  totalRides?: number;
  role: 'driver';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  operatorCode?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorCode = searchParams.get('operatorCode');
    const status = searchParams.get('status');
    const usersRef = db.collection('users');
    let query = usersRef.where('role', '==', 'driver');
    if (operatorCode) {
      query = query.where('operatorCode', '==', operatorCode);
    }
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    const snapshot = await query.get();
    const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ drivers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch drivers', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Implement other HTTP methods (POST, PUT, DELETE) similarly using the Admin SDK if needed.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Basic validation
    const driverSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      vehicleModel: z.string().optional(),
      licensePlate: z.string().optional(),
      operatorCode: z.string().min(2),
      vehicleCategory: z.string().optional(),
      arNumber: z.string().optional(),
      insuranceNumber: z.string().optional(),
    });
    const parsed = driverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Invalid driver data', errors: parsed.error.format() }, { status: 400 });
    }
    const driverData = parsed.data;
    
    // Check for duplicate email
    const usersRef = db.collection('users');
    const existing = await usersRef.where('email', '==', driverData.email).get();
    if (!existing.empty) {
      return NextResponse.json({ message: 'A driver with this email already exists.' }, { status: 409 });
    }
    
    // Generate sequential driver ID
    const driverId = await generateSequentialDriverId(driverData.operatorCode);
    
    const now = Timestamp.now();
    const newDriver = {
      ...driverData,
      status: 'Pending Approval',
      role: 'driver',
      createdAt: now,
      customId: driverId,
      driverIdentifier: driverId,
    };
    
    const docRef = await usersRef.add(newDriver);
    const createdSnap = await docRef.get();
    const createdData = createdSnap.data();
    const serializedDriver = {
      id: docRef.id,
      name: createdData.name,
      email: createdData.email,
      phone: createdData.phone,
      vehicleModel: createdData.vehicleModel,
      licensePlate: createdData.licensePlate,
      vehicleCategory: createdData.vehicleCategory,
      arNumber: createdData.arNumber,
      insuranceNumber: createdData.insuranceNumber,
      status: createdData.status,
      role: createdData.role,
      createdAt: serializeTimestamp(createdData.createdAt),
      operatorCode: createdData.operatorCode,
      customId: createdData.customId,
      driverIdentifier: createdData.driverIdentifier,
    };
    return NextResponse.json({ message: 'Driver created successfully', driver: serializedDriver }, { status: 201 });
  } catch (error) {
    console.error('Error creating driver:', error);
    return NextResponse.json({ message: 'Failed to create driver', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// Function to generate sequential driver ID for an operator
async function generateSequentialDriverId(operatorCode: string): Promise<string> {
  const counterRef = db.collection('counters').doc(`driverId_${operatorCode}`);
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const currentId = counterDoc.data().currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    return `${operatorCode}/DR${result.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating driver ID:', error);
    throw error;
  }
}

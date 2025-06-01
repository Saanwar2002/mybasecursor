
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

// Define the structure of a Driver document we expect to fetch/return
// This should align with what src/app/(app)/operator/manage-drivers/page.tsx expects
// and what is stored in Firestore for users with role 'driver'.
interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval';
  rating?: number;
  totalRides?: number;
  role: 'driver';
  createdAt?: { _seconds: number; _nanoseconds: number } | null; // Serialized timestamp
  // Add other fields as necessary, e.g., lastLogin
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
}


interface GetContext {
  params: {
    driverId: string;
  };
}

export async function GET(request: NextRequest, context: GetContext) {
  // TODO: Implement authentication/authorization for operator role. Ensure only authorized operators can access this.

  const { driverId } = context.params;

  if (!driverId || typeof driverId !== 'string' || driverId.trim() === '') {
    return NextResponse.json({ message: 'A valid Driver ID path parameter is required.' }, { status: 400 });
  }

  try {
    const driverRef = doc(db, 'users', driverId); // Assuming drivers are in 'users' collection
    const driverSnap = await getDoc(driverRef);

    if (!driverSnap.exists()) {
      return NextResponse.json({ message: `Driver with ID ${driverId} not found.` }, { status: 404 });
    }

    const driverData = driverSnap.data();

    // Verify the user is actually a driver
    if (driverData.role !== 'driver') {
      // Even if the user ID exists, if it's not a driver, treat as not found for this endpoint's purpose
      return NextResponse.json({ message: `User with ID ${driverId} is not a driver.` }, { status: 404 });
    }

    // Ensure all known and potential timestamp fields are serialized
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
      role: 'driver', // Assert role
      createdAt: serializeTimestamp(driverData.createdAt as Timestamp | undefined),
      lastLogin: serializeTimestamp(driverData.lastLogin as Timestamp | undefined),
      // Add other fields as necessary
    };
    
    return NextResponse.json(serializedDriver, { status: 200 });

  } catch (error) {
    console.error(`Error fetching driver ${driverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch driver ${driverId}`, details: errorMessage }, { status: 500 });
  }
}

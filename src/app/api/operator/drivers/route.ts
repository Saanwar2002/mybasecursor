
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter as firestoreStartAfter,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  QueryConstraint,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { z } from 'zod';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  let {
    limit,
    startAfter: startAfterDocId,
    status,
    sortBy,
    sortOrder,
    searchName,
    operatorCode, // Destructure new filter
  } = parsedQuery.data;

  // If operatorCode is provided and no specific status is requested, default to 'Active'
  if (operatorCode && status === 'all') {
    status = 'Active';
  }


  try {
    const usersRef = collection(db, 'users'); 
    const queryConstraints: QueryConstraint[] = [];

    queryConstraints.push(where('role', '==', 'driver'));

    if (operatorCode) {
      queryConstraints.push(where('operatorCode', '==', operatorCode));
    }

    if (status && status !== 'all') {
      queryConstraints.push(where('status', '==', status));
    }

    if (searchName) {
      queryConstraints.push(where('name', '>=', searchName));
      queryConstraints.push(where('name', '<=', searchName + '\uf8ff')); 
       if (sortBy !== 'name') {
        queryConstraints.push(orderBy('name', sortOrder)); 
        if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder)); 
      } else {
        queryConstraints.push(orderBy(sortBy, sortOrder));
      }
    } else if (sortBy) {
        queryConstraints.push(orderBy(sortBy, sortOrder));
    }


    let lastDocSnapshot = null;
    if (startAfterDocId) {
      const startAfterDocRef = doc(db, 'users', startAfterDocId); 
      lastDocSnapshot = await getDoc(startAfterDocRef);
      if (!lastDocSnapshot.exists()) {
        return NextResponse.json({ message: 'Pagination cursor not found.' }, { status: 404 });
      }
      queryConstraints.push(firestoreStartAfter(lastDocSnapshot));
    }

    queryConstraints.push(firestoreLimit(limit));

    const q = query(usersRef, ...queryConstraints) as Query<DocumentData>;
    const querySnapshot = await getDocs(q);

    const drivers: Driver[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        phone: data.phone,
        vehicleModel: data.vehicleModel,
        licensePlate: data.licensePlate,
        vehicleCategory: data.vehicleCategory,
        customId: data.customId,
        status: data.status || 'Inactive', 
        rating: data.rating,
        totalRides: data.totalRides,
        role: 'driver', 
        createdAt: serializeTimestamp(data.createdAt as Timestamp | undefined),
        operatorCode: data.operatorCode || null,
      } as Driver;
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      nextCursor = lastVisible.id;
    }

    return NextResponse.json({
      drivers,
      nextCursor,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching drivers for operator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch drivers', details: errorMessage }, { status: 500 });
  }
}

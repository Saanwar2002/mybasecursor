
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
  status: z.enum(['Active', 'Inactive', 'Pending Approval']).optional(),
  sortBy: z.enum(['name', 'email', 'status', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  searchName: z.string().optional(),
});

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
  // Add other fields as necessary
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization to ensure only operators can access this.

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const {
    limit,
    startAfter: startAfterDocId,
    status,
    sortBy,
    sortOrder,
    searchName,
  } = parsedQuery.data;

  try {
    const usersRef = collection(db, 'users'); // Assuming drivers are stored in a 'users' collection
    const queryConstraints: QueryConstraint[] = [];

    // Always filter by role 'driver'
    queryConstraints.push(where('role', '==', 'driver'));

    // Filtering
    if (status) {
      queryConstraints.push(where('status', '==', status));
    }

    // Basic search functionality for name (case-sensitive, prefix match might require different setup or client-side filtering for basic Firestore)
    // For more robust search, consider a dedicated search service like Algolia or Elasticsearch.
    // Firestore's native querying for "contains" or case-insensitive search is limited.
    // If searchName is provided, we might need to adjust sortBy if it's not 'name'.
    if (searchName) {
      queryConstraints.push(where('name', '>=', searchName));
      queryConstraints.push(where('name', '<=', searchName + '\uf8ff')); // Firestore trick for prefix search
       // If searching by name, Firestore requires the first orderBy to be on 'name'.
       if (sortBy !== 'name') {
        queryConstraints.push(orderBy('name', sortOrder)); // Add name sort first
        if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder)); // Then the original sort
      } else {
        queryConstraints.push(orderBy(sortBy, sortOrder));
      }
    } else if (sortBy) {
        queryConstraints.push(orderBy(sortBy, sortOrder));
    }


    // Pagination
    let lastDocSnapshot = null;
    if (startAfterDocId) {
      const startAfterDocRef = doc(db, 'users', startAfterDocId); // Assuming 'users' collection
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
        status: data.status || 'Inactive', // Default to Inactive if not set
        rating: data.rating,
        totalRides: data.totalRides,
        role: 'driver', // Assert role
        createdAt: serializeTimestamp(data.createdAt as Timestamp | undefined),
        // Ensure all fields expected by the Driver interface are included
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
    // Check for Firestore index errors specifically
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch drivers', details: errorMessage }, { status: 500 });
  }
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { withOperatorAuth } from '@/lib/auth-middleware';
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
  sortBy: z.enum(['name', 'email', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  searchName: z.string().optional(),
  searchEmail: z.string().optional(),
});

// Define the structure of a Passenger document we expect to fetch/return
interface Passenger {
  id: string;
  name: string;
  email: string;
  phone?: string; // Passengers might also have phone numbers
  role: 'passenger';
  createdAt?: { _seconds: number; _nanoseconds: number } | null; // Serialized timestamp
  lastLogin?: { _seconds: number; _nanoseconds: number } | null; // Serialized timestamp
  // Add other relevant passenger fields if any
}

export const GET = withOperatorAuth(async (req) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());

  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const {
    limit,
    startAfter: startAfterDocId,
    sortBy,
    sortOrder,
    searchName,
    searchEmail,
  } = parsedQuery.data;

  try {
    const usersRef = collection(db, 'users');
    const queryConstraints: QueryConstraint[] = [];

    // Always filter by role 'passenger'
    queryConstraints.push(where('role', '==', 'passenger'));

    // Filtering by name
    if (searchName) {
      queryConstraints.push(where('name', '>=', searchName));
      queryConstraints.push(where('name', '<=', searchName + '\uf8ff'));
      // If searching by name, Firestore requires the first orderBy to be on 'name'.
      if (sortBy !== 'name') {
        queryConstraints.push(orderBy('name', sortOrder)); // Add name sort first
        if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder)); // Then the original sort
      } else {
        queryConstraints.push(orderBy(sortBy, sortOrder));
      }
    } else if (searchEmail) {
      // Filtering by email (exact match)
      queryConstraints.push(where('email', '==', searchEmail));
      // If filtering by email and sortBy is not email, it might need specific indexing.
      // For simplicity, if sortBy is different, we'll add email sort first.
      if (sortBy !== 'email') {
          queryConstraints.push(orderBy('email', sortOrder));
          if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder));
      } else {
          queryConstraints.push(orderBy(sortBy, sortOrder));
      }
    } else if (sortBy) {
      queryConstraints.push(orderBy(sortBy, sortOrder));
    }


    // Pagination
    if (startAfterDocId) {
      const startAfterDocRef = doc(db, 'users', startAfterDocId);
      const lastDocSnapshot = await getDoc(startAfterDocRef);
      if (!lastDocSnapshot.exists()) {
        return NextResponse.json({ message: 'Pagination cursor not found.' }, { status: 404 });
      }
      queryConstraints.push(firestoreStartAfter(lastDocSnapshot));
    }

    queryConstraints.push(firestoreLimit(limit));

    const q = query(usersRef, ...queryConstraints) as Query<DocumentData>;
    const querySnapshot = await getDocs(q);

    const passengers: Passenger[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        phone: data.phone, // Include phone if available
        role: 'passenger', // Assert role
        createdAt: serializeTimestamp(data.createdAt as Timestamp | undefined),
        lastLogin: serializeTimestamp(data.lastLogin as Timestamp | undefined),
      } as Passenger;
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      nextCursor = lastVisible.id;
    }

    return NextResponse.json({
      passengers,
      nextCursor,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching passengers for operator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch passengers', details: errorMessage }, { status: 500 });
  }
});
    
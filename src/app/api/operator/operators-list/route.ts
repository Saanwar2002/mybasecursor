
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
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  startAfter: z.string().optional(), // Document ID to start after
  status: z.enum(['Active', 'Inactive', 'Pending Approval', 'Suspended']).optional(),
  sortBy: z.enum(['name', 'email', 'status', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  searchName: z.string().optional(),
});

interface OperatorUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended';
  role: 'operator';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  operatorUpdatedAt?: { _seconds: number; _nanoseconds: number } | null;
}

import { auth } from '@/lib/firebase';
import { getAuth } from 'firebase-admin/auth';

export async function GET(request: NextRequest) {
  // Require authentication and super-admin role
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Missing or invalid authorization header' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (err) {
    return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
  }
  if (decodedToken.role !== 'super-admin' && decodedToken.role !== 'platform-owner') {
    return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

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
    const usersRef = collection(db, 'users');
    const queryConstraints: QueryConstraint[] = [];

    queryConstraints.push(where('role', '==', 'operator'));

    if (status) {
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

    const operators: OperatorUser[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        phone: data.phone,
        status: data.status || 'Inactive',
        role: 'operator',
        createdAt: serializeTimestamp(data.createdAt as Timestamp | undefined),
        lastLogin: serializeTimestamp(data.lastLogin as Timestamp | undefined),
        operatorUpdatedAt: serializeTimestamp(data.operatorUpdatedAt as Timestamp | undefined),
      } as OperatorUser;
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      nextCursor = lastVisible.id;
    }

    return NextResponse.json({ operators, nextCursor }, { status: 200 });

  } catch (error) {
    console.error('Error fetching operators:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch operators', details: errorMessage }, { status: 500 });
  }
}

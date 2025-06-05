
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
import type { UserRole } from '@/contexts/auth-context';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): { _seconds: number; _nanoseconds: number } | null {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return {
      _seconds: timestamp.seconds,
      _nanoseconds: timestamp.nanoseconds,
    };
  }
  // Handle cases where it might already be an object like { seconds: ..., nanoseconds: ... } from other parts of app
  if (typeof timestamp === 'object' && timestamp !== null && ('_seconds'in timestamp || 'seconds' in timestamp)) {
     return {
      _seconds: (timestamp as any)._seconds ?? (timestamp as any).seconds,
      _nanoseconds: (timestamp as any)._nanoseconds ?? (timestamp as any).nanoseconds ?? 0,
    };
  }
  return null;
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  startAfter: z.string().optional(), // Document ID to start after
  role: z.enum(['all', 'passenger', 'driver', 'operator', 'admin']).optional().default('all'),
  status: z.string().optional(), // e.g., 'Active', 'Pending Approval', 'Suspended', 'Inactive'
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  searchName: z.string().optional(),
  searchEmail: z.string().optional(),
});

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string; // 'Active', 'Inactive', 'Pending Approval', 'Suspended'
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  phone?: string;
  operatorCode?: string;
  driverIdentifier?: string;
  vehicleCategory?: string;
  customId?: string;
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization for admin role.
  // For now, assumes the caller is authorized.

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const parsedQuery = querySchema.safeParse(params);

  if (!parsedQuery.success) {
    return NextResponse.json({ message: 'Invalid query parameters', errors: parsedQuery.error.format() }, { status: 400 });
  }

  const {
    limit,
    startAfter: startAfterDocId,
    role,
    status,
    sortBy,
    sortOrder,
    searchName,
    searchEmail,
  } = parsedQuery.data;

  try {
    const usersRef = collection(db, 'users');
    const queryConstraints: QueryConstraint[] = [];

    if (role && role !== 'all') {
      queryConstraints.push(where('role', '==', role));
    }
    if (status && status !== 'all') {
      queryConstraints.push(where('status', '==', status));
    }

    // Name search (prefix based)
    if (searchName) {
      queryConstraints.push(where('name', '>=', searchName));
      queryConstraints.push(where('name', '<=', searchName + '\uf8ff'));
    }
    // Email search (can be exact, or prefix if Firestore supports it well enough or use third-party search)
    if (searchEmail) {
      queryConstraints.push(where('email', '>=', searchEmail));
      queryConstraints.push(where('email', '<=', searchEmail + '\uf8ff'));
    }
    
    // Firestore requires the first orderBy field to match the field in inequality filters if present.
    // Adjusting order of orderBy constraints based on search fields.
    if (searchName) {
      queryConstraints.push(orderBy('name', sortOrder)); // Primary sort on name if searching by name
      if (sortBy !== 'name') queryConstraints.push(orderBy(sortBy, sortOrder)); // Secondary sort
    } else if (searchEmail) {
      queryConstraints.push(orderBy('email', sortOrder)); // Primary sort on email if searching by email
      if (sortBy !== 'email') queryConstraints.push(orderBy(sortBy, sortOrder)); // Secondary sort
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

    const users: PlatformUser[] = querySnapshot.docs.map((userDoc) => {
      const data = userDoc.data();
      return {
        id: userDoc.id,
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        role: data.role || 'passenger', // Default if role is missing
        status: data.status || 'Inactive', // Default status
        createdAt: serializeTimestamp(data.createdAt as Timestamp | undefined),
        lastLogin: serializeTimestamp(data.lastLogin as Timestamp | undefined),
        phone: data.phoneNumber || data.phone,
        operatorCode: data.operatorCode,
        driverIdentifier: data.driverIdentifier,
        vehicleCategory: data.vehicleCategory,
        customId: data.customId,
      };
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      nextCursor = lastVisible.id;
    }

    return NextResponse.json({ users, nextCursor }, { status: 200 });

  } catch (error) {
    console.error('Error fetching platform users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch platform users', details: errorMessage }, { status: 500 });
  }
}

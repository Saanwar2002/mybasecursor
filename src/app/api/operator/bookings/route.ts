import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withOperatorAuth } from '@/lib/auth-middleware';
import { Timestamp, DocumentData, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { z } from 'zod';

// Helper to convert Firestore Timestamp to a serializable format (ISO string)
function serializeTimestamp(timestamp: Timestamp | undefined | null): string | null {
  if (!timestamp) return null;
  return timestamp.toDate().toISOString();
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  startAfter: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().optional().default('bookingTimestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  dateFrom: z.string().datetime({ message: "Invalid dateFrom format" }).optional(),
  dateTo: z.string().datetime({ message: "Invalid dateTo format" }).optional(),
  passengerName: z.string().optional(),
});


export const GET = withOperatorAuth(async (request, { user: operatorUser }) => {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  if (!operatorUser || !operatorUser.operatorCode) {
    return NextResponse.json({ message: 'Operator not authenticated or operator code is missing' }, { status: 401 });
  }
  const operatorCode = operatorUser.operatorCode;

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
    dateFrom,
    dateTo,
    passengerName,
  } = parsedQuery.data;

  try {
    let queryChain: Query<DocumentData> = db.collection('bookings')
        .where('originatingOperatorId', '==', operatorCode);

    if (status && status !== "all") {
      queryChain = queryChain.where('status', '==', status);
    }
    if (passengerName) {
      queryChain = queryChain.where('passengerName', '>=', passengerName)
                           .where('passengerName', '<=', passengerName + '\uf8ff');
    }
    if (dateFrom) {
      queryChain = queryChain.where('bookingTimestamp', '>=', Timestamp.fromDate(new Date(dateFrom)));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      queryChain = queryChain.where('bookingTimestamp', '<=', Timestamp.fromDate(toDate));
    }

    if (passengerName) {
        queryChain = queryChain.orderBy('passengerName', sortOrder);
    } else if (dateFrom || dateTo) {
        queryChain = queryChain.orderBy('bookingTimestamp', sortOrder);
    } else {
        queryChain = queryChain.orderBy(sortBy, sortOrder);
    }
    
    if (startAfterDocId) {
      const startAfterDoc = await db.collection('bookings').doc(startAfterDocId).get();
      if (startAfterDoc.exists) {
        queryChain = queryChain.startAfter(startAfterDoc);
      }
    }

    const finalQuery = queryChain.limit(limit);
    const querySnapshot = await finalQuery.get();

    const bookings = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: serializeTimestamp(data.scheduledPickupAt as Timestamp | undefined),
        updatedAt: serializeTimestamp(data.updatedAt as Timestamp | undefined),
        cancelledAt: serializeTimestamp(data.cancelledAt as Timestamp | undefined),
      };
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      nextCursor = querySnapshot.docs[querySnapshot.docs.length - 1].id;
    }

    return NextResponse.json({
      bookings,
      nextCursor,
    });

  } catch (error) {
    console.error("Error fetching operator bookings:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    if (error instanceof Error && 'code' in error && (error as any).code === 5) {
        return NextResponse.json({ 
            message: "Query requires a composite index. Check Firestore console.",
            details: errorMessage 
        }, { status: 500 });
    }
    return NextResponse.json({ message: `Error fetching bookings: ${errorMessage}` }, { status: 500 });
  }
});

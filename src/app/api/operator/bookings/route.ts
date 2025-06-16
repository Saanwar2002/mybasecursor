
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
  startAfter: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().optional().default('bookingTimestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  dateFrom: z.string().datetime({ message: "Invalid dateFrom format, expected ISO string" }).optional(),
  dateTo: z.string().datetime({ message: "Invalid dateTo format, expected ISO string" }).optional(),
  passengerName: z.string().optional(),
});

const PLATFORM_OPERATOR_CODE_FOR_ID = "OP001";
const PLATFORM_OPERATOR_ID_PREFIX = "001";

function getOperatorPrefix(operatorCode?: string | null): string {
  if (operatorCode && operatorCode.startsWith("OP") && operatorCode.length >= 5) {
    const numericPart = operatorCode.substring(2);
    if (/^\d{3,}$/.test(numericPart)) {
      return numericPart;
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
}

export async function GET(request: NextRequest) {
  // TODO: Implement authentication/authorization for operator role

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
    dateFrom,
    dateTo,
    passengerName,
  } = parsedQuery.data;

  try {
    const bookingsRef = collection(db, 'bookings');
    const queryConstraints: QueryConstraint[] = [];

    // Filtering
    if (status) {
      queryConstraints.push(where('status', '==', status));
    }
    if (passengerName) {
      queryConstraints.push(where('passengerName', '>=', passengerName));
      queryConstraints.push(where('passengerName', '<=', passengerName + '\uf8ff'));
    }
    if (dateFrom) {
      queryConstraints.push(where('bookingTimestamp', '>=', Timestamp.fromDate(new Date(dateFrom))));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      queryConstraints.push(where('bookingTimestamp', '<=', Timestamp.fromDate(toDate)));
    }

    if (passengerName && sortBy !== 'passengerName') {
        queryConstraints.push(orderBy('passengerName', sortOrder));
        if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder));
    } else if (dateFrom || dateTo) {
        if (sortBy !== 'bookingTimestamp') {
            queryConstraints.push(orderBy('bookingTimestamp', sortOrder));
            if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder));
        } else {
            queryConstraints.push(orderBy(sortBy, sortOrder));
        }
    } else if (sortBy) {
        queryConstraints.push(orderBy(sortBy, sortOrder));
    }


    // Pagination
    let lastDocSnapshot = null;
    if (startAfterDocId) {
      const startAfterDocRef = doc(db, 'bookings', startAfterDocId);
      lastDocSnapshot = await getDoc(startAfterDocRef);
      if (!lastDocSnapshot.exists()) {
        return NextResponse.json({ message: 'Pagination cursor not found.' }, { status: 404 });
      }
      queryConstraints.push(firestoreStartAfter(lastDocSnapshot));
    }

    queryConstraints.push(firestoreLimit(limit));

    const q = query(bookingsRef, ...queryConstraints) as Query<DocumentData>;
    const querySnapshot = await getDocs(q);

    const bookings = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      let displayBookingId = data.displayBookingId;
      const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
      if (!displayBookingId) {
        const prefix = getOperatorPrefix(rideOriginatingOperatorId);
        displayBookingId = `${prefix}/${doc.id}`;
      }

      return {
        id: doc.id,
        displayBookingId: displayBookingId,
        originatingOperatorId: rideOriginatingOperatorId,
        passengerId: data.passengerId,
        passengerName: data.passengerName,
        driverId: data.driverId,
        driverName: data.driverName,
        driverVehicleDetails: data.driverVehicleDetails,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        stops: data.stops,
        status: data.status,
        fareEstimate: data.fareEstimate,
        bookingTimestamp: serializeTimestamp(data.bookingTimestamp as Timestamp | undefined),
        scheduledPickupAt: data.scheduledPickupAt ? data.scheduledPickupAt : null,
        updatedAt: serializeTimestamp(data.updatedAt as Timestamp | undefined),
        cancelledAt: serializeTimestamp(data.cancelledAt as Timestamp | undefined),
        vehicleType: data.vehicleType,
        passengers: data.passengers,
        paymentMethod: data.paymentMethod,
        driverNotes: data.driverNotes,
        isPriorityPickup: data.isPriorityPickup,
        priorityFeeAmount: data.priorityFeeAmount,
        waitAndReturn: data.waitAndReturn,
        estimatedWaitTimeMinutes: data.estimatedWaitTimeMinutes,
      };
    });

    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      nextCursor = lastVisible.id;
    }

    return NextResponse.json({
      bookings,
      nextCursor,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching bookings for operator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch bookings', details: errorMessage }, { status: 500 });
  }
}

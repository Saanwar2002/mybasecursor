
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
      return numericPart.slice(0, 3); // Return first 3 digits of the numeric part
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
}

function generateNumericSuffix(): string {
  const timestampPart = Date.now().toString().slice(-4); // Last 4 digits of ms
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 random digits
  return `${timestampPart}${randomPart}`; // 6-digit numeric suffix
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
    if (status && status !== "all") { // Make sure "all" doesn't apply a filter
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
    } else if ((dateFrom || dateTo) && sortBy !== 'bookingTimestamp') {
        queryConstraints.push(orderBy('bookingTimestamp', sortOrder));
        if (sortBy) queryConstraints.push(orderBy(sortBy, sortOrder));
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

    const firestoreBookings = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      let displayBookingId = data.displayBookingId;
      const rideOriginatingOperatorId = data.originatingOperatorId || data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;
      
      if (!displayBookingId || (displayBookingId.includes('/') && displayBookingId.split('/')[1].length > 10 && !/^\d+$/.test(displayBookingId.split('/')[1]))) {
        const prefix = getOperatorPrefix(rideOriginatingOperatorId);
        const shortSuffix = doc.id.substring(0, 6).toUpperCase();
        displayBookingId = `${prefix}/${shortSuffix}`;
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

    // --- MOCK DATA INJECTION FOR TESTING ---
    const mockBookingsForTesting: any[] = [];
    if (!startAfterDocId) { // Only add mocks on the first page load for simplicity
        const now = Timestamp.now();
        const nowSerialized = serializeTimestamp(now);

        // Job 1 (Simple)
        mockBookingsForTesting.push({
            id: `mock_simple_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP001",
            passengerName: "Test Passenger Simple",
            pickupLocation: { address: "10 Downing Street, London", latitude: 51.503364, longitude: -0.127625 },
            dropoffLocation: { address: "Buckingham Palace, London", latitude: 51.501364, longitude: -0.141890 },
            status: 'pending_assignment',
            fareEstimate: 15.50,
            bookingTimestamp: nowSerialized,
            vehicleType: 'car', passengers: 1, paymentMethod: 'card'
        });

        // Job 2 (One Stop)
        mockBookingsForTesting.push({
            id: `mock_onestop_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP002")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP002",
            passengerName: "Test Passenger OneStop",
            pickupLocation: { address: "Tower of London, London", latitude: 51.508112, longitude: -0.075949 },
            stops: [{ address: "London Eye, London", latitude: 51.503324, longitude: -0.119543 }],
            dropoffLocation: { address: "Trafalgar Square, London", latitude: 51.508039, longitude: -0.128069 },
            status: 'pending_assignment',
            fareEstimate: 22.75,
            bookingTimestamp: nowSerialized,
            vehicleType: 'estate', passengers: 2, paymentMethod: 'cash'
        });
        
        // Job 3 (Priority)
        mockBookingsForTesting.push({
            id: `mock_priority_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP001",
            passengerName: "Test Passenger Priority",
            pickupLocation: { address: "The Shard, London", latitude: 51.504511, longitude: -0.086500 },
            dropoffLocation: { address: "Canary Wharf, London", latitude: 51.505446, longitude: -0.023533 },
            status: 'pending_assignment',
            fareEstimate: 18.00,
            isPriorityPickup: true,
            priorityFeeAmount: 3.00,
            bookingTimestamp: nowSerialized,
            vehicleType: 'car', passengers: 1, paymentMethod: 'card'
        });

        // Job 4 (Wait & Return)
        mockBookingsForTesting.push({
            id: `mock_waitreturn_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP001",
            passengerName: "Test Passenger W&R",
            pickupLocation: { address: "Harrods, London", latitude: 51.501055, longitude: -0.163226 },
            dropoffLocation: { address: "Natural History Museum, London", latitude: 51.496712, longitude: -0.176367 },
            status: 'pending_assignment',
            fareEstimate: 12.20, // One way base
            waitAndReturn: true,
            estimatedWaitTimeMinutes: 25,
            bookingTimestamp: nowSerialized,
            vehicleType: 'car', passengers: 3, paymentMethod: 'cash'
        });
    }
    const allBookings = [...mockBookingsForTesting, ...firestoreBookings];
    // --- END MOCK DATA INJECTION ---

    let nextCursor: string | null = null;
    if (firestoreBookings.length === limit && allBookings.length > mockBookingsForTesting.length) { // ensure we only paginate if Firestore had more
      const lastFirestoreBooking = firestoreBookings[firestoreBookings.length - 1];
      if(lastFirestoreBooking) nextCursor = lastFirestoreBooking.id;
    }


    return NextResponse.json({
      bookings: allBookings, // Return combined list
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


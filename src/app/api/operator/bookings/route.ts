
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
      return numericPart.slice(0, 3);
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
}

function generateNumericSuffix(): string {
  const timestampPart = Date.now().toString().slice(-4);
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${timestampPart}${randomPart}`;
}

const nowForMocks = Timestamp.now();
const nowSerializedForMocks = serializeTimestamp(nowForMocks);

const priorityMockBookingsForTesting: any[] = [
    {
        id: `mock_phone_1stop_${Date.now() + 1}`,
        displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
        originatingOperatorId: "OP001",
        passengerName: "Contactable Rider (Phone & Stop)",
        passengerPhone: "+447700900123",
        pickupLocation: { address: "Huddersfield Library, Princess Alexandra Walk, Huddersfield HD1 2SU", latitude: 53.6469, longitude: -1.7821 },
        stops: [{ address: "Kingsgate Shopping Centre, King Street, Huddersfield HD1 2QB", latitude: 53.6465, longitude: -1.7833 }],
        dropoffLocation: { address: "Huddersfield Train Station, St George's Square, Huddersfield HD1 1JB", latitude: 53.6483, longitude: -1.7805 },
        status: 'pending_assignment',
        fareEstimate: 19.80,
        bookingTimestamp: nowSerializedForMocks,
        vehicleType: 'estate', passengers: 1, paymentMethod: 'cash',
        driverNotes: "Please wait near the main entrance, I have a small suitcase."
    },
    {
        id: `mock_phone_2stops_${Date.now() + 2}`,
        displayBookingId: `${getOperatorPrefix("OP002")}/${generateNumericSuffix()}`,
        originatingOperatorId: "OP002",
        passengerName: "Multi-Stop Passenger (Phone & 2 Stops)",
        passengerPhone: "07700900456",
        pickupLocation: { address: "University of Huddersfield, Queensgate, Huddersfield HD1 3DH", latitude: 53.6438, longitude: -1.7787 },
        stops: [
            { address: "Greenhead Park (Play Area), Park Drive, Huddersfield HD1 4HS", latitude: 53.6501, longitude: -1.7969 },
            { address: "Lindley Village (Post Office), Lidget Street, Huddersfield HD3 3JB", latitude: 53.6580, longitude: -1.8280 }
        ],
        dropoffLocation: { address: "Beaumont Park, Huddersfield HD4 7AY", latitude: 53.6333, longitude: -1.8080 },
        status: 'pending_assignment',
        fareEstimate: 28.50,
        bookingTimestamp: nowSerializedForMocks,
        vehicleType: 'minibus_6', passengers: 4, paymentMethod: 'card'
    },
    {
        id: `mock_note_only_${Date.now() + 3}`,
        displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
        originatingOperatorId: "OP001",
        passengerName: "Specific Needs Rider (Note)",
        pickupLocation: { address: "John Smith's Stadium, Stadium Way, Huddersfield HD1 6PG", latitude: 53.6542, longitude: -1.7677 },
        dropoffLocation: { address: "Almondbury Village, Huddersfield HD5 8XE", latitude: 53.6391, longitude: -1.7542 },
        status: 'pending_assignment',
        fareEstimate: 16.25,
        bookingTimestamp: nowSerializedForMocks,
        vehicleType: 'disable_wheelchair_access', passengers: 1, paymentMethod: 'account',
        driverNotes: "Requires assistance with a foldable wheelchair. Please ensure boot space is clear. Thank you."
    }
];


export async function GET(request: NextRequest) {
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

    if (status && status !== "all") {
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
        passengerPhone: data.passengerPhone || data.customerPhoneNumber, // Include passengerPhone
        driverId: data.driverId,
        driverName: data.driverName,
        driverVehicleDetails: data.driverVehicleDetails,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        stops: data.stops || [], // Ensure stops is an array
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

    const generalMockBookingsForTesting: any[] = [];
    if (!startAfterDocId) { // Only add general mocks on the first page load
        generalMockBookingsForTesting.push({
            id: `mock_simple_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP001",
            passengerName: "Test Passenger Simple",
            pickupLocation: { address: "10 Downing Street, London", latitude: 51.503364, longitude: -0.127625 },
            dropoffLocation: { address: "Buckingham Palace, London", latitude: 51.501364, longitude: -0.141890 },
            status: 'pending_assignment',
            fareEstimate: 15.50,
            bookingTimestamp: nowSerializedForMocks,
            vehicleType: 'car', passengers: 1, paymentMethod: 'card'
        });
        generalMockBookingsForTesting.push({
            id: `mock_onestop_general_${Date.now()}`, // Unique ID from priority one
            displayBookingId: `${getOperatorPrefix("OP002")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP002",
            passengerName: "Test Passenger OneStop (General)",
            pickupLocation: { address: "Tower of London, London", latitude: 51.508112, longitude: -0.075949 },
            stops: [{ address: "London Eye, London", latitude: 51.503324, longitude: -0.119543 }],
            dropoffLocation: { address: "Trafalgar Square, London", latitude: 51.508039, longitude: -0.128069 },
            status: 'pending_assignment',
            fareEstimate: 22.75,
            bookingTimestamp: nowSerializedForMocks,
            vehicleType: 'estate', passengers: 2, paymentMethod: 'cash'
        });
        generalMockBookingsForTesting.push({
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
            bookingTimestamp: nowSerializedForMocks,
            vehicleType: 'car', passengers: 1, paymentMethod: 'card'
        });
        generalMockBookingsForTesting.push({
            id: `mock_waitreturn_${Date.now()}`,
            displayBookingId: `${getOperatorPrefix("OP001")}/${generateNumericSuffix()}`,
            originatingOperatorId: "OP001",
            passengerName: "Test Passenger W&R",
            pickupLocation: { address: "Harrods, London", latitude: 51.501055, longitude: -0.163226 },
            dropoffLocation: { address: "Natural History Museum, London", latitude: 51.496712, longitude: -0.176367 },
            status: 'pending_assignment',
            fareEstimate: 12.20,
            waitAndReturn: true,
            estimatedWaitTimeMinutes: 25,
            bookingTimestamp: nowSerializedForMocks,
            vehicleType: 'car', passengers: 3, paymentMethod: 'cash'
        });
    }
    
    const combinedBookings = [...priorityMockBookingsForTesting, ...generalMockBookingsForTesting, ...firestoreBookings];
    
    const uniqueBookingsMap = new Map();
    combinedBookings.forEach(booking => {
        if (!uniqueBookingsMap.has(booking.id)) {
            uniqueBookingsMap.set(booking.id, booking);
        }
    });
    const finalUniqueBookings = Array.from(uniqueBookingsMap.values());


    let nextCursor: string | null = null;
    if (querySnapshot.docs.length === limit) {
      const lastVisibleFirestoreDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      if (lastVisibleFirestoreDoc) {
        nextCursor = lastVisibleFirestoreDoc.id;
      }
    }

    return NextResponse.json({
      bookings: finalUniqueBookings.slice(0, limit), // Ensure we only return the requested limit of the combined list
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


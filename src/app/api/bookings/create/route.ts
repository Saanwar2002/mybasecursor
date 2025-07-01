import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface BookingPayload {
  passengerId: string;
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops: LocationPoint[];
  vehicleType: string;
  passengers: number;
  fareEstimate: number;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied: boolean;
  surgeMultiplier: number;
  stopSurchargeTotal: number;
  scheduledPickupAt?: string | null;
  customerPhoneNumber?: string;
  bookedByOperatorId?: string;
  driverNotes?: string;
  waitAndReturn?: boolean;
  estimatedWaitTimeMinutes?: number;
  promoCode?: string;
  paymentMethod: "card" | "cash" | "account";
  preferredOperatorId?: string;
}

function generateFourDigitPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

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

// Function to generate sequential booking ID for an operator
async function generateBookingId(operatorCode: string): Promise<string> {
  const counterRef = db.collection('counters').doc(`bookingId_${operatorCode}`);
  
  const result = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    if (!counterDoc.exists) {
      // Initialize counter if it doesn't exist
      transaction.set(counterRef, { currentId: 1 });
      return 1;
    }
    
    const currentId = counterDoc.data().currentId;
    transaction.update(counterRef, { currentId: currentId + 1 });
    return currentId + 1;
  });
  
  return `${operatorCode}/${result.toString().padStart(8, '0')}`;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Validate required fields
    if (!data.passengerId || !data.pickupLocation || !data.dropoffLocation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Add server-generated fields
    data.createdAt = Timestamp.now();
    data.status = "pending_assignment"; // or "active" if that's your logic
    data.bookingTimestamp = Timestamp.now();

    if (data.paymentMethod === "account") {
      data.ridePin = generateFourDigitPin();
    } else {
      data.ridePin = null;
    }

    data.originatingOperatorId = data.preferredOperatorId || PLATFORM_OPERATOR_CODE_FOR_ID;

    // Generate sequential display booking ID
    const displayBookingId = await generateBookingId(data.originatingOperatorId);
    data.displayBookingId = displayBookingId;

    // Find available drivers (status: 'Active') for the operator
    let assignedDriver = null;
    let driverQuery = db.collection('users')
      .where('role', '==', 'driver')
      .where('status', '==', 'Active');
    if (typeof data?.originatingOperatorId === 'string' && data.originatingOperatorId.length > 0) {
      driverQuery = driverQuery.where('operatorCode', '==', data.originatingOperatorId);
    }
    const availableDriversSnap = await driverQuery.get();
    if (!availableDriversSnap.empty) {
      // Pick the first available driver (or random, or closest if you add location logic)
      const driverDoc = availableDriversSnap.docs[0];
      assignedDriver = driverDoc.id;
      data.driverId = assignedDriver;
      data.status = "assigned";
    } else {
      // No drivers available, keep status as pending_assignment
      data.status = "pending_assignment";
    }

    // Write to Firestore
    const docRef = await db.collection('bookings').add(data);

    // Log for debugging
    console.log("Booking created:", docRef.id, "Display ID:", displayBookingId, data);

    // Return consistent response
    return NextResponse.json({ 
      success: true, 
      bookingId: docRef.id,
      displayBookingId: displayBookingId,
      assignedDriver: assignedDriver,
      message: assignedDriver ? "Ride assigned to driver." : "No drivers available. Your ride is queued."
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: 'Failed to create booking', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
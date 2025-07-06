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
const BOOKING_TIMEOUT_MINUTES = 30; // 30-minute timeout for queued bookings

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
    
    const currentId = counterDoc.data()?.currentId || 0;
    transaction.update(counterRef, { currentId: currentId + 1 });
    return currentId + 1;
  });
  
  return `${operatorCode}/${result.toString().padStart(8, '0')}`;
}

// Function to check operator's dispatch mode
async function getOperatorDispatchMode(operatorId: string): Promise<'auto' | 'manual'> {
  try {
    const operatorSettingsDoc = await db.collection('operatorSettings').doc(operatorId).get();
    if (operatorSettingsDoc.exists) {
      const settings = operatorSettingsDoc.data();
      if (settings && typeof settings.dispatchMode === 'string') {
        return settings.dispatchMode === 'manual' ? 'manual' : 'auto';
      }
    }
  } catch (error) {
    console.warn('Failed to fetch operator dispatch mode, defaulting to auto:', error);
  }
  return 'auto'; // Default to auto
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
    data.status = "pending_assignment"; // Default to pending_assignment
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

    // Check operator's dispatch mode
    const dispatchMode = await getOperatorDispatchMode(data.originatingOperatorId);
    
    let assignedDriver = null;
    let bookingStatus = "pending_assignment";
    let assignmentMethod = "queued";

    // Only attempt auto-assignment if dispatch mode is 'auto'
    if (dispatchMode === 'auto') {
      // Find available drivers (status: 'Active' and availability: 'online') for the operator
      let driverQuery = db.collection('drivers')
        .where('status', '==', 'Active')
        .where('availability', '==', 'online');
      
      if (typeof data?.originatingOperatorId === 'string' && data.originatingOperatorId.length > 0) {
        driverQuery = driverQuery.where('operatorCode', '==', data.originatingOperatorId);
      }
      
      const availableDriversSnap = await driverQuery.get();
      if (!availableDriversSnap.empty) {
        // Pick the first available driver (or random, or closest if you add location logic)
        const driverDoc = availableDriversSnap.docs[0];
        assignedDriver = driverDoc.id;
        data.driverId = assignedDriver;
        bookingStatus = "pending_offer";
        assignmentMethod = "auto_immediate";
      }
    } else {
      // Manual dispatch mode - always queue for manual assignment
      assignmentMethod = "manual_queued";
    }

    // Set final status and assignment details
    data.status = bookingStatus;
    data.assignmentMethod = assignmentMethod;
    data.dispatchMode = dispatchMode;
    
    // Add timeout information for queued bookings
    if (bookingStatus === "pending_assignment") {
      const timeoutAt = new Date();
      timeoutAt.setMinutes(timeoutAt.getMinutes() + BOOKING_TIMEOUT_MINUTES);
      data.timeoutAt = Timestamp.fromDate(timeoutAt);
      data.queuedAt = Timestamp.now();
    }

    // Write to Firestore
    const docRef = await db.collection('bookings').add(data);

    // Always create a rideOffers document if a driver is assigned, regardless of dispatch mode
    if (assignedDriver) {
      try {
        console.log("Attempting to create rideOffers document for driver:", assignedDriver);
        await db.collection('rideOffers').doc(docRef.id).set({
          driverId: assignedDriver,
          bookingId: docRef.id,
          status: 'pending',
          createdAt: Timestamp.now(),
          offerDetails: {
            pickupLocation: data.pickupLocation,
            dropoffLocation: data.dropoffLocation,
            fareEstimate: data.fareEstimate,
            vehicleType: data.vehicleType,
            passengerName: data.passengerName,
            // Add more fields as needed
          }
        });
        console.log("rideOffers document created successfully.");
      } catch (err) {
        console.error("Failed to create rideOffers document:", err);
      }
    }

    // Log for debugging
    console.log("Booking created:", docRef.id, "Display ID:", displayBookingId, {
      status: bookingStatus,
      assignmentMethod,
      dispatchMode,
      assignedDriver,
      timeoutAt: data.timeoutAt
    });

    // Return consistent response with enhanced information
    return NextResponse.json({ 
      success: true, 
      bookingId: docRef.id,
      displayBookingId: displayBookingId,
      assignedDriver: assignedDriver,
      status: bookingStatus,
      assignmentMethod,
      dispatchMode,
      timeoutAt: data.timeoutAt,
      message: assignedDriver 
        ? "Ride assigned to driver." 
        : dispatchMode === 'manual'
        ? "Booking queued for manual assignment by operator."
        : "No drivers available. Your ride is queued and will be assigned as soon as a driver becomes available."
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: 'Failed to create booking', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
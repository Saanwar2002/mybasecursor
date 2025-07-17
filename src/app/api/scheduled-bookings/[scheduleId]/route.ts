// src/app/api/scheduled-bookings/[scheduleId]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface LocationPointPayload {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

const daysOfWeekEnum = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const scheduledRideUpdateSchema = z.object({
  passengerId: z.string(), // For verification
  label: z.string().min(3).max(50).optional(),
  pickupLocation: z.object({
    address: z.string().min(3),
    latitude: z.number(),
    longitude: z.number(),
    doorOrFlat: z.string().max(50).optional(),
  }).optional(),
  dropoffLocation: z.object({
    address: z.string().min(3),
    latitude: z.number(),
    longitude: z.number(),
    doorOrFlat: z.string().max(50).optional(),
  }).optional(),
  stops: z.array(z.object({
    address: z.string().min(3),
    latitude: z.number(),
    longitude: z.number(),
    doorOrFlat: z.string().max(50).optional(),
  })).optional(),
  vehicleType: z.enum([
    "car", "estate", "minibus_6", "minibus_8",
    "pet_friendly_car", "disable_wheelchair_access",
    "minibus_6_pet_friendly", "minibus_8_pet_friendly"
  ]).optional(),
  passengers: z.coerce.number().min(1).max(10).optional(),
  daysOfWeek: z.array(daysOfWeekEnum).min(1).optional(),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  isReturnJourneyScheduled: z.boolean().optional(),
  returnPickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  isWaitAndReturnOutbound: z.boolean().optional(),
  estimatedWaitTimeMinutesOutbound: z.number().int().min(0).optional().nullable(),
  driverNotes: z.string().max(200).optional().nullable(),
  paymentMethod: z.enum(["card", "cash"]).optional(),
  isActive: z.boolean().optional(),
  // nextRunDate will be recalculated by a backend job or manually by user via pause/resume
  estimatedFareOneWay: z.number().optional().nullable(),
  estimatedFareReturn: z.number().optional().nullable(),
}).refine(data => {
  if (data.isReturnJourneyScheduled === true && (!data.returnPickupTime || !data.returnPickupTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/))) {
    return false; // Invalid if return is scheduled but time is missing/invalid
  }
  return true;
}, {
  message: "Return pickup time is required and must be in HH:MM format if return journey is scheduled.",
  path: ["returnPickupTime"],
}).refine(data => {
  if (data.isWaitAndReturnOutbound === true && (data.estimatedWaitTimeMinutesOutbound === undefined || data.estimatedWaitTimeMinutesOutbound === null || data.estimatedWaitTimeMinutesOutbound < 0)) {
    return false; // Invalid if wait and return is true but wait time is missing/invalid
  }
  return true;
}, {
  message: "Estimated wait time (outbound) is required for Wait & Return.",
  path: ["estimatedWaitTimeMinutesOutbound"],
});

interface RouteContext {
  params: {
    scheduleId: string;
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { scheduleId } = context.params;
  // TODO: Implement user authentication and get authenticatedUserId
  // const authenticatedUserId = await getUserIdFromRequest(request);

  try {
    const payload = await request.json();
    console.log(`API PUT /scheduled-bookings/${scheduleId}: Received raw payload`, JSON.stringify(payload, null, 2));
    
    const parsedPayload = scheduledRideUpdateSchema.safeParse(payload);

    if (!parsedPayload.success) {
      console.error("API PUT validation error:", parsedPayload.error.format());
      return NextResponse.json({ message: 'Invalid update payload.', errors: parsedPayload.error.format() }, { status: 400 });
    }
    
    const updateData = parsedPayload.data;
    console.log(`API PUT /scheduled-bookings/${scheduleId}: Validated updateData`, JSON.stringify(updateData, null, 2));

    const scheduleRef = db.collection('scheduledBookings').doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      return NextResponse.json({ message: 'Scheduled booking not found.' }, { status: 404 });
    }

    const existingScheduleData = scheduleSnap.data();
    // Verify ownership using passengerId from payload (replace with authenticatedUserId in real app)
    if (updateData.passengerId !== existingScheduleData.passengerId) {
      return NextResponse.json({ message: 'Unauthorized to update this schedule.' }, { status: 403 });
    }

    const finalUpdatePayload: Partial<any> = { ...updateData };
    delete finalUpdatePayload.passengerId; // Don't update passengerId itself
    finalUpdatePayload.updatedAt = Timestamp.fromDate(new Date());

    // Handle nullable fields explicitly to allow setting them to null or removing them
    const nullableFields: Array<keyof typeof finalUpdatePayload> = ['returnPickupTime', 'estimatedWaitTimeMinutesOutbound', 'driverNotes', 'estimatedFareOneWay', 'estimatedFareReturn'];
    nullableFields.forEach(field => {
        if (finalUpdatePayload[field] === null) {
            finalUpdatePayload[field] = null; // Firestore accepts null
        } else if (finalUpdatePayload[field] === undefined && existingScheduleData[field] !== undefined) {
            // If undefined in payload but exists in DB, means don't change it. If explicitly want to remove, send null.
        }
    });
    if(updateData.isReturnJourneyScheduled === false && finalUpdatePayload.returnPickupTime === undefined) {
        finalUpdatePayload.returnPickupTime = null;
    }
    if(updateData.isWaitAndReturnOutbound === false && finalUpdatePayload.estimatedWaitTimeMinutesOutbound === undefined) {
        finalUpdatePayload.estimatedWaitTimeMinutesOutbound = null;
    }

    console.log(`API PUT /scheduled-bookings/${scheduleId}: Updating Firestore with`, finalUpdatePayload);
    await scheduleRef.update(finalUpdatePayload);
    
    const updatedDocSnap = await scheduleRef.get(); 

    return NextResponse.json({ 
        message: 'Scheduled booking updated successfully.', 
        data: { 
            id: updatedDocSnap.id, 
            ...updatedDocSnap.data(),
            createdAt: updatedDocSnap.data()?.createdAt?.toDate().toISOString(),
            updatedAt: updatedDocSnap.data()?.updatedAt?.toDate().toISOString(),
        } 
    }, { status: 200 });

  } catch (error) {
    console.error(`Error updating scheduled booking ${scheduleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update scheduled booking', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { scheduleId } = context.params;
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get('passengerId'); 

  if (!passengerId) { 
     return NextResponse.json({ message: 'passengerId query parameter is required for verification.' }, { status: 400 });
  }

  console.log(`API DELETE /scheduled-bookings/${scheduleId}: Request received for passenger ${passengerId}`);
  try {
    const scheduleRef = db.collection('scheduledBookings').doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      return NextResponse.json({ message: 'Scheduled booking not found.' }, { status: 404 });
    }
    const scheduleData = scheduleSnap.data();
    if (scheduleData?.passengerId !== passengerId) { 
      console.warn(`API DELETE /scheduled-bookings/${scheduleId}: Unauthorized attempt by passenger ${passengerId}. Owner is ${scheduleData.passengerId}.`);
      return NextResponse.json({ message: 'Unauthorized to delete this schedule.' }, { status: 403 });
    }
    await scheduleRef.delete();
    console.log(`API DELETE /scheduled-bookings/${scheduleId}: Successfully deleted.`);
    
    return NextResponse.json({ message: 'Scheduled booking deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting scheduled booking ${scheduleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to delete scheduled booking', details: errorMessage }, { status: 500 });
  }
}

// GET specific schedule (for the edit page)
export async function GET(request: NextRequest, context: RouteContext) {
  const { scheduleId } = context.params;
  // TODO: Add passengerId verification if needed, or rely on Firestore rules
  // const { searchParams } = new URL(request.url);
  // const passengerId = searchParams.get('passengerId');
  
  console.log(`API GET /scheduled-bookings/${scheduleId}: Request received.`);
  try {
    const scheduleRef = db.collection('scheduledBookings').doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      return NextResponse.json({ message: `Scheduled booking with ID ${scheduleId} not found.` }, { status: 404 });
    }
    
    const data = scheduleSnap.data();
    // TODO: Verify ownership if passengerId is available and critical for this GET
    // if (passengerId && data.passengerId !== passengerId) {
    //   return NextResponse.json({ message: 'Unauthorized to view this schedule.' }, { status: 403 });
    // }

    const responseData = {
        id: scheduleSnap.id,
        ...data,
        createdAt: data?.createdAt?.toDate().toISOString(),
        updatedAt: data?.updatedAt?.toDate().toISOString(),
        nextRunDate: data?.nextRunDate instanceof Timestamp 
            ? data.nextRunDate.toDate().toISOString().split('T')[0] 
            : typeof data?.nextRunDate === 'string' ? data.nextRunDate : undefined,
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error(`Error fetching scheduled booking ${scheduleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: `Failed to fetch scheduled booking ${scheduleId}`, details: errorMessage }, { status: 500 });
  }
}

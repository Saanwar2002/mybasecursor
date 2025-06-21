import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { calculateFare, type FareCalculationParams, type VehicleType } from '@/lib/fare-calculator';

interface LocationPoint {
    address: string;
    latitude: number;
    longitude: number;
}

interface UpdateDetailsPayload {
  rideId: string;
  passengerId: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  driverNotes?: string;
}

// NOTE: A full implementation would require re-geocoding addresses
// and recalculating the fare estimate. For now, this is a simplified version.

export async function POST(request: NextRequest) {
  try {
    const payload: UpdateDetailsPayload = await request.json();
    const { rideId, passengerId, pickupLocation, dropoffLocation, driverNotes } = payload;

    if (!rideId || !passengerId || !pickupLocation || !dropoffLocation) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }
    
    if (!db) {
      return NextResponse.json({ message: 'Database connection error.' }, { status: 500 });
    }

    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);

    if (!rideSnap.exists()) {
      return NextResponse.json({ message: 'Ride not found.' }, { status: 404 });
    }

    const rideData = rideSnap.data();

    if (rideData.passengerId !== passengerId) {
      return NextResponse.json({ message: 'You are not authorized to edit this ride.' }, { status: 403 });
    }

    if (rideData.status !== 'searching') {
        return NextResponse.json({ message: `Cannot edit a ride that is already "${rideData.status.replace(/_/g, ' ')}".` }, { status: 409 });
    }
    
    const fareParams: FareCalculationParams = {
      pickupCoords: { lat: pickupLocation.latitude, lng: pickupLocation.longitude },
      dropoffCoords: { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude },
      // The current edit form doesn't support changing stops, so we pass the existing ones.
      stops: rideData.stops?.map((s: any) => ({ lat: s.latitude, lng: s.longitude })) || [],
      vehicleType: rideData.vehicleType as VehicleType,
      passengers: rideData.passengers,
      isWaitAndReturn: rideData.waitAndReturn,
      estimatedWaitTimeMinutes: rideData.estimatedWaitTimeMinutes,
      isPriorityPickup: rideData.isPriorityPickup,
      priorityFeeAmount: rideData.priorityFeeAmount,
      isSurgeApplied: rideData.isSurgeApplied,
    };
    
    const { fareEstimate, distance, duration, surgeMultiplier } = await calculateFare(fareParams);

    const updateData: any = {
      pickupLocation: pickupLocation,
      dropoffLocation: dropoffLocation,
      driverNotes: driverNotes || rideData.driverNotes || "",
      fareEstimate: fareEstimate,
      distance: distance,
      duration: duration,
      surgeMultiplier: surgeMultiplier,
      // We also need to update the fare in the top-level booking data
      fare: fareEstimate
    };

    await updateDoc(rideRef, updateData);

    return NextResponse.json({ message: 'Ride details updated successfully.', newFare: fareEstimate }, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/bookings/update-details:', error);
    const message = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ message: 'Failed to update ride details.', error: message }, { status: 500 });
  }
}

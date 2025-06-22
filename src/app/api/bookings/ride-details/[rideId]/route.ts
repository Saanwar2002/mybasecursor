import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';

// This endpoint can be accessed by the passenger of the ride, or an admin/operator.
export const GET = withAuth(async (req, { params, user }) => {
  const db = getDb();
  const { rideId } = params as { rideId: string };

  if (!rideId) {
    return NextResponse.json({ message: 'Ride ID is required.' }, { status: 400 });
  }

  try {
    const rideRef = db.collection('bookings').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return NextResponse.json({ message: 'Ride not found.' }, { status: 404 });
    }

    const rideData = rideDoc.data();
    
    // Security Check: Ensure the person requesting is the passenger or an admin/operator
    const isPassenger = rideData?.passengerId === user.uid;
    const isAdminOrOperator = user.role === 'admin' || user.role === 'operator';

    if (!isPassenger && !isAdminOrOperator) {
        return NextResponse.json({ message: 'Forbidden: You do not have permission to view this ride.' }, { status: 403 });
    }

    // Fetch driver details if they exist
    let driverName = "N/A";
    let driverAvatar = null;
    let vehicleModel = "N/A";
    let vehicleReg = "N/A";

    if (rideData?.driverId) {
        const driverRef = db.collection('users').doc(rideData.driverId);
        const driverDoc = await driverRef.get();
        if (driverDoc.exists) {
            const driverData = driverDoc.data();
            driverName = driverData?.name || "N/A";
            driverAvatar = driverData?.avatarUrl || null;
            vehicleModel = driverData?.vehicleMakeModel || "N/A";
            vehicleReg = driverData?.vehicleRegistration || "N/A";
        }
    }
    
    // We can expand this with more details as needed
    const rideSummary = {
      id: rideDoc.id,
      driverName,
      driverAvatar,
      vehicleModel,
      vehicleReg,
      pickupLocation: rideData?.pickupLocation,
      dropoffLocation: rideData?.dropoffLocation,
      finalFare: rideData?.finalCalculatedFare || rideData?.fare,
      paymentMethod: rideData?.paymentMethod,
      fareProposal: rideData?.fareProposal || null
    };

    return NextResponse.json({ ride: rideSummary }, { status: 200 });

  } catch (error) {
    console.error('Error fetching ride details:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}); 
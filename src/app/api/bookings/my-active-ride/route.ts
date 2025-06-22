import { getAuth, getDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { DocumentData, QuerySnapshot } from 'firebase-admin/firestore';

const auth = getAuth();
const firestore = getDb();

const ACTIVE_RIDE_STATUSES = ['searching', 'pending', 'accepted', 'en_route_to_pickup', 'at_pickup', 'in_progress'];

async function getActiveRide(uid: string) {
    const rideQuery = firestore.collection('bookings')
        .where('passengerId', '==', uid)
        .where('status', 'in', ACTIVE_RIDE_STATUSES)
        .orderBy('bookingTimestamp', 'desc')
        .limit(1);

    const snapshot = await rideQuery.get();

    if (snapshot.empty) {
        return null;
    }

    const rideDoc = snapshot.docs[0];
    const rideData = rideDoc.data();

    // Fetch driver details if available
    let driverData = null;
    if (rideData.driverId) {
        const driverDoc = await firestore.collection('users').doc(rideData.driverId).get();
        if(driverDoc.exists) {
            const d = driverDoc.data();
            if (d) {
                driverData = {
                    name: d.name || 'N/A',
                    avatar: d.avatarUrl || null,
                    phone: d.phoneNumber || null,
                    vehicleMakeModel: d.vehicleMakeModel || 'N/A',
                    vehicleRegistration: d.vehicleRegistration || 'N/A',
                    rating: d.rating || 4.8 // Mock rating if not present
                };
            }
        }
    }

    return {
        id: rideDoc.id,
        ...rideData,
        bookingTimestamp: rideData.bookingTimestamp.toDate().toISOString(),
        driverName: driverData?.name || 'Finding Driver...',
        driverAvatar: driverData?.avatar,
        driverPhone: driverData?.phone,
        vehicleMakeModel: driverData?.vehicleMakeModel,
        vehicleRegistration: driverData?.vehicleRegistration,
        driverRating: driverData?.rating,
        driverCurrentLocation: rideData.driverCurrentLocation || null, // Ensure this field exists or is handled
    };
}

export async function GET(req: NextRequest) {
    const idToken = req.headers.get('authorization')?.split('Bearer ')[1];

    if (!idToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // This is a long-polling endpoint. It holds the connection open until there's an update or it times out.
        
        const initialRide = await getActiveRide(uid);
        
        // This promise resolves after 25 seconds, acting as a timeout for the long poll.
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timeout: true, ride: initialRide }), 25000));

        const rideWatcherPromise = new Promise(resolve => {
            const rideQuery = firestore.collection('bookings')
                .where('passengerId', '==', uid)
                .where('status', 'in', ACTIVE_RIDE_STATUSES)
                .orderBy('bookingTimestamp', 'desc')
                .limit(1);
            
            const unsubscribe = rideQuery.onSnapshot((snapshot: QuerySnapshot<DocumentData>) => {
                if (!snapshot.empty) {
                    const newRideDoc = snapshot.docs[0];
                    const newRideData = newRideDoc.data();
                    
                    // We need to fetch driver details for the new ride data as well
                    getActiveRide(uid).then(fullRideData => {
                        // Resolve only if there's a meaningful change from the initial state
                        if (JSON.stringify(fullRideData) !== JSON.stringify(initialRide)) {
                            unsubscribe();
                            resolve({ timeout: false, ride: fullRideData });
                        }
                    });

                } else if (initialRide) { // Ride existed but now it's gone (completed/cancelled)
                    unsubscribe();
                    resolve({ timeout: false, ride: null });
                }
            });

            // Clean up the listener if the client aborts the request
            req.signal.onabort = () => {
                unsubscribe();
                resolve({ timeout: true, ride: initialRide }); // Resolve with old data on abort
            };
        });
        
        // Wait for either the watcher to find a change or the timeout
        const result: any = await Promise.race([rideWatcherPromise, timeoutPromise]);
        
        if (result.ride) {
            return NextResponse.json(result.ride);
        } else {
             return NextResponse.json({ message: 'No active ride found' }, { status: 404 });
        }

    } catch (error) {
        console.error('Error fetching active ride:', error);
        if (error instanceof Error && (error.message.includes('token') || error.message.includes('expired'))) {
            return NextResponse.json({ message: 'Authentication error. Please log in again.' }, { status: 401 });
        }
         if (error instanceof Error && 'code' in error && (error as any).code === 9) { // Firestore index required
            return NextResponse.json({ message: "Query requires a composite index. Check Firebase console.", details: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

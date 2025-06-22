import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, { user }) => {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const rideId = searchParams.get('rideId');

  if (!rideId) {
    return NextResponse.json({ message: 'Ride ID is required.' }, { status: 400 });
  }

  try {
    // First, verify the user has access to this ride
    const rideRef = db.collection('bookings').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return NextResponse.json({ message: 'Ride not found.' }, { status: 404 });
    }

    const rideData = rideDoc.data();
    const isPassenger = rideData?.passengerId === user.uid;
    const isDriver = rideData?.driverId === user.uid;
    const isAdminOrOperator = user.role === 'admin' || user.role === 'operator';

    if (!isPassenger && !isDriver && !isAdminOrOperator) {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to view this chat.' }, { status: 403 });
    }

    // Fetch messages
    const messagesRef = db.collection('chats').doc(rideId).collection('messages');
    const snapshot = await messagesRef.orderBy('timestamp', 'asc').get();

    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        sender: data.senderId === user.uid ? 'user' : 'other',
        text: data.text,
        timestamp: data.timestamp?.toDate?.()?.toLocaleTimeString() || new Date().toLocaleTimeString(),
      };
    });

    return NextResponse.json({ messages }, { status: 200 });

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}); 
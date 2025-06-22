import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';

export const POST = withAuth(async (req, { user }) => {
  const db = getDb();
  
  try {
    const { rideId, text } = await req.json();

    if (!rideId || !text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ message: 'Ride ID and message text are required.' }, { status: 400 });
    }

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
      return NextResponse.json({ message: 'Forbidden: You do not have permission to send messages in this chat.' }, { status: 403 });
    }

    // Check if ride is in a state where chat is allowed
    const allowedStatuses = ['accepted', 'en_route_to_pickup', 'at_pickup', 'in_progress'];
    if (!allowedStatuses.includes(rideData?.status)) {
      return NextResponse.json({ message: 'Chat is not available for this ride status.' }, { status: 400 });
    }

    // Create the message
    const messageData = {
      senderId: user.uid,
      senderName: user.name || 'Unknown',
      text: text.trim(),
      timestamp: new Date(),
    };

    const messagesRef = db.collection('chats').doc(rideId).collection('messages');
    const messageDoc = await messagesRef.add(messageData);

    return NextResponse.json({ 
      message: 'Message sent successfully',
      messageId: messageDoc.id 
    }, { status: 200 });

  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}); 
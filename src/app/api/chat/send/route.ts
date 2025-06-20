import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
  }

  try {
    const { rideId, senderId, text } = await request.json();

    if (!rideId || !senderId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rideMessagesRef = collection(db, 'chats', rideId, 'messages');

    await addDoc(rideMessagesRef, {
      senderId,
      text,
      timestamp: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
} 
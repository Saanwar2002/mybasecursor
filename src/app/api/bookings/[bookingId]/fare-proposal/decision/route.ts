import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request: NextRequest, { params }: { params: { bookingId: string } }) {
  const { bookingId } = params;
  if (!db) {
    return NextResponse.json({ error: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
  }
  try {
    const { decision, decisionBy } = await request.json(); // decision: 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision) || !decisionBy) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const data = bookingSnap.data();
    if (!data.fareProposal) {
      return NextResponse.json({ error: 'No fare proposal found' }, { status: 400 });
    }
    await updateDoc(bookingRef, {
      fareProposal: {
        ...data.fareProposal,
        status: decision,
        decisionBy,
        decisionAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update fare proposal decision' }, { status: 500 });
  }
} 
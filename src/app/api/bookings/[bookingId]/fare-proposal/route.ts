import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request: NextRequest, { params }: { params: { bookingId: string } }) {
  const { bookingId } = params;
  if (!db) {
    return NextResponse.json({ error: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
  }
  try {
    const { proposedAmount, reason, proposedBy } = await request.json();
    if (typeof proposedAmount !== 'number' || !reason || !proposedBy) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      fareProposal: {
        proposedAmount,
        reason,
        status: 'pending',
        proposedBy,
        createdAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to submit fare proposal' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { bookingId: string } }) {
  const { bookingId } = params;
  if (!db) {
    return NextResponse.json({ error: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
  }
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const data = bookingSnap.data();
    return NextResponse.json({ fareProposal: data.fareProposal || null });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch fare proposal' }, { status: 500 });
  }
} 
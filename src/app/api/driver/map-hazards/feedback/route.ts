
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, increment } from 'firebase/firestore'; // Added increment
import { z } from 'zod';

const feedbackSchema = z.object({
  hazardId: z.string().min(1),
  driverId: z.string().min(1),
  isStillPresent: z.boolean(),
  feedbackTimestamp: z.string().datetime(), // Expect ISO string
});

const NEGATION_THRESHOLD = 2; // Number of "No" votes to clear a hazard

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsedPayload = feedbackSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid input data.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const { hazardId, driverId, isStillPresent, feedbackTimestamp } = parsedPayload.data;

    // TODO: Verify driverId belongs to an authenticated user

    const hazardRef = doc(db, 'mapHazards', hazardId);
    const hazardSnap = await getDoc(hazardRef);

    if (!hazardSnap.exists()) {
      return NextResponse.json({ message: 'Hazard not found.' }, { status: 404 });
    }

    const hazardData = hazardSnap.data();
    const updates: any = {};

    if (isStillPresent) {
      updates.confirmations = increment(1);
      updates.lastConfirmedAt = Timestamp.fromDate(new Date(feedbackTimestamp));
      // Optionally reset negations if a hazard is confirmed again after some negations
      // updates.negations = 0; 
    } else {
      updates.negations = increment(1);
      updates.lastNegatedAt = Timestamp.fromDate(new Date(feedbackTimestamp));

      const currentNegations = (hazardData.negations || 0) + 1; // Calculate what the new negation count will be
      if (currentNegations >= NEGATION_THRESHOLD) {
        updates.status = 'cleared'; // Or 'negated'
        console.log(`Hazard ${hazardId} met negation threshold (${currentNegations}/${NEGATION_THRESHOLD}). Setting status to 'cleared'.`);
      }
    }

    updates.updatedAt = Timestamp.now(); // Always update the general updatedAt field

    await updateDoc(hazardRef, updates);

    return NextResponse.json({ message: 'Hazard feedback recorded successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Error processing hazard feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to process hazard feedback', details: errorMessage }, { status: 500 });
  }
}

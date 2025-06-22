import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const feedbackSchema = z.object({
  submitterId: z.string().min(1),
  submitterName: z.string().min(1),
  submitterEmail: z.string().email().optional(),
  submitterRole: z.enum(['passenger', 'driver', 'operator', 'admin']),
  category: z.string().min(1),
  details: z.string().min(10, { message: "Details must be at least 10 characters."}),
  rideId: z.string().optional().nullable(),
  rating: z.number().min(1).max(5).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const db = getDb();
  try {
    const payload = await request.json();
    const parsedPayload = feedbackSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid feedback data.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const { 
        submitterId, 
        submitterName,
        submitterEmail,
        submitterRole, 
        category, 
        details,
        rideId,
        rating
    } = parsedPayload.data;

    const newFeedback = {
      submitterId,
      submitterName,
      submitterEmail: submitterEmail || null,
      submitterRole,
      category,
      details,
      rideId: rideId || null,
      rating: rating || null,
      status: 'New', // Default status for new feedback
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('userFeedback').add(newFeedback);
    
    return NextResponse.json({ message: 'Feedback submitted successfully.', feedbackId: docRef.id }, { status: 201 });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to submit feedback', details: errorMessage }, { status: 500 });
  }
}

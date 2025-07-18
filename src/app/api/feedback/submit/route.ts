
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

const feedbackSchema = z.object({
  submitterId: z.string().min(1),
  submitterName: z.string().min(1),
  submitterEmail: z.string().email().optional(),
  submitterRole: z.enum(['passenger', 'driver', 'operator', 'admin']),
  category: z.string().min(1),
  details: z.string().min(10, { message: "Details must be at least 10 characters."}),
  rideId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
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
        rideId 
    } = parsedPayload.data;

    const newFeedback = {
      submitterId,
      submitterName,
      submitterEmail: submitterEmail || null,
      submitterRole,
      category,
      details,
      rideId: rideId || null,
      status: 'New', // Default status for new feedback
      submittedAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    // For this mock, we'll just log it. In a real app, save to Firestore:
    // const docRef = await addDoc(collection(db, 'userFeedback'), newFeedback);
    console.log("Mock Feedback Submitted:", JSON.stringify(newFeedback, null, 2));
    // console.log("Mock Feedback would be saved with ID:", docRef.id);

    return NextResponse.json({ message: 'Feedback submitted successfully (mock).', feedbackId: `mock-${Date.now()}` }, { status: 201 });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to submit feedback', details: errorMessage }, { status: 500 });
  }
}

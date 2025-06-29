import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function POST(req: Request) {
  try {
    const data = await req.json();
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('userFeedback').add(data);
    return NextResponse.json({ message: 'Feedback submitted successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit feedback', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

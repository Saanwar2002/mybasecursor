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
    const docRef = await db.collection('mapHazardFeedback').add(data);
    return NextResponse.json({ message: 'Map hazard feedback submitted successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit map hazard feedback', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

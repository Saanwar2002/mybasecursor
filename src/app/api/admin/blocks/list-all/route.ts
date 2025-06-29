import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET() {
  try {
    const blocksRef = db.collection('userBlocks');
    const snapshot = await blocksRef.get();
    const blocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ blocks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user blocks', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}


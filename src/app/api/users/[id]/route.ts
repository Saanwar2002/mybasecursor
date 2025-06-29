import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
  }
  let updates;
  try {
    updates = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }
  try {
    const userRef = db.collection('users').doc(userId);
    await userRef.update(updates);
    return NextResponse.json({ message: 'User updated successfully.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to update user.' }, { status: 500 });
  }
}
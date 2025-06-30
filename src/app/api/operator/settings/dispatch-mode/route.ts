import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get('operatorId');
    if (!operatorId) {
      return NextResponse.json({ error: 'Missing operatorId' }, { status: 400 });
    }
    const docRef = db.collection('operatorSettings').doc(operatorId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Operator settings not found' }, { status: 404 });
    }
    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operator settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get('operatorId');
    if (!operatorId) {
      return NextResponse.json({ error: 'Missing operatorId' }, { status: 400 });
    }
    const updates = await req.json();
    const docRef = db.collection('operatorSettings').doc(operatorId);
    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    const updatedSettings = updatedDoc.data();

    return NextResponse.json({ 
      message: 'Operator settings updated successfully',
      settings: updatedSettings 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update operator settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

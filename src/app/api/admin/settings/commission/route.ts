import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface CommissionSettings {
  directDriverRate?: number; // Stored as a decimal, e.g., 0.15 for 15%
  operatorAffiliatedDriverRate?: number; // Stored as a decimal
  lastUpdated?: Timestamp;
}

// GET handler to fetch current commission rates
export async function GET(req: Request) {
  try {
    const docRef = db.collection('companySettings').doc('commission');
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Commission settings not found' }, { status: 404 });
    }
    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch commission settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST handler to update one or both commission rates
export async function PATCH(req: Request) {
  try {
    const updates = await req.json();
    const docRef = db.collection('companySettings').doc('commission');
    await docRef.update({
      ...updates,
      lastUpdated: Timestamp.now(),
    });
    const updatedDoc = await docRef.get();
    return NextResponse.json({
      message: 'Commission settings updated successfully',
      settings: updatedDoc.data(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update commission settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

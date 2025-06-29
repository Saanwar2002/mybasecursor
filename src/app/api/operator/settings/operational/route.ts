import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface OperationalSettings {
  enableSurgePricing: boolean;
  operatorSurgePercentage?: number; // Stored as a whole number, e.g., 20 for 20%
  maxAutoAcceptWaitTimeMinutes?: number; // e.g., 30 for 30 minutes, 0 for no limit
  lastUpdated?: Timestamp;
}

// Using the same document for simplicity, but fields are expanded.
const settingsDocRef = db.collection('companySettings').doc('pricing'); 

const operationalSettingsResponseSchema = z.object({
  enableSurgePricing: z.boolean().default(false),
  operatorSurgePercentage: z.number().min(0).max(500).optional().default(0),
  maxAutoAcceptWaitTimeMinutes: z.number().min(0).optional().default(30), // Default to 30 mins
});

const operationalSettingsUpdateSchema = z.object({
  enableSurgePricing: z.boolean().optional(),
  operatorSurgePercentage: z.number().min(0).max(500).optional(),
  maxAutoAcceptWaitTimeMinutes: z.number().min(0).optional(), // 0 can mean "no limit"
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one setting must be provided.",
});

// GET handler to fetch current operational settings
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

// POST handler to update operational settings
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get('operatorId');
    if (!operatorId) {
      return NextResponse.json({ error: 'Missing operatorId' }, { status: 400 });
    }
    const updates = await req.json();
    const docRef = db.collection('operatorSettings').doc(operatorId);
    await docRef.update(updates);
    return NextResponse.json({ message: 'Operator settings updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update operator settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

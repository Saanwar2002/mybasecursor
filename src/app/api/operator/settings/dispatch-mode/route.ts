import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { withOperatorAuth } from '@/lib/auth-middleware';

interface DispatchSettings {
  dispatchMode: 'auto' | 'manual';
  lastUpdated?: Timestamp;
}

// TODO: In a real app, this would be dynamic per operator (e.g., `operatorSettings/${operatorId}/dispatchMode`)
const dispatchModeDocRef = db ? doc(db, 'operatorSettings', 'dispatchMode') : null;

const dispatchModeSchema = z.enum(['auto', 'manual']);

// GET handler to fetch current dispatch mode
export const GET = withOperatorAuth(async (req) => {
  if (!db || !dispatchModeDocRef) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  try {
    const docSnap = await getDoc(dispatchModeDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as DispatchSettings;
      return NextResponse.json({ dispatchMode: data.dispatchMode || 'auto' }, { status: 200 });
    } else {
      // Default to 'auto' if settings not found
      return NextResponse.json({ dispatchMode: 'auto' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching dispatch settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch dispatch settings', details: errorMessage }, { status: 500 });
  }
});

// POST handler to update dispatch mode
export const POST = withOperatorAuth(async (req) => {
  if (!db || !dispatchModeDocRef) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  try {
    const body = await req.json();
    const parsedDispatchMode = dispatchModeSchema.safeParse(body.dispatchMode);

    if (!parsedDispatchMode.success) {
      return NextResponse.json({ message: 'Invalid payload: dispatchMode must be "auto" or "manual".', errors: parsedDispatchMode.error.format() }, { status: 400 });
    }

    const settingsUpdate: DispatchSettings = {
      dispatchMode: parsedDispatchMode.data,
      lastUpdated: Timestamp.now(),
    };

    await setDoc(dispatchModeDocRef, settingsUpdate, { merge: true }); // merge true to not overwrite other company settings

    return NextResponse.json({ message: 'Dispatch mode updated successfully', settings: settingsUpdate }, { status: 200 });

  } catch (error) {
    console.error('Error updating dispatch settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update dispatch settings', details: errorMessage }, { status: 500 });
  }
});

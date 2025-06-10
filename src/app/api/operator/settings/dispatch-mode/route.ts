
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

interface DispatchSettings {
  dispatchMode: 'auto' | 'manual';
  lastUpdated?: Timestamp;
}

// TODO: In a real app, this would be dynamic per operator (e.g., `operatorSettings/${operatorId}/dispatchMode`)
const settingsDocRef = doc(db, 'companySettings', 'dispatchMode');

const dispatchModeSchema = z.enum(['auto', 'manual']);

// GET handler to fetch current dispatch mode
export async function GET(request: NextRequest) {
  // TODO: Add operator authentication/authorization check
  try {
    const docSnap = await getDoc(settingsDocRef);
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
}

// POST handler to update dispatch mode
export async function POST(request: NextRequest) {
  // TODO: Add operator authentication/authorization check
  try {
    const body = await request.json();
    const parsedDispatchMode = dispatchModeSchema.safeParse(body.dispatchMode);

    if (!parsedDispatchMode.success) {
      return NextResponse.json({ message: 'Invalid payload: dispatchMode must be "auto" or "manual".', errors: parsedDispatchMode.error.format() }, { status: 400 });
    }

    const settingsUpdate: DispatchSettings = {
      dispatchMode: parsedDispatchMode.data,
      lastUpdated: Timestamp.now(),
    };

    await setDoc(settingsDocRef, settingsUpdate, { merge: true }); // merge true to not overwrite other company settings

    return NextResponse.json({ message: 'Dispatch mode updated successfully', settings: settingsUpdate }, { status: 200 });

  } catch (error) {
    console.error('Error updating dispatch settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update dispatch settings', details: errorMessage }, { status: 500 });
  }
}

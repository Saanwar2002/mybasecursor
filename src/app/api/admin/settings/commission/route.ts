
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

interface CommissionSettings {
  defaultRate: number; // Stored as a decimal, e.g., 0.15 for 15%
  lastUpdated: Timestamp;
}

const commissionSettingsDocRef = doc(db, 'platformSettings', 'commission');

const postBodySchema = z.object({
  defaultRate: z.number().min(0, "Commission rate must be non-negative.").max(1, "Commission rate cannot exceed 100%.")
});

// GET handler to fetch current commission rate
export async function GET(request: NextRequest) {
  // TODO: Add robust admin authentication/authorization check
  try {
    const docSnap = await getDoc(commissionSettingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as CommissionSettings;
      return NextResponse.json({ defaultRate: data.defaultRate, lastUpdated: data.lastUpdated?.toDate().toISOString() }, { status: 200 });
    } else {
      // Default to a sensible value if settings not found, e.g., 0% or prompt admin to set it.
      return NextResponse.json({ defaultRate: 0, message: "Commission rate not yet set." }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch commission settings', details: errorMessage }, { status: 500 });
  }
}

// POST handler to update commission rate
export async function POST(request: NextRequest) {
  // TODO: Add robust admin authentication/authorization check
  try {
    const body = await request.json();
    const parsedBody = postBodySchema.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { defaultRate } = parsedBody.data;

    const settingsUpdate: CommissionSettings = {
      defaultRate,
      lastUpdated: Timestamp.now(),
    };

    await setDoc(commissionSettingsDocRef, settingsUpdate, { merge: true });

    return NextResponse.json({ message: 'Default commission rate updated successfully', settings: { defaultRate, lastUpdated: settingsUpdate.lastUpdated.toDate().toISOString() } }, { status: 200 });

  } catch (error) {
    console.error('Error updating commission settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update commission settings', details: errorMessage }, { status: 500 });
  }
}

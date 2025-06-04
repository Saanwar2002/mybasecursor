
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

interface PricingSettings {
  enableSurgePricing: boolean;
  lastUpdated?: Timestamp;
}

const settingsDocRef = doc(db, 'companySettings', 'pricing');

// GET handler to fetch current pricing settings
export async function GET(request: NextRequest) {
  // TODO: Add operator authentication/authorization check
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as PricingSettings;
      return NextResponse.json({ enableSurgePricing: data.enableSurgePricing || false }, { status: 200 });
    } else {
      // Default to false if settings not found
      return NextResponse.json({ enableSurgePricing: false }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching pricing settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch pricing settings', details: errorMessage }, { status: 500 });
  }
}

// POST handler to update pricing settings
export async function POST(request: NextRequest) {
  // TODO: Add operator authentication/authorization check
  try {
    const { enableSurgePricing } = (await request.json()) as { enableSurgePricing: boolean };

    if (typeof enableSurgePricing !== 'boolean') {
      return NextResponse.json({ message: 'Invalid payload: enableSurgePricing must be a boolean.' }, { status: 400 });
    }

    const settingsUpdate: PricingSettings = {
      enableSurgePricing,
      lastUpdated: Timestamp.now(),
    };

    await setDoc(settingsDocRef, settingsUpdate, { merge: true });

    return NextResponse.json({ message: 'Pricing settings updated successfully', settings: settingsUpdate }, { status: 200 });

  } catch (error) {
    console.error('Error updating pricing settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update pricing settings', details: errorMessage }, { status: 500 });
  }
}

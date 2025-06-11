
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

interface PricingSettings {
  enableSurgePricing: boolean;
  operatorSurgePercentage?: number; // Stored as a whole number, e.g., 20 for 20%
  lastUpdated?: Timestamp;
}

const settingsDocRef = doc(db, 'companySettings', 'pricing'); // Assuming one global setting for now

const pricingSettingsResponseSchema = z.object({
  enableSurgePricing: z.boolean().default(false),
  operatorSurgePercentage: z.number().min(0).max(500).optional().default(0), // Max 500% surge, default 0
});

const pricingSettingsUpdateSchema = z.object({
  enableSurgePricing: z.boolean().optional(),
  operatorSurgePercentage: z.number().min(0).max(500).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one setting (enableSurgePricing or operatorSurgePercentage) must be provided.",
});


// GET handler to fetch current pricing settings
export async function GET(request: NextRequest) {
  // TODO: Add operator authentication/authorization check
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as PricingSettings;
      const responsePayload: z.infer<typeof pricingSettingsResponseSchema> = {
        enableSurgePricing: data.enableSurgePricing || false,
        operatorSurgePercentage: data.operatorSurgePercentage === undefined ? 0 : data.operatorSurgePercentage,
      };
      return NextResponse.json(responsePayload, { status: 200 });
    } else {
      // Default values if settings not found
      return NextResponse.json({
        enableSurgePricing: false,
        operatorSurgePercentage: 0,
      }, { status: 200 });
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
    const body = await request.json();
    const parsedBody = pricingSettingsUpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }
    
    const updatePayload: Partial<PricingSettings> = { // Partial because not all fields might be updated at once
      lastUpdated: Timestamp.now(),
    };

    if (parsedBody.data.enableSurgePricing !== undefined) {
        updatePayload.enableSurgePricing = parsedBody.data.enableSurgePricing;
    }
    if (parsedBody.data.operatorSurgePercentage !== undefined) {
        updatePayload.operatorSurgePercentage = parsedBody.data.operatorSurgePercentage;
    }

    await setDoc(settingsDocRef, updatePayload, { merge: true });

    // Fetch the latest settings to return
    const currentSettingsSnap = await getDoc(settingsDocRef);
    const currentSettings = currentSettingsSnap.data() as PricingSettings;

    return NextResponse.json({ 
        message: 'Pricing settings updated successfully', 
        settings: {
            enableSurgePricing: currentSettings.enableSurgePricing,
            operatorSurgePercentage: currentSettings.operatorSurgePercentage
        }
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating pricing settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update pricing settings', details: errorMessage }, { status: 500 });
  }
}


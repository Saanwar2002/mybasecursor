import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { withOperatorAuth } from '@/lib/auth-middleware';

interface OperationalSettings {
  enableSurgePricing: boolean;
  operatorSurgePercentage?: number; // Stored as a whole number, e.g., 20 for 20%
  maxAutoAcceptWaitTimeMinutes?: number; // e.g., 30 for 30 minutes, 0 for no limit
  lastUpdated?: Timestamp;
}

// This would typically be dynamic, e.g., `operators/${operatorId}/settings/operational`
const settingsDocRef = db ? doc(db, 'operatorSettings', 'defaultOperational') : null;

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

export const GET = withOperatorAuth(async (req) => {
  if (!db || !settingsDocRef) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as OperationalSettings;
      const responsePayload: z.infer<typeof operationalSettingsResponseSchema> = {
        enableSurgePricing: data.enableSurgePricing || false,
        operatorSurgePercentage: data.operatorSurgePercentage === undefined ? 0 : data.operatorSurgePercentage,
        maxAutoAcceptWaitTimeMinutes: data.maxAutoAcceptWaitTimeMinutes === undefined ? 30 : data.maxAutoAcceptWaitTimeMinutes,
      };
      return NextResponse.json(responsePayload, { status: 200 });
    } else {
      // Default values if settings not found
      return NextResponse.json({
        enableSurgePricing: false,
        operatorSurgePercentage: 0,
        maxAutoAcceptWaitTimeMinutes: 30, // Default if not set
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching operational settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch operational settings', details: errorMessage }, { status: 500 });
  }
});

export const POST = withOperatorAuth(async (req) => {
  if (!db || !settingsDocRef) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  try {
    const body = await req.json();
    const parsedBody = operationalSettingsUpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }
    
    const updatePayload: Partial<OperationalSettings> = { 
      lastUpdated: Timestamp.now(),
    };

    if (parsedBody.data.enableSurgePricing !== undefined) {
        updatePayload.enableSurgePricing = parsedBody.data.enableSurgePricing;
    }
    if (parsedBody.data.operatorSurgePercentage !== undefined) {
        updatePayload.operatorSurgePercentage = parsedBody.data.operatorSurgePercentage;
    }
    if (parsedBody.data.maxAutoAcceptWaitTimeMinutes !== undefined) {
        updatePayload.maxAutoAcceptWaitTimeMinutes = parsedBody.data.maxAutoAcceptWaitTimeMinutes;
    }

    await setDoc(settingsDocRef, updatePayload, { merge: true });

    const currentSettingsSnap = await getDoc(settingsDocRef);
    const currentSettings = currentSettingsSnap.data() as OperationalSettings;

    return NextResponse.json({ 
        message: 'Operational settings updated successfully', 
        settings: {
            enableSurgePricing: currentSettings.enableSurgePricing,
            operatorSurgePercentage: currentSettings.operatorSurgePercentage,
            maxAutoAcceptWaitTimeMinutes: currentSettings.maxAutoAcceptWaitTimeMinutes
        }
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating operational settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update operational settings', details: errorMessage }, { status: 500 });
  }
});

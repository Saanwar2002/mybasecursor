
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

interface CommissionSettings {
  directDriverRate?: number; // Stored as a decimal, e.g., 0.15 for 15%
  operatorAffiliatedDriverRate?: number; // Stored as a decimal
  lastUpdated?: Timestamp;
}

const commissionSettingsDocRef = doc(db, 'platformSettings', 'commission');

// Schema for GET response and current stored data
const commissionSettingsSchema = z.object({
  directDriverRate: z.number().optional().default(0),
  operatorAffiliatedDriverRate: z.number().optional().default(0.15), // Example default
  lastUpdated: z.string().optional(), // ISO string for client
});

// Schema for POST request body, allowing partial updates
const postBodySchema = z.object({
  directDriverRate: z.number().min(0, "Rate must be non-negative.").max(1, "Rate cannot exceed 100%.").optional(),
  operatorAffiliatedDriverRate: z.number().min(0, "Rate must be non-negative.").max(1, "Rate cannot exceed 100%.").optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one commission rate must be provided for update.",
});


// GET handler to fetch current commission rates
export async function GET(request: NextRequest) {
  try {
    const docSnap = await getDoc(commissionSettingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as CommissionSettings;
      const responsePayload: z.infer<typeof commissionSettingsSchema> = {
        directDriverRate: data.directDriverRate ?? 0,
        operatorAffiliatedDriverRate: data.operatorAffiliatedDriverRate ?? 0.15, // Default if not set
        lastUpdated: data.lastUpdated?.toDate().toISOString(),
      };
      return NextResponse.json(responsePayload, { status: 200 });
    } else {
      // Default values if settings not found
      return NextResponse.json({
        directDriverRate: 0,
        operatorAffiliatedDriverRate: 0.15, // Default if not set
        message: "Commission rates not yet set. Displaying defaults."
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch commission settings', details: errorMessage }, { status: 500 });
  }
}

// POST handler to update one or both commission rates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = postBodySchema.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }

    const updatePayload: CommissionSettings = {
      lastUpdated: Timestamp.now(),
    };

    if (parsedBody.data.directDriverRate !== undefined) {
      updatePayload.directDriverRate = parsedBody.data.directDriverRate;
    }
    if (parsedBody.data.operatorAffiliatedDriverRate !== undefined) {
      updatePayload.operatorAffiliatedDriverRate = parsedBody.data.operatorAffiliatedDriverRate;
    }
    
    await setDoc(commissionSettingsDocRef, updatePayload, { merge: true });

    const docSnap = await getDoc(commissionSettingsDocRef);
    const savedSettings = docSnap.data() as CommissionSettings;

    return NextResponse.json({
      message: 'Commission rates updated successfully',
      settings: {
        directDriverRate: savedSettings.directDriverRate,
        operatorAffiliatedDriverRate: savedSettings.operatorAffiliatedDriverRate,
        lastUpdated: savedSettings.lastUpdated?.toDate().toISOString()
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating commission settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update commission settings', details: errorMessage }, { status: 500 });
  }
}

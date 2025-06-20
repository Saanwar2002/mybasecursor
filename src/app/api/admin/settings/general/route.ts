import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { withAdminAuth } from '@/lib/auth-middleware';

interface GeneralPlatformSettings {
  defaultCurrency: 'GBP' | 'USD' | 'EUR';
  platformMinimumFare: number;
  enableSpeedLimitAlerts?: boolean; // Added
  lastUpdated?: string; // ISO string
}

// Mock in-memory store for general settings
let currentGeneralSettings: GeneralPlatformSettings = {
  defaultCurrency: 'GBP',
  platformMinimumFare: 3.50,
  enableSpeedLimitAlerts: false, // Default to false
  lastUpdated: new Date().toISOString(),
};

const generalSettingsSchema = z.object({
  defaultCurrency: z.enum(['GBP', 'USD', 'EUR'], {
    errorMap: () => ({ message: "Please select a valid currency." }),
  }).optional(), // Make fields optional for partial updates
  platformMinimumFare: z.coerce
    .number({ invalid_type_error: "Minimum fare must be a number." })
    .min(0, "Minimum fare cannot be negative.")
    .max(100, "Minimum fare seems too high (max 100).")
    .optional(),
  enableSpeedLimitAlerts: z.boolean().optional(), // Added
});

// GET handler to fetch current general settings
export const GET = withAdminAuth(async (req) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  // TODO: Implement admin authentication/authorization
  try {
    // Simulate a small delay
    await new Promise(resolve => setTimeout(resolve, 200));
    return NextResponse.json(currentGeneralSettings, { status: 200 });
  } catch (error) {
    console.error('Error fetching general platform settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch general settings', details: errorMessage }, { status: 500 });
  }
});

// POST handler to update general settings
export const POST = withAdminAuth(async (req) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }
  // TODO: Implement admin authentication/authorization
  try {
    const body = await req.json();
    const parsedBody = generalSettingsSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }

    currentGeneralSettings = {
      ...currentGeneralSettings, // Preserve existing settings
      ...parsedBody.data,       // Apply new updates
      lastUpdated: new Date().toISOString(),
    };
    
    // Simulate a small delay
    await new Promise(resolve => setTimeout(resolve, 300));

    return NextResponse.json({
      message: 'General platform settings updated successfully.',
      settings: currentGeneralSettings,
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating general platform settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to update general settings', details: errorMessage }, { status: 500 });
  }
});

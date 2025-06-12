
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface GeneralPlatformSettings {
  defaultCurrency: 'GBP' | 'USD' | 'EUR';
  platformMinimumFare: number;
  lastUpdated?: string; // ISO string
}

// Mock in-memory store for general settings
let currentGeneralSettings: GeneralPlatformSettings = {
  defaultCurrency: 'GBP',
  platformMinimumFare: 3.50,
  lastUpdated: new Date().toISOString(),
};

const generalSettingsSchema = z.object({
  defaultCurrency: z.enum(['GBP', 'USD', 'EUR'], {
    errorMap: () => ({ message: "Please select a valid currency." }),
  }),
  platformMinimumFare: z.coerce
    .number({ invalid_type_error: "Minimum fare must be a number." })
    .min(0, "Minimum fare cannot be negative.")
    .max(100, "Minimum fare seems too high (max 100)."), // Basic sanity check
});

// GET handler to fetch current general settings
export async function GET(request: NextRequest) {
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
}

// POST handler to update general settings
export async function POST(request: NextRequest) {
  // TODO: Implement admin authentication/authorization
  try {
    const body = await request.json();
    const parsedBody = generalSettingsSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid payload.', errors: parsedBody.error.format() }, { status: 400 });
    }

    currentGeneralSettings = {
      ...currentGeneralSettings, // Preserve other settings if any were added
      ...parsedBody.data,
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
}

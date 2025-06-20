import { NextRequest, NextResponse } from 'next/server';

// This is a mock database. In a real application, you would use a proper database.
let loyaltySettings = {
  isEnabled: false,
  pointsPerRide: 10,
  rewardTiers: [
    { id: 1, points: 100, reward: "5% off next ride" },
    { id: 2, points: 500, reward: "15% off next ride" },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    loyaltySettings = { ...loyaltySettings, ...body };
    console.log("Updated loyalty settings:", loyaltySettings);
    return NextResponse.json({ success: true, settings: loyaltySettings });
  } catch (error) {
    console.error('Error saving loyalty settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(loyaltySettings);
} 
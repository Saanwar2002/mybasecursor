import { NextResponse } from 'next/server';

// This is a mock implementation.
// In a real app, you'd add a record to a database table linking a user to a driver.
export async function POST(request: Request) {
  try {
    const { driverId, driverName, vehicleInfo } = await request.json();

    if (!driverId || !driverName || !vehicleInfo) {
      return NextResponse.json({ message: 'Missing driver details' }, { status: 400 });
    }

    console.log(`(MOCK) Added driver ${driverName} (${driverId}) with vehicle ${vehicleInfo} to favorites.`);

    // In a real app, you would now have the logic to save this to the database.
    // For the mock, we don't need to manipulate the in-memory list here,
    // as the 'list' endpoint returns a static list.

    return NextResponse.json({
      message: `Driver ${driverName} added to favorites successfully.`,
      driver: { id: driverId, name: driverName, vehicleInfo }
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to add favorite driver:', error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });
  }
} 
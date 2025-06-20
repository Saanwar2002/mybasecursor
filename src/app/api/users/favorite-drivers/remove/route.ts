import { NextResponse } from 'next/server';

// This is a mock implementation.
// In a real app, you'd remove a record from a database table.
export async function POST(request: Request) {
  try {
    const { driverId } = await request.json();

    if (!driverId) {
      return NextResponse.json({ message: 'Missing driver ID' }, { status: 400 });
    }

    console.log(`(MOCK) Removing driver ${driverId} from favorites.`);

    // In a real app, you would now have the logic to delete this from the database.
    // We don't manipulate the in-memory list here as it's just a mock.

    return NextResponse.json({
      message: `Driver removed from favorites successfully.`
    }, { status: 200 });

  } catch (error) {
    console.error('Failed to remove favorite driver:', error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });
  }
} 
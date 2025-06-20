import { NextRequest, NextResponse } from 'next/server';

// In-memory pause state for demo (keyed by driver ID)
const driverPauseState: Record<string, boolean> = {};

const GUEST_DRIVER_ID = 'guest-driver';

export async function POST(req: NextRequest) {
  try {
    const { paused } = await req.json();
    if (typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    driverPauseState[GUEST_DRIVER_ID] = paused;
    return NextResponse.json({ paused });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  const paused = !!driverPauseState[GUEST_DRIVER_ID];
  return NextResponse.json({ paused });
}

export { driverPauseState, GUEST_DRIVER_ID }; 
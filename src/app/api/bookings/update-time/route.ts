
// This file is deprecated and will be removed.
// Its functionality has been merged into /api/bookings/update-details/route.ts

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'This endpoint is deprecated. Please use /api/bookings/update-details.' }, { status: 410 });
}

    
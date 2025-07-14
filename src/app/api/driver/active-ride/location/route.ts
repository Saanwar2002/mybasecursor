import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Optionally parse and log the body for debugging
  // const data = await req.json();
  // console.log('Received driver location update:', data);
  return NextResponse.json({ status: 'ok' });
} 
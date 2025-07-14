import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { paused } = await req.json();
  // TODO: Save the pause state to your database or session if needed
  return NextResponse.json({ success: true, paused });
} 
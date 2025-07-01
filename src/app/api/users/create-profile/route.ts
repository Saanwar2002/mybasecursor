import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import path from 'path';
import { readFileSync } from 'fs';

// Dynamically load the service account JSON
const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin only once
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, userProfile } = body;
    if (!uid || !userProfile) {
      return NextResponse.json({ error: 'Missing uid or userProfile' }, { status: 400 });
    }
    await db.collection('users').doc(uid).set(userProfile);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
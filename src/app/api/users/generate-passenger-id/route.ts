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
    const passengerId = await generateSequentialPassengerId();
    
    return NextResponse.json({ 
      success: true, 
      passengerId 
    });

  } catch (error) {
    console.error('Error generating passenger ID:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function to generate sequential passenger ID
async function generateSequentialPassengerId(): Promise<string> {
  const counterRef = db.collection('counters').doc('passengerId');
  
  try {
    // Get current counter
    const counterDoc = await counterRef.get();
    let currentId = 1;
    
    if (counterDoc.exists) {
      currentId = counterDoc.data()?.currentId + 1;
    }
    
    // Update counter
    await counterRef.set({ currentId }, { merge: true });
    
    return `CU${currentId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating passenger ID:', error);
    throw error;
  }
} 
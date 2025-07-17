import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function POST(req: Request) {
  try {
    const { operatorCode } = await req.json();

    if (!operatorCode) {
      return NextResponse.json({ error: 'Operator code is required' }, { status: 400 });
    }

    // Generate sequential booking ID for the operator
    const counterRef = db.collection('counters').doc(`bookingId_${operatorCode}`);
    
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { currentId: 1 });
        return 1;
      }
      
      const counterData = counterDoc.data();
      if (!counterData) {
        throw new Error('Counter document data is null');
      }
      const currentId = counterData.currentId;
      transaction.update(counterRef, { currentId: currentId + 1 });
      return currentId + 1;
    });
    
    const bookingId = `${operatorCode}/${result.toString().padStart(8, '0')}`;

    return NextResponse.json({ 
      success: true, 
      bookingId,
      operatorCode,
      sequenceNumber: result 
    });
  } catch (error) {
    console.error('Error generating booking ID:', error);
    return NextResponse.json({ 
      error: 'Failed to generate booking ID', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 
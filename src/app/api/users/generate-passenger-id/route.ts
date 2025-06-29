import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  const counterRef = doc(db, 'counters', 'passengerId');
  
  try {
    // Get current counter
    const counterDoc = await getDoc(counterRef);
    let currentId = 1;
    
    if (counterDoc.exists()) {
      currentId = counterDoc.data().currentId + 1;
    }
    
    // Update counter
    await setDoc(counterRef, { currentId }, { merge: true });
    
    return `CU${currentId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating passenger ID:', error);
    throw error;
  }
} 
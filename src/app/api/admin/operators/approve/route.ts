import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { operatorUserId, approved } = await request.json();

    if (!operatorUserId) {
      return NextResponse.json({ error: 'Operator user ID is required' }, { status: 400 });
    }

    // Get the operator user document
    const operatorRef = doc(db, 'users', operatorUserId);
    const operatorDoc = await getDoc(operatorRef);

    if (!operatorDoc.exists()) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const operatorData = operatorDoc.data();

    if (operatorData.role !== 'operator') {
      return NextResponse.json({ error: 'User is not an operator' }, { status: 400 });
    }

    if (approved) {
      // Generate sequential operator ID
      const operatorId = await generateSequentialOperatorId();
      
      // Update operator status and assign operator ID
      await updateDoc(operatorRef, {
        status: 'Active',
        operatorCode: operatorId,
        approvedAt: new Date(),
        approvedBy: 'admin' // You can add actual admin user ID here
      });

      // Create operator settings document
      const operatorSettingsRef = doc(db, 'operatorSettings', operatorId);
      await setDoc(operatorSettingsRef, {
        autoDispatchEnabled: false, // Default to disabled
        operatorName: operatorData.companyName || operatorData.name,
        createdAt: new Date(),
        status: 'Active'
      });

      return NextResponse.json({ 
        success: true, 
        operatorId,
        message: 'Operator approved successfully' 
      });
    } else {
      // Reject operator
      await updateDoc(operatorRef, {
        status: 'Rejected',
        rejectedAt: new Date(),
        rejectedBy: 'admin'
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Operator rejected' 
      });
    }

  } catch (error) {
    console.error('Error approving operator:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function to generate sequential operator ID
async function generateSequentialOperatorId(): Promise<string> {
  const counterRef = doc(db, 'counters', 'operatorId');
  
  try {
    // Get current counter
    const counterDoc = await getDoc(counterRef);
    let currentId = 1;
    
    if (counterDoc.exists()) {
      currentId = counterDoc.data().currentId + 1;
    }
    
    // Update counter
    await setDoc(counterRef, { currentId }, { merge: true });
    
    return `OP${currentId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating operator ID:', error);
    throw error;
  }
} 
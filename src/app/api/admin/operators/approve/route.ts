import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { operatorUserId, approved } = await request.json();

    if (!operatorUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the user document
    const userRef = doc(db, 'users', operatorUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (userData.role !== 'operator' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'User is not an operator or admin' }, { status: 400 });
    }

    if (approved) {
      if (userData.role === 'operator') {
        // Generate sequential operator ID
        const operatorId = await generateSequentialOperatorId();
        
        // Update operator status and assign operator ID
        await updateDoc(userRef, {
          status: 'Active',
          operatorCode: operatorId,
          approvedAt: new Date(),
          approvedBy: 'admin' // You can add actual admin user ID here
        });

        // Create operator settings document
        const operatorSettingsRef = doc(db, 'operatorSettings', operatorId);
        await setDoc(operatorSettingsRef, {
          autoDispatchEnabled: false, // Default to disabled
          operatorName: userData.companyName || userData.name,
          createdAt: new Date(),
          status: 'Active'
        });

        return NextResponse.json({ 
          success: true, 
          operatorId,
          message: 'Operator approved successfully' 
        });
      } else if (userData.role === 'admin') {
        // Generate sequential admin ID
        const adminId = await generateSequentialAdminId();
        
        // Update admin status and assign admin ID
        await updateDoc(userRef, {
          status: 'Active',
          customId: adminId,
          approvedAt: new Date(),
          approvedBy: 'super_admin' // You can add actual super admin user ID here
        });

        return NextResponse.json({ 
          success: true, 
          adminId,
          message: 'Admin approved successfully' 
        });
      }
    } else {
      // Reject user
      await updateDoc(userRef, {
        status: 'Rejected',
        rejectedAt: new Date(),
        rejectedBy: 'admin'
      });

      return NextResponse.json({ 
        success: true, 
        message: `${userData.role} rejected` 
      });
    }

  } catch (error) {
    console.error('Error approving user:', error);
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

// Function to generate sequential admin ID
async function generateSequentialAdminId(): Promise<string> {
  const counterRef = doc(db, 'counters', 'adminId');
  
  try {
    // Get current counter
    const counterDoc = await getDoc(counterRef);
    let currentId = 1;
    
    if (counterDoc.exists()) {
      currentId = counterDoc.data().currentId + 1;
    }
    
    // Update counter
    await setDoc(counterRef, { currentId }, { merge: true });
    
    return `AD${currentId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating admin ID:', error);
    throw error;
  }
} 
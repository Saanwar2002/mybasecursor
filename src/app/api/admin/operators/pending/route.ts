import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Query for all pending operators
    const operatorsRef = collection(db, 'users');
    const q = query(
      operatorsRef,
      where('role', '==', 'operator'),
      where('status', '==', 'Pending Approval')
    );

    const querySnapshot = await getDocs(q);
    const operators = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        status: data.status,
        createdAt: data.createdAt,
        role: data.role
      };
    });

    // Sort by creation date (newest first)
    operators.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return NextResponse.json({ 
      success: true, 
      operators 
    });

  } catch (error) {
    console.error('Error fetching pending operators:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
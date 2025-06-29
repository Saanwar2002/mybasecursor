import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Query for all approved operators
    const operatorsRef = collection(db, 'users');
    const q = query(
      operatorsRef,
      where('role', '==', 'operator'),
      where('status', '==', 'Active')
    );

    const querySnapshot = await getDocs(q);
    const operators = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        operatorCode: data.operatorCode,
        name: data.companyName || data.name,
        email: data.email,
        phone: data.phone,
        status: data.status
      };
    });

    // Sort by operator code
    operators.sort((a, b) => a.operatorCode.localeCompare(b.operatorCode));

    return NextResponse.json({ 
      success: true, 
      operators 
    });

  } catch (error) {
    console.error('Error fetching approved operators:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
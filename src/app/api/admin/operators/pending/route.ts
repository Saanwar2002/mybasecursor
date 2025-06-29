import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Query for all pending operators and admins
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', 'in', ['operator', 'admin']),
      where('status', '==', 'Pending Approval')
    );

    const querySnapshot = await getDocs(q);
    const pendingUsers = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        status: data.status,
        role: data.role,
        createdAt: data.createdAt
      };
    });

    // Sort by creation date (newest first)
    pendingUsers.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return NextResponse.json({ 
      success: true, 
      pendingUsers 
    });

  } catch (error) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ message: 'Database connection failed: Firestore not initialized.' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const limitCount = parseInt(searchParams.get('limit') || '50');

    const usersRef = collection(db, 'users');
    const constraints = [];
    
    if (role) {
      constraints.push(where('role', '==', role));
    }
    
    if (status) {
      constraints.push(where('status', '==', status));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(usersRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ 
      users,
      total: users.length,
      filters: { role, status, limit: limitCount }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch users', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

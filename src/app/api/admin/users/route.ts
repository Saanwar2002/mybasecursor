import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const limitCount = parseInt(searchParams.get('limit') || '50');

    let q: any = db.collection('users');
    
    if (role) {
      q = q.where('role', '==', role);
    }
    
    if (status) {
      q = q.where('status', '==', status);
    }
    
    q = q.orderBy('createdAt', 'desc').limit(limitCount);

    const snapshot = await q.get();
    const users = snapshot.docs.map(doc => ({
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

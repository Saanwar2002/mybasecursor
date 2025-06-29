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

    const usersRef = db.collection('users');
    const constraints = [];
    
    if (role) {
      constraints.push(db.collection('users').where('role', '==', role));
    }
    
    if (status) {
      constraints.push(db.collection('users').where('status', '==', status));
    }
    
    constraints.push(db.collection('users').orderBy('createdAt', 'desc'));
    constraints.push(db.collection('users').limit(limitCount));

    const q = db.collection('users').where(...constraints);
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

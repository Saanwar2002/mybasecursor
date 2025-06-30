import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const usersRef = db.collection('users');
    let query = usersRef.where('role', '==', 'operator');
    const status = searchParams.get('status');
    if (status) {
      query = query.where('status', '==', status);
    }
    const snapshot = await query.get();
    const operators = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ operators });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operators', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

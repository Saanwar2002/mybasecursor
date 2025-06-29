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
    const operatorCode = searchParams.get('operatorCode');
    const usersRef = db.collection('users');
    let query = usersRef.where('role', '==', 'passenger');
    if (operatorCode) {
      query = query.where('operatorCode', '==', operatorCode);
    }
    const snapshot = await query.get();
    const passengers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ passengers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch passengers', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
    
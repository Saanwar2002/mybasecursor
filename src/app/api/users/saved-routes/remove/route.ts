import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId');
    if (!routeId) {
      return NextResponse.json({ error: 'Missing routeId' }, { status: 400 });
    }
    await db.collection('savedRoutes').doc(routeId).delete();
    return NextResponse.json({ message: 'Saved route deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete saved route', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

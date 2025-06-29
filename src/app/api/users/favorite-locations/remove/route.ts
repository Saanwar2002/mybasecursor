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
    const favId = searchParams.get('favId');
    if (!favId) {
      return NextResponse.json({ error: 'Missing favId' }, { status: 400 });
    }
    await db.collection('favoriteLocations').doc(favId).delete();
    return NextResponse.json({ message: 'Favorite location deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete favorite location', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

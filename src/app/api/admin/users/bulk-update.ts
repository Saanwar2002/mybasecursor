import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function POST(req: Request) {
  try {
    const { userIds, status, reason } = await req.json();
    if (!Array.isArray(userIds) || !status) {
      return NextResponse.json({ message: 'userIds (array) and status are required.' }, { status: 400 });
    }
    const results = [];
    for (const userId of userIds) {
      try {
        const userRef = db.collection('users').doc(userId);
        const update: any = { status, operatorUpdatedAt: Timestamp.now() };
        if (status === 'Suspended' && reason) update.statusReason = reason;
        await userRef.update(update);
        results.push({ userId, success: true });
      } catch (err) {
        results.push({ userId, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return NextResponse.json({ message: 'Bulk update complete', results });
  } catch (error) {
    return NextResponse.json({ message: 'Bulk update failed', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 
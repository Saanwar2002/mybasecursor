import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';

const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef
      .where('role', '==', 'operator')
      .where('status', '==', 'Active')
      .get();

    const operators = snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data.operatorCode || !data.name) return null;
        return {
          id: doc.id,
          operatorCode: data.operatorCode,
          name: data.companyName || data.name,
          email: data.email,
          phone: data.phone,
          status: data.status
        };
      })
      .filter((op): op is NonNullable<typeof op> => op !== null)
      .sort((a, b) => a.operatorCode.localeCompare(b.operatorCode));

    return NextResponse.json({ success: true, operators });
  } catch (error) {
    console.error('Error fetching approved operators:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 
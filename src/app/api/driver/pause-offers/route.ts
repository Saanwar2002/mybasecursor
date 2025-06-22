import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin';

const adminDb = getDb();

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await getAuth().verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (error) {
            console.error('Error verifying ID token:', error);
            return null;
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paused } = await req.json();
        if (typeof paused !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload: "paused" must be a boolean.' }, { status: 400 });
        }

        const userRef = adminDb.collection('users').doc(userId);
        
        await userRef.update({
            isPaused: paused,
        });

        console.log(`Driver ${userId} pause state updated to: ${paused}`);
        return NextResponse.json({ success: true, paused: paused });

    } catch (error) {
        console.error('Error in pause-offers POST:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 
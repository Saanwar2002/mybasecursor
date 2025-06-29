import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
  // orderBy, // Removed orderBy
} from 'firebase/firestore';
import { z } from 'zod';
import type { UserRole } from '@/contexts/auth-context';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

interface UserBlock {
  id: string; // Document ID of the block itself
  blockerId: string;
  blockedId: string;
  blockerRole: UserRole;
  blockedRole: UserRole;
  createdAt: Timestamp;
}

interface BlockedUserDisplay {
  blockId: string; // Document ID of the block itself
  blockedUserId: string;
  blockedUserName: string;
  blockedUserRole: UserRole;
  createdAt: string; // ISO string
}

const createBlockSchema = z.object({
  blockerId: z.string().min(1),
  blockedId: z.string().min(1),
  blockerRole: z.enum(['passenger', 'driver', 'operator', 'admin']),
  blockedRole: z.enum(['passenger', 'driver', 'operator', 'admin']),
});

// POST: Create a new block
export async function POST(req: Request) {
  try {
    const data = await req.json();
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('userBlocks').add(data);
    return NextResponse.json({ message: 'User block added successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add user block', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// GET: List users blocked by a specific user
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId'); // This is the blockerId

  if (!userId) {
    return NextResponse.json({ message: 'userId query parameter is required.' }, { status: 400 });
  }

  try {
    // Removed orderBy('createdAt', 'desc') to avoid index error. Sorting will be done client-side.
    const q = query(collection(db, 'userBlocks'), where('blockerId', '==', userId));
    const querySnapshot = await getDocs(q);

    const blockedUsersDisplay: BlockedUserDisplay[] = [];

    for (const blockDoc of querySnapshot.docs) {
      const blockData = blockDoc.data() as Omit<UserBlock, 'id'>;
      const blockedUserDocRef = doc(db, 'users', blockData.blockedId);
      const blockedUserSnap = await getDoc(blockedUserDocRef);

      let blockedUserName = 'Unknown User';
      let blockedUserRole: UserRole = 'passenger'; // Default role

      if (blockedUserSnap.exists()) {
        const blockedUserData = blockedUserSnap.data();
        blockedUserName = blockedUserData.name || 'Unnamed User';
        blockedUserRole = blockedUserData.role || 'passenger';
      }

      blockedUsersDisplay.push({
        blockId: blockDoc.id,
        blockedUserId: blockData.blockedId,
        blockedUserName,
        blockedUserRole,
        createdAt: (blockData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      });
    }
    
    // Sort in JavaScript after fetching
    blockedUsersDisplay.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(blockedUsersDisplay, { status: 200 });

  } catch (error) {
    console.error('Error fetching blocked users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Removed check for 'failed-precondition' as orderBy is removed
    return NextResponse.json({ message: 'Failed to fetch blocked users', details: errorMessage }, { status: 500 });
  }
}

// DELETE: Remove a block
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get('blockId');
    if (!blockId) {
      return NextResponse.json({ error: 'Missing blockId' }, { status: 400 });
    }
    await db.collection('userBlocks').doc(blockId).delete();
    return NextResponse.json({ message: 'User block deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user block', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

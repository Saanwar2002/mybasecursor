
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  orderBy, // Added orderBy
} from 'firebase/firestore';
import { z } from 'zod';
import type { UserRole } from '@/contexts/auth-context';

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
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsedPayload = createBlockSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json({ message: 'Invalid input data.', errors: parsedPayload.error.format() }, { status: 400 });
    }

    const { blockerId, blockedId, blockerRole, blockedRole } = parsedPayload.data;

    if (blockerId === blockedId) {
      return NextResponse.json({ message: 'User cannot block themselves.' }, { status: 400 });
    }

    // Check if block already exists
    const q = query(
      collection(db, 'userBlocks'),
      where('blockerId', '==', blockerId),
      where('blockedId', '==', blockedId)
    );
    const existingBlockSnap = await getDocs(q);
    if (!existingBlockSnap.empty) {
      return NextResponse.json({ message: 'This user is already blocked.' }, { status: 409 });
    }

    const newBlock = {
      blockerId,
      blockedId,
      blockerRole,
      blockedRole,
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'userBlocks'), newBlock);
    return NextResponse.json({ message: 'User blocked successfully.', blockId: docRef.id }, { status: 201 });

  } catch (error) {
    console.error('Error creating user block:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to create user block', details: errorMessage }, { status: 500 });
  }
}

// GET: List users blocked by a specific user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId'); // This is the blockerId

  if (!userId) {
    return NextResponse.json({ message: 'userId query parameter is required.' }, { status: 400 });
  }

  try {
    const q = query(collection(db, 'userBlocks'), where('blockerId', '==', userId), orderBy('createdAt', 'desc'));
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

    return NextResponse.json(blockedUsersDisplay, { status: 200 });

  } catch (error) {
    console.error('Error fetching blocked users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check the console for a link to create it.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch blocked users', details: errorMessage }, { status: 500 });
  }
}

// DELETE: Remove a block
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('blockId');
  // const userId = searchParams.get('userId'); // User ID of the person initiating the delete

  if (!blockId) { // Removed userId from required check for admin override
    return NextResponse.json({ message: 'blockId query parameter is required.' }, { status: 400 });
  }

  try {
    const blockDocRef = doc(db, 'userBlocks', blockId);
    const blockDocSnap = await getDoc(blockDocRef);

    if (!blockDocSnap.exists()) {
      return NextResponse.json({ message: 'Block record not found.' }, { status: 404 });
    }

    // TODO: Implement proper admin role check here.
    // For now, any authenticated user can delete any block by its ID if they call this endpoint.
    // The frontend logic will differentiate between user unblocking their own and admin unblocking any.
    // const blockData = blockDocSnap.data();
    // if (blockData.blockerId !== userId && !IS_ADMIN_USER_MAKING_REQUEST) { // IS_ADMIN_USER_MAKING_REQUEST needs to be determined
    //   return NextResponse.json({ message: 'You are not authorized to remove this block.' }, { status: 403 });
    // }

    await deleteDoc(blockDocRef);
    return NextResponse.json({ message: 'User unblocked successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Error deleting user block:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to delete user block', details: errorMessage }, { status: 500 });
  }
}

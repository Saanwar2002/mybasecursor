
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy, // Re-added orderBy
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import type { UserRole } from '@/contexts/auth-context';

interface UserBlock {
  id: string; // Document ID of the block itself
  blockerId: string;
  blockerName?: string; // To be enriched
  blockerRole?: UserRole; // To be enriched
  blockedId: string;
  blockedName?: string; // To be enriched
  blockedRole?: UserRole; // To be enriched
  createdAt: string; // ISO string
}

// This is a simplified version. In a real app, you'd implement pagination.
export async function GET(request: NextRequest) {
  // TODO: Implement robust admin authentication/authorization here.
  // For example, verify an admin ID token or session.

  try {
    const blocksRef = collection(db, 'userBlocks');
    // Re-added orderBy('createdAt', 'desc')
    const q = query(blocksRef, orderBy('createdAt', 'desc')); 
    const querySnapshot = await getDocs(q);

    const allBlocks: UserBlock[] = [];

    for (const blockDoc of querySnapshot.docs) {
      const blockData = blockDoc.data();

      // Fetch blocker details
      let blockerName = 'Unknown User';
      let blockerRole: UserRole = 'passenger'; // Default
      if (blockData.blockerId) {
        const blockerDocRef = doc(db, 'users', blockData.blockerId);
        const blockerSnap = await getDoc(blockerDocRef);
        if (blockerSnap.exists()) {
          blockerName = blockerSnap.data().name || 'Unnamed User';
          blockerRole = blockerSnap.data().role || 'passenger';
        }
      }
      
      // Fetch blocked user details
      let blockedName = 'Unknown User';
      let blockedRole: UserRole = 'passenger'; // Default
       if (blockData.blockedId) {
        const blockedDocRef = doc(db, 'users', blockData.blockedId);
        const blockedSnap = await getDoc(blockedDocRef);
        if (blockedSnap.exists()) {
          blockedName = blockedSnap.data().name || 'Unnamed User';
          blockedRole = blockedSnap.data().role || 'passenger';
        }
      }

      allBlocks.push({
        id: blockDoc.id,
        blockerId: blockData.blockerId,
        blockerName,
        blockerRole,
        blockedId: blockData.blockedId,
        blockedName,
        blockedRole,
        createdAt: (blockData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      });
    }

    // Removed manual JavaScript sort as Firestore will handle it now
    // allBlocks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    return NextResponse.json({ blocks: allBlocks }, { status: 200 });

  } catch (error) {
    console.error('Error fetching all user blocks for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (error instanceof Error && (error as any).code === 'failed-precondition') {
        return NextResponse.json({
            message: 'Query requires a Firestore index. Please check console for link.',
            details: errorMessage
        }, { status: 500});
    }
    return NextResponse.json({ message: 'Failed to fetch all user blocks', details: errorMessage }, { status: 500 });
  }
}

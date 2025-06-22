import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAdminAuth } from '@/lib/auth-middleware';

interface FeedbackItem {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterEmail?: string | null;
  submitterRole: 'passenger' | 'driver' | 'operator' | 'admin';
  category: string;
  details: string;
  rideId?: string | null;
  status: 'New' | 'Investigating' | 'Resolved' | 'Closed';
  submittedAt: string; // ISO string
  updatedAt: string; // ISO string
}

export const GET = withAdminAuth(async (req) => {
  const db = getDb();
  try {
    const feedbackSnapshot = await db.collection('userFeedback').orderBy('submittedAt', 'desc').get();
    const feedback = feedbackSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        submittedAt: data.submittedAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      };
    });
    
    return NextResponse.json({ feedback }, { status: 200 });

  } catch (error) {
    console.error('Error fetching feedback list for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch feedback list', details: errorMessage }, { status: 500 });
  }
});

// Placeholder for future PUT if admin can update status, etc.
// export async function PUT(request: NextRequest) { /* ... */ }

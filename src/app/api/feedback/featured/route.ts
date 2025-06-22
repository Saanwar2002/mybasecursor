import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to a serializable format
function serializeTimestamp(timestamp: Timestamp | undefined | null): string | null {
  if (!timestamp) return null;
  return timestamp.toDate().toISOString();
}

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  try {
    const feedbackSnapshot = await db.collection('userFeedback')
      .where('rating', '>=', 4)
      .orderBy('rating', 'desc')
      .orderBy('submittedAt', 'desc')
      .limit(7)
      .get();

    if (feedbackSnapshot.empty) {
      return NextResponse.json({ featuredReviews: [] }, { status: 200 });
    }

    const featuredReviews = feedbackSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.submitterName,
        reviewText: data.details,
        stars: data.rating,
        avatarText: data.submitterName.split(' ').map((n: string) => n[0]).join(''),
        // Location is not in the feedback schema, so we omit it or set a default
        location: "Huddersfield", 
        submittedAt: serializeTimestamp(data.submittedAt),
      };
    });
    
    return NextResponse.json({ featuredReviews }, { status: 200 });

  } catch (error) {
    console.error('Error fetching featured reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch featured reviews', details: errorMessage }, { status: 500 });
  }
} 

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'; // Removed orderBy

interface FavoriteLocationDoc {
  id: string;
  userId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Timestamp; // Firestore Timestamp on server
}

// Helper to convert Firestore Timestamp to a serializable format for JSON response
function serializeTimestamp(timestamp: Timestamp): { _seconds: number; _nanoseconds: number } {
  return {
    _seconds: timestamp.seconds,
    _nanoseconds: timestamp.nanoseconds,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'userId query parameter is required.' }, { status: 400 });
  }
  
  // In a real app, you'd get userId from the authenticated session.

  try {
    const favLocationsRef = collection(db, 'favoriteLocations');
    // Removed orderBy('label', 'asc') from the query
    const q = query(
      favLocationsRef,
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    
    const locations: any[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<FavoriteLocationDoc, 'id'>;
      let processedTimestamp: Timestamp;
       if (data.createdAt instanceof Timestamp) {
        processedTimestamp = data.createdAt;
      } else if (data.createdAt && typeof (data.createdAt as any).seconds === 'number' && typeof (data.createdAt as any).nanoseconds === 'number') {
        // Handle cases where it might already be an object { seconds: ..., nanoseconds: ... }
        processedTimestamp = new Timestamp((data.createdAt as any).seconds, (data.createdAt as any).nanoseconds);
      } else {
        // Fallback if timestamp is missing or malformed
        console.warn(`Favorite location doc ${doc.id} has missing or malformed createdAt. Using current time as fallback.`);
        processedTimestamp = Timestamp.now(); // Use current server time as a fallback
      }
      
      locations.push({
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(processedTimestamp), // Ensure serialization
      });
    });

    return NextResponse.json(locations, { status: 200 });

  } catch (error) {
    console.error('Error fetching favorite locations:', error);
    let errorMessage = 'An unknown server error occurred.';
    let errorDetails = '';

    if (error instanceof Error) {
        errorMessage = error.message;
        const firebaseError = error as any; 
        if (firebaseError.code === 'failed-precondition' || (firebaseError.message && firebaseError.message.toLowerCase().includes('index'))) {
             errorDetails = `The query requires an index. Firestore query failed. This often indicates a missing composite index. Please check the server-side logs for a Firestore error message, which may include a URL to create the required index. Firestore error code: ${firebaseError.code || 'N/A'}. Firestore message: ${firebaseError.message}`;
        } else {
            errorDetails = error.toString();
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
        errorDetails = error;
    }
    
    return NextResponse.json({
      message: 'Failed to retrieve favorite locations. Please check server logs for more details, especially regarding Firestore indexes.',
      details: `${errorMessage} ${errorDetails}`.trim()
    }, { status: 500 });
  }
}


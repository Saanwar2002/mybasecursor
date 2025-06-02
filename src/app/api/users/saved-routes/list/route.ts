
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SavedRouteDoc {
  id: string;
  userId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  createdAt: Timestamp; // Firestore Timestamp on server
}

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
  
  try {
    const savedRoutesRef = collection(db, 'savedRoutes');
    const q = query(
      savedRoutesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc') // Show most recently saved routes first
    );

    const querySnapshot = await getDocs(q);
    
    const routes: any[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<SavedRouteDoc, 'id'>;
      let processedTimestamp: Timestamp;
       if (data.createdAt instanceof Timestamp) {
        processedTimestamp = data.createdAt;
      } else if (data.createdAt && typeof (data.createdAt as any).seconds === 'number') {
        processedTimestamp = new Timestamp((data.createdAt as any).seconds, (data.createdAt as any).nanoseconds || 0);
      } else {
        console.warn(`Saved route doc ${doc.id} has missing or malformed createdAt. Using current time as fallback.`);
        processedTimestamp = Timestamp.now();
      }
      
      routes.push({
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(processedTimestamp),
      });
    });

    return NextResponse.json(routes, { status: 200 });

  } catch (error) {
    console.error('Error fetching saved routes:', error);
    let errorMessage = 'An unknown server error occurred.';
    let errorDetails = '';

    if (error instanceof Error) {
        errorMessage = error.message;
        const firebaseError = error as any; 
        if (firebaseError.code === 'failed-precondition' && firebaseError.message.toLowerCase().includes('index')) {
             errorDetails = `The query requires an index. Firestore query failed. This often indicates a missing composite index. Firestore error code: ${firebaseError.code || 'N/A'}. Details: ${firebaseError.message}`;
        } else {
            errorDetails = error.toString();
        }
    }
    
    return NextResponse.json({
      message: 'Failed to retrieve saved routes.',
      details: `${errorMessage} ${errorDetails}`.trim()
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';

interface DriverHealthStats {
  averageRating: number;
  completionRate: number;
  acceptanceRate: number; // Placeholder for now
  safetyScore: string;    // Placeholder for now
  passengerBlocks: number;
  positiveFeedback: string | null;
  areaForImprovement: string | null;
  overallScore: number;
  status: 'Good' | 'Fair' | 'Poor';
}

async function getDriverBookings(driverId: string): Promise<DocumentData[]> {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('driverId', '==', driverId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getDriverBlocks(driverId: string): Promise<number> {
    // This assumes passenger documents have a 'blockedDrivers' array field.
    // This is a heavy operation and should be optimized in a real app,
    // perhaps by using a dedicated 'blocks' collection or denormalizing a count on the driver doc.
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('blockedDrivers', 'array-contains', driverId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
}

async function getRecentFeedback(driverId: string): Promise<{positive: string | null, improvement: string | null}> {
    const feedbackRef = collection(db, 'userFeedback');
    // Fetch one recent positive and one recent constructive feedback.
    // This is simplified. A real app might look for patterns.
    
    const positiveQuery = query(feedbackRef, where('driverId', '==', driverId), where('rating', '>=', 4), limit(1));
    const improvementQuery = query(feedbackRef, where('driverId', '==', driverId), where('rating', '<=', 3), limit(1));

    const [positiveSnapshot, improvementSnapshot] = await Promise.all([
        getDocs(positiveQuery),
        getDocs(improvementQuery)
    ]);

    const positive = positiveSnapshot.empty ? null : positiveSnapshot.docs[0].data().comments;
    const improvement = improvementSnapshot.empty ? null : improvementSnapshot.docs[0].data().comments || "Consider being more proactive with communication on arrival times.";


    return { positive, improvement };
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');

  if (!driverId) {
    return NextResponse.json({ message: 'driverId is required' }, { status: 400 });
  }

  try {
    const bookings = await getDriverBookings(driverId);
    const totalBookings = bookings.length;

    if (totalBookings === 0) {
        // Return a default state for new drivers
        return NextResponse.json({
            averageRating: 5.0,
            completionRate: 100,
            acceptanceRate: 100,
            safetyScore: "100/100",
            passengerBlocks: 0,
            positiveFeedback: "Welcome! Start completing rides to see your feedback.",
            areaForImprovement: null,
            overallScore: 100,
            status: 'Good'
        });
    }

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const completionRate = totalBookings > 0 ? (completedBookings.length / totalBookings) * 100 : 100;

    const ratings = completedBookings.map(b => b.rating).filter(r => r != null && r > 0);
    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0;

    const passengerBlocks = await getDriverBlocks(driverId);
    const { positive: positiveFeedback, improvement: areaForImprovement } = await getRecentFeedback(driverId);
    
    // --- Simplified Overall Score Calculation ---
    let score = 0;
    score += (averageRating / 5) * 40; // 40% weight for rating
    score += (completionRate / 100) * 40; // 40% weight for completion
    score -= passengerBlocks * 10; // 10 points penalty per block
    const overallScore = Math.max(0, Math.min(100, Math.round(score)));
    
    const status = overallScore >= 80 ? 'Good' : overallScore >= 60 ? 'Fair' : 'Poor';
    
    const healthStats: DriverHealthStats = {
      averageRating: parseFloat(averageRating.toFixed(1)),
      completionRate: Math.round(completionRate),
      acceptanceRate: 88, // Not implemented yet
      safetyScore: "98/100", // Not implemented yet
      passengerBlocks,
      positiveFeedback: positiveFeedback || "Passengers appreciate your quick and safe journeys!",
      areaForImprovement,
      overallScore,
      status
    };

    return NextResponse.json(healthStats);

  } catch (error) {
    console.error(`Failed to get driver account health for ${driverId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
} 
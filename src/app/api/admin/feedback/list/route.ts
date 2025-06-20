import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formatISO, subDays } from 'date-fns';
import { db } from '@/lib/firebase';
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

// Mock data store for feedback items
const mockFeedbackItems: FeedbackItem[] = [
  {
    id: 'fb_mock_001',
    submitterId: 'pass123',
    submitterName: 'Alice Wanderer',
    submitterEmail: 'alice@example.com',
    submitterRole: 'passenger',
    category: 'Driver Compliment',
    details: 'Driver John (DRV007) was exceptionally courteous and helpful with my luggage. Smooth ride!',
    rideId: 'RIDE789',
    status: 'New',
    submittedAt: subDays(new Date(), 1).toISOString(),
    updatedAt: subDays(new Date(), 1).toISOString(),
  },
  {
    id: 'fb_mock_002',
    submitterId: 'driver456',
    submitterName: 'Bob The Driver',
    submitterEmail: 'bob.driver@example.com',
    submitterRole: 'driver',
    category: 'App Issue / Bug Report',
    details: 'The earnings page sometimes shows incorrect totals for the current day. It corrects itself later but is confusing.',
    status: 'Investigating',
    submittedAt: subDays(new Date(), 3).toISOString(),
    updatedAt: subDays(new Date(), 2).toISOString(),
  },
  {
    id: 'fb_mock_003',
    submitterId: 'op789',
    submitterName: 'City Taxis Dispatch',
    submitterEmail: 'dispatch@citytaxis.co',
    submitterRole: 'operator',
    category: 'Platform Feature Request',
    details: 'It would be very helpful to have a bulk CSV import for new drivers to speed up onboarding for larger fleets.',
    status: 'New',
    submittedAt: subDays(new Date(), 5).toISOString(),
    updatedAt: subDays(new Date(), 5).toISOString(),
  },
   {
    id: 'fb_mock_004',
    submitterId: 'pass777',
    submitterName: 'Charlie Brown',
    submitterEmail: 'charlie@example.com',
    submitterRole: 'passenger',
    category: 'Booking Issue',
    details: 'Tried to schedule a ride for next Tuesday but the calendar was not responsive on my Android device.',
    status: 'Resolved',
    submittedAt: subDays(new Date(), 7).toISOString(),
    updatedAt: subDays(new Date(), 4).toISOString(),
  },
];

export const GET = withAdminAuth(async (req) => {
  if (!db) {
    return NextResponse.json({ message: "Firestore not initialized" }, { status: 500 });
  }

  try {
    // Simulate some delay for API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const sortedFeedback = [...mockFeedbackItems].sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return NextResponse.json({ feedback: sortedFeedback }, { status: 200 });

  } catch (error) {
    console.error('Error fetching feedback list for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ message: 'Failed to fetch feedback list', details: errorMessage }, { status: 500 });
  }
});

// Placeholder for future PUT if admin can update status, etc.
// export async function PUT(request: NextRequest) { /* ... */ }

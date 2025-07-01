import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formatISO } from 'date-fns';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { notifySupportTicket } from '@/lib/notifications';

interface SupportTicket {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterRole: 'driver' | 'passenger' | 'operator';
  driverOperatorCode?: string;
  driverOperatorName?: string;
  category: string;
  details: string;
  submittedAt: string; // ISO string
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Closed';
  lastUpdated?: string; // ISO string
  assignedTo?: string; // Admin/Operator User ID
}

// In-memory store for mock tickets
const serverMockTickets: SupportTicket[] = [
  { id: 'TICKET001', submitterId: 'driverX1', submitterName: 'John Doe', submitterRole: 'driver', driverOperatorCode: 'OP001', driverOperatorName: 'City Cabs (Mock)', category: 'Payment Query', details: 'My earning for last week seems incorrect. Missing two rides.', submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'Pending' },
  { id: 'TICKET002', submitterId: 'passengerY2', submitterName: 'Alice Smith', submitterRole: 'passenger', category: 'App Issue', details: 'The map freezes occasionally when booking a ride.', submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'In Progress', assignedTo: 'AdminJane' },
  { id: 'TICKET003', submitterId: 'driverZ3', submitterName: 'Bob K.', submitterRole: 'driver', driverOperatorCode: 'OP002', driverOperatorName: 'Speedy Cars (Mock)', category: 'Operator Concern', details: 'My operator (OP002) is not responding to my calls regarding shifts.', submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'Resolved', lastUpdated: new Date(Date.now() - 86400000 * 3).toISOString(), assignedTo: 'AdminMike' },
  { id: 'TICKET004', submitterId: 'operatorA1', submitterName: 'City Cabs', submitterRole: 'operator', category: 'Platform Suggestion', details: 'It would be great to have bulk driver import feature.', submittedAt: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'Closed' },
  { id: 'TICKET005', submitterId: 'driverW5', submitterName: 'Will Byers', submitterRole: 'driver', driverOperatorCode: 'OP001', driverOperatorName: 'City Cabs (Mock)', category: 'Safety Concern', details: 'Street lighting on Elm St is very poor, making night pickups difficult.', submittedAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), status: 'Pending' },
];

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

export async function GET(request: NextRequest) {
  // TODO: Implement admin authentication
  // For now, directly return the mock tickets
  try {
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return NextResponse.json({ tickets: serverMockTickets.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) }, { status: 200 });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return NextResponse.json({ message: "Failed to fetch tickets", details: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Basic validation (expand as needed)
    if (!body.submitterId || !body.submitterName || !body.submitterRole || !body.category || !body.details) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }
    const now = Timestamp.now();
    const newTicket = {
      submitterId: body.submitterId,
      submitterName: body.submitterName,
      submitterRole: body.submitterRole,
      driverOperatorCode: body.driverOperatorCode || null,
      driverOperatorName: body.driverOperatorName || null,
      category: body.category,
      details: body.details,
      submittedAt: now,
      status: 'Pending',
      lastUpdated: now,
      assignedTo: null,
    };
    const docRef = await db.collection('supportTickets').add(newTicket);
    const createdSnap = await docRef.get();
    const createdData = createdSnap.data();
    if (!createdData) {
      return NextResponse.json({ message: 'Failed to retrieve created ticket data.' }, { status: 500 });
    }
    // Trigger notification for admin(s)
    await notifySupportTicket({
      toRole: 'admin',
      ticketId: docRef.id,
      subject: createdData.category,
      link: `/admin/support-tickets/${docRef.id}`
    });
    return NextResponse.json({ message: 'Support ticket created successfully', ticket: { id: docRef.id, ...createdData } }, { status: 201 });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json({ message: 'Failed to create support ticket', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
    
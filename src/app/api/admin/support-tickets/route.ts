
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formatISO } from 'date-fns';

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

// POST could be used to create new tickets in a real scenario
// export async function POST(request: NextRequest) {
//   // ... implementation ...
// }
    
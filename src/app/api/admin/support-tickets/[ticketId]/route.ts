
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

// This should ideally share the same in-memory store as the /api/admin/support-tickets route.
// For simplicity in this example, we'll assume direct access or another mechanism.
// In a real app, use a proper database or a shared in-memory store instance.
// For now, we re-declare and assume it's the same data.
let serverMockTickets: SupportTicket[] = [
  { id: 'TICKET001', submitterId: 'driverX1', submitterName: 'John Doe', submitterRole: 'driver', driverOperatorCode: 'OP001', driverOperatorName: 'City Cabs (Mock)', category: 'Payment Query', details: 'My earning for last week seems incorrect. Missing two rides.', submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'Pending' },
  { id: 'TICKET002', submitterId: 'passengerY2', submitterName: 'Alice Smith', submitterRole: 'passenger', category: 'App Issue', details: 'The map freezes occasionally when booking a ride.', submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'In Progress', assignedTo: 'AdminJane' },
  { id: 'TICKET003', submitterId: 'driverZ3', submitterName: 'Bob K.', submitterRole: 'driver', driverOperatorCode: 'OP002', driverOperatorName: 'Speedy Cars (Mock)', category: 'Operator Concern', details: 'My operator (OP002) is not responding to my calls regarding shifts.', submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'Resolved', lastUpdated: new Date(Date.now() - 86400000 * 3).toISOString(), assignedTo: 'AdminMike' },
  { id: 'TICKET004', submitterId: 'operatorA1', submitterName: 'City Cabs', submitterRole: 'operator', category: 'Platform Suggestion', details: 'It would be great to have bulk driver import feature.', submittedAt: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'Closed' },
  { id: 'TICKET005', submitterId: 'driverW5', submitterName: 'Will Byers', submitterRole: 'driver', driverOperatorCode: 'OP001', driverOperatorName: 'City Cabs (Mock)', category: 'Safety Concern', details: 'Street lighting on Elm St is very poor, making night pickups difficult.', submittedAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), status: 'Pending' },
];


interface UpdateContext {
  params: {
    ticketId: string;
  };
}

export async function PUT(request: NextRequest, context: UpdateContext) {
  const { ticketId } = context.params;
  // TODO: Implement admin authentication
  try {
    const { status } = await request.json() as { status: SupportTicket['status'] };
    if (!status || !['Pending', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided.' }, { status: 400 });
    }

    const ticketIndex = serverMockTickets.findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) {
      return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });
    }

    serverMockTickets[ticketIndex] = {
      ...serverMockTickets[ticketIndex],
      status: status,
      lastUpdated: new Date().toISOString(),
    };
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return NextResponse.json(serverMockTickets[ticketIndex], { status: 200 });

  } catch (error) {
    console.error(`Error updating ticket ${ticketId}:`, error);
    return NextResponse.json({ message: "Failed to update ticket", details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: UpdateContext) {
  const { ticketId } = context.params;
  // TODO: Implement admin authentication
  try {
    const initialLength = serverMockTickets.length;
    serverMockTickets = serverMockTickets.filter(t => t.id !== ticketId);

    if (serverMockTickets.length === initialLength) {
      return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });
    }
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return NextResponse.json({ message: 'Ticket deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting ticket ${ticketId}:`, error);
    return NextResponse.json({ message: "Failed to delete ticket", details: (error as Error).message }, { status: 500 });
  }
}
    
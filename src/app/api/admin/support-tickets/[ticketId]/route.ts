import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { withAdminAuth } from '@/lib/auth-middleware';
import { FieldValue } from 'firebase-admin/firestore';

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

interface UpdateContext {
  params: {
    ticketId: string;
  };
}

export const GET = withAdminAuth(async (req, { params }) => {
    const db = getDb();
    try {
        const ticketRef = db.collection('support-tickets').doc(params.ticketId);
        const doc = await ticketRef.get();
        if (!doc.exists) {
            return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
        }
        return NextResponse.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch ticket", details: (error as Error).message }, { status: 500 });
    }
});

export const PUT = withAdminAuth(async (req, { params }) => {
    const { ticketId } = params;
    const db = getDb();
    try {
        const { status } = await req.json() as { status: SupportTicket['status'] };
        if (!status || !['Pending', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
            return NextResponse.json({ message: 'Invalid status provided.' }, { status: 400 });
        }
        
        const ticketRef = db.collection('support-tickets').doc(ticketId);
        await ticketRef.update({
          status: status,
          lastUpdated: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ message: `Ticket ${ticketId} updated successfully.` });
    } catch (error) {
        return NextResponse.json({ message: "Failed to update ticket", details: (error as Error).message }, { status: 500 });
    }
});

export const DELETE = withAdminAuth(async (req, { params }) => {
    const { ticketId } = params;
    const db = getDb();
    try {
        const ticketRef = db.collection('support-tickets').doc(ticketId);
        await ticketRef.delete();
        
        return NextResponse.json({ message: `Ticket ${ticketId} deleted successfully.` });
    } catch (error) {
        return NextResponse.json({ message: "Failed to delete ticket", details: (error as Error).message }, { status: 500 });
    }
});
    
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formatISO } from 'date-fns';
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

export const GET = withAdminAuth(async (req) => {
  const db = getDb();
  try {
    const ticketsSnapshot = await db.collection('support-tickets').orderBy('submittedAt', 'desc').get();
    const tickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return NextResponse.json({ message: "Failed to fetch tickets", details: (error as Error).message }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (req) => {
  const db = getDb();
  try {
    const newTicketData = await req.json();
    
    const newTicket = {
      ...newTicketData,
      submittedAt: FieldValue.serverTimestamp(),
      status: 'Pending',
    };

    const docRef = await db.collection('support-tickets').add(newTicket);
    
    return NextResponse.json({ id: docRef.id, ...newTicket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Failed to create ticket", details: (error as Error).message }, { status: 500 });
  }
});
    
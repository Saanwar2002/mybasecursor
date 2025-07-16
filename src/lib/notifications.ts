import { Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'signup' | 'support' | 'emergency';

export interface Notification {
  toUserId?: string; // If targeting a specific user
  toRole?: string;   // If targeting a role (e.g., 'admin', 'operator')
  type: NotificationType;
  title: string;
  body: string;
  createdAt?: Timestamp;
  read?: boolean;
  link?: string;
}

export async function createNotification(notification: Notification) {
  if (!db) throw new Error('Firestore not initialized');
  const doc = {
    ...notification,
    read: false,
    createdAt: Timestamp.now(),
  };
  await addDoc(collection(db, 'notifications'), doc);
}

// Helper functions for common notification types
export async function notifyNewSignup({ toRole, toUserId, driverName, operatorName, link }: { toRole?: string, toUserId?: string, driverName?: string, operatorName?: string, link?: string }) {
  await createNotification({
    toRole,
    toUserId,
    type: 'signup',
    title: 'New Signup Pending Approval',
    body: driverName ? `Driver ${driverName} has signed up and is pending approval.` : `Operator ${operatorName} has signed up and is pending approval.`,
    link: link || '/admin/manage-drivers',
  });
}

export async function notifySupportTicket({ toRole, toUserId, ticketId, subject, link }: { toRole?: string, toUserId?: string, ticketId: string, subject?: string, link?: string }) {
  await createNotification({
    toRole,
    toUserId,
    type: 'support',
    title: 'Support Ticket Update',
    body: subject ? `Ticket: ${subject}` : `Support ticket updated.`,
    link: link || `/admin/support-tickets/${ticketId}`,
  });
}

export async function notifyDriverEmergency({ toRole, toUserId, driverName, location, link }: { toRole?: string, toUserId?: string, driverName: string, location?: string, link?: string }) {
  await createNotification({
    toRole,
    toUserId,
    type: 'emergency',
    title: 'Driver Emergency Alert',
    body: location ? `Emergency alert from ${driverName} at ${location}.` : `Emergency alert from ${driverName}.`,
    link: link || '/admin/server-monitoring',
  });
} 
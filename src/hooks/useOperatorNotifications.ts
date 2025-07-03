import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';

export interface OperatorNotification {
  id: string;
  toUserId?: string;
  toRole?: string;
  type: string;
  title: string;
  body: string;
  createdAt: any;
  read: boolean;
  link?: string;
}

export function useOperatorNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OperatorNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user) return () => {};
    // Listen for notifications for this operator (by UID or by role)
    const q = query(
      collection(db, 'notifications'),
      where('read', '==', false),
      where('toRole', 'in', ['operator', 'all']),
      orderBy('createdAt', 'desc')
    );
    // Optionally, add a second query for toUserId == user.id
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: OperatorNotification[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Show if toUserId matches or toRole matches
        if ((data.toUserId && data.toUserId === user.id) || (data.toRole && (data.toRole === 'operator' || data.toRole === 'all'))) {
          notifs.push({ id: docSnap.id, ...data } as OperatorNotification);
        }
      });
      setNotifications(notifs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return { notifications, unreadCount, loading, markAsRead };
} 
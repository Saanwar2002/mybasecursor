import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Timestamp, SerializedTimestamp } from '../types/global';

export interface OperatorNotification {
  id: string;
  toUserId?: string;
  toRole?: string;
  type: string;
  title: string;
  body: string;
  createdAt: Timestamp | SerializedTimestamp;
  read: boolean;
  link?: string;
}

export function useOperatorNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OperatorNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user || !user.id) return () => {};

    const q = query(
      collection(db, 'notifications'),
      where('read', '==', false),
      where('toRole', 'in', ['operator', 'all']),
      orderBy('createdAt', 'desc')
    );

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs: OperatorNotification[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if ((data.toUserId && data.toUserId === user.id) || (data.toRole && (data.toRole === 'operator' || data.toRole === 'all'))) {
            notifs.push({ id: docSnap.id, ...data } as OperatorNotification);
          }
        });
        setNotifications(notifs);
        setLoading(false);
      });
    } catch (err) {
      console.error("Firestore onSnapshot error in useOperatorNotifications:", err);
      setLoading(false);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return { notifications, unreadCount, loading, markAsRead };
} 
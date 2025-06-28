import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  role?: string;
  status?: string;
}

export function useChatUsers(currentUserId: string | undefined | null) {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !currentUserId) {
      setChatUsers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    
    // Fetch users that the current user can chat with (drivers, support, etc.)
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['driver', 'support', 'operator']),
      orderBy('name')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const users: ChatUser[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: doc.id,
            name: data.name || 'Unknown User',
            avatar: data.avatarUrl || `https://placehold.co/40x40.png?text=${data.name?.charAt(0) || 'U'}`,
            lastMessage: data.lastMessage || '',
            timestamp: data.lastMessageTime || '',
            unread: data.unreadCount || 0,
            role: data.role,
            status: data.status
          });
        });
        setChatUsers(users);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching chat users:', err);
        setError('Failed to load chat users');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  return { chatUsers, loading, error };
} 
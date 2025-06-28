import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';

export interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  timestamp: string;
  senderId: string;
  receiverId: string;
}

export function useChatMessages(
  currentUserId: string | undefined | null,
  selectedChatUserId: string | undefined | null
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!db || !currentUserId || !selectedChatUserId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    
    // Create a chat ID that's consistent between two users
    const chatId = [currentUserId, selectedChatUserId].sort().join('_');
    
    // Query messages for this chat
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          msgs.push({
            id: doc.id,
            sender: data.senderId === currentUserId ? 'user' : 'other',
            text: data.text || '',
            timestamp: data.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || data.timestamp || '',
            senderId: data.senderId,
            receiverId: data.receiverId
          });
        });
        setMessages(msgs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId, selectedChatUserId]);

  const sendMessage = async (text: string) => {
    if (!db || !currentUserId || !selectedChatUserId || !text.trim()) {
      return false;
    }

    setSending(true);
    try {
      const chatId = [currentUserId, selectedChatUserId].sort().join('_');
      
      await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: currentUserId,
        receiverId: selectedChatUserId,
        text: text.trim(),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      setSending(false);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      setSending(false);
      return false;
    }
  };

  return { messages, loading, error, sending, sendMessage };
} 
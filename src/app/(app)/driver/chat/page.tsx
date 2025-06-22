"use client";
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle, X, ListPlus } from "lucide-react"; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  timestamp: string;
}

const quickReplies = [
  { id: "qr1", text: "I'm on my way." },
  { id: "qr2", text: "I have arrived at the pickup location." },
  { id: "qr3", text: "I'm stuck in traffic, I might be a few minutes late." },
  { id: "qr4", text: "Okay, thank you." },
  { id: "qr5", text: "Can you please confirm your exact pickup spot?" },
  { id: "qr6", text: "Running slightly late, be there soon." },
];

export default function DriverChatPage() {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter(); 
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/driver/active-ride?driverId=${user.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setActiveRide(data))
        .catch(() => setActiveRide(null));
    }
  }, [user]);

  useEffect(() => {
    if (!activeRide?.id || !db) {
        setMessages([]);
        return;
    };

    const rideMessagesRef = collection(db, 'chats', activeRide.id, 'messages');
    const q = query(rideMessagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newMessages: Message[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.senderId === user?.id ? 'user' : 'other',
          text: data.text,
          timestamp: data.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
        };
      });
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [activeRide, user?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !activeRide || !user) return;

    await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rideId: activeRide.id,
        senderId: user.id,
        text: newMessage,
      }),
    });

    setNewMessage('');
  };

  const handleQuickReplySelect = (replyText: string) => {
    setNewMessage(replyText);
    setIsQuickReplyOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)]">
      <Card className="flex-1 flex flex-col rounded-lg shadow-lg">
        {activeRide ? (
          <>
            <CardHeader className="border-b p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={activeRide.passengerAvatar || 'https://placehold.co/40x40.png?text=P'} alt={activeRide.passengerName} />
                  <AvatarFallback>{activeRide.passengerName?.charAt(0) || 'P'}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-headline">{activeRide.passengerName || 'Passenger'}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Go Back</span>
              </Button>
            </CardHeader>
            <ScrollArea className="flex-1 p-4 space-y-4 bg-muted/20">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                    <p>{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'}`}>{msg.timestamp}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>
            <CardContent className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Popover open={isQuickReplyOpen} onOpenChange={setIsQuickReplyOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                      <ListPlus className="w-5 h-5" />
                      <span className="sr-only">Quick Replies</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 max-h-60 overflow-y-auto">
                    <div className="space-y-1">
                      {quickReplies.map((reply) => (
                        <Button
                          key={reply.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-left h-auto py-1.5 px-2"
                          onClick={() => handleQuickReplySelect(reply.text)}
                        >
                          {reply.text}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <MessageCircle className="w-16 h-16 mb-4" />
            <p className="text-lg">No Active Ride</p>
            <p className="text-sm">When you accept a ride, you can chat with the passenger here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

"use client";
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle, X, Loader2, AlertTriangle } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  timestamp: string;
}

interface ActiveRide {
  id: string;
  driverName: string;
  driverAvatar?: string;
  status: string;
}

export default function ChatPage() {
  const [activeRide, setActiveRide] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, getAuthToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Fetch active ride
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchActiveRide = async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const response = await fetch('/api/bookings/my-active-ride', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 404) {
          setError("No active ride found.");
          setActiveRide(null);
        } else if (response.ok) {
          const ride = await response.json();
          setActiveRide(ride);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to fetch active ride.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchActiveRide();
  }, [user, getAuthToken]);

  // Fetch messages
  useEffect(() => {
    if (!activeRide) return;

    const fetchMessages = async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(`/api/chat/messages?rideId=${activeRide.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch messages.');
        }

        const data = await response.json();
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred fetching messages.');
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll for new messages every 5 seconds

    return () => clearInterval(interval);
  }, [activeRide, getAuthToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRide) return;

    const optimisticMessage = {
      text: newMessage,
      senderId: user?.uid,
      timestamp: new Date().toISOString(),
      optimistic: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
       const token = await getAuthToken();
       if (!token) throw new Error("Not authenticated");

      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rideId: activeRide.id,
          text: newMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message.');
      }
      // The message will be replaced by the one from polling, so no need to do anything with the response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred sending the message.');
      setMessages(prev => prev.filter(m => !m.optimistic)); // Remove optimistic message on failure
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)] items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)]">
      <Card className="flex-1 flex flex-col rounded-l-none shadow-lg">
        {activeRide ? (
          <>
            <CardHeader className="border-b p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={activeRide.driverAvatar} alt={activeRide.driverName} />
                  <AvatarFallback>{activeRide.driverName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl font-headline">{activeRide.driverName}</CardTitle>
                  <CardDescription className="text-sm">Ride in progress</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4 space-y-4 bg-muted/20">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow ${
                      msg.sender === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-card border'
                    }`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-xs mt-1 ${
                        msg.sender === 'user' 
                          ? 'text-primary-foreground/70 text-right' 
                          : 'text-muted-foreground text-left'
                      }`}>
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            <CardContent className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  disabled={!activeRide}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={!newMessage.trim() || !activeRide}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <MessageCircle className="w-16 h-16 mb-4" />
            <p className="text-lg">No active ride</p>
            <p className="text-sm">Chat will be available when you have an active ride.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active ride
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchActiveRide = async () => {
      try {
        const response = await fetch('/api/bookings/my-active-ride');
        if (response.ok) {
          const data = await response.json();
          if (data.ride && ['accepted', 'en_route_to_pickup', 'at_pickup', 'in_progress'].includes(data.ride.status)) {
            setActiveRide(data.ride);
          } else {
            setActiveRide(null);
          }
        } else {
          setActiveRide(null);
        }
      } catch (err) {
        console.error('Error fetching active ride:', err);
        setError('Failed to load ride information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveRide();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!activeRide?.id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages?rideId=${activeRide.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        } else {
          setError('Failed to load messages');
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages');
      }
    };

    fetchMessages();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeRide]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !activeRide || !user || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: activeRide.id,
          text: newMessage.trim(),
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // The message will be added to the list when we poll for updates
      } else {
        toast({
          title: "Failed to send message",
          description: "Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not send message. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
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
                  disabled={isSending}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={isSending || !newMessage.trim()}
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
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

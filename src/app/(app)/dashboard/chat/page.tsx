"use client";
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle, X, Loader2 } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { useChatUsers, ChatUser } from '@/hooks/useChatUsers';
import { useChatMessages, Message } from '@/hooks/useChatMessages';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use real Firestore data
  const { chatUsers, loading: loadingUsers, error: usersError } = useChatUsers(user?.id);
  const { messages, loading: loadingMessages, error: messagesError, sending, sendMessage } = useChatMessages(user?.id, selectedChat?.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSelectChat = (user: ChatUser) => {
    setSelectedChat(user);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedChat || sending) return;

    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage("");
    } else {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Show loading state
  if (loadingUsers) {
    return (
      <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading chats...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (usersError) {
    return (
      <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading chats</p>
          <p className="text-sm text-muted-foreground">{usersError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)]">
      <Card className="w-1/3 border-r-0 rounded-r-none shadow-lg">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" /> Chats
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[calc(100%-4.5rem)]">
          <CardContent className="p-0">
            {chatUsers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>No chat users available</p>
                <p className="text-sm">Drivers and support will appear here when available.</p>
              </div>
            ) : (
              chatUsers.map(user => (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${selectedChat?.id === user.id ? 'bg-muted' : ''}`}
                  onClick={() => handleSelectChat(user)}
                >
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.lastMessage || 'No messages yet'}</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <p>{user.timestamp || ''}</p>
                    {user.unread && user.unread > 0 && (
                      <span className="mt-1 inline-block bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                        {user.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col rounded-l-none shadow-lg">
        {selectedChat ? (
          <>
            <CardHeader className="border-b p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedChat.avatar} alt={selectedChat.name} />
                  <AvatarFallback>{selectedChat.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-headline">{selectedChat.name}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Close chat</span>
              </Button>
            </CardHeader>
            <ScrollArea className="flex-1 p-4 space-y-4 bg-muted/20">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messagesError ? (
                <div className="text-center text-destructive py-8">
                  <p>Error loading messages</p>
                  <p className="text-sm">{messagesError}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No messages yet</p>
                  <p className="text-sm">Start a conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                      <p>{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'}`}>{msg.timestamp}</p>
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
                  disabled={sending}
                />
                <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={sending}>
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <MessageCircle className="w-16 h-16 mb-4" />
            <p className="text-lg">Select a chat to start messaging</p>
            <p className="text-sm">Communicate with drivers or support here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

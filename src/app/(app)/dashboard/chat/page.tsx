
"use client";
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread?: number;
}

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  timestamp: string;
}

const initialMockChatUsers: ChatUser[] = [
  { id: 'driver1', name: 'Driver John D.', avatar: 'https://placehold.co/40x40.png?text=JD', lastMessage: "I'm arriving in 2 minutes.", timestamp: "10:30 AM", unread: 1 },
  { id: 'driver2', name: 'Driver Jane S.', avatar: 'https://placehold.co/40x40.png?text=JS', lastMessage: "Okay, see you soon!", timestamp: "Yesterday" },
  { id: 'support', name: 'TaxiNow Support', avatar: 'https://placehold.co/40x40.png?text=TN', lastMessage: "How can we help you today?", timestamp: "Mon" },
];

const initialMockMessages: { [key: string]: Message[] } = {
  driver1: [
    { id: 'm1', sender: 'other', text: "Hello! I'm your driver, John. I'm on my way.", timestamp: "10:25 AM" },
    { id: 'm2', sender: 'user', text: "Great, thank you!", timestamp: "10:26 AM" },
    { id: 'm3', sender: 'other', text: "I'm arriving in 2 minutes.", timestamp: "10:30 AM" },
  ],
  driver2: [
     { id: 'm4', sender: 'other', text: "Okay, see you soon!", timestamp: "Yesterday" },
  ],
  support: [
     { id: 'm5', sender: 'other', text: "How can we help you today?", timestamp: "Mon" },
  ]
};

export default function ChatPage() {
  const [chatUsersList, setChatUsersList] = useState<ChatUser[]>(initialMockChatUsers);
  const [selectedChat, setSelectedChat] = useState<ChatUser | null>(initialMockChatUsers[0]);
  const [messages, setMessages] = useState<Message[]>(initialMockMessages[initialMockChatUsers[0].id]);
  const [messagesData, setMessagesData] = useState<{ [key: string]: Message[] }>(initialMockMessages);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (selectedChat) {
      setMessages(messagesData[selectedChat.id] || []);
    }
  }, [selectedChat, messagesData]);

  const handleSelectChat = (user: ChatUser) => {
    setSelectedChat(user);
    setChatUsersList(prevUsers => 
      prevUsers.map(u => u.id === user.id ? {...u, unread: 0} : u)
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedChat) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: newMessage,
      timestamp: currentTime,
    };

    setMessages(prev => [...prev, userMsg]);
    
    const updatedMessagesForSelectedChat = [...(messagesData[selectedChat.id] || []), userMsg];
    setMessagesData(prevData => ({
      ...prevData,
      [selectedChat.id]: updatedMessagesForSelectedChat,
    }));

    setChatUsersList(prevUsers => 
      prevUsers.map(u => 
        u.id === selectedChat.id ? { ...u, lastMessage: newMessage, timestamp: currentTime, unread: 0 } : u
      )
    );
    setSelectedChat(prevSel => prevSel ? {...prevSel, lastMessage: newMessage, timestamp: currentTime, unread: 0} : null);


    const replyText = `Roger that! "${newMessage.substring(0, 20)}${newMessage.length > 20 ? '...' : ''}"`;
    setNewMessage(""); // Clear input after capturing its value

    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const replyMsg: Message = {
        id: `other-${Date.now()}`,
        sender: 'other',
        text: replyText,
        timestamp: replyTime,
      };
      setMessages(prev => [...prev, replyMsg]);
      
      const finalMessagesForChat = [...updatedMessagesForSelectedChat, replyMsg];
       setMessagesData(prevData => ({
        ...prevData,
        [selectedChat.id]: finalMessagesForChat,
      }));

      setChatUsersList(prevUsers => 
        prevUsers.map(u => 
          u.id === selectedChat.id ? { ...u, lastMessage: replyText, timestamp: replyTime } : u
        )
      );
      setSelectedChat(prevSel => prevSel ? {...prevSel, lastMessage: replyText, timestamp: replyTime} : null);

    }, 1200);
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)]"> {/* Adjusted height */}
      <Card className="w-1/3 border-r-0 rounded-r-none shadow-lg">
        <CardHeader className="border-b p-4">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" /> Chats
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[calc(100%-4.5rem)]"> {/* Adjusted height */}
          <CardContent className="p-0">
            {chatUsersList.map(user => (
              <div
                key={user.id}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${selectedChat?.id === user.id ? 'bg-muted' : ''}`}
                onClick={() => handleSelectChat(user)}
              >
                <Avatar>
                  <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="avatar profile" />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.lastMessage}</p>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <p>{user.timestamp}</p>
                  {user.unread && user.unread > 0 && (
                    <span className="mt-1 inline-block bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {user.unread}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col rounded-l-none shadow-lg">
        {selectedChat ? (
          <>
            <CardHeader className="border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedChat.avatar} alt={selectedChat.name} data-ai-hint="avatar profile" />
                  <AvatarFallback>{selectedChat.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-headline">{selectedChat.name}</CardTitle>
              </div>
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
            <p className="text-lg">Select a chat to start messaging</p>
            <p className="text-sm">Communicate with drivers or support here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

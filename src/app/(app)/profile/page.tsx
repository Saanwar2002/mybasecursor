
"use client";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

export default function ProfilePage() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.role === 'driver' ? "555-0101" : ""); // Example phone
    }
  }, [user]);


  const handleSaveProfile = () => {
    if (!user) return;
    // Simulate updating user details. In a real app, this would be an API call.
    // For now, we'll update the AuthContext directly.
    login(email, name, user.role, user.vehicleCategory); 
    setIsEditing(false);
    toast({ title: "Profile Updated", description: "Your profile details have been saved." });
  };
  
  if (!user) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <UserCircle className="w-8 h-8 text-primary" /> Your Profile
          </CardTitle>
          <CardDescription>View and manage your account details and preferences.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile large"/>
            <AvatarFallback className="text-3xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <CardTitle className="text-2xl font-headline">{user.name}</CardTitle>
            <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1">
              <Briefcase className="w-4 h-4" /> {user.role}
            </CardDescription>
          </div>
          <Button variant={isEditing ? "destructive" : "outline"} onClick={() => setIsEditing(!isEditing)}>
            <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Profile"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name" className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</Label>
            {isEditing ? (
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            ) : (
              <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</Label>
            {isEditing ? (
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            ) : (
              <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
            )}
          </div>
          {user.role === 'driver' && (
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</Label>
              {isEditing ? (
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              ) : (
                <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{phone || "Not set"}</p>
              )}
            </div>
          )}
          {isEditing && (
            <Button onClick={handleSaveProfile} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">Save Profile Changes</Button>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-5 h-5 text-green-500" />
                Your information is kept secure.
            </div>
        </CardFooter>
      </Card>
      
      {user.role === 'passenger' && 
        <Card>
            <CardHeader><CardTitle>Payment Methods (Placeholder)</CardTitle></CardHeader>
            <CardContent>
                <Image src="https://placehold.co/300x100.png?text=Add+Payment+Method" data-ai-hint="credit card payment" alt="Payment methods" width={300} height={100} />
                <p className="text-muted-foreground mt-2">Secure payment gateway integration via Stripe (Test Mode).</p>
            </CardContent>
        </Card>
      }
    </div>
  );
}

    
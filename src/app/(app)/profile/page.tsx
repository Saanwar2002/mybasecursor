
"use client";
import { useAuth, User, UserRole } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2, AlertTriangle, Users, Car as CarIcon } from "lucide-react"; // Removed KeyRound
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
// Removed Zod and react-hook-form imports if no longer needed after PIN removal
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import * as z from "zod";
// import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// PIN Schema and related types are removed from here

export default function ProfilePage() {
  const { user, login, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Removed PIN related state
  // const [currentPin, setCurrentPin] = useState<string | null>(null);
  // const [isSettingPin, setIsSettingPin] = useState(false);
  
  // Removed PIN form initialization

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phoneNumber || (user.role === 'driver' ? "555-0101" : ""));

      // Removed PIN loading from localStorage
    }
  }, [user]);

  const handleSaveProfile = () => {
    if (!user) return;
    const updatedDetails: Partial<User> = {};
    if (name !== user.name) updatedDetails.name = name;
    if (email !== user.email) updatedDetails.email = email;
    if (phone !== user.phoneNumber) updatedDetails.phoneNumber = phone;

    if (Object.keys(updatedDetails).length > 0) { updateUserProfileInContext(updatedDetails); }
    setIsEditing(false);
    toast({ title: "Profile Changes Applied (Mock)", description: "Your profile display has been updated." });
  };

  // Removed PIN handler functions (handleSetPin, handleRemovePin)

  if (!user) {
    return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p> </div> );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"> <UserCircle className="w-8 h-8 text-primary" /> Your Profile </CardTitle> <CardDescription>View and manage your account details and preferences.</CardDescription> </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary"> <AvatarImage src={user?.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile large"/> <AvatarFallback className="text-3xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback> </Avatar>
          <div className="flex-1 text-center md:text-left"> <CardTitle className="text-2xl font-headline">{user.name}</CardTitle> <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1"> <Briefcase className="w-4 h-4" /> {user.role} </CardDescription> </div>
          <Button variant={isEditing ? "destructive" : "outline"} onClick={() => setIsEditing(!isEditing)}>
            <span className="flex items-center justify-center">
              <Edit3 className="mr-2 h-4 w-4" />
              {isEditing ? <span>Cancel Edit</span> : <span>Edit Profile</span>}
            </span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name">
              <span className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</span>
            </Label>
            {isEditing ? (<Input id="name" value={name} onChange={(e) => setName(e.target.value)} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>)}
          </div>
          <div>
            <Label htmlFor="email">
              <span className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</span>
            </Label>
            <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
            {isEditing && <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact support if needed.</p>}
          </div>
          <div>
            <Label htmlFor="phone">
              <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</span>
            </Label>
            {isEditing ? (<Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={user.role === 'passenger' ? "Required for passengers" : "Optional"} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.phoneNumber || "Not set"}</p>)}
            {user.phoneVerified === false && user.phoneVerificationDeadline && (<p className="text-sm text-orange-600 mt-1">Phone not verified. Please verify by {new Date(user.phoneVerificationDeadline).toLocaleDateString()}. (Verification UI not yet implemented)</p>)}
            {user.phoneVerified === true && (<p className="text-sm text-green-600 mt-1">Phone verified.</p>)}
          </div>
          
          {isEditing && (<Button onClick={handleSaveProfile} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">Save Profile Changes</Button>)}
        </CardContent>
        <CardFooter className="border-t pt-6"> <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Shield className="w-5 h-5 text-green-500" /> Your information is kept secure. </div> </CardFooter>
      </Card>
      
      {/* PIN Setup Card Removed From Here */}

      {user.role === 'passenger' && 
        <Card>
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground"/>Payment Methods</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <CreditCard className="w-16 h-16 text-primary mb-4 opacity-50" />
            <p className="text-muted-foreground mb-3">
              Securely manage your payment methods here.
            </p>
            <Button disabled className="bg-primary/80 hover:bg-primary/70">
              Add Payment Method (Coming Soon)
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Integration with Stripe (Test Mode) is planned for future updates.
            </p>
          </CardContent>
        </Card>
      }
    </div>
  );
}

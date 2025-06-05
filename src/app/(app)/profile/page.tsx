
"use client";
import { useAuth, User } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StoredPinUser extends User {
  pin: string;
}

const pinSetupSchema = z.object({
  newPin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 digits." }),
  confirmNewPin: z.string().length(4, { message: "PIN must be 4 digits." }),
}).refine((data) => data.newPin === data.confirmNewPin, {
  message: "PINs do not match.",
  path: ["confirmNewPin"],
});

export default function ProfilePage() {
  const { user, login, updateUserProfileInContext } = useAuth(); // Use updateUserProfileInContext if needed for other fields
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);


  const pinForm = useForm<z.infer<typeof pinSetupSchema>>({
    resolver: zodResolver(pinSetupSchema),
    defaultValues: {
      newPin: "",
      confirmNewPin: "",
    },
  });


  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phoneNumber || (user.role === 'driver' ? "555-0101" : "")); // Example phone

      // Load current PIN for this user if it exists for this device
      const storedUserData = localStorage.getItem('linkCabsUserWithPin');
      if (storedUserData) {
        try {
            const parsedData: StoredPinUser = JSON.parse(storedUserData);
            if (parsedData.id === user.id) { // Check if the stored PIN belongs to the current user
                setCurrentPin(parsedData.pin);
            }
        } catch (e) {
            console.error("Error parsing stored PIN user data:", e);
            localStorage.removeItem('linkCabsUserWithPin'); // Clear corrupted data
        }
      } else {
        setCurrentPin(null);
      }
    }
  }, [user]);


  const handleSaveProfile = () => {
    if (!user) return;
    // Simulate updating user details.
    // For actual profile fields like name/email, you'd make an API call to update Firestore and Firebase Auth.
    // Here, we'll update the context for 'name' and 'email' if they were part of the form.
    const updatedDetails: Partial<User> = {};
    if (name !== user.name) updatedDetails.name = name;
    if (email !== user.email) updatedDetails.email = email; // Email updates are complex in Firebase, usually requires re-auth.
    if (phone !== user.phoneNumber) updatedDetails.phoneNumber = phone;

    if (Object.keys(updatedDetails).length > 0) {
        updateUserProfileInContext(updatedDetails); // Update context
        // TODO: Add API call to persist these to Firestore user document.
    }
    
    setIsEditing(false);
    toast({ title: "Profile Changes Applied (Mock)", description: "Your profile display has been updated." });
  };
  
  const handleSetPin = (values: z.infer<typeof pinSetupSchema>) => {
    if (!user) return;
    setIsSettingPin(true);
    const userWithPin: StoredPinUser = {
      ...user,
      pin: values.newPin, // Storing PIN directly - NOT SECURE for production
    };
    localStorage.setItem('linkCabsUserWithPin', JSON.stringify(userWithPin));
    setCurrentPin(values.newPin);
    pinForm.reset();
    setIsSettingPin(false);
    toast({ title: "PIN Set for This Device", description: "You can now use this PIN for quick login on this device." });
  };

  const handleRemovePin = () => {
    if (!user) return;
    localStorage.removeItem('linkCabsUserWithPin');
    setCurrentPin(null);
    toast({ title: "PIN Removed", description: "Quick PIN login has been disabled for this device." });
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
             <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
             {isEditing && <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact support if needed.</p>}
          </div>
          
          <div>
              <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</Label>
              {isEditing ? (
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={user.role === 'passenger' ? "Required for passengers" : "Optional"} />
              ) : (
                <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.phoneNumber || "Not set"}</p>
              )}
              {user.phoneVerified === false && user.phoneVerificationDeadline && (
                <p className="text-sm text-orange-600 mt-1">Phone not verified. Please verify by {new Date(user.phoneVerificationDeadline).toLocaleDateString()}. (Verification UI not yet implemented)</p>
              )}
              {user.phoneVerified === true && (
                 <p className="text-sm text-green-600 mt-1">Phone verified.</p>
              )}
            </div>

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
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-muted-foreground"/>Quick PIN Login (This Device Only)</CardTitle>
            <CardDescription>Set a 4-digit PIN for faster login on this device. This is a mock feature and not secure for production.</CardDescription>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Mock Feature</AlertTitle>
                <AlertDescription>
                This PIN feature is for UI demonstration only. It stores the PIN in your browser and is **not secure**. Do not use real sensitive PINs.
                </AlertDescription>
            </Alert>
            {currentPin ? (
                <div className="space-y-3">
                    <p>A PIN is currently set for this device: <span className="font-mono bg-muted px-2 py-1 rounded text-lg tracking-widest">{currentPin.split('').join(' • ')}</span> (Showing for demo, normally hidden)</p>
                    <Button onClick={handleRemovePin} variant="destructive">Remove PIN for this Device</Button>
                </div>
            ) : (
                <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handleSetPin)} className="space-y-4">
                        <FormField control={pinForm.control} name="newPin" render={({ field }) => (
                            <FormItem>
                                <FormLabel>New 4-Digit PIN</FormLabel>
                                <FormControl>
                                    <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="••••" {...field} disabled={isSettingPin} className="text-center text-xl tracking-[0.3em]" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={pinForm.control} name="confirmNewPin" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm New PIN</FormLabel>
                                <FormControl>
                                    <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="••••" {...field} disabled={isSettingPin} className="text-center text-xl tracking-[0.3em]" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <Button type="submit" disabled={isSettingPin} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            {isSettingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Set PIN for this Device
                        </Button>
                    </form>
                </Form>
            )}
        </CardContent>
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

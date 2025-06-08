
"use client";
import { useAuth, User, UserRole } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2, KeyRound, AlertTriangle, Users, UserX, Car as CarIcon, Trash2, CreditCard, Dog } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

interface BlockedUserDisplay {
  blockId: string;
  blockedUserId: string;
  blockedUserName: string;
  blockedUserRole: UserRole;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, login, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserDisplay[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [errorBlockedUsers, setErrorBlockedUsers] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  
  // Local state for driver's pet friendly preference
  const [acceptsPetFriendlyJobs, setAcceptsPetFriendlyJobs] = useState(user?.acceptsPetFriendlyJobs || false);


  const pinForm = useForm<z.infer<typeof pinSetupSchema>>({
    resolver: zodResolver(pinSetupSchema),
    defaultValues: { newPin: "", confirmNewPin: "" },
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phoneNumber || (user.role === 'driver' ? "555-0101" : ""));
      setAcceptsPetFriendlyJobs(user.acceptsPetFriendlyJobs || false);

      const storedUserData = localStorage.getItem('myBaseUserWithPin');
      if (storedUserData) {
        try {
            const parsedData: StoredPinUser = JSON.parse(storedUserData);
            if (parsedData.id === user.id) { setCurrentPin(parsedData.pin); }
        } catch (e) { console.error("Error parsing stored PIN user data:", e); localStorage.removeItem('myBaseUserWithPin'); }
      } else { setCurrentPin(null); }
    }
  }, [user]);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;
    setIsLoadingBlockedUsers(true);
    setErrorBlockedUsers(null);
    try {
      const response = await fetch(`/api/users/blocks?userId=${user.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch blocked users.");
      }
      const data: BlockedUserDisplay[] = await response.json();
      setBlockedUsers(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load blocked users."
      toast({ title: "Error", description: message, variant: "destructive" });
      setErrorBlockedUsers(message);
      setBlockedUsers([]);
    } finally {
      setIsLoadingBlockedUsers(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleSaveProfile = () => {
    if (!user) return;
    const updatedDetails: Partial<User> = {};
    if (name !== user.name) updatedDetails.name = name;
    if (email !== user.email) updatedDetails.email = email;
    if (phone !== user.phoneNumber) updatedDetails.phoneNumber = phone;
    if (user.role === 'driver' && acceptsPetFriendlyJobs !== user.acceptsPetFriendlyJobs) {
        updatedDetails.acceptsPetFriendlyJobs = acceptsPetFriendlyJobs;
    }


    if (Object.keys(updatedDetails).length > 0) { updateUserProfileInContext(updatedDetails); }
    setIsEditing(false);
    toast({ title: "Profile Changes Applied (Mock)", description: "Your profile display has been updated." });
  };

  const handleSetPin = (values: z.infer<typeof pinSetupSchema>) => {
    if (!user) return;
    setIsSettingPin(true);
    const userWithPin: StoredPinUser = { ...user, pin: values.newPin };
    localStorage.setItem('myBaseUserWithPin', JSON.stringify(userWithPin));
    setCurrentPin(values.newPin);
    pinForm.reset();
    setIsSettingPin(false);
    toast({ title: "PIN Set for This Device", description: "You can now use this PIN for quick login on this device." });
  };

  const handleRemovePin = () => {
    if (!user) return;
    localStorage.removeItem('myBaseUserWithPin');
    setCurrentPin(null);
    toast({ title: "PIN Removed", description: "Quick PIN login has been disabled for this device." });
  };

  const handleUnblockUser = async (blockId: string, blockedUserName: string) => {
    if (!user) return;
    setUnblockingUserId(blockId);
    try {
      const response = await fetch(`/api/users/blocks?blockId=${blockId}&userId=${user.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to unblock user.");
      }
      toast({ title: "User Unblocked", description: `${blockedUserName} has been removed from your block list.` });
      fetchBlockedUsers();
    } catch (error) {
      toast({ title: "Unblocking Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setUnblockingUserId(null);
    }
  };

  if (!user) {
    return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p> </div> );
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'passenger': return <UserCircle className="w-4 h-4 text-muted-foreground" />;
      case 'driver': return <CarIcon className="w-4 h-4 text-muted-foreground" />;
      case 'operator': return <Briefcase className="w-4 h-4 text-muted-foreground" />;
      case 'admin': return <Shield className="w-4 h-4 text-muted-foreground" />;
      default: return <UserCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"> <UserCircle className="w-8 h-8 text-primary" /> Your Profile </CardTitle> <CardDescription>View and manage your account details and preferences.</CardDescription> </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary"> <AvatarImage src={`https://placehold.co/100x100.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile large"/> <AvatarFallback className="text-3xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback> </Avatar>
          <div className="flex-1 text-center md:text-left"> <CardTitle className="text-2xl font-headline">{user.name}</CardTitle> <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1"> <Briefcase className="w-4 h-4" /> {user.role} </CardDescription> </div>
          <Button variant={isEditing ? "destructive" : "outline"} onClick={() => setIsEditing(!isEditing)}> <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Profile"} </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div> <Label htmlFor="name" className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</Label> {isEditing ? (<Input id="name" value={name} onChange={(e) => setName(e.target.value)} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>)} </div>
          <div> <Label htmlFor="email" className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</Label> <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p> {isEditing && <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact support if needed.</p>} </div>
          <div> <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</Label> {isEditing ? (<Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={user.role === 'passenger' ? "Required for passengers" : "Optional"} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.phoneNumber || "Not set"}</p>)} {user.phoneVerified === false && user.phoneVerificationDeadline && (<p className="text-sm text-orange-600 mt-1">Phone not verified. Please verify by {new Date(user.phoneVerificationDeadline).toLocaleDateString()}. (Verification UI not yet implemented)</p>)} {user.phoneVerified === true && (<p className="text-sm text-green-600 mt-1">Phone verified.</p>)} </div>
          
          {user.role === 'driver' && isEditing && (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2 text-foreground">
                  <Dog className="w-5 h-5 text-primary" />
                  Accept Pet Friendly Jobs?
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable this if you are willing to take pet friendly rides.
                </p>
              </div>
              <Switch
                checked={acceptsPetFriendlyJobs}
                onCheckedChange={setAcceptsPetFriendlyJobs}
                aria-label="Accept Pet Friendly Jobs toggle"
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30"
              />
            </FormItem>
          )}
          {user.role === 'driver' && !isEditing && (
             <div className="p-3 border rounded-md bg-muted/50">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Dog className="w-5 h-5 text-primary" /> Pet Friendly Jobs: 
                  <span className={cn("font-semibold", acceptsPetFriendlyJobs ? "text-green-600" : "text-red-600")}>
                    {acceptsPetFriendlyJobs ? "Allowed" : "Not Allowed"}
                  </span>
                </p>
             </div>
          )}

          {isEditing && (<Button onClick={handleSaveProfile} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">Save Profile Changes</Button>)}
        </CardContent>
        <CardFooter className="border-t pt-6"> <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Shield className="w-5 h-5 text-green-500" /> Your information is kept secure. </div> </CardFooter>
      </Card>

      <Card>
        <CardHeader> <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-muted-foreground"/>Manage Blocked Users</CardTitle> <CardDescription>Review and manage users you have blocked.</CardDescription> </CardHeader>
        <CardContent>
          {isLoadingBlockedUsers && <div className="flex items-center justify-center p-4"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Loading blocked users...</div>}
          {!isLoadingBlockedUsers && errorBlockedUsers && <p className="text-destructive">Error loading blocked users: {errorBlockedUsers}</p>}
          {!isLoadingBlockedUsers && !errorBlockedUsers && blockedUsers.length === 0 && <p className="text-muted-foreground">You haven't blocked any users.</p>}
          {!isLoadingBlockedUsers && !errorBlockedUsers && blockedUsers.length > 0 && (
            <div className="space-y-3">
              {blockedUsers.map((blocked) => (
                <div key={blocked.blockId} className="flex items-center justify-between p-3 border rounded-md bg-card hover:shadow-sm">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(blocked.blockedUserRole)}
                    <div>
                      <p className="font-medium">{blocked.blockedUserName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{blocked.blockedUserRole} (Blocked on: {new Date(blocked.createdAt).toLocaleDateString()})</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblockUser(blocked.blockId, blocked.blockedUserName)}
                    disabled={unblockingUserId === blocked.blockId}
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {unblockingUserId === blocked.blockId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
         <CardFooter className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Blocking a user prevents them from being assigned to your rides (if you are a passenger blocking a driver) or prevents their ride requests from being shown to you (if you are a driver blocking a passenger). This is a simplified demonstration.
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader> <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-muted-foreground"/>Quick PIN Login (This Device Only)</CardTitle> <CardDescription>Set a 4-digit PIN for faster login on this device. This is a mock feature and not secure for production.</CardDescription> </CardHeader>
        <CardContent>
            <Alert variant="destructive" className="mb-4"> <AlertTriangle className="h-4 w-4" /> <AlertTitle>Warning: Mock Feature</AlertTitle> <AlertDescription> This PIN feature is for UI demonstration only. It stores the PIN in your browser and is **not secure**. Do not use real sensitive PINs. </AlertDescription> </Alert>
            {currentPin ? ( <div className="space-y-3"> <p>A PIN is currently set for this device: <span className="font-mono bg-muted px-2 py-1 rounded text-lg tracking-widest">{currentPin.split('').join(' • ')}</span> (Showing for demo, normally hidden)</p> <Button onClick={handleRemovePin} variant="destructive">Remove PIN for this Device</Button> </div> ) : ( <Form {...pinForm}> <form onSubmit={pinForm.handleSubmit(handleSetPin)} className="space-y-4"> <FormField control={pinForm.control} name="newPin" render={({ field }) => ( <FormItem> <FormLabel>New 4-Digit PIN</FormLabel> <FormControl> <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="••••" {...field} disabled={isSettingPin} className="text-center text-xl tracking-[0.3em]" /> </FormControl> <FormMessage /> </FormItem> )} /> <FormField control={pinForm.control} name="confirmNewPin" render={({ field }) => ( <FormItem> <FormLabel>Confirm New PIN</FormLabel> <FormControl> <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="••••" {...field} disabled={isSettingPin} className="text-center text-xl tracking-[0.3em]" /> </FormControl> <FormMessage /> </FormItem> )} /> <Button type="submit" disabled={isSettingPin} className="bg-accent hover:bg-accent/90 text-accent-foreground"> {isSettingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Set PIN for this Device </Button> </form> </Form> )}
        </CardContent>
      </Card>

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

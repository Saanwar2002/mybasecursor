
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bell, Palette, Lock, HelpCircle, Dog, UserX, Car as CarIcon, Briefcase, UserCircle as UserCircleIcon, Trash2, AlertTriangle, Loader2, KeyRound, Layers, Info, Route } from "lucide-react"; 
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole, User, PLATFORM_OPERATOR_CODE } from "@/contexts/auth-context"; 
import { zodResolver } from "@hookform/resolvers/zod"; 
import { useForm } from "react-hook-form"; 
import * as z from "zod"; 
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; 
import { Input } from "@/components/ui/input"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { cn } from "@/lib/utils"; 

interface BlockedUserDisplay {
  blockId: string;
  blockedUserId: string;
  blockedUserName: string;
  blockedUserRole: UserRole;
  createdAt: string;
}

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


export default function SettingsPage() {
  const { user, updateUserProfileInContext } = useAuth(); 
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('theme');
      if (savedMode === null) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return savedMode === 'dark';
    }
    return false;
  });
  const [language, setLanguage] = useState("en");
  const [driverAcceptsPets, setDriverAcceptsPets] = useState(false); 
  const [driverAcceptsPlatformJobs, setDriverAcceptsPlatformJobs] = useState(false); 
  const [driverMaxJourneyDistance, setDriverMaxJourneyDistance] = useState("no_limit");

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserDisplay[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [errorBlockedUsers, setErrorBlockedUsers] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);
  
  const pinForm = useForm<z.infer<typeof pinSetupSchema>>({
    resolver: zodResolver(pinSetupSchema),
    defaultValues: { newPin: "", confirmNewPin: "" },
  });


  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      if (user.role === 'driver') {
        setDriverAcceptsPets(user.acceptsPetFriendlyJobs || false);
        setDriverAcceptsPlatformJobs(user.operatorCode === PLATFORM_OPERATOR_CODE ? true : (user.acceptsPlatformJobs || false));
        setDriverMaxJourneyDistance(user.maxJourneyDistance || "no_limit");
      }
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

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'passenger': return <UserCircleIcon className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'driver': return <CarIcon className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'operator': return <Briefcase className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'admin': return <Shield className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      default: return <UserCircleIcon className="w-4 h-4 inline mr-1 text-muted-foreground" />;
    }
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

  const handleSaveChanges = () => {
    let changesMadeDescription = "";
    const updates: Partial<User> = {};

    if (user && user.role === 'driver') {
      if (user.acceptsPetFriendlyJobs !== driverAcceptsPets) {
        updates.acceptsPetFriendlyJobs = driverAcceptsPets;
        changesMadeDescription += "Pet preference updated. ";
      }
      if (user.operatorCode !== PLATFORM_OPERATOR_CODE && user.acceptsPlatformJobs !== driverAcceptsPlatformJobs) { 
        updates.acceptsPlatformJobs = driverAcceptsPlatformJobs;
        changesMadeDescription += "Platform jobs preference updated. ";
      }
      if (user.maxJourneyDistance !== driverMaxJourneyDistance) {
        updates.maxJourneyDistance = driverMaxJourneyDistance;
        changesMadeDescription += "Max journey distance updated. ";
      }
    }
    
    if (Object.keys(updates).length > 0) {
      updateUserProfileInContext(updates);
    }

    if (changesMadeDescription.trim() === "") {
      changesMadeDescription = "No preference changes to save.";
    }
    toast({ title: "Settings Update", description: changesMadeDescription.trim() });
  };

  if (!user) {
    return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-4 text-lg text-muted-foreground">Loading settings...</p> </div> );
  }

  const isPlatformDriver = user.role === 'driver' && user.operatorCode === PLATFORM_OPERATOR_CODE;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> App Settings
          </CardTitle>
          <CardDescription>Customize your MyBase experience.</CardDescription>
        </CardHeader>
      </Card>

      {user?.role === 'driver' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><CarIcon className="w-5 h-5 text-muted-foreground" /> Driver Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="pet-friendly-switch" className="text-base">
                Accept Pet Friendly Jobs?
              </Label>
              <Switch
                id="pet-friendly-switch"
                checked={driverAcceptsPets}
                onCheckedChange={setDriverAcceptsPets}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Enable this if you are willing to take passengers with pets.
            </p>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="platform-jobs-switch" className="text-base">
                  Accept Jobs from MyBase Platform Pool?
                </Label>
                <p className="text-xs text-muted-foreground">
                  ON: Get jobs from your operator AND the general MyBase platform.
                  <br/>
                  OFF: Only jobs from your affiliated operator.
                </p>
              </div>
              <Switch
                id="platform-jobs-switch"
                checked={driverAcceptsPlatformJobs}
                onCheckedChange={isPlatformDriver ? undefined : setDriverAcceptsPlatformJobs}
                disabled={isPlatformDriver} 
                className={cn(isPlatformDriver && "cursor-not-allowed opacity-70")}
              />
            </div>
            {isPlatformDriver && (
              <Alert variant="default" className="mt-2 bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="font-semibold text-blue-700 dark:text-blue-300">Platform Driver Note</AlertTitle>
                  <AlertDescription className="text-sm text-blue-600 dark:text-blue-400">
                      As a MyBase direct driver ({PLATFORM_OPERATOR_CODE}), you automatically receive all jobs from the platform pool. This setting is fixed for you.
                  </AlertDescription>
              </Alert>
            )}
            
            <div className="pt-4 border-t space-y-2">
              <Label htmlFor="max-journey-distance-select" className="text-base flex items-center gap-1">
                <Route className="w-4 h-4 text-muted-foreground" /> Maximum Journey Distance
              </Label>
              <Select value={driverMaxJourneyDistance} onValueChange={setDriverMaxJourneyDistance}>
                <SelectTrigger id="max-journey-distance-select">
                  <SelectValue placeholder="Select max distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_limit">No Limit (National)</SelectItem>
                  <SelectItem value="local_5">Local (Up to 5 miles)</SelectItem>
                  <SelectItem value="medium_10">Medium (Up to 10 miles)</SelectItem>
                  <SelectItem value="long_20">Long (Up to 20 miles)</SelectItem>
                  <SelectItem value="extra_long_30">Extra Long (Up to 30 miles)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Set your preferred maximum distance for ride offers. This is a preference, actual offers depend on availability.
              </p>
            </div>

          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Bell className="w-5 h-5 text-muted-foreground" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notifications-switch" className="text-base">Enable Ride Notifications</Label>
            <Switch
              id="notifications-switch"
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Receive updates about your ride status, driver arrival, and promotions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Palette className="w-5 h-5 text-muted-foreground" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode-switch" className="text-base">Dark Mode</Label>
            <Switch
              id="dark-mode-switch"
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="language-select" className="text-base">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es" disabled>Español (Coming Soon)</SelectItem>
                <SelectItem value="fr" disabled>Français (Coming Soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
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
                    <p>A PIN is currently set for this device: <span className="font-mono bg-muted px-2 py-1 rounded text-lg tracking-widest">{currentPin.split('').map(() => '•').join(' ')}</span></p>
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
                           <span className="flex items-center justify-center">
                                {isSettingPin ? (
                                    <React.Fragment>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                        Setting PIN...
                                    </React.Fragment>
                                ) : (
                                    "Set PIN for this Device"
                                )}
                            </span>
                        </Button>
                    </form>
                </Form>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader> <CardTitle className="flex items-center gap-2"><UserX className="w-5 h-5 text-muted-foreground"/>Manage Blocked Users</CardTitle> <CardDescription>Review and manage users you have blocked.</CardDescription> </CardHeader>
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
                    <span className="flex items-center justify-center">
                      {unblockingUserId === blocked.blockId ? (
                        <React.Fragment>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            Unblocking...
                        </React.Fragment>
                      ) : (
                        <React.Fragment>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Unblock
                        </React.Fragment>
                      )}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
         <CardFooter className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Blocking a user prevents them from being assigned to your rides or their requests being shown to you.
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Lock className="w-5 h-5 text-muted-foreground" /> Account & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full md:w-auto" disabled>Change Password (Coming Soon)</Button>
          <Button variant="outline" className="w-full md:w-auto" disabled>Manage Linked Devices (Coming Soon)</Button>
          <Button variant="destructive" className="w-full md:w-auto" disabled>Delete Account (Coming Soon)</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><HelpCircle className="w-5 h-5 text-muted-foreground" /> Help & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button variant="link" className="p-0 h-auto" disabled>FAQs (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Contact Support (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Terms of Service (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Privacy Policy (Coming Soon)</Button>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSaveChanges} size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
          Save All Settings
        </Button>
      </div>
    </div>
  );
}

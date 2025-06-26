
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bell, Palette, Lock, HelpCircle, Dog, UserX, Car as CarIcon, Briefcase, UserCircle as UserCircleIcon, Trash2, AlertTriangle, Loader2, Layers, Info, Route, CreditCard, Coins, Save } from "lucide-react"; 
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole, User, PLATFORM_OPERATOR_CODE } from "@/contexts/auth-context"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { cn } from "@/lib/utils"; 
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";


interface BlockedUserDisplay {
  blockId: string;
  blockedUserId: string;
  blockedUserName: string;
  blockedUserRole: UserRole;
  createdAt: string;
}

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

  // Move persistDriverSetting to top-level so it's accessible everywhere
  const persistDriverSetting = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save setting.');
      }
      updateUserProfileInContext(updates);
    } catch (error) {
      toast({ title: 'Settings Update Failed', description: error instanceof Error ? error.message : 'Unknown error.', variant: 'destructive' });
    }
  };
  
  // Driver specific states
  const [driverAcceptsPets, setDriverAcceptsPets] = useState(user?.role === 'driver' ? user.acceptsPetFriendlyJobs || false : false); 
  const [driverAcceptsPlatformJobs, setDriverAcceptsPlatformJobs] = useState(user?.role === 'driver' ? (user.operatorCode === PLATFORM_OPERATOR_CODE ? true : (user.acceptsPlatformJobs || false)) : false); 
  const [driverMaxJourneyDistance, setDriverMaxJourneyDistance] = useState(user?.role === 'driver' ? user.maxJourneyDistance || "no_limit" : "no_limit");
  const [driverAcceptsAccountJobs, setDriverAcceptsAccountJobs] = useState(user?.role === 'driver' ? (user.acceptsAccountJobs === undefined ? true : user.acceptsAccountJobs) : true);

  // Passenger specific state
  const [passengerPaymentMethod, setPassengerPaymentMethod] = useState<'card' | 'cash' | undefined>(user?.role === 'passenger' ? user.preferredPaymentMethod || 'card' : 'card');

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserDisplay[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [errorBlockedUsers, setErrorBlockedUsers] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

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
        setDriverAcceptsAccountJobs(user.acceptsAccountJobs === undefined ? true : user.acceptsAccountJobs);
      } else if (user.role === 'passenger') {
        setPassengerPaymentMethod(user.preferredPaymentMethod || 'card');
      }
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

  const handleSaveChanges = async () => {
    let changesMadeDescription = "";
    const updates: Partial<User> = {};
    let saveError = null;

    if (user && user.role === 'driver') {
      if (user.acceptsPetFriendlyJobs !== driverAcceptsPets) { updates.acceptsPetFriendlyJobs = driverAcceptsPets; changesMadeDescription += "Pet preference updated. "; }
      if (user.operatorCode !== PLATFORM_OPERATOR_CODE && user.acceptsPlatformJobs !== driverAcceptsPlatformJobs) { updates.acceptsPlatformJobs = driverAcceptsPlatformJobs; changesMadeDescription += "Platform jobs preference updated. "; }
      if (user.maxJourneyDistance !== driverMaxJourneyDistance) { updates.maxJourneyDistance = driverMaxJourneyDistance; changesMadeDescription += "Max journey distance updated. "; }
      if (user.acceptsAccountJobs !== driverAcceptsAccountJobs) { updates.acceptsAccountJobs = driverAcceptsAccountJobs; changesMadeDescription += "Account jobs preference updated. "; }
    }

    if (user && user.role === 'passenger') {
      if (user.preferredPaymentMethod !== passengerPaymentMethod && passengerPaymentMethod) {
        updates.preferredPaymentMethod = passengerPaymentMethod;
        changesMadeDescription += "Preferred payment method updated. ";
      }
    }
    
    if (Object.keys(updates).length > 0) {
      try {
        // Helper to persist a single driver setting
        const persistDriverSetting = async (updates: Partial<User>) => {
          if (!user) return;
          try {
            const response = await fetch(`/api/users/${user.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates)
            });
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to save setting.');
            }
            updateUserProfileInContext(updates);
          } catch (error) {
            toast({ title: 'Settings Update Failed', description: error instanceof Error ? error.message : 'Unknown error.', variant: 'destructive' });
          }
        };
      } catch (error) {
        saveError = error instanceof Error ? error.message : 'Unknown error.';
      }
    }

    if (saveError) {
      toast({ title: "Settings Update Failed", description: saveError, variant: "destructive" });
      return;
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
              <Switch id="pet-friendly-switch" checked={driverAcceptsPets} onCheckedChange={(val) => { setDriverAcceptsPets(val); persistDriverSetting({ acceptsPetFriendlyJobs: val }); }}/>
            </div>
            <p className="text-sm text-muted-foreground">Enable this if you are willing to take passengers with pets.</p>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="platform-jobs-switch" className="text-base">Accept Jobs from MyBase Platform Pool?</Label>
                <p className="text-xs text-muted-foreground">ON: Get jobs from your operator AND the general MyBase platform.<br/>OFF: Only jobs from your affiliated operator.</p>
              </div>
              <Switch id="platform-jobs-switch" checked={driverAcceptsPlatformJobs} onCheckedChange={isPlatformDriver ? undefined : (val) => { setDriverAcceptsPlatformJobs(val); persistDriverSetting({ acceptsPlatformJobs: val }); }} disabled={isPlatformDriver} className={cn(isPlatformDriver && "cursor-not-allowed opacity-70")}/>
            </div>
            {isPlatformDriver && (
              <Alert variant="default" className="mt-2 bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="font-semibold text-blue-700 dark:text-blue-300">Platform Driver Note</AlertTitle>
                  <AlertDescription className="text-sm text-blue-600 dark:text-blue-400">As a MyBase direct driver ({PLATFORM_OPERATOR_CODE}), you automatically receive all jobs from the platform pool. This setting is fixed for you.</AlertDescription>
              </Alert>
            )}
            
            <div className="pt-4 border-t space-y-2">
              <Label htmlFor="max-journey-distance-select" className="text-base"><span className="flex items-center gap-1"><Route className="w-4 h-4 text-muted-foreground" /> Maximum Journey Distance</span></Label>
              <Select value={driverMaxJourneyDistance} onValueChange={(val) => { setDriverMaxJourneyDistance(val); persistDriverSetting({ maxJourneyDistance: val }); }}>
                <SelectTrigger id="max-journey-distance-select"><SelectValue placeholder="Select max distance" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_limit">No Limit (National)</SelectItem>
                  <SelectItem value="local_5">Local (Up to 5 miles)</SelectItem>
                  <SelectItem value="medium_10">Medium (Up to 10 miles)</SelectItem>
                  <SelectItem value="long_20">Long (Up to 20 miles)</SelectItem>
                  <SelectItem value="extra_long_30">Extra Long (Up to 30 miles)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Set your preferred maximum distance for ride offers. This is a preference, actual offers depend on availability.</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="account-jobs-switch" className="text-base">Accept Account Jobs?</Label>
              <Switch id="account-jobs-switch" checked={driverAcceptsAccountJobs} onCheckedChange={(val) => { setDriverAcceptsAccountJobs(val); persistDriverSetting({ acceptsAccountJobs: val }); }} />
            </div>
            <p className="text-sm text-muted-foreground">Enable this if you are willing to take on Account Jobs (e.g., corporate clients, school runs) which may have different payment/billing.</p>
          </CardContent>
        </Card>
      )}

      {user.role === 'passenger' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground" />Payment Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-base">Preferred Payment Method</Label>
            <RadioGroup
              value={passengerPaymentMethod}
              onValueChange={(value: 'card' | 'cash') => setPassengerPaymentMethod(value)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="payment-card" />
                <Label htmlFor="payment-card" className="font-normal flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-blue-500" /> Card
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="payment-cash" />
                <Label htmlFor="payment-cash" className="font-normal flex items-center gap-1">
                  <Coins className="w-4 h-4 text-green-500" /> Cash
                </Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              This will be pre-selected when you book a ride. You can always change it during booking.
            </p>
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
            <Switch id="notifications-switch" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled}/>
          </div>
          <p className="text-sm text-muted-foreground">Receive updates about your ride status, driver arrival, and promotions.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Palette className="w-5 h-5 text-muted-foreground" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode-switch" className="text-base">Dark Mode</Label>
            <Switch id="dark-mode-switch" checked={darkMode} onCheckedChange={setDarkMode}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language-select" className="text-base">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language-select"><SelectValue placeholder="Select language" /></SelectTrigger>
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
                  <Button variant="outline" size="sm" onClick={() => handleUnblockUser(blocked.blockId, blocked.blockedUserName)} disabled={unblockingUserId === blocked.blockId} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <span className="flex items-center justify-center">
                      {unblockingUserId === blocked.blockId ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Unblocking...</> ) : ( <><Trash2 className="mr-2 h-4 w-4"/>Unblock</> )}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
         <CardFooter className="border-t pt-4"> <p className="text-xs text-muted-foreground">Blocking a user prevents them from being assigned to your rides or their requests being shown to you.</p> </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Lock className="w-5 h-5 text-muted-foreground" /> Account & Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full md:w-auto" disabled>Change Password (Coming Soon)</Button>
          <Button variant="outline" className="w-full md:w-auto" disabled>Manage Linked Devices (Coming Soon)</Button>
          <Button variant="destructive" className="w-full md:w-auto" disabled>Delete Account (Coming Soon)</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle className="text-xl flex items-center gap-2"><HelpCircle className="w-5 h-5 text-muted-foreground" /> Help & Support</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <Button variant="link" className="p-0 h-auto" disabled>FAQs (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Contact Support (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Terms of Service (Coming Soon)</Button><br/>
            <Button variant="link" className="p-0 h-auto" disabled>Privacy Policy (Coming Soon)</Button>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSaveChanges} size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
          <Save className="mr-2 h-4 w-4" />Save All Settings
        </Button>
      </div>
    </div>
  );
}

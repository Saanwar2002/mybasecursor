
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bell, Palette, Lock, HelpCircle, Dog, UserX, Car as CarIcon, Briefcase, UserCircle as UserCircleIcon, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole } from "@/contexts/auth-context"; 

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
  const [driverAcceptsPets, setDriverAcceptsPets] = useState(false); 

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
    if (user && user.role === 'driver') {
      setDriverAcceptsPets(user.acceptsPetFriendlyJobs || false);
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
      fetchBlockedUsers(); // Refresh the list
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


  const handleSaveChanges = () => {
    let changesMadeDescription = "";
    if (user && user.role === 'driver' && user.acceptsPetFriendlyJobs !== driverAcceptsPets) {
      updateUserProfileInContext({ acceptsPetFriendlyJobs: driverAcceptsPets });
      changesMadeDescription += "Pet preference updated. ";
    }
    // Example: Save notifications settings (if they were fetched from a backend)
    // For now, it's mostly for the theme.
    // if (user.notificationsEnabled !== notificationsEnabled) {
    //   updateUserProfileInContext({ notificationsEnabled });
    //   changesMadeDescription += "Notification settings updated. ";
    // }
    // if (user.language !== language) {
    //   updateUserProfileInContext({ language });
    //   changesMadeDescription += "Language preference updated. ";
    // }

    if (changesMadeDescription.trim() === "") {
      changesMadeDescription = "No preference changes to save.";
    }

    toast({
      title: "Settings Update",
      description: changesMadeDescription.trim(),
    });
  };

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
            <CardTitle className="text-xl flex items-center gap-2"><Dog className="w-5 h-5 text-muted-foreground" /> Driver Preferences</CardTitle>
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

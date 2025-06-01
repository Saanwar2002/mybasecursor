"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bell, Palette, Lock, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false); // Local state for demo
  const [language, setLanguage] = useState("en");

  const handleSaveChanges = () => {
    // In a real app, save these settings to backend / user preferences
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated.",
    });
    if (darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> App Settings
          </CardTitle>
          <CardDescription>Customize your Link Cabs experience.</CardDescription>
        </CardHeader>
      </Card>

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
                <SelectItem value="es">Español (Spanish)</SelectItem>
                <SelectItem value="fr">Français (French)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Lock className="w-5 h-5 text-muted-foreground" /> Account & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full md:w-auto">Change Password</Button>
          <Button variant="outline" className="w-full md:w-auto">Manage Linked Devices</Button>
          <Button variant="destructive" className="w-full md:w-auto">Delete Account</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><HelpCircle className="w-5 h-5 text-muted-foreground" /> Help & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button variant="link" className="p-0 h-auto">FAQs</Button><br/>
            <Button variant="link" className="p-0 h-auto">Contact Support</Button><br/>
            <Button variant="link" className="p-0 h-auto">Terms of Service</Button><br/>
            <Button variant="link" className="p-0 h-auto">Privacy Policy</Button>
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

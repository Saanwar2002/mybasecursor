"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DollarSign, Loader2, AlertTriangle, Zap, SlidersHorizontal, Save, TimerIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OperationalSettingsData {
  enableSurgePricing?: boolean;
  operatorSurgePercentage?: number;
  maxAutoAcceptWaitTimeMinutes?: number;
}

export default function OperatorOperationalSettingsPage() {
  const { user, updateUserProfileInContext } = useAuth();
  const [operationalSettings, setOperationalSettings] = useState<OperationalSettingsData>({});
  const [surgePercentageInput, setSurgePercentageInput] = useState<string>("0");
  
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [isSavingToggle, setIsSavingToggle] = useState<string | null>(null); // For surge or dispatch
  const [isSavingValue, setIsSavingValue] = useState<string | null>(null); // For percentage or wait time
  
  const [errorSettings, setErrorSettings] = useState<string | null>(null);

  const [enableAutoDispatch, setEnableAutoDispatch] = useState<boolean>(true);
  const [isLoadingDispatch, setIsLoadingDispatch] = useState<boolean>(true);
  const [errorDispatch, setErrorDispatch] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchOperationalSettings = useCallback(async () => {
    if (!user?.operatorCode) return;
    setIsLoadingSettings(true);
    setErrorSettings(null);
    try {
      const response = await fetch(`/api/operator/settings/operational?operatorId=${user.operatorCode}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load operational settings.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setOperationalSettings({
        enableSurgePricing: data.enableSurgePricing || false,
        operatorSurgePercentage: data.operatorSurgePercentage || 0,
        maxAutoAcceptWaitTimeMinutes: data.maxAutoAcceptWaitTimeMinutes === undefined ? 30 : data.maxAutoAcceptWaitTimeMinutes,
      });
      setSurgePercentageInput(String(data.operatorSurgePercentage || 0));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load operational settings.";
      setErrorSettings(message);
      setOperationalSettings({ enableSurgePricing: false, operatorSurgePercentage: 0, maxAutoAcceptWaitTimeMinutes: 30 });
      setSurgePercentageInput("0");
      toast({ title: "Error Loading Operational Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast, user?.operatorCode]);

  const fetchDispatchSettings = useCallback(async () => {
    if (!user?.operatorCode) return;
    setIsLoadingDispatch(true);
    setErrorDispatch(null);
    try {
      const response = await fetch(`/api/operator/settings/dispatch-mode?operatorId=${user.operatorCode}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load dispatch settings.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableAutoDispatch(data.dispatchMode === 'auto');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load dispatch settings.";
      setErrorDispatch(message);
      setEnableAutoDispatch(true); 
      toast({ title: "Error Loading Dispatch Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingDispatch(false);
    }
  }, [toast, user?.operatorCode]);

  useEffect(() => {
    if (user?.operatorCode) {
      fetchOperationalSettings();
      fetchDispatchSettings();
    } else if (user) {
      // If user is loaded but has no operator code, stop loading and show an error/prompt.
      setIsLoadingSettings(false);
      setIsLoadingDispatch(false);
      setErrorSettings("Operator details not found. Cannot load settings.");
      setErrorDispatch("Operator details not found. Cannot load settings.");
    }
  }, [user, fetchOperationalSettings, fetchDispatchSettings]);

  const handleSaveSetting = async (settingKey: keyof OperationalSettingsData, value: string | number | boolean, settingType: 'toggle' | 'value') => {
    if (!user?.operatorCode) {
      toast({ title: "Error", description: "Operator details not found. Cannot save setting.", variant: "destructive" });
      return;
    }
    if (settingType === 'toggle') setIsSavingToggle(settingKey);
    else setIsSavingValue(settingKey);
    setErrorSettings(null);

    try {
      const response = await fetch(`/api/operator/settings/operational?operatorId=${user.operatorCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: value }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `Failed to update ${settingKey}.`}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setOperationalSettings(data.settings || {});
      if (settingKey === 'operatorSurgePercentage') {
        setSurgePercentageInput(String(data.settings?.operatorSurgePercentage || 0));
      }
      
      toast({ title: "Setting Updated", description: `${settingKey.replace(/([A-Z])/g, ' $1').trim()} updated successfully.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not update ${settingKey}.`;
      setErrorSettings(message);
      fetchOperationalSettings(); 
      toast({ title: `Error Saving ${settingKey}`, description: message, variant: "destructive" });
    } finally {
      if (settingType === 'toggle') setIsSavingToggle(null);
      else setIsSavingValue(null);
    }
  };

  const handleToggleAutoDispatch = async (newSetting: boolean) => {
    if (!user?.operatorCode) {
      toast({ title: "Error", description: "Operator details not found. Cannot save setting.", variant: "destructive" });
      return;
    }
    setIsSavingToggle('dispatchMode'); // Use a unique key for dispatch toggle
    setErrorDispatch(null);
    const newDispatchMode = newSetting ? 'auto' : 'manual';
    try {
      const response = await fetch(`/api/operator/settings/dispatch-mode?operatorId=${user.operatorCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchMode: newDispatchMode }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update setting.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableAutoDispatch(data.settings.dispatchMode === 'auto');
      if (user) {
        updateUserProfileInContext({ dispatchMode: data.settings.dispatchMode });
      }
      toast({ title: "Dispatch Mode Updated", description: `Dispatch mode set to ${data.settings.dispatchMode === 'auto' ? 'AUTOMATIC' : 'MANUAL'}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update dispatch settings.";
      setErrorDispatch(message);
      fetchDispatchSettings();
      toast({ title: "Error Saving Dispatch Settings", description: message, variant: "destructive" });
    } finally {
      setIsSavingToggle(null);
    }
  };

  const maxWaitTimeOptions = [
    { value: 15, label: "15 Minutes" },
    { value: 30, label: "30 Minutes (Default)" },
    { value: 45, label: "45 Minutes" },
    { value: 60, label: "60 Minutes" },
    { value: 0, label: "No Limit (Not Recommended)" }, // 0 for "no limit"
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <SlidersHorizontal className="w-8 h-8 text-primary" /> Operational Settings
          </CardTitle>
          <CardDescription>Configure dispatch modes and pricing parameters for your taxi fleet.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2"><Zap className="w-5 h-5 text-muted-foreground" /> Dispatch Mode</CardTitle>
          <CardDescription>Control how new ride offers are handled for your fleet.</CardDescription>
        </CardHeader>
        {isLoadingDispatch ? (
          <CardContent><div className="space-y-3"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-10 w-full rounded-md" /></div></CardContent>
        ) : errorDispatch ? (
          <CardContent><div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md"><AlertTriangle className="h-5 w-5" /><p>Error: {errorDispatch}</p></div></CardContent>
        ) : (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Switch id="auto-dispatch-switch" checked={enableAutoDispatch} onCheckedChange={handleToggleAutoDispatch} disabled={isSavingToggle === 'dispatchMode'} />
                <Label htmlFor="auto-dispatch-switch" className="text-base">{enableAutoDispatch ? "Automatic Dispatch Enabled" : "Manual Dispatch Mode Active"}</Label>
                {isSavingToggle === 'dispatchMode' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Automatic: MyBase system auto-assigns relevant rides. Manual: All rides for your base require manual assignment via 'Manage Rides'.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2"><DollarSign className="w-5 h-5 text-muted-foreground"/> Pricing & Offer Control</CardTitle>
          <CardDescription>Manage surge pricing and automated job offer thresholds.</CardDescription>
        </CardHeader>
        {isLoadingSettings ? (
          <CardContent>
            <div className="space-y-3"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-10 w-full rounded-md mt-3" /><Separator className="my-4" /><Skeleton className="h-6 w-1/2 rounded-md" /><Skeleton className="h-10 w-1/3 rounded-md" /></div>
          </CardContent>
        ) : errorSettings ? (
          <CardContent><div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md"><AlertTriangle className="h-5 w-5" /> <p>Error: {errorSettings}</p></div></CardContent>
        ) : (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Switch id="surge-pricing-switch" checked={operationalSettings.enableSurgePricing || false} onCheckedChange={(checked) => handleSaveSetting('enableSurgePricing', checked, 'toggle')} disabled={isSavingToggle === 'enableSurgePricing' || isSavingValue === 'operatorSurgePercentage'} />
                <Label htmlFor="surge-pricing-switch" className="text-base">{operationalSettings.enableSurgePricing ? "Surge Pricing Enabled" : "Surge Pricing Disabled"}</Label>
                {isSavingToggle === 'enableSurgePricing' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">When enabled, the system may apply surge multipliers.</p>
            </div>
            
            {operationalSettings.enableSurgePricing && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <Label htmlFor="surge-percentage-input" className="text-base font-medium">Your Base Surge Contribution (%)</Label>
                <div className="flex items-center gap-3">
                  <Input id="surge-percentage-input" type="number" value={surgePercentageInput} onChange={(e) => setSurgePercentageInput(e.target.value)} placeholder="e.g., 20" min="0" max="500" className="max-w-xs" disabled={isSavingValue === 'operatorSurgePercentage' || isSavingToggle === 'enableSurgePricing'} />
                  <Button onClick={() => handleSaveSetting('operatorSurgePercentage', parseFloat(surgePercentageInput), 'value')} disabled={isSavingValue === 'operatorSurgePercentage' || isSavingToggle === 'enableSurgePricing' || parseFloat(surgePercentageInput) === operationalSettings.operatorSurgePercentage}>
                    {isSavingValue === 'operatorSurgePercentage' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Percentage
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enter a percentage (0-500). Current saved: {operationalSettings.operatorSurgePercentage || 0}%. Applied when platform surge is active.</p>
              </div>
            )}

            <Separator className="my-6" />

            <div className="space-y-3">
               <Label htmlFor="max-wait-time-select" className="text-base font-medium flex items-center gap-1"><TimerIcon className="w-4 h-4 text-muted-foreground"/> Max. Auto-Offer Wait Time</Label>
                <div className="flex items-center gap-3">
                    <Select
                        value={String(operationalSettings.maxAutoAcceptWaitTimeMinutes ?? 30)}
                        onValueChange={(value) => handleSaveSetting('maxAutoAcceptWaitTimeMinutes', parseInt(value), 'value')}
                        disabled={isSavingValue === 'maxAutoAcceptWaitTimeMinutes'}
                    >
                        <SelectTrigger id="max-wait-time-select" className="max-w-xs">
                            <SelectValue placeholder="Select max wait time" />
                        </SelectTrigger>
                        <SelectContent>
                        {maxWaitTimeOptions.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                     {isSavingValue === 'maxAutoAcceptWaitTimeMinutes' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  If estimated wait time for new passengers exceeds this, automated job offers to your fleet will be temporarily paused. (Applies in Automatic Dispatch mode).
                </p>
            </div>
          </CardContent>
        )}
        <CardFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground">Note: Platform-wide rules may also influence pricing and job offers.</p>
        </CardFooter>
      </Card>
    </div>
  );
}

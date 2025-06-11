
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DollarSign, Loader2, AlertTriangle, Zap, SlidersHorizontal, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function OperatorOperationalSettingsPage() {
  const { user, updateUserProfileInContext } = useAuth();
  const [enableSurgePricing, setEnableSurgePricing] = useState<boolean>(false);
  const [operatorSurgePercentage, setOperatorSurgePercentage] = useState<number>(0);
  const [surgePercentageInput, setSurgePercentageInput] = useState<string>("0");
  const [isLoadingSurgeSettings, setIsLoadingSurgeSettings] = useState<boolean>(true);
  const [isSavingSurgeToggle, setIsSavingSurgeToggle] = useState<boolean>(false);
  const [isSavingSurgePercentage, setIsSavingSurgePercentage] = useState<boolean>(false);
  const [errorSurge, setErrorSurge] = useState<string | null>(null);

  const [enableAutoDispatch, setEnableAutoDispatch] = useState<boolean>(true);
  const [isLoadingDispatch, setIsLoadingDispatch] = useState<boolean>(true);
  const [isSavingDispatch, setIsSavingDispatch] = useState<boolean>(false);
  const [errorDispatch, setErrorDispatch] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchPricingSettings = useCallback(async () => {
    setIsLoadingSurgeSettings(true);
    setErrorSurge(null);
    try {
      const response = await fetch('/api/operator/settings/pricing');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load surge settings.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableSurgePricing(data.enableSurgePricing || false);
      setOperatorSurgePercentage(data.operatorSurgePercentage || 0);
      setSurgePercentageInput(String(data.operatorSurgePercentage || 0));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load surge settings.";
      setErrorSurge(message);
      setEnableSurgePricing(false); 
      setOperatorSurgePercentage(0);
      setSurgePercentageInput("0");
      toast({ title: "Error Loading Surge Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingSurgeSettings(false);
    }
  }, [toast]);

  const fetchDispatchSettings = useCallback(async () => {
    setIsLoadingDispatch(true);
    setErrorDispatch(null);
    try {
      const response = await fetch('/api/operator/settings/dispatch-mode');
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
  }, [toast]);

  useEffect(() => {
    fetchPricingSettings();
    fetchDispatchSettings();
  }, [fetchPricingSettings, fetchDispatchSettings]);

  const handleToggleSurgePricing = async (newSetting: boolean) => {
    setIsSavingSurgeToggle(true);
    setErrorSurge(null);
    try {
      const response = await fetch('/api/operator/settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableSurgePricing: newSetting }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update setting.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableSurgePricing(data.settings.enableSurgePricing);
      // If surge is disabled, we might want to reset UI percentage input, but not necessarily DB
      if (!data.settings.enableSurgePricing) {
        setOperatorSurgePercentage(0); // Reflect that it's not active
        setSurgePercentageInput("0");
      } else {
         // If enabling, ensure the percentage displayed is what's currently saved or a default.
         setOperatorSurgePercentage(data.settings.operatorSurgePercentage || 0);
         setSurgePercentageInput(String(data.settings.operatorSurgePercentage || 0));
      }
      toast({ title: "Surge Toggle Updated", description: `Surge pricing is now ${data.settings.enableSurgePricing ? 'ENABLED' : 'DISABLED'}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update surge toggle.";
      setErrorSurge(message);
      fetchPricingSettings(); 
      toast({ title: "Error Saving Surge Toggle", description: message, variant: "destructive" });
    } finally {
      setIsSavingSurgeToggle(false);
    }
  };

  const handleSaveSurgePercentage = async () => {
    const percentageValue = parseFloat(surgePercentageInput);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 500) {
      toast({ title: "Invalid Percentage", description: "Please enter a number between 0 and 500 for surge percentage.", variant: "destructive" });
      return;
    }
    setIsSavingSurgePercentage(true);
    setErrorSurge(null);
    try {
      const response = await fetch('/api/operator/settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorSurgePercentage: percentageValue }),
      });
       if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update percentage.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setOperatorSurgePercentage(data.settings.operatorSurgePercentage);
      setSurgePercentageInput(String(data.settings.operatorSurgePercentage));
      toast({ title: "Surge Percentage Updated", description: `Custom surge percentage set to ${data.settings.operatorSurgePercentage}%.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save surge percentage.";
      setErrorSurge(message);
      fetchPricingSettings(); // Re-fetch to ensure consistency
      toast({ title: "Error Saving Surge Percentage", description: message, variant: "destructive" });
    } finally {
      setIsSavingSurgePercentage(false);
    }
  };

  const handleToggleAutoDispatch = async (newSetting: boolean) => {
    setIsSavingDispatch(true);
    setErrorDispatch(null);
    const newDispatchMode = newSetting ? 'auto' : 'manual';
    try {
      const response = await fetch('/api/operator/settings/dispatch-mode', {
        method: 'POST',
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
      setIsSavingDispatch(false);
    }
  };

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
          <CardDescription>
            Control how new ride offers are handled for your fleet.
          </CardDescription>
        </CardHeader>
        {isLoadingDispatch ? (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-6 w-11 rounded-full" />
                <Skeleton className="h-6 w-48 rounded-md" />
              </div>
              <Skeleton className="h-10 w-full rounded-md" /> 
            </div>
          </CardContent>
        ) : errorDispatch ? (
          <CardContent>
            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p>Error: {errorDispatch}</p>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Switch
                  id="auto-dispatch-switch"
                  checked={enableAutoDispatch}
                  onCheckedChange={handleToggleAutoDispatch}
                  disabled={isSavingDispatch}
                />
                <Label htmlFor="auto-dispatch-switch" className="text-base">
                  {enableAutoDispatch ? "Automatic Dispatch Enabled" : "Manual Dispatch Mode Active"}
                </Label>
                {isSavingDispatch && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">
                When Automatic Dispatch is ON, the MyBase system will attempt to auto-assign relevant new rides to your available drivers.
                <br />
                When OFF (Manual Mode), all new rides for your base will appear as 'Pending Assignment' on your 'Manage Rides' screen, requiring you to assign them manually.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2"><DollarSign className="w-5 h-5 text-muted-foreground"/> Surge Pricing Control</CardTitle>
          <CardDescription>
            Enable dynamic surge pricing and set your operator-specific surge percentage.
          </CardDescription>
        </CardHeader>
        {isLoadingSurgeSettings ? (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3"> <Skeleton className="h-6 w-11 rounded-full" /> <Skeleton className="h-6 w-64 rounded-md" /> </div>
              <Skeleton className="h-10 w-full rounded-md mt-3" />
              <Separator className="my-4" />
              <Skeleton className="h-6 w-1/2 rounded-md" />
              <Skeleton className="h-10 w-1/3 rounded-md" />
            </div>
          </CardContent>
        ) : errorSurge ? (
          <CardContent>
            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-5 w-5" /> <p>Error: {errorSurge}</p>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Switch
                  id="surge-pricing-switch"
                  checked={enableSurgePricing}
                  onCheckedChange={handleToggleSurgePricing}
                  disabled={isSavingSurgeToggle || isSavingSurgePercentage}
                />
                <Label htmlFor="surge-pricing-switch" className="text-base">
                  {enableSurgePricing ? "Surge Pricing Enabled" : "Surge Pricing Disabled (Normal Fares)"}
                </Label>
                {isSavingSurgeToggle && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
               <p className="text-sm text-muted-foreground">
                When enabled, the system may apply surge multipliers. You can set your base's contribution below.
              </p>
            </div>
            
            {enableSurgePricing && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <Label htmlFor="surge-percentage-input" className="text-base font-medium">Your Base Surge Percentage (%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="surge-percentage-input"
                    type="number"
                    value={surgePercentageInput}
                    onChange={(e) => setSurgePercentageInput(e.target.value)}
                    placeholder="e.g., 20 for 20%"
                    min="0"
                    max="500" // Example max, adjust as needed
                    className="max-w-xs"
                    disabled={isSavingSurgePercentage || isSavingSurgeToggle}
                  />
                  <Button 
                    onClick={handleSaveSurgePercentage} 
                    disabled={isSavingSurgePercentage || isSavingSurgeToggle || parseFloat(surgePercentageInput) === operatorSurgePercentage}
                  >
                    {isSavingSurgePercentage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Percentage
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a percentage (e.g., 20 for 20%). This value will be considered by the platform's fare calculation when surge is active.
                  Current saved: {operatorSurgePercentage}%.
                </p>
              </div>
            )}
          </CardContent>
        )}
        <CardFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
                Note: The platform might have its own base surge logic. Your settings here are applied in conjunction with platform-level rules.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

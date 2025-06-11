
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Loader2, AlertTriangle, Zap, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton import

export default function OperatorOperationalSettingsPage() {
  const { user, updateUserProfileInContext } = useAuth();
  const [enableSurgePricing, setEnableSurgePricing] = useState<boolean>(false);
  const [isLoadingSurge, setIsLoadingSurge] = useState<boolean>(true);
  const [isSavingSurge, setIsSavingSurge] = useState<boolean>(false);
  const [errorSurge, setErrorSurge] = useState<string | null>(null);

  const [enableAutoDispatch, setEnableAutoDispatch] = useState<boolean>(true);
  const [isLoadingDispatch, setIsLoadingDispatch] = useState<boolean>(true);
  const [isSavingDispatch, setIsSavingDispatch] = useState<boolean>(false);
  const [errorDispatch, setErrorDispatch] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchPricingSettings = useCallback(async () => {
    setIsLoadingSurge(true);
    setErrorSurge(null);
    try {
      const response = await fetch('/api/operator/settings/pricing');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load surge settings.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableSurgePricing(data.enableSurgePricing || false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load surge settings.";
      setErrorSurge(message);
      setEnableSurgePricing(false);
      toast({ title: "Error Loading Surge Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingSurge(false);
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
      if (user) {
        updateUserProfileInContext({ dispatchMode: data.dispatchMode });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load dispatch settings.";
      setErrorDispatch(message);
      setEnableAutoDispatch(true); // Default to auto on error
      toast({ title: "Error Loading Dispatch Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingDispatch(false);
    }
  }, [toast, user, updateUserProfileInContext]);

  useEffect(() => {
    fetchPricingSettings();
    fetchDispatchSettings();
  }, [fetchPricingSettings, fetchDispatchSettings]);

  const handleToggleSurgePricing = async (newSetting: boolean) => {
    setIsSavingSurge(true);
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
      toast({ title: "Surge Settings Updated", description: `Surge pricing is now ${data.settings.enableSurgePricing ? 'ENABLED' : 'DISABLED'}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update surge settings.";
      setErrorSurge(message);
      fetchPricingSettings(); 
      toast({ title: "Error Saving Surge Settings", description: message, variant: "destructive" });
    } finally {
      setIsSavingSurge(false);
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
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
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
            Enable or disable dynamic surge pricing for your fleet based on demand or other factors.
            When disabled, all rides will use standard fares.
          </CardDescription>
        </CardHeader>
        {isLoadingSurge ? (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-6 w-11 rounded-full" />
                <Skeleton className="h-6 w-64 rounded-md" />
              </div>
              <Skeleton className="h-4 w-full rounded-md mt-3" />
            </div>
          </CardContent>
        ) : errorSurge ? (
          <CardContent>
            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p>Error: {errorSurge}</p>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex items-center space-x-3">
              <Switch
                id="surge-pricing-switch"
                checked={enableSurgePricing}
                onCheckedChange={handleToggleSurgePricing}
                disabled={isSavingSurge}
              />
              <Label htmlFor="surge-pricing-switch" className="text-base">
                {enableSurgePricing ? "Surge Pricing Enabled" : "Surge Pricing Disabled (Normal Fares)"}
              </Label>
              {isSavingSurge && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Changes are saved automatically when you toggle the switch. (Mock API Interaction)
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

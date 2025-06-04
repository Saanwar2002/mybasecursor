
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PricingSettingsPage() {
  const [enableSurgePricing, setEnableSurgePricing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPricingSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/operator/settings/pricing');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load settings, defaulting to normal fares.'}));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableSurgePricing(data.enableSurgePricing || false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load pricing settings.";
      setError(message);
      setEnableSurgePricing(false); // Default to false on error
      toast({ title: "Error Loading Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPricingSettings();
  }, [fetchPricingSettings]);

  const handleToggleSurgePricing = async (newSetting: boolean) => {
    setIsSaving(true);
    setError(null);
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
      toast({ title: "Settings Updated", description: `Surge pricing is now ${data.settings.enableSurgePricing ? 'ENABLED' : 'DISABLED'}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update pricing settings.";
      setError(message);
      // Revert UI optimistically if save fails or fetch current state again
      fetchPricingSettings(); 
      toast({ title: "Error Saving Settings", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-primary" /> Pricing Settings
          </CardTitle>
          <CardDescription>Configure pricing parameters for your taxi fleet.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Surge Pricing</CardTitle>
          <CardDescription>
            Enable or disable dynamic surge pricing based on demand or other factors.
            When disabled, all rides will use standard fares.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading settings...</p>
            </div>
          )}
          {!isLoading && error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p>Error: {error}</p>
            </div>
          )}
          {!isLoading && !error && (
            <div className="flex items-center space-x-3">
              <Switch
                id="surge-pricing-switch"
                checked={enableSurgePricing}
                onCheckedChange={handleToggleSurgePricing}
                disabled={isSaving}
              />
              <Label htmlFor="surge-pricing-switch" className="text-base">
                {enableSurgePricing ? "Surge Pricing Enabled" : "Surge Pricing Disabled (Normal Fares)"}
              </Label>
              {isSaving && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-3">
            Changes are saved automatically when you toggle the switch.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

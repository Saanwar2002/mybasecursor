
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, AlertTriangle, DollarSign, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const commissionFormSchema = z.object({
  commissionRatePercentage: z.coerce // Use coerce to ensure it's treated as a number from input
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Rate must be 0 or greater.")
    .max(100, "Rate cannot exceed 100%.")
});

type CommissionFormValues = z.infer<typeof commissionFormSchema>;

export default function AdminGlobalSettingsPage() {
  const { toast } = useToast();
  const [currentCommissionRate, setCurrentCommissionRate] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commissionForm = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: {
      commissionRatePercentage: 0,
    },
  });

  const fetchCommissionRate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings/commission');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load commission rate.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setCurrentCommissionRate(data.defaultRate);
      setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Not set");
      commissionForm.reset({ commissionRatePercentage: data.defaultRate !== null ? data.defaultRate * 100 : 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load commission rate.";
      setError(message);
      toast({ title: "Error Loading Commission Rate", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, commissionForm]);

  useEffect(() => {
    fetchCommissionRate();
  }, [fetchCommissionRate]);

  async function onSubmitCommission(values: CommissionFormValues) {
    setIsSaving(true);
    setError(null);
    try {
      const rateAsDecimal = values.commissionRatePercentage / 100;
      const response = await fetch('/api/admin/settings/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultRate: rateAsDecimal }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to save commission rate.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setCurrentCommissionRate(data.settings.defaultRate);
      setLastUpdated(new Date(data.settings.lastUpdated).toLocaleString());
      commissionForm.reset({ commissionRatePercentage: data.settings.defaultRate * 100 });
      toast({ title: "Commission Rate Saved", description: `Default commission rate set to ${data.settings.defaultRate * 100}%.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save commission rate.";
      setError(message);
      toast({ title: "Error Saving Commission Rate", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> Global Platform Settings
          </CardTitle>
          <CardDescription>
            Configure core platform-wide settings, default policies, and integrations.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent" /> Default Commission Rate
          </CardTitle>
          <CardDescription>
            Set the default percentage the platform takes from each completed ride fare.
            This can potentially be overridden by specific operator agreements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading commission rate...</p>
            </div>
          )}
          {!isLoading && error && (
            <div className="text-red-600 flex items-center gap-2 p-3 bg-red-50 rounded-md">
              <AlertTriangle className="w-5 h-5" />
              <p>Error: {error}</p>
              <Button onClick={fetchCommissionRate} variant="outline" size="sm">Retry</Button>
            </div>
          )}
          {!isLoading && !error && (
            <Form {...commissionForm}>
              <form onSubmit={commissionForm.handleSubmit(onSubmitCommission)} className="space-y-4">
                <div className="mb-4">
                  <Label className="text-sm font-medium text-muted-foreground">Current Default Rate</Label>
                  <p className="text-2xl font-bold">
                    {currentCommissionRate !== null ? `${(currentCommissionRate * 100).toFixed(2)}%` : "Not set"}
                  </p>
                  {lastUpdated && <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>}
                </div>
                <FormField
                  control={commissionForm.control}
                  name="commissionRatePercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="commissionRatePercentage">Set New Rate (%)</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            id="commissionRatePercentage"
                            type="number"
                            step="0.01"
                            placeholder="e.g., 15"
                            {...field}
                            className="max-w-xs"
                            disabled={isSaving}
                          />
                        </FormControl>
                        <FormDescription>%</FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSaving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Commission Rate
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other Global Configurations (Placeholder)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/50 rounded-lg">
            <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">More Settings Under Construction</h3>
            <p className="text-muted-foreground max-w-md">
              Future settings could include: platform API keys, feature toggles, default currency, regional settings, and general policy management.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

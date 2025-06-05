
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, AlertTriangle, DollarSign, Loader2, Save, Users, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const commissionRateSchema = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Rate must be 0 or greater.")
  .max(100, "Rate cannot exceed 100%.");

const directDriversFormSchema = z.object({
  directDriverRatePercentage: commissionRateSchema,
});
type DirectDriversFormValues = z.infer<typeof directDriversFormSchema>;

const operatorAffiliatedFormSchema = z.object({
  operatorAffiliatedRatePercentage: commissionRateSchema,
});
type OperatorAffiliatedFormValues = z.infer<typeof operatorAffiliatedFormSchema>;

interface CommissionData {
    directDriverRate?: number | null;
    operatorAffiliatedDriverRate?: number | null;
    lastUpdated?: string | null;
}

export default function AdminGlobalSettingsPage() {
  const { toast } = useToast();
  const [commissionData, setCommissionData] = useState<CommissionData>({});
  const [isLoadingCommission, setIsLoadingCommission] = useState(true);
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const [isSavingOperator, setIsSavingOperator] = useState(false);
  const [errorCommission, setErrorCommission] = useState<string | null>(null);

  const directDriversForm = useForm<DirectDriversFormValues>({
    resolver: zodResolver(directDriversFormSchema),
    defaultValues: { directDriverRatePercentage: 0 },
  });

  const operatorAffiliatedForm = useForm<OperatorAffiliatedFormValues>({
    resolver: zodResolver(operatorAffiliatedFormSchema),
    defaultValues: { operatorAffiliatedRatePercentage: 0 },
  });

  const fetchCommissionRates = useCallback(async () => {
    setIsLoadingCommission(true);
    setErrorCommission(null);
    try {
      const response = await fetch('/api/admin/settings/commission');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load commission rates.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setCommissionData({
        directDriverRate: data.directDriverRate,
        operatorAffiliatedDriverRate: data.operatorAffiliatedDriverRate,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Not set",
      });
      directDriversForm.reset({ directDriverRatePercentage: data.directDriverRate !== null && data.directDriverRate !== undefined ? data.directDriverRate * 100 : 0 });
      operatorAffiliatedForm.reset({ operatorAffiliatedRatePercentage: data.operatorAffiliatedDriverRate !== null && data.operatorAffiliatedDriverRate !== undefined ? data.operatorAffiliatedDriverRate * 100 : 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load commission rates.";
      setErrorCommission(message);
      toast({ title: "Error Loading Commission Rates", description: message, variant: "destructive" });
    } finally {
      setIsLoadingCommission(false);
    }
  }, [toast, directDriversForm, operatorAffiliatedForm]);

  useEffect(() => {
    fetchCommissionRates();
  }, [fetchCommissionRates]);

  async function onSubmitDirectRate(values: DirectDriversFormValues) {
    setIsSavingDirect(true);
    setErrorCommission(null);
    try {
      const rateAsDecimal = values.directDriverRatePercentage / 100;
      const response = await fetch('/api/admin/settings/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directDriverRate: rateAsDecimal }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to save direct driver commission rate.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setCommissionData(prev => ({
        ...prev,
        directDriverRate: data.settings.directDriverRate,
        lastUpdated: new Date(data.settings.lastUpdated).toLocaleString(),
      }));
      directDriversForm.reset({ directDriverRatePercentage: data.settings.directDriverRate * 100 });
      toast({ title: "Direct Driver Commission Saved", description: `Rate set to ${data.settings.directDriverRate * 100}%.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save direct driver commission rate.";
      setErrorCommission(message);
      toast({ title: "Error Saving Rate", description: message, variant: "destructive" });
    } finally {
      setIsSavingDirect(false);
    }
  }

  async function onSubmitOperatorAffiliatedRate(values: OperatorAffiliatedFormValues) {
    setIsSavingOperator(true);
    setErrorCommission(null);
    try {
      const rateAsDecimal = values.operatorAffiliatedRatePercentage / 100;
      const response = await fetch('/api/admin/settings/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAffiliatedDriverRate: rateAsDecimal }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to save operator-affiliated commission rate.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setCommissionData(prev => ({
          ...prev,
          operatorAffiliatedDriverRate: data.settings.operatorAffiliatedDriverRate,
          lastUpdated: new Date(data.settings.lastUpdated).toLocaleString(),
      }));
      operatorAffiliatedForm.reset({ operatorAffiliatedRatePercentage: data.settings.operatorAffiliatedDriverRate * 100 });
      toast({ title: "Operator-Affiliated Commission Saved", description: `Default rate set to ${data.settings.operatorAffiliatedDriverRate * 100}%.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save operator-affiliated commission rate.";
      setErrorCommission(message);
      toast({ title: "Error Saving Rate", description: message, variant: "destructive" });
    } finally {
      setIsSavingOperator(false);
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

      {isLoadingCommission && (
        <Card>
            <CardContent className="flex items-center justify-center p-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-lg">Loading commission settings...</p>
            </CardContent>
        </Card>
      )}

      {!isLoadingCommission && errorCommission && (
        <Card>
            <CardContent className="p-6">
            <div className="text-red-600 flex items-center gap-2 p-3 bg-red-50 rounded-md">
              <AlertTriangle className="w-5 h-5" />
              <p>Error: {errorCommission}</p>
              <Button onClick={fetchCommissionRates} variant="outline" size="sm">Retry</Button>
            </div>
            </CardContent>
        </Card>
      )}

      {!isLoadingCommission && !errorCommission && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-foreground bg-primary p-0.5 rounded-sm" /> Commission for Direct Platform Drivers
              </CardTitle>
              <CardDescription>
                Set the commission rate for drivers working directly under the platform (e.g., drivers with operator code OP001).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...directDriversForm}>
                <form onSubmit={directDriversForm.handleSubmit(onSubmitDirectRate)} className="space-y-4">
                  <div className="mb-4">
                    <Label className="text-sm font-medium text-muted-foreground">Current Rate for Direct Drivers</Label>
                    <p className="text-2xl font-bold">
                      {commissionData.directDriverRate !== null && commissionData.directDriverRate !== undefined ? `${(commissionData.directDriverRate * 100).toFixed(2)}%` : "Not set"}
                    </p>
                    {commissionData.lastUpdated && <p className="text-xs text-muted-foreground">Last global update: {commissionData.lastUpdated}</p>}
                  </div>
                  <FormField
                    control={directDriversForm.control}
                    name="directDriverRatePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="directDriverRatePercentage">Set New Rate (%)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input id="directDriverRatePercentage" type="number" step="0.01" placeholder="e.g., 10" {...field} className="max-w-xs" disabled={isSavingDirect} />
                          </FormControl>
                          <FormDescription>%</FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSavingDirect} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSavingDirect ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Direct Driver Rate
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent-foreground bg-accent p-0.5 rounded-sm" /> Default Commission for Operator-Affiliated Drivers
              </CardTitle>
              <CardDescription>
                Set the default commission rate for drivers managed by external taxi base operators.
                This can be overridden by specific operator agreements (feature not yet implemented).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...operatorAffiliatedForm}>
                <form onSubmit={operatorAffiliatedForm.handleSubmit(onSubmitOperatorAffiliatedRate)} className="space-y-4">
                  <div className="mb-4">
                    <Label className="text-sm font-medium text-muted-foreground">Current Default Rate for Operator-Affiliated Drivers</Label>
                    <p className="text-2xl font-bold">
                      {commissionData.operatorAffiliatedDriverRate !== null && commissionData.operatorAffiliatedDriverRate !== undefined ? `${(commissionData.operatorAffiliatedDriverRate * 100).toFixed(2)}%` : "Not set"}
                    </p>
                     {commissionData.lastUpdated && <p className="text-xs text-muted-foreground">Last global update: {commissionData.lastUpdated}</p>}
                  </div>
                  <FormField
                    control={operatorAffiliatedForm.control}
                    name="operatorAffiliatedRatePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="operatorAffiliatedRatePercentage">Set New Default Rate (%)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input id="operatorAffiliatedRatePercentage" type="number" step="0.01" placeholder="e.g., 20" {...field} className="max-w-xs" disabled={isSavingOperator}/>
                          </FormControl>
                           <FormDescription>%</FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSavingOperator} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isSavingOperator ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Operator-Affiliated Rate
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}

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

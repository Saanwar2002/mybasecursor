"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, AlertTriangle, Loader2, Save, Users, Briefcase, Globe, Zap } from "lucide-react"; // Added Zap for Feature Toggles
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Added Switch
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";


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

const generalSettingsFormSchema = z.object({
  defaultCurrency: z.enum(['GBP', 'USD', 'EUR'], {
    errorMap: () => ({ message: "Please select a valid currency." }),
  }),
  platformMinimumFare: z.coerce
    .number({ invalid_type_error: "Minimum fare must be a number." })
    .min(0, "Minimum fare cannot be negative.")
    .max(100, "Minimum fare seems too high (max £100)."),
});
type GeneralSettingsFormValues = z.infer<typeof generalSettingsFormSchema>;

interface GeneralSettingsData {
  defaultCurrency: 'GBP' | 'USD' | 'EUR';
  platformMinimumFare: number;
  enableSpeedLimitAlerts?: boolean; // Added
  lastUpdated?: string;
}


export default function AdminGlobalSettingsPage() {
  const { toast } = useToast();
  // Commission States
  const [commissionData, setCommissionData] = useState<CommissionData>({});
  const [isLoadingCommission, setIsLoadingCommission] = useState(true);
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const [isSavingOperator, setIsSavingOperator] = useState(false);
  const [errorCommission, setErrorCommission] = useState<string | null>(null);

  // General Settings States

  const [isLoadingGeneral, setIsLoadingGeneral] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enableSpeedLimitAlerts, setEnableSpeedLimitAlerts] = useState<boolean>(false);
  const [isSavingSpeedAlertToggle, setIsSavingSpeedAlertToggle] = useState(false);


  const directDriversForm = useForm<DirectDriversFormValues>({
    resolver: zodResolver(directDriversFormSchema),
    defaultValues: { directDriverRatePercentage: 0 },
  });

  const operatorAffiliatedForm = useForm<OperatorAffiliatedFormValues>({
    resolver: zodResolver(operatorAffiliatedFormSchema),
    defaultValues: { operatorAffiliatedRatePercentage: 0 },
  });
  
  const generalSettingsForm = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: { defaultCurrency: 'GBP', platformMinimumFare: 0 },
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

  const fetchGeneralSettings = useCallback(async () => {
    setIsLoadingGeneral(true);
    setErrorGeneral(null);
    try {
      const response = await fetch('/api/admin/settings/general');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load general settings.' }));
        throw new Error(errData.message);
      }
      const data: GeneralSettingsData = await response.json();
      generalSettingsForm.reset({
        defaultCurrency: data.defaultCurrency,
        platformMinimumFare: data.platformMinimumFare,
      });
      setEnableSpeedLimitAlerts(data.enableSpeedLimitAlerts || false); // Set the toggle state
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load general settings.";
      setErrorGeneral(message);
      toast({ title: "Error Loading General Settings", description: message, variant: "destructive" });
    } finally {
      setIsLoadingGeneral(false);
    }
  }, [toast, generalSettingsForm]);


  useEffect(() => {
    fetchCommissionRates();
    fetchGeneralSettings();
  }, [fetchCommissionRates, fetchGeneralSettings]);

  async function onSubmitDirectRate(values: DirectDriversFormValues) {
    setIsSavingDirect(true);
    setErrorCommission(null);
    try {
      const rateAsDecimal = values.directDriverRatePercentage / 100;
      const response = await fetch('/api/admin/settings/commission', {
        method: 'PATCH',
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
        method: 'PATCH',
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

  async function onSubmitGeneralSettings(values: GeneralSettingsFormValues) {
    setIsSavingGeneral(true);
    setErrorGeneral(null);
    try {
      const response = await fetch('/api/admin/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to save general settings.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setGeneralSettingsData(data.settings);
      generalSettingsForm.reset({
        defaultCurrency: data.settings.defaultCurrency,
        platformMinimumFare: data.settings.platformMinimumFare,
      });
      setEnableSpeedLimitAlerts(data.settings.enableSpeedLimitAlerts || false);
      toast({ title: "General Settings Saved", description: "Platform currency and minimum fare updated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save general settings.";
      setErrorGeneral(message);
      toast({ title: "Error Saving General Settings", description: message, variant: "destructive" });
    } finally {
      setIsSavingGeneral(false);
    }
  }

  const handleToggleSpeedLimitAlerts = async (checked: boolean) => {
    setIsSavingSpeedAlertToggle(true);
    setErrorGeneral(null);
    try {
      const response = await fetch('/api/admin/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableSpeedLimitAlerts: checked }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update Speed Limit Alert setting.' }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setEnableSpeedLimitAlerts(data.settings.enableSpeedLimitAlerts || false);
      setGeneralSettingsData(prev => ({...prev!, enableSpeedLimitAlerts: data.settings.enableSpeedLimitAlerts }));
      toast({ title: "Speed Limit Alert Setting Updated", description: `Driver speed limit alerts ${checked ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update Speed Limit Alert setting.";
      setErrorGeneral(message);
      toast({ title: "Error Updating Setting", description: message, variant: "destructive" });
      // Revert UI on error
      setEnableSpeedLimitAlerts(!checked);
    } finally {
      setIsSavingSpeedAlertToggle(false);
    }
  };


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
          <CardTitle className="text-xl font-headline flex items-center gap-2"><Globe className="w-5 h-5 text-primary-foreground bg-primary p-0.5 rounded-sm"/> General Platform Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingGeneral ? (
            <div className="flex items-center justify-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : errorGeneral ? (
            <div className="text-red-600 flex items-center gap-2 p-3 bg-red-50 rounded-md">
              <AlertTriangle className="w-5 h-5" /> <p>Error: {errorGeneral}</p>
              <Button onClick={fetchGeneralSettings} variant="outline" size="sm">Retry</Button>
            </div>
          ) : (
            <Form {...generalSettingsForm}>
              <form onSubmit={generalSettingsForm.handleSubmit(onSubmitGeneralSettings)} className="space-y-4">
                <FormField
                  control={generalSettingsForm.control}
                  name="defaultCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSavingGeneral}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select default currency" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="GBP">GBP (£ - Pound Sterling)</SelectItem>
                          <SelectItem value="USD">USD ($ - US Dollar)</SelectItem>
                          <SelectItem value="EUR">EUR (€ - Euro)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={generalSettingsForm.control}
                  name="platformMinimumFare"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Minimum Fare ({generalSettingsForm.getValues('defaultCurrency')})</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g., 3.50" {...field} disabled={isSavingGeneral} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSavingGeneral} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSavingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save General Settings
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8"/>

       <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2"><Zap className="w-5 h-5 text-muted-foreground" /> Feature Toggles</CardTitle>
        </CardHeader>
        <CardContent>
        {isLoadingGeneral ? (
            <div className="flex items-center justify-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : errorGeneral ? (
            <div className="text-red-600 flex items-center gap-2 p-3 bg-red-50 rounded-md">
              <AlertTriangle className="w-5 h-5" /> <p>Error loading feature toggle status: {errorGeneral}</p>
              <Button onClick={fetchGeneralSettings} variant="outline" size="sm">Retry</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Switch id="speed-limit-alert-switch" checked={enableSpeedLimitAlerts} onCheckedChange={handleToggleSpeedLimitAlerts} disabled={isSavingSpeedAlertToggle} />
                <Label htmlFor="speed-limit-alert-switch" className="text-base">{enableSpeedLimitAlerts ? "Driver Speed Limit Alerts Enabled" : "Driver Speed Limit Alerts Disabled"}</Label>
                {isSavingSpeedAlertToggle && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">
                If enabled, drivers will see a mock speed limit display. (This is a UI demo, no real speed data).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator className="my-8"/>

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
              Future settings could include: platform API keys, feature toggles, general policy management, support contact details, and more.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


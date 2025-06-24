
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, PlusCircle, Users, AlertTriangle, Edit, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from 'react';

interface CreditAccount {
  id: string;
  accountHolderName: string;
  associatedUserId?: string;
  balance: number; // Negative for owed to operator, positive for credit available
  creditLimit: number;
  status: "Active" | "Suspended" | "Closed";
  billingCycle: "Weekly" | "Fortnightly" | "Monthly";
  lastBilledDate?: string;
  createdAt: string;
}

const addAccountFormSchema = z.object({
  accountHolderName: z.string().min(3, { message: "Account holder name must be at least 3 characters." }).max(100),
  associatedUserId: z.string().optional(),
  creditLimit: z.coerce.number().min(0, { message: "Credit limit must be 0 or greater."}),
  billingCycle: z.enum(["Weekly", "Fortnightly", "Monthly"], { required_error: "Billing cycle is required." }),
  pin: z.string().length(6, { message: "PIN must be 6 digits." }).regex(/^\d{6}$/, { message: "PIN must be 6 digits." })
});

type AddAccountFormValues = z.infer<typeof addAccountFormSchema>;

export default function OperatorCreditAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editAccount, setEditAccount] = useState<CreditAccount|null>(null);
  const [deleteAccount, setDeleteAccount] = useState<CreditAccount|null>(null);
  const [suspendAccount, setSuspendAccount] = useState<CreditAccount|null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/operator/credit-accounts');
        const data = await res.json();
        setAccounts(data.accounts || []);
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to load credit accounts.' });
      }
    }
    fetchAccounts();
  }, [toast]);

  const addAccountForm = useForm<AddAccountFormValues>({
    resolver: zodResolver(addAccountFormSchema),
    defaultValues: {
      accountHolderName: "",
      associatedUserId: "",
      creditLimit: 100,
      billingCycle: "Monthly",
      pin: ""
    },
  });

  async function onAddAccountSubmit(values: AddAccountFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/operator/credit-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Failed to create account');
      const data = await res.json();
      setAccounts(prev => [data.account, ...prev]);
      toast({ title: 'Account Created!', description: `Credit account for "${values.accountHolderName}" has been created.` });
      addAccountForm.reset();
      setIsAddAccountDialogOpen(false);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to create account.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(account: CreditAccount) {
    setDeleteAccount(account);
  }
  async function confirmDelete() {
    if (!deleteAccount) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/operator/credit-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteAccount.id }),
      });
      if (!res.ok) throw new Error('Failed to delete account');
      setAccounts(prev => prev.filter(acc => acc.id !== deleteAccount.id));
      toast({ title: 'Account Deleted', description: `Credit account for "${deleteAccount.accountHolderName}" has been deleted.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete account.' });
    } finally {
      setIsProcessing(false);
      setDeleteAccount(null);
    }
  }

  async function handleSuspend(account: CreditAccount) {
    setSuspendAccount(account);
  }
  async function confirmSuspend() {
    if (!suspendAccount) return;
    setIsProcessing(true);
    try {
      const newStatus = suspendAccount.status === 'Suspended' ? 'Active' : 'Suspended';
      console.log('PATCH payload:', { id: suspendAccount.id, status: newStatus });
      const res = await fetch('/api/operator/credit-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: suspendAccount.id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update account status');
      setAccounts(prev => prev.map(acc => acc.id === suspendAccount.id ? { ...acc, status: newStatus } : acc));
      toast({ title: `Account ${newStatus === 'Suspended' ? 'Suspended' : 'Activated'}`, description: `Credit account for "${suspendAccount.accountHolderName}" is now ${newStatus}.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update account status.' });
    } finally {
      setIsProcessing(false);
      setSuspendAccount(null);
    }
  }

  function handleEdit(account: CreditAccount) {
    setEditAccount(account);
    // For simplicity, editing can be implemented as a dialog with a form (not included in this snippet)
  }

  // Dialogs for delete and suspend
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-primary" /> Credit Accounts
            </CardTitle>
            <CardDescription>Manage credit facilities for your valued passengers and corporate clients.</CardDescription>
          </div>
          <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Credit Account</DialogTitle>
                <DialogDescription>
                  Set up a new credit account. Actual balance management and invoicing are backend features.
                </DialogDescription>
              </DialogHeader>
              <Form {...addAccountForm}>
                <form onSubmit={addAccountForm.handleSubmit(onAddAccountSubmit)} className="space-y-4 py-2">
                  <FormField control={addAccountForm.control} name="accountHolderName" render={({ field }) => (
                      <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="e.g., Corporate Client Ltd" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={addAccountForm.control} name="associatedUserId" render={({ field }) => (
                      <FormItem><FormLabel>Associated Passenger User ID <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="User's MyBase ID" {...field} required /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={addAccountForm.control} name="creditLimit" render={({ field }) => (
                      <FormItem><FormLabel>Credit Limit (£)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={addAccountForm.control} name="billingCycle" render={({ field }) => (
                      <FormItem><FormLabel>Billing Cycle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={addAccountForm.control} name="pin" render={({ field }) => (
                      <FormItem><FormLabel>6-digit Account PIN</FormLabel><FormControl><Input type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="e.g., 123456" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Credit Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No credit accounts set up yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Balance (£)</TableHead>
                  <TableHead className="text-right">Limit (£)</TableHead>
                  <TableHead>Billing Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.accountHolderName}</TableCell>
                    <TableCell className="text-xs">{account.associatedUserId || 'N/A'}</TableCell>
                    <TableCell className={`text-right font-semibold ${account.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                      {account.balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{account.creditLimit.toFixed(2)}</TableCell>
                    <TableCell>{account.billingCycle}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === "Active" ? "default" : "destructive"}
                       className={account.status === "Active" ? "bg-green-100 text-green-700 border-green-300" : ""}>
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(account)} title="Edit Account">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleSuspend(account)} title={account.status === 'Suspended' ? 'Activate Account' : 'Suspend Account'}>
                        <AlertTriangle className={`h-4 w-4 ${account.status === 'Suspended' ? 'text-green-600' : 'text-yellow-600'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(account)} title="Delete Account">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialogs for delete and suspend */}
      <Dialog open={!!deleteAccount} onOpenChange={v => !v && setDeleteAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credit Account</DialogTitle>
            <DialogDescription>Are you sure you want to delete the account for <b>{deleteAccount?.accountHolderName}</b>? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccount(null)} disabled={isProcessing}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isProcessing}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!suspendAccount} onOpenChange={v => !v && setSuspendAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suspendAccount?.status === 'Suspended' ? 'Activate' : 'Suspend'} Credit Account</DialogTitle>
            <DialogDescription>Are you sure you want to {suspendAccount?.status === 'Suspended' ? 'activate' : 'suspend'} the account for <b>{suspendAccount?.accountHolderName}</b>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendAccount(null)} disabled={isProcessing}>Cancel</Button>
            <Button variant={suspendAccount?.status === 'Suspended' ? 'default' : 'destructive'} onClick={confirmSuspend} disabled={isProcessing}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {suspendAccount?.status === 'Suspended' ? 'Activate' : 'Suspend'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit Account Dialog */}
      <Dialog open={!!editAccount} onOpenChange={v => !v && setEditAccount(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Credit Account</DialogTitle>
            <DialogDescription>
              Update the details for <b>{editAccount?.accountHolderName}</b>.
            </DialogDescription>
          </DialogHeader>
          {editAccount && (
            <Form {...addAccountForm}>
              <form
                onSubmit={addAccountForm.handleSubmit(async (values) => {
                  setIsSubmitting(true);
                  try {
                    const res = await fetch('/api/operator/credit-accounts', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: editAccount.id, ...values }),
                    });
                    if (!res.ok) throw new Error('Failed to update account');
                    const data = await res.json();
                    setAccounts(prev => prev.map(acc => acc.id === editAccount.id ? data.account : acc));
                    toast({ title: 'Account Updated', description: `Credit account for "${values.accountHolderName}" has been updated.` });
                    setEditAccount(null);
                  } catch (e) {
                    toast({ title: 'Error', description: 'Failed to update account.' });
                  } finally {
                    setIsSubmitting(false);
                  }
                })}
                className="space-y-4 py-2"
              >
                <FormField control={addAccountForm.control} name="accountHolderName" render={({ field }) => (
                  <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="e.g., Corporate Client Ltd" {...field} defaultValue={editAccount.accountHolderName} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAccountForm.control} name="associatedUserId" render={({ field }) => (
                  <FormItem><FormLabel>Associated Passenger User ID <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="User's MyBase ID" {...field} defaultValue={editAccount.associatedUserId} required /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAccountForm.control} name="creditLimit" render={({ field }) => (
                  <FormItem><FormLabel>Credit Limit (£)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} defaultValue={editAccount.creditLimit} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAccountForm.control} name="billingCycle" render={({ field }) => (
                  <FormItem><FormLabel>Billing Cycle</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={editAccount.billingCycle}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={addAccountForm.control} name="pin" render={({ field }) => (
                  <FormItem><FormLabel>6-digit Account PIN</FormLabel><FormControl><Input type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="e.g., 123456" {...field} defaultValue={editAccount.pin} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
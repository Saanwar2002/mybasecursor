
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

const mockCreditAccounts: CreditAccount[] = [
  { id: "acc_1", accountHolderName: "Corporate Client A", balance: -150.75, creditLimit: 500, status: "Active", billingCycle: "Monthly", createdAt: new Date(2023,0,15).toISOString() },
  { id: "acc_2", accountHolderName: "Regular VIP John Doe", associatedUserId: "user_vip_john", balance: 25.00, creditLimit: 200, status: "Active", billingCycle: "Fortnightly", lastBilledDate: new Date(2023,9,20).toISOString(), createdAt: new Date(2023,2,10).toISOString() },
  { id: "acc_3", accountHolderName: "Hotel Partnership X", balance: -450.00, creditLimit: 1000, status: "Suspended", billingCycle: "Monthly", createdAt: new Date(2022,11,1).toISOString() },
  { id: "acc_4", accountHolderName: "School Runs Account", balance: 0.00, creditLimit: 750, status: "Active", billingCycle: "Weekly", createdAt: new Date(2023,5,1).toISOString() },
];

const addAccountFormSchema = z.object({
  accountHolderName: z.string().min(3, { message: "Account holder name must be at least 3 characters." }).max(100),
  associatedUserId: z.string().optional(),
  creditLimit: z.coerce.number().min(0, { message: "Credit limit must be 0 or greater."}),
  billingCycle: z.enum(["Weekly", "Fortnightly", "Monthly"], { required_error: "Billing cycle is required." }),
});

type AddAccountFormValues = z.infer<typeof addAccountFormSchema>;

export default function OperatorCreditAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CreditAccount[]>(mockCreditAccounts);
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAccountForm = useForm<AddAccountFormValues>({
    resolver: zodResolver(addAccountFormSchema),
    defaultValues: {
      accountHolderName: "",
      associatedUserId: "",
      creditLimit: 100,
      billingCycle: "Monthly",
    },
  });

  async function onAddAccountSubmit(values: AddAccountFormValues) {
    setIsSubmitting(true);
    console.log("Simulating add credit account:", values);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newAccount: CreditAccount = {
        id: `acc_mock_${Date.now()}`,
        ...values,
        balance: 0, // New accounts start with zero balance
        status: "Active",
        createdAt: new Date().toISOString(),
    };
    setAccounts(prev => [newAccount, ...prev]); // Add to the top of the mock list

    toast({
      title: "Account Created (Mock)",
      description: `Credit account for "${values.accountHolderName}" has been simulated.`,
    });
    addAccountForm.reset();
    setIsAddAccountDialogOpen(false);
    setIsSubmitting(false);
  }

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
                      <FormItem><FormLabel>Associated Passenger User ID (Optional)</FormLabel><FormControl><Input placeholder="User's MyBase ID" {...field} /></FormControl><FormMessage /></FormItem>
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
                  <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account (Mock)
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md shadow">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p className="font-semibold">Feature Under Development</p>
        </div>
        <p className="text-sm">
          Full functionality, including transaction history, balance updates, and invoicing, will be implemented with backend services.
        </p>
      </div>

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
                       <Button variant="outline" size="icon" className="h-8 w-8" disabled title="Edit Account (Soon)">
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" disabled title="Delete Account (Soon)">
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
    </div>
  );
}

    
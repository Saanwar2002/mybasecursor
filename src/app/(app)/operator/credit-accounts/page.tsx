
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, PlusCircle, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";

// Mock data - replace with API calls in a real application
const mockCreditAccounts = [
  { id: "acc_1", passengerName: "Corporate Client A", balance: -150.75, limit: 500, status: "Active" },
  { id: "acc_2", passengerName: "Regular VIP John Doe", balance: 25.00, limit: 200, status: "Active" },
  { id: "acc_3", passengerName: "Hotel Partnership X", balance: -450.00, limit: 1000, status: "Suspended" },
];

export default function OperatorCreditAccountsPage() {
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
          <Button disabled className="bg-primary hover:bg-primary/90 text-primary-foreground w-full md:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Account (Coming Soon)
          </Button>
        </CardHeader>
      </Card>

      <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md shadow">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p className="font-semibold">Feature Under Development</p>
        </div>
        <p className="text-sm">
          This section is a placeholder for managing passenger credit accounts. Full functionality, including creating accounts, setting limits, viewing transactions, and generating invoices, will be implemented in a future update.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Credit Accounts (Mock Data)</CardTitle>
        </CardHeader>
        <CardContent>
          {mockCreditAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No credit accounts set up yet.</p>
          ) : (
            <div className="space-y-3">
              {mockCreditAccounts.map(account => (
                <Card key={account.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card hover:shadow-md transition-shadow">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-semibold text-primary flex items-center gap-1"><Users className="w-4 h-4 text-primary/80"/>{account.passengerName}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: <span className={account.status === "Active" ? "text-green-600" : "text-red-600"}>{account.status}</span>
                    </p>
                  </div>
                  <div className="text-sm text-right">
                    <p>Balance: <span className={account.balance < 0 ? "text-red-600" : "text-green-600"}>£{account.balance.toFixed(2)}</span></p>
                    <p className="text-muted-foreground">Credit Limit: £{account.limit.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 sm:mt-0 sm:ml-4">
                     <Button variant="outline" size="sm" disabled>Manage (Soon)</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

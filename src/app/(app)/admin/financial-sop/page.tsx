
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, UploadCloud, BookOpen, AlertTriangle, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockSopVersions = [
  { id: "sop1-v2", name: "Payment Reconciliation SOP", version: "2.1", lastUpdated: "2024-03-15", updatedBy: "Admin Jane" },
  { id: "sop1-v1", name: "Payment Reconciliation SOP", version: "2.0", lastUpdated: "2024-01-20", updatedBy: "Admin Jane" },
  { id: "sop2-v1", name: "Dispute Resolution SOP", version: "1.3", lastUpdated: "2024-02-10", updatedBy: "Admin Mike" },
];

export default function FinancialSopPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-primary" /> Financial SOPs
          </CardTitle>
          <CardDescription>
            Manage Standard Operating Procedures for Payment Reconciliation and Dispute Resolution.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <AlertTriangle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Document Management Placeholder</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is a conceptual outline for managing financial SOPs. Actual document storage, version control, and access permissions would be handled by a dedicated document management system or integrated backend.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> Payment Reconciliation SOP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <BookOpen className="mr-2 h-4 w-4" /> View Current Reconciliation SOP (Mock PDF)
            </Button>
            <Textarea
              readOnly
              value="Key Steps (Summary):\n1. Daily reconciliation of payment gateway reports with platform bookings.\n2. Identify discrepancies (over/under payments, missing transactions).\n3. Investigate and resolve discrepancies within 24-48 hours.\n4. Monthly summary report generation for accounting."
              className="h-32 text-xs bg-muted/50"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> Dispute Resolution SOP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <BookOpen className="mr-2 h-4 w-4" /> View Current Dispute Resolution SOP (Mock PDF)
            </Button>
            <Textarea
              readOnly
              value="Key Steps (Summary):\n1. Passenger/Driver submits dispute via support channel.\n2. Ticket assigned to relevant team (e.g., Finance, Operations).\n3. Gather all relevant information (ride details, communication logs, payment records).\n4. Mediate and propose resolution within 3-5 business days.\n5. Document outcome and any financial adjustments."
              className="h-32 text-xs bg-muted/50"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">SOP Version History (Mock Data)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Updated By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSopVersions.map((sop) => (
                <TableRow key={sop.id}>
                  <TableCell className="font-medium">{sop.name}</TableCell>
                  <TableCell>{sop.version}</TableCell>
                  <TableCell>{sop.lastUpdated}</TableCell>
                  <TableCell>{sop.updatedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Upload / Update SOP Document (Placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="file" id="sop-upload" className="text-sm" disabled />
            <Button disabled>
              <UploadCloud className="mr-2 h-4 w-4" /> Upload New Version
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            In a real system, this would allow uploading new PDF documents for SOPs, manage versioning, and potentially integrate with a CMS or document storage like Google Drive or SharePoint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

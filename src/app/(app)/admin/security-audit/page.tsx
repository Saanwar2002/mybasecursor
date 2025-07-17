
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldCheck, AlertTriangle, FileText, CalendarDays, UserCheck, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const mockAuditSchedule = [
  { id: "audit1", type: "Full Penetration Test", date: "2024-09-15", status: "Planned", vendor: "SecureCyber LLP", reportLink: "#" },
  { id: "audit2", type: "Source Code Review (Payment Module)", date: "2024-10-01", status: "Planned", vendor: "CodeSure Inc.", reportLink: "#" },
  { id: "audit3", type: "GDPR Compliance Audit", date: "2024-11-05", status: "Planned", vendor: "Internal Audit Team", reportLink: "#" },
  { id: "audit4", type: "PCI-DSS Scoping (Phase 1)", date: "2024-07-20", status: "Completed", vendor: "SecurePay Consultants", reportLink: "#" },
];

const mockPastFindings = [
  { 
    id: "finding1", 
    auditId: "audit4", 
    auditName: "PCI-DSS Scoping (Phase 1)",
    severity: "Medium", 
    description: "Initial review identified 3 potential CDE (Cardholder Data Environment) components requiring further isolation before full PCI assessment.", 
    recommendation: "Isolate payment processing servers and implement stricter network segmentation.", 
    status: "Remediated", 
    remediatedDate: "2024-08-05" 
  },
  { 
    id: "finding2", 
    auditId: "audit4", 
    auditName: "PCI-DSS Scoping (Phase 1)",
    severity: "Low", 
    description: "Log retention policy for authentication logs not explicitly defined beyond 30 days.", 
    recommendation: "Update log retention policy to meet PCI requirements (at least 1 year, 3 months immediately available).", 
    status: "Pending Review", 
    remediatedDate: null 
  },
];

export default function SecurityAuditPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" /> Security Audit & Compliance
          </CardTitle>
          <CardDescription>
            Plan, track, and review security audits, penetration tests, and compliance status.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <AlertTriangle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Management Placeholder</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is a conceptual outline for managing security audits. Actual audit processes, reporting, and remediation tracking would involve external tools and detailed documentation.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent" /> Upcoming Audit Schedule (Mock Data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Type</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendor/Auditor</TableHead>
                <TableHead className="text-center">Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAuditSchedule.map((audit) => (
                <TableRow key={audit.id}>
                  <TableCell className="font-medium">{audit.type}</TableCell>
                  <TableCell>{audit.date}</TableCell>
                  <TableCell>
                    <Badge variant={audit.status === "Completed" ? "default" : audit.status === "Planned" ? "secondary" : "outline"}
                           className={audit.status === "Completed" ? "bg-green-100 text-green-700 border-green-300" : audit.status === "Planned" ? "bg-blue-100 text-blue-700 border-blue-300" : ""}>
                      {audit.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{audit.vendor}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" disabled={audit.status !== "Completed"} onClick={() => toast({title: "Mock Action", description: `Would open report for ${audit.type}`})}>
                      <FileText className="mr-1 h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-destructive" /> Past Audit Findings & Remediation (Mock Data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {mockPastFindings.map((finding) => (
              <AccordionItem value={finding.id} key={finding.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex justify-between items-center w-full pr-2">
                    <span className="font-medium">Finding: {finding.auditName} - Severity: {finding.severity}</span>
                    <Badge variant={finding.status === "Remediated" ? "default" : "destructive"}
                           className={finding.status === "Remediated" ? "bg-green-100 text-green-700 border-green-300" : ""}>
                      {finding.status}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p><strong>Description:</strong> {finding.description}</p>
                  <p><strong>Recommendation:</strong> {finding.recommendation}</p>
                  {finding.remediatedDate && <p><strong>Remediated On:</strong> {finding.remediatedDate}</p>}
                   <Button size="sm" variant="outline" className="mt-2" onClick={() => toast({title: "Mock Action", description: "Would open detailed remediation ticket/task."})}>
                     View Remediation Task (Mock)
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline">External Links & Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            <Button variant="link" className="p-0 h-auto text-base" asChild disabled>
                <a href="#" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    Internal Security Policy <ExternalLink className="w-4 h-4" />
                </a>
            </Button>
            <br />
             <Button variant="link" className="p-0 h-auto text-base" asChild disabled>
                <a href="#" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    Data Backup & Disaster Recovery Plan <ExternalLink className="w-4 h-4" />
                </a>
            </Button>
        </CardContent>
      </Card>

    </div>
  );
}

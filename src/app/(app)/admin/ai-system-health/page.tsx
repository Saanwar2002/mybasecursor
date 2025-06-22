"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Activity, AlertTriangle, CheckCircle, Loader2, ListChecks, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { runAiSystemDiagnostic, SystemDiagnosticOutput, DiagnosticFinding } from '@/ai/flows/system-diagnostic-flow';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function AiSystemHealthPage() {
  const [diagnosticResults, setDiagnosticResults] = useState<SystemDiagnosticOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRunDiagnostics = async () => {
    setIsLoading(true);
    setDiagnosticResults(null);
    try {
      const result = await runAiSystemDiagnostic({ checkLevel: 'deep_simulated' });
      setDiagnosticResults(result);
      toast({
        title: "AI Diagnostic Scan Complete (Simulated)",
        description: `Found ${result.issues.length} potential issue(s) and ${result.recommendations.length} recommendation(s).`,
      });
    } catch (error) {
      console.error("Error running AI system diagnostic:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Diagnostic Error",
        description: `Could not run diagnostic scan: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadge = (severity: DiagnosticFinding['severity']) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="capitalize">{severity}</Badge>;
      case 'warning': return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 capitalize">{severity}</Badge>;
      case 'info': return <Badge variant="outline" className="capitalize border-blue-500 text-blue-500">{severity}</Badge>;
      default: return <Badge variant="outline" className="capitalize">{severity}</Badge>;
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <BrainCircuit className="w-8 h-8 text-primary" /> AI System Health & Diagnostics
          </CardTitle>
          <CardDescription>
            Run AI-powered diagnostics to check system health, identify potential issues, and get maintenance recommendations.
            (Currently uses simulated data)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRunDiagnostics} disabled={isLoading} size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-5 w-5" /> Run AI Diagnostic Scan (Simulated)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Diagnostic Results</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-10 space-y-3">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">AI is analyzing the system (simulated)...</p>
          </CardContent>
        </Card>
      )}

      {diagnosticResults && !isLoading && (
        <div className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><ListChecks className="w-6 h-6 text-destructive" /> Potential Issues Found ({diagnosticResults.issues.length})</CardTitle>
              <CardDescription>Issues detected by the AI that may require attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {diagnosticResults.issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center bg-green-50 border-2 border-dashed border-green-300 rounded-lg">
                    <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                    <p className="text-lg font-semibold text-green-700">No immediate issues detected by the AI scan!</p>
                    <p className="text-sm text-green-600">The system appears to be in good order based on the simulated checks.</p>
                </div>
              ) : (
                diagnosticResults.issues.map((issue, index) => (
                  <Card key={`issue-${index}`} className="bg-destructive/5 border-destructive/50">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" /> {issue.title}
                        </CardTitle>
                        {getSeverityBadge(issue.severity)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-destructive-foreground/90">{issue.description}</p>
                      {issue.details && <pre className="mt-2 p-2 bg-destructive/10 text-xs rounded-md overflow-x-auto">{JSON.stringify(issue.details, null, 2)}</pre>}
                      {issue.suggestedAction && (
                        <p className="mt-2 text-sm font-medium text-destructive-foreground">
                          <span className="font-semibold">Suggested Action:</span> {issue.suggestedAction}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Lightbulb className="w-6 h-6 text-accent" /> AI Recommendations ({diagnosticResults.recommendations.length})</CardTitle>
              <CardDescription>Recommendations from the AI for system improvements or maintenance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {diagnosticResults.recommendations.length === 0 ? (
                 <p className="text-muted-foreground">No specific new recommendations from this scan.</p>
              ) : (
                diagnosticResults.recommendations.map((rec, index) => (
                  <div key={`rec-${index}`} className="p-3 border rounded-md bg-accent/5 border-accent/40">
                    <h4 className="font-semibold text-accent-foreground/90">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    {rec.priority && <p className="text-xs mt-1">Priority: <Badge variant="outline" className="capitalize">{rec.priority}</Badge></p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="text-xl">Overall Health Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg font-semibold">{diagnosticResults.overallHealthStatus}</p>
                <p className="text-sm text-muted-foreground">{diagnosticResults.summary}</p>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">Scan completed on: {new Date(diagnosticResults.timestamp).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">AI Model Used: {diagnosticResults.aiModelUsed} (Simulated)</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

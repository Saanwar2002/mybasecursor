
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ServerCog, Zap, Cpu, AlertTriangle, BarChart2, Link as LinkIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  status?: "healthy" | "warning" | "critical";
  unit?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, status = "healthy", unit }) => {
  const statusColor =
    status === "critical" ? "text-red-500 dark:text-red-400" :
    status === "warning" ? "text-yellow-500 dark:text-yellow-400" :
    "text-green-500 dark:text-green-400";

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`w-4 h-4 ${statusColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${statusColor}`}>
          {value}
          {unit && <span className="text-xs font-normal ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
};

export default function ServerMonitoringPage() {
  const mockRecentErrors = [
    { id: "err1", message: "502 Bad Gateway: /api/bookings/create (3 times in last hour)", severity: "critical", timestamp: new Date(Date.now() - 30 * 60 * 1000).toLocaleString() },
    { id: "err2", message: "Timeout: Firestore query on 'users' collection", severity: "warning", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString() },
    { id: "err3", message: "TypeError: user.profile is undefined at /dashboard", severity: "warning", timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <ServerCog className="w-8 h-8 text-primary" /> Server Performance & Error Monitoring
          </CardTitle>
          <CardDescription>
            Overview of system health, API performance, and error tracking. This page would typically integrate with dedicated monitoring services.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <AlertTriangle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Placeholder Page</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This is a conceptual page. Real-time server monitoring and error tracking require integration with services like Sentry, New Relic, Google Cloud Monitoring, or similar.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Avg. API Response Time" value="120" unit="ms" icon={Zap} status="healthy" />
        <MetricCard title="Server CPU Utilization" value="35" unit="%" icon={Cpu} status="healthy" />
        <MetricCard title="Error Rate (Last Hr)" value="0.5" unit="%" icon={BarChart2} status="warning" />
        <MetricCard title="Active Users (Sim)" value="450" icon={Users} status="healthy" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Recent Critical System Alerts (Mock)
          </CardTitle>
          <CardDescription>Highlights from integrated error tracking systems.</CardDescription>
        </CardHeader>
        <CardContent>
          {mockRecentErrors.length > 0 ? (
            <ul className="space-y-3">
              {mockRecentErrors.map(error => (
                <li key={error.id} className={`p-3 rounded-md border ${error.severity === 'critical' ? 'bg-destructive/10 border-destructive/50' : 'bg-yellow-400/10 border-yellow-500/50'}`}>
                  <p className={`font-semibold ${error.severity === 'critical' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'}`}>{error.message}</p>
                  <p className="text-xs text-muted-foreground">Last seen: {error.timestamp}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">No critical alerts in the mock data.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-accent" /> Monitoring Service Integrations (Conceptual)
          </CardTitle>
          <CardDescription>Links to external or integrated detailed monitoring dashboards.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full md:w-auto" disabled>
            <ExternalLink className="mr-2 h-4 w-4" /> Open Sentry Dashboard (Not Configured)
          </Button>
          <Button variant="outline" className="w-full md:w-auto" disabled>
            <ExternalLink className="mr-2 h-4 w-4" /> View New Relic APM (Not Configured)
          </Button>
          <Button variant="outline" className="w-full md:w-auto" disabled>
            <ExternalLink className="mr-2 h-4 w-4" /> Google Cloud Monitoring (Not Configured)
          </Button>
           <p className="text-sm text-muted-foreground">
            Integration with these services would provide in-depth logs, performance traces, and error analytics.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}

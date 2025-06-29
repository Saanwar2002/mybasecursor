"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Car as CarIcon, DollarSign, AlertTriangle, Loader2, Users2, Building, Shield, Lightbulb, BrainCircuit } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, subMonths } from 'date-fns';

interface PlatformSummaryStats {
  totalUsers: number;
  totalPassengers: number;
  totalDrivers: number;
  totalOperators: number;
  totalAdmins: number;
  totalRidesLast30Days: number;
  totalRevenueLast30Days: number;
}

interface DailyRideData {
  date: string; // YYYY-MM-DD
  name: string; // Short day name e.g., "Mon"
  rides: number;
}

interface MonthlyUserRegistrationData {
  month: string; // "MMM yyyy"
  passengers: number;
  drivers: number;
  operators: number;
}

export default function AdminAnalyticsPage() {
  const { toast } = useToast();

  const [summaryStats, setSummaryStats] = useState<PlatformSummaryStats | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  const [dailyRidesData, setDailyRidesData] = useState<DailyRideData[]>([]);
  const [isLoadingDailyRides, setIsLoadingDailyRides] = useState(true);
  const [errorDailyRides, setErrorDailyRides] = useState<string | null>(null);

  const [userRegistrationsData, setUserRegistrationsData] = useState<MonthlyUserRegistrationData[]>([]);
  const [isLoadingUserRegistrations, setIsLoadingUserRegistrations] = useState(true);
  const [errorUserRegistrations, setErrorUserRegistrations] = useState<string | null>(null);

  const fetchSummaryStats = useCallback(async () => {
    setIsLoadingSummary(true); setErrorSummary(null);
    try {
      const response = await fetch('/api/admin/analytics/platform-summary');
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to load summary stats: ${response.status} ${errorBody}`);
      }
      const data = await response.json();
      setSummaryStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred while fetching summary stats.";
      setErrorSummary(msg);
      toast({ title: "Error Loading Summary Stats", description: msg, variant: "destructive" });
    } finally { setIsLoadingSummary(false); }
  }, [toast]);

  const fetchDailyRides = useCallback(async () => {
    setIsLoadingDailyRides(true); setErrorDailyRides(null);
    try {
      const response = await fetch('/api/admin/analytics/platform-rides-daily?days=30');
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to load daily rides: ${response.status} ${errorBody}`);
      }
      const data = await response.json();
      setDailyRidesData(data.dailyPlatformRides);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred while fetching daily rides data.";
      setErrorDailyRides(msg);
      toast({ title: "Error Loading Daily Rides", description: msg, variant: "destructive" });
    } finally { setIsLoadingDailyRides(false); }
  }, [toast]);

  const fetchUserRegistrations = useCallback(async () => {
    setIsLoadingUserRegistrations(true); setErrorUserRegistrations(null);
    try {
      const response = await fetch('/api/admin/analytics/platform-user-registrations?months=6');
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to load user registrations: ${response.status} ${errorBody}`);
      }
      const data = await response.json();
      setUserRegistrationsData(data.monthlyRegistrations);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred while fetching user registration data.";
      setErrorUserRegistrations(msg);
      toast({ title: "Error Loading User Registrations", description: msg, variant: "destructive" });
    } finally { setIsLoadingUserRegistrations(false); }
  }, [toast]);

  useEffect(() => {
    fetchSummaryStats();
    fetchDailyRides();
    fetchUserRegistrations();
  }, [fetchSummaryStats, fetchDailyRides, fetchUserRegistrations]);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" /> Platform System Analytics
          </CardTitle>
          <CardDescription>Global insights into the TaxiNow platform's performance and user base.</CardDescription>
        </CardHeader>
      </Card>
      
      {isLoadingSummary && (
        <Card>
            <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/> Loading summary data...
            </CardContent>
        </Card>
      )}
      {errorSummary && !isLoadingSummary && (
         <Card className="border-destructive">
            <CardContent className="p-4">
              <ErrorDisplay message={errorSummary} onRetry={fetchSummaryStats}/>
            </CardContent>
        </Card>
      )}

      {!isLoadingSummary && !errorSummary && summaryStats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Users" value={summaryStats.totalUsers} icon={Users2} />
          <StatCard title="Total Passengers" value={summaryStats.totalPassengers} icon={Users} />
          <StatCard title="Total Drivers" value={summaryStats.totalDrivers} icon={CarIcon} />
          <StatCard title="Total Operators" value={summaryStats.totalOperators} icon={Building} />
          <StatCard title="Total Admins" value={summaryStats.totalAdmins} icon={Shield} />
          <StatCard title="Rides (Last 30d)" value={summaryStats.totalRidesLast30Days} icon={TrendingUp} color="text-green-500"/>
          <StatCard title="Revenue (Last 30d)" value={`£${(summaryStats.totalRevenueLast30Days ?? 0).toLocaleString()}`} icon={DollarSign} color="text-green-500" description="(Mock Data)"/>
        </div>
      )}


      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily Rides (Platform-Wide, Last 30 Days)" description="Number of completed rides across the entire platform.">
          {isLoadingDailyRides && <LoadingSpinner />}
          {errorDailyRides && !isLoadingDailyRides && <ErrorDisplay message={errorDailyRides} onRetry={fetchDailyRides}/>}
          {!isLoadingDailyRides && !errorDailyRides && dailyRidesData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyRidesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Completed Rides" />
              </BarChart>
            </ResponsiveContainer>
          )}
           {!isLoadingDailyRides && !errorDailyRides && dailyRidesData.length === 0 && <NoDataDisplay />}
        </ChartCard>
        
        <ChartCard title="New User Registrations (Platform-Wide, Last 6 Months)" description="Monthly count of new passenger, driver, and operator sign-ups.">
          {isLoadingUserRegistrations && <LoadingSpinner />}
          {errorUserRegistrations && !isLoadingUserRegistrations && <ErrorDisplay message={errorUserRegistrations} onRetry={fetchUserRegistrations}/>}
          {!isLoadingUserRegistrations && !errorUserRegistrations && userRegistrationsData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userRegistrationsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false}/>
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="passengers" stroke="hsl(var(--chart-1))" name="Passengers" strokeWidth={2} dot={{ r:3 }} activeDot={{ r: 5 }}/>
                <Line type="monotone" dataKey="drivers" stroke="hsl(var(--chart-2))" name="Drivers" strokeWidth={2} dot={{ r:3 }} activeDot={{ r: 5 }}/>
                <Line type="monotone" dataKey="operators" stroke="hsl(var(--chart-3))" name="Operators" strokeWidth={2} dot={{ r:3 }} activeDot={{ r: 5 }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
           {!isLoadingUserRegistrations && !errorUserRegistrations && userRegistrationsData.length === 0 && <NoDataDisplay />}
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-accent" /> Future: Advanced Analytics Dashboards (Scoping)
            </CardTitle>
            <CardDescription>
                This section outlines potential advanced analytics dashboards and metrics for future development to provide deeper insights into platform operations.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                <li><strong>User Acquisition & Retention Funnels:</strong> Track user journey from registration to first ride and beyond to identify drop-off points.</li>
                <li><strong>Churn Rate Analysis:</strong> Monitor passenger and driver churn rates, identify reasons, and predict at-risk users.</li>
                <li><strong>Marketing Campaign Performance:</strong> Detailed ROI and effectiveness tracking for various marketing initiatives.</li>
                <li><strong>Driver Performance Scorecards:</strong> Platform-wide benchmarks for driver acceptance rates, completion rates, ratings, and earnings.</li>
                <li><strong>Fraud Detection Metrics:</strong> Advanced patterns and anomaly detection for potentially fraudulent activities.</li>
                <li><strong>Predictive Demand Forecasting:</strong> AI-driven models to predict high-demand periods and locations.</li>
                <li><strong>Geospatial Heatmaps:</strong> Dynamic maps showing demand vs. supply, popular routes, and surge pricing effectiveness over time.</li>
                <li><strong>Detailed Financial Performance:</strong> Profitability per ride, operational cost breakdowns, and revenue optimization insights.</li>
                <li><strong>Service Quality Metrics:</strong> Analysis of average wait times, ride durations, cancellation reasons, and passenger feedback trends.</li>
            </ul>
            <p className="mt-4 text-sm text-accent-foreground/80">
                These advanced dashboards will require further data collection, backend processing, and potentially integration with specialized analytics tools.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

const Loader2Icon = () => <Loader2 className="h-5 w-5 animate-spin" />;

interface StatCardProps {
    title: string;
    value: string | number | React.ReactNode;
    icon: React.ElementType;
    color?: string;
    description?: string;
}

function StatCard({ title, value, icon: Icon, color = "text-muted-foreground", description }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}

interface ChartCardProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

function ChartCard({ title, description, children }: ChartCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
}

function LoadingSpinner() {
  return <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;
}

function ErrorDisplay({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="h-[300px] flex flex-col items-center justify-center text-destructive text-center p-4">
      <AlertTriangle className="w-10 h-10 mb-3"/>
      <p className="font-semibold">Error loading data:</p>
      <p className="text-sm mb-3">{message}</p>
      {onRetry && <Button onClick={onRetry} variant="outline" size="sm">Try Again</Button>}
    </div>
  );
}

function NoDataDisplay() {
  return <div className="h-[300px] flex items-center justify-center text-muted-foreground"><p>No data available for this period.</p></div>;
}


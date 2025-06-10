
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Clock, DollarSign, MapPin, Loader2, AlertTriangle, BrainCircuit } from "lucide-react"; // Added BrainCircuit
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

interface DailyRideData {
  name: string; // e.g., 'Mon', 'Tue' or 'YYYY-MM-DD'
  rides: number;
}

interface HourlyActivityData {
  hour: string; // HH:00
  rides: number;
}

interface MonthlyRevenueData {
  month: string; // "MMM yyyy"
  revenue: number;
}

interface PopularAddressData {
  address: string;
  rides: number;
}


export default function OperatorAnalyticsPage() {
  const [dailyRidesData, setDailyRidesData] = useState<DailyRideData[]>([]);
  const [isLoadingDailyRides, setIsLoadingDailyRides] = useState(true);
  const [errorDailyRides, setErrorDailyRides] = useState<string | null>(null);

  const [hourlyActivityData, setHourlyActivityData] = useState<HourlyActivityData[]>([]);
  const [isLoadingHourlyActivity, setIsLoadingHourlyActivity] = useState(true);
  const [errorHourlyActivity, setErrorHourlyActivity] = useState<string | null>(null);

  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenueData[]>([]);
  const [isLoadingMonthlyRevenue, setIsLoadingMonthlyRevenue] = useState(true);
  const [errorMonthlyRevenue, setErrorMonthlyRevenue] = useState<string | null>(null);

  const [popularAddressesData, setPopularAddressesData] = useState<PopularAddressData[]>([]);
  const [isLoadingPopularAddresses, setIsLoadingPopularAddresses] = useState(true);
  const [errorPopularAddresses, setErrorPopularAddresses] = useState<string | null>(null);


  const { toast } = useToast();

  useEffect(() => {
    const fetchDailyRides = async () => {
      setIsLoadingDailyRides(true);
      setErrorDailyRides(null);
      try {
        const response = await fetch('/api/operator/analytics/daily-rides?days=7');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch daily rides: ${response.status}`);
        }
        const data = await response.json();
        setDailyRidesData(data.dailyRideCounts);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred while fetching daily rides.";
        setErrorDailyRides(message);
        toast({ title: "Error Fetching Daily Rides", description: message, variant: "destructive" });
      } finally {
        setIsLoadingDailyRides(false);
      }
    };

    const fetchHourlyActivity = async () => {
      setIsLoadingHourlyActivity(true);
      setErrorHourlyActivity(null);
      try {
        const response = await fetch(`/api/operator/analytics/hourly-rides?date=${format(new Date(), 'yyyy-MM-dd')}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch hourly activity: ${response.status}`);
        }
        const data = await response.json();
        setHourlyActivityData(data.hourlyActivity);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred while fetching hourly activity.";
        setErrorHourlyActivity(message);
        toast({ title: "Error Fetching Hourly Activity", description: message, variant: "destructive" });
      } finally {
        setIsLoadingHourlyActivity(false);
      }
    };

    const fetchMonthlyRevenue = async () => {
      setIsLoadingMonthlyRevenue(true);
      setErrorMonthlyRevenue(null);
      try {
        const response = await fetch('/api/operator/analytics/monthly-revenue?months=6');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch monthly revenue: ${response.status}`);
        }
        const data = await response.json();
        setMonthlyRevenueData(data.monthlyRevenue);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred while fetching monthly revenue.";
        setErrorMonthlyRevenue(message);
        toast({ title: "Error Fetching Monthly Revenue", description: message, variant: "destructive" });
      } finally {
        setIsLoadingMonthlyRevenue(false);
      }
    };

    const fetchPopularAddresses = async () => {
      setIsLoadingPopularAddresses(true);
      setErrorPopularAddresses(null);
      try {
        const response = await fetch('/api/operator/analytics/popular-pickup-addresses?limit=5&days=30');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch popular addresses: ${response.status}`);
        }
        const data = await response.json();
        setPopularAddressesData(data.popularAddresses);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred while fetching popular addresses.";
        setErrorPopularAddresses(message);
        toast({ title: "Error Fetching Popular Addresses", description: message, variant: "destructive" });
      } finally {
        setIsLoadingPopularAddresses(false);
      }
    };

    fetchDailyRides();
    fetchHourlyActivity();
    fetchMonthlyRevenue();
    fetchPopularAddresses();
  }, [toast]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" /> Fleet Analytics
          </CardTitle>
          <CardDescription>Gain insights into your taxi operations with detailed analytics and reports.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rides This Week" value="510" icon={TrendingUp} />
        <StatCard title="Active Drivers Online" value="22" icon={Users} />
        <StatCard title="Average Wait Time" value="7 min" icon={Clock} />
        <StatCard title="Total Revenue (Month)" value="£28,000" icon={DollarSign} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily Rides Overview" description="Number of completed rides per day for the last 7 days.">
          {isLoadingDailyRides && <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>}
          {errorDailyRides && !isLoadingDailyRides && (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangle className="w-8 h-8 mb-2"/>
              <p>Error: {errorDailyRides}</p>
            </div>
          )}
          {!isLoadingDailyRides && !errorDailyRides && dailyRidesData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyRidesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Completed Rides" />
              </BarChart>
            </ResponsiveContainer>
          )}
           {!isLoadingDailyRides && !errorDailyRides && dailyRidesData.length === 0 && (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground"><p>No ride data for this period.</p></div>
           )}
        </ChartCard>
        <ChartCard title="Today's Hourly Ride Activity" description="Number of rides per hour for today.">
           {isLoadingHourlyActivity && <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>}
          {errorHourlyActivity && !isLoadingHourlyActivity && (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangle className="w-8 h-8 mb-2"/>
              <p>Error: {errorHourlyActivity}</p>
            </div>
          )}
          {!isLoadingHourlyActivity && !errorHourlyActivity && hourlyActivityData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(tick) => tick.split(':')[0]} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rides" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Rides"/>
              </LineChart>
            </ResponsiveContainer>
          )}
          {!isLoadingHourlyActivity && !errorHourlyActivity && hourlyActivityData.length === 0 && (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground"><p>No ride data for today.</p></div>
           )}
        </ChartCard>
      </div>
      
       <div className="grid gap-6 lg:grid-cols-2">
         <ChartCard title="Monthly Revenue Trend" description="Total revenue generated per month for the last 6 months.">
          {isLoadingMonthlyRevenue && <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>}
          {errorMonthlyRevenue && !isLoadingMonthlyRevenue && (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangle className="w-8 h-8 mb-2"/>
              <p>Error: {errorMonthlyRevenue}</p>
            </div>
          )}
          {!isLoadingMonthlyRevenue && !errorMonthlyRevenue && monthlyRevenueData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `£${value/1000}k`} />
                <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {!isLoadingMonthlyRevenue && !errorMonthlyRevenue && monthlyRevenueData.length === 0 && (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground"><p>No revenue data available.</p></div>
           )}
        </ChartCard>
        <ChartCard title="Popular Pickup Addresses" description="Most frequent pickup locations in the last 30 days.">
          {isLoadingPopularAddresses && <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>}
          {errorPopularAddresses && !isLoadingPopularAddresses && (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangle className="w-8 h-8 mb-2"/>
              <p>Error: {errorPopularAddresses}</p>
            </div>
          )}
          {!isLoadingPopularAddresses && !errorPopularAddresses && popularAddressesData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="vertical" data={popularAddressesData} margin={{left: 20, right: 20}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="address" type="category" width={150} tick={{fontSize: 10}}/>
                <Tooltip />
                <Legend />
                <Bar dataKey="rides" name="Rides" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {!isLoadingPopularAddresses && !errorPopularAddresses && popularAddressesData.length === 0 && (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground"><p>No popular address data available.</p></div>
           )}
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-accent" /> Future: Advanced Operator Dashboards (Scoping)
            </CardTitle>
            <CardDescription>
                This section outlines potential advanced analytics dashboards and metrics specifically for taxi base operators to manage their fleet more effectively.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                <li><strong>Driver Performance Scorecards:</strong> Detailed metrics for each driver (acceptance rate, completion rate, average rating, earnings, hours online).</li>
                <li><strong>Fleet Utilization Rates:</strong> Track active vs. idle drivers, peak hour analysis for driver availability.</li>
                <li><strong>Earnings per Driver/Vehicle:</strong> Breakdown of revenue generated by individual drivers and vehicles in your fleet.</li>
                <li><strong>Passenger Feedback for Your Drivers:</strong> Aggregated ratings, comments, and common themes for drivers under your operation.</li>
                <li><strong>Local Demand Hotspots (Operator Specific):</strong> Heatmaps showing high-demand pickup areas specifically relevant to your operational zones.</li>
                <li><strong>Commission & Payout Tracking:</strong> Clear overview of commissions earned from your drivers and upcoming payouts (if applicable).</li>
                <li><strong>Service Level Agreement (SLA) Monitoring:</strong> Track average wait times, response times to new job offers by your drivers.</li>
                <li><strong>Ride Completion Funnel (Operator View):</strong> Track job offers to your drivers, acceptances, and successful completions.</li>
            </ul>
            <p className="mt-4 text-sm text-accent-foreground/80">
                These operator-specific dashboards will help you optimize your fleet, improve driver performance, and enhance service quality.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
}

function StatCard({ title, value, icon: Icon }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
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


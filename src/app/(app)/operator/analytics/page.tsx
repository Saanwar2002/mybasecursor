
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Clock, DollarSign, MapPin, Loader2, AlertTriangle } from "lucide-react";
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

// Keep other mock data for now
const revenueData = [
  { month: 'Jan', revenue: 40000 }, { month: 'Feb', revenue: 30000 }, { month: 'Mar', revenue: 50000 },
  { month: 'Apr', revenue: 45000 }, { month: 'May', revenue: 60000 }, { month: 'Jun', revenue: 55000 },
];

const popularZonesData = [
    {zone: "Downtown", rides: 120},
    {zone: "Airport", rides: 95},
    {zone: "North Suburb", rides: 70},
    {zone: "West End", rides: 60},
    {zone: "University", rides: 50},
]

export default function OperatorAnalyticsPage() {
  const [dailyRidesData, setDailyRidesData] = useState<DailyRideData[]>([]);
  const [isLoadingDailyRides, setIsLoadingDailyRides] = useState(true);
  const [errorDailyRides, setErrorDailyRides] = useState<string | null>(null);

  const [hourlyActivityData, setHourlyActivityData] = useState<HourlyActivityData[]>([]);
  const [isLoadingHourlyActivity, setIsLoadingHourlyActivity] = useState(true);
  const [errorHourlyActivity, setErrorHourlyActivity] = useState<string | null>(null);

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
        // Fetches for today by default
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

    fetchDailyRides();
    fetchHourlyActivity();
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
         <ChartCard title="Monthly Revenue Trend" description="Total revenue generated per month. (Mock data)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `£${value/1000}k`} />
              <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Popular Pickup Zones" description="Most frequent pickup locations. (Mock data)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={popularZonesData} margin={{left: 20}}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="zone" type="category" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="rides" name="Rides" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>More Analytics Coming Soon!</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                Detailed driver performance, customer satisfaction ratings, peak hour analysis, and more advanced reports will be available here.
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

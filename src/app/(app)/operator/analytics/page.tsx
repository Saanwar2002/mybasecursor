"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Clock, DollarSign, MapPin } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

// Mock data for charts
const dailyRidesData = [
  { name: 'Mon', rides: 65 }, { name: 'Tue', rides: 59 }, { name: 'Wed', rides: 80 },
  { name: 'Thu', rides: 81 }, { name: 'Fri', rides: 95 }, { name: 'Sat', rides: 120 },
  { name: 'Sun', rides: 110 },
];

const hourlyActivityData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  rides: Math.floor(Math.random() * 30) + (i > 6 && i < 22 ? 10 : 0), // Peak hours
}));

const revenueData = [
  { month: 'Jan', revenue: 4000 }, { month: 'Feb', revenue: 3000 }, { month: 'Mar', revenue: 5000 },
  { month: 'Apr', revenue: 4500 }, { month: 'May', revenue: 6000 }, { month: 'Jun', revenue: 5500 },
];

const popularZonesData = [
    {zone: "Downtown", rides: 120},
    {zone: "Airport", rides: 95},
    {zone: "North Suburb", rides: 70},
    {zone: "West End", rides: 60},
    {zone: "University", rides: 50},
]

export default function OperatorAnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" /> Fleet Analytics
          </CardTitle>
          <CardDescription>Gain insights into your taxi operations with detailed analytics and reports. (Placeholder data)</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rides This Week" value="510" icon={TrendingUp} />
        <StatCard title="Active Drivers Online" value="22" icon={Users} />
        <StatCard title="Average Wait Time" value="7 min" icon={Clock} />
        <StatCard title="Total Revenue (Month)" value="$28,000" icon={DollarSign} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily Rides Overview" description="Number of rides per day for the current week.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyRidesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Hourly Ride Activity" description="Average number of rides per hour.">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(tick) => tick.split(':')[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="rides" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
       <div className="grid gap-6 lg:grid-cols-2">
         <ChartCard title="Monthly Revenue Trend" description="Total revenue generated per month.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value/1000}k`} />
              <Tooltip formatter={(value:any) => `$${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Popular Pickup Zones" description="Most frequent pickup locations.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={popularZonesData} margin={{left: 20}}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="zone" type="category" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="rides" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
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

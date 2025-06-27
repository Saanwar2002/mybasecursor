
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CalendarDays, TrendingUp, ListChecks, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useContext } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Earning {
  id: string;
  date: string;
  rides: number;
  totalFare: number;
  commission: number;
  netEarning: number;
}

const mockEarnings: Earning[] = [
  { id: 'e1', date: '2023-10-25', rides: 5, totalFare: 120.50, commission: 24.10, netEarning: 96.40 },
  { id: 'e2', date: '2023-10-24', rides: 7, totalFare: 150.00, commission: 30.00, netEarning: 120.00 },
  { id: 'e3', date: '2023-10-23', rides: 3, totalFare: 80.75, commission: 16.15, netEarning: 64.60 },
  { id: 'e4', date: '2023-10-22', rides: 8, totalFare: 180.20, commission: 36.04, netEarning: 144.16 },
];

const chartData = mockEarnings.map(e => ({ name: e.date.substring(5), earnings: e.netEarning })).reverse();


export default function DriverEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>(mockEarnings);
  const [timeRange, setTimeRange] = useState("last_7_days");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !db) return;
    // Assume earnings are stored in 'earnings' collection with driverId field
    const earningsRef = collection(db, 'earnings');
    const q = query(earningsRef, where('driverId', '==', user.id));
    // Optionally, filter by timeRange here
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const earningsData: Earning[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Convert Firestore Timestamp to string date if needed
        let dateStr = data.date;
        if (data.date instanceof Timestamp) {
          dateStr = data.date.toDate().toISOString().slice(0, 10);
        }
        return {
          id: docSnap.id,
          date: dateStr,
          rides: data.rides || 0,
          totalFare: data.totalFare || 0,
          commission: data.commission || 0,
          netEarning: data.netEarning || 0,
        };
      });
      setEarnings(earningsData);
    });
    return () => unsubscribe();
  }, [user, timeRange]);

  const totalNetEarnings = earnings.reduce((sum, e) => sum + e.netEarning, 0);
  const totalRides = earnings.reduce((sum, e) => sum + e.rides, 0);

  useEffect(() => {
    setEarnings(mockEarnings); 
  }, [timeRange]);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-primary" /> Earnings & History
          </CardTitle>
          <CardDescription>Track your earnings, view ride history, and analyze your performance.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Net Earnings" value={`£${totalNetEarnings.toFixed(2)}`} icon={TrendingUp} color="text-green-500" />
        <StatCard title="Total Rides Completed" value={totalRides.toString()} icon={ListChecks} color="text-blue-500" />
        <StatCard title="Average Earning/Ride" value={`£${(totalNetEarnings / (totalRides || 1)).toFixed(2)}`} icon={DollarSign} color="text-purple-500" />
        <StatCard title="Current Period" value={timeRange.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} icon={CalendarDays} color="text-orange-500" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Earnings Trend</CardTitle>
                <CardDescription>Net earnings over the selected period.</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                </SelectContent>
            </Select>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `£${value}`} />
                <Tooltip formatter={(value: number, name: string, props: any) => [`£${value.toFixed(2)}`, props.payload.name]}/>
                <Legend />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Net Earnings"/>
            </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Earnings History</CardTitle>
          <CardDescription>A log of your daily earnings and ride statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Rides</TableHead>
                <TableHead className="text-right">Total Fare</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Net Earning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.map((earning) => (
                <TableRow key={earning.id}>
                  <TableCell>{earning.date}</TableCell>
                  <TableCell className="text-right">{earning.rides}</TableCell>
                  <TableCell className="text-right">£{earning.totalFare.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-red-500">-£{earning.commission.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">£{earning.netEarning.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    color?: string;
}

function StatCard({ title, value, icon: Icon, color = "text-primary" }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

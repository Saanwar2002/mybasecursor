
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Car, Users, BarChart3, AlertTriangle, Map } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});


// Default UK coordinates (London)
const defaultUKCenter: [number, number] = [51.5074, -0.1278];
const mockFleetMarkers = [
    { position: [51.51, -0.10] as [number, number], popupText: "Driver 1 (John D) - Active" },
    { position: [51.50, -0.13] as [number, number], popupText: "Driver 2 (Jane S) - Available" },
    { position: [51.52, -0.12] as [number, number], popupText: "Driver 3 (Mike B) - On Break" },
    { position: [51.49, -0.11] as [number, number], popupText: "Driver 4 (Sarah W) - Available" },
];

export default function OperatorDashboardPage() {
  const { user } = useAuth();

  const activeRides = 12;
  const availableDrivers = 25;
  const totalDrivers = 30;
  const issuesReported = 3;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Taxi Base Control Panel</CardTitle>
          <CardDescription>Welcome, {user?.name || 'Operator'}. Manage your fleet and operations efficiently.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center gap-6">
           <div className="flex-1 space-y-4">
            <p className="text-lg">Oversee all ongoing rides, manage your drivers, and view real-time analytics to optimize your taxi service.</p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/operator/manage-rides">
                <Briefcase className="mr-2 h-5 w-5" /> Manage Rides
              </Link>
            </Button>
          </div>
          <div className="flex-shrink-0">
            <Image src="https://placehold.co/300x200.png" alt="Operator control panel" data-ai-hint="control panel city" width={300} height={200} className="rounded-lg shadow-md" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Rides" value={activeRides.toString()} icon={Car} color="text-green-500" />
        <StatCard title="Available Drivers" value={`${availableDrivers} / ${totalDrivers}`} icon={Users} color="text-blue-500" />
        <StatCard title="Issues Reported" value={issuesReported.toString()} icon={AlertTriangle} color="text-red-500" />
        <StatCard title="System Status" value="Operational" icon={Briefcase} color="text-green-500" />
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Map className="w-6 h-6 text-primary" /> Live Fleet Overview
            </CardTitle>
        </CardHeader>
        <CardContent className="h-80 md:h-96 bg-muted/50 rounded-md overflow-hidden">
             <MapDisplay 
                center={defaultUKCenter} 
                zoom={12} 
                markers={mockFleetMarkers} 
                className="w-full h-full" 
                scrollWheelZoom={true}
             />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Manage All Rides"
          description="View, assign, and track all ongoing and requested rides."
          icon={Car}
          link="/operator/manage-rides"
          actionText="Go to Ride Management"
        />
        <FeatureCard
          title="Driver Management"
          description="Onboard new drivers, manage profiles, and monitor performance."
          icon={Users}
          link="/operator/manage-drivers"
          actionText="Manage Drivers"
        />
        <FeatureCard
          title="Analytics & Reports"
          description="Access detailed reports on rides, earnings, and driver activity."
          icon={BarChart3}
          link="/operator/analytics"
          actionText="View Analytics"
        />
      </div>
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
        <Card className="hover:shadow-md transition-shadow">
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

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  actionText: string;
}

function FeatureCard({ title, description, icon: Icon, link, actionText }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center pb-4">
        <Icon className="w-10 h-10 text-accent mb-3" />
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" asChild>
          <Link href={link}>{actionText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}


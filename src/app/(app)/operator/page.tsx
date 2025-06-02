
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Car, Users, BarChart3, AlertTriangle, Map, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const defaultUKCenter: [number, number] = [51.5074, -0.1278];
const mockFleetMarkers = [
    { position: [51.51, -0.10] as [number, number], popupText: "Driver 1 (John D) - Active" },
    { position: [51.50, -0.13] as [number, number], popupText: "Driver 2 (Jane S) - Available" },
    { position: [51.52, -0.12] as [number, number], popupText: "Driver 3 (Mike B) - On Break" },
    { position: [51.49, -0.11] as [number, number], popupText: "Driver 4 (Sarah W) - Available" },
];

interface Ride { id: string; status: string; }
interface Driver { id: string; status: string; }

export default function OperatorDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeRidesCount, setActiveRidesCount] = useState<number | string>("...");
  const [availableDriversCount, setAvailableDriversCount] = useState<number | string>("...");
  const [totalDriversCount, setTotalDriversCount] = useState<number | string>("...");
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Mocked: In a real app, fetch actual issues
  const issuesReported = 3; 

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoadingStats(true);
      try {
        // Fetch active rides (e.g., 'Assigned' or 'In Progress')
        // For simplicity, we fetch a small list and use its length. 
        // A real API might provide a count directly.
        const ridesResponseAssigned = await fetch(`/api/operator/bookings?status=Assigned&limit=50`);
        const ridesResponseInProgress = await fetch(`/api/operator/bookings?status=In%20Progress&limit=50`);
        
        if (!ridesResponseAssigned.ok || !ridesResponseInProgress.ok) {
            if (!ridesResponseAssigned.ok) console.error("Failed to fetch assigned rides", await ridesResponseAssigned.text());
            if (!ridesResponseInProgress.ok) console.error("Failed to fetch in-progress rides", await ridesResponseInProgress.text());
            throw new Error('Failed to fetch ride data for dashboard');
        }
        const assignedData = await ridesResponseAssigned.json();
        const inProgressData = await ridesResponseInProgress.json();
        const activeRides = (assignedData.bookings?.length || 0) + (inProgressData.bookings?.length || 0);
        setActiveRidesCount(activeRides);

        // Fetch available (active) drivers
        const availableDriversResponse = await fetch(`/api/operator/drivers?status=Active&limit=100`); // Fetch more for a better count idea
        if (!availableDriversResponse.ok) {
            console.error("Failed to fetch available drivers", await availableDriversResponse.text());
            throw new Error('Failed to fetch available drivers');
        }
        const availableDriversData = await availableDriversResponse.json();
        setAvailableDriversCount(availableDriversData.drivers?.length || 0);

        // Fetch total drivers (all statuses)
        const totalDriversResponse = await fetch(`/api/operator/drivers?limit=100`); // Fetch more for a better count idea
        if (!totalDriversResponse.ok) {
            console.error("Failed to fetch total drivers", await totalDriversResponse.text());
            throw new Error(`Failed to fetch total drivers "${await totalDriversResponse.text()}"`);
        }
        const totalDriversData = await totalDriversResponse.json();
        setTotalDriversCount(totalDriversData.drivers?.length || 0);

      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        toast({
          title: "Error Loading Stats",
          description: "Could not load some dashboard statistics.",
          variant: "destructive",
        });
        // Set counts to N/A on error to indicate data couldn't be fetched
        setActiveRidesCount("N/A");
        setAvailableDriversCount("N/A");
        setTotalDriversCount("N/A");
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (user) {
      fetchDashboardStats();
    }
  }, [user, toast]);

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
        <StatCard title="Active Rides" value={isLoadingStats ? <Loader2 className="animate-spin h-5 w-5" /> : String(activeRidesCount)} icon={Car} color="text-green-500" />
        <StatCard title="Available Drivers" value={isLoadingStats ? <Loader2 className="animate-spin h-5 w-5" /> : `${availableDriversCount} / ${totalDriversCount}`} icon={Users} color="text-blue-500" />
        <StatCard title="Issues Reported" value={issuesReported.toString()} icon={AlertTriangle} color="text-red-500" />
        <StatCard title="System Status" value="Operational" icon={Briefcase} color="text-green-500" />
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Map className="w-6 h-6 text-primary" /> Live Fleet Overview
            </CardTitle>
        </CardHeader>
        <CardContent className="h-80 md:h-96 bg-muted/50 rounded-md overflow-hidden flex items-center justify-center text-muted-foreground">
            Map display temporarily disabled.
             {/* 
             <MapDisplay 
                center={defaultUKCenter} 
                zoom={12} 
                markers={mockFleetMarkers} 
                className="w-full h-full" 
                scrollWheelZoom={true}
             />
             */}
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
    value: string | React.ReactNode;
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

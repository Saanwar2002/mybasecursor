
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; 
import { Briefcase, Car, Users, BarChart3, AlertTriangle, Map, Loader2, ListChecks, ShieldCheck, TrafficCone, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from 'lucide-react';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };
const mockFleetMarkersData = [
    { position: {lat: 53.6480, lng: -1.7800}, title: "Driver 1 (John D) - Active", label: { text: "D1", color: "white", fontWeight: "bold"} },
    { position: {lat: 53.6420, lng: -1.7850}, title: "Driver 2 (Jane S) - Available", label: { text: "D2", color: "white", fontWeight: "bold"} },
    { position: {lat: 53.6500, lng: -1.7750}, title: "Driver 3 (Mike B) - On Break", label: { text: "D3", color: "white", fontWeight: "bold"} },
    { position: {lat: 53.6400, lng: -1.7900}, title: "Driver 4 (Sarah W) - Available", label: { text: "D4", color: "white", fontWeight: "bold"} },
];

interface Ride { id: string; status: string; }
interface Driver { id: string; status: string; }

type MapBusynessLevel = 'idle' | 'moderate' | 'high';

interface ActionableItem {
  id: string;
  label: string;
  completed: boolean; // For checkbox state
  priority?: 'high' | 'medium' | 'low';
  details?: string;
}

interface ActionableCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  items: ActionableItem[];
}

const initialOperatorActionItems: ActionableCategory[] = [
  {
    id: 'driver-management',
    name: 'Driver Management',
    icon: Users,
    items: [
      { id: 'op-task-1', label: 'Review 2 new driver applications.', completed: false, priority: 'high', details: 'Check documents for Smith J. and Ali K.' },
      { id: 'op-task-2', label: 'Driver Patel R. - PCO license expiring in 7 days.', completed: false, priority: 'medium', details: 'Send reminder or check renewal status.' },
      { id: 'op-task-3', label: 'Investigate low acceptance rate for Driver Evans.', completed: false, priority: 'low' },
    ],
  },
  {
    id: 'ride-operations',
    name: 'Ride Operations',
    icon: Car,
    items: [
      { id: 'op-task-4', label: 'High demand reported in "Town Centre" zone. Monitor driver availability.', completed: false, priority: 'high' },
      { id: 'op-task-5', label: 'Address passenger complaint re: Ride #12345 (vehicle cleanliness).', completed: false, priority: 'medium' },
    ],
  },
  {
    id: 'fleet-alerts',
    name: 'Fleet Alerts',
    icon: AlertTriangle,
    items: [
      { id: 'op-task-6', label: 'Vehicle BZ68 XYZ - MOT due next month.', completed: true, priority: 'medium' },
      { id: 'op-task-7', label: 'Surge pricing automatically activated in "Stadium Zone" due to event.', completed: false, priority: 'low', details: 'Monitor and adjust if needed.' },
    ],
  },
];

const mapOperatorPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return 'font-bold text-destructive';
    case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
    default: return '';
  }
};

export default function OperatorDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeRidesCount, setActiveRidesCount] = useState<number | string>("...");
  const [availableDriversCount, setAvailableDriversCount] = useState<number | string>("...");
  const [totalDriversCount, setTotalDriversCount] = useState<number | string>("...");
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [mapBusynessLevel, setMapBusynessLevel] = useState<MapBusynessLevel>('idle');
  const [operatorActionItems, setOperatorActionItems] = useState<ActionableCategory[]>(initialOperatorActionItems);


  // Mocked: In a real app, fetch actual issues
  const issuesReported = 3; // This could be derived from operatorActionItems count where priority is high

   useEffect(() => {
    const busynessLevels: MapBusynessLevel[] = ['idle', 'moderate', 'high', 'moderate'];
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % busynessLevels.length;
      setMapBusynessLevel(busynessLevels[currentIndex]);
    }, 4000); 

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoadingStats(true);
      try {
        const ridesResponseAssigned = await fetch(`/api/operator/bookings?status=Assigned&limit=100`); 
        const ridesResponseInProgress = await fetch(`/api/operator/bookings?status=In%20Progress&limit=100`);

        let assignedErrorText = "";
        let inProgressErrorText = "";

        if (!ridesResponseAssigned.ok) {
            assignedErrorText = await ridesResponseAssigned.text();
            console.error("Failed to fetch assigned rides", assignedErrorText);
        }
        if (!ridesResponseInProgress.ok) {
            inProgressErrorText = await ridesResponseInProgress.text();
            console.error("Failed to fetch in-progress rides", inProgressErrorText);
        }

        if (!ridesResponseAssigned.ok || !ridesResponseInProgress.ok) {
            let errorDetails = 'Failed to fetch ride data for dashboard.';
            if (assignedErrorText.includes("Query requires a Firestore index") || assignedErrorText.includes("Invalid query parameters")) {
                 errorDetails = `Error fetching assigned rides: ${assignedErrorText}`;
            } else if (inProgressErrorText.includes("Query requires a Firestore index") || inProgressErrorText.includes("Invalid query parameters")) {
                 errorDetails = `Error fetching in-progress rides: ${inProgressErrorText}`;
            }
            throw new Error(errorDetails);
        }
        
        const assignedData = await ridesResponseAssigned.json();
        const inProgressData = await ridesResponseInProgress.json();
        const activeRides = (assignedData.bookings?.length || 0) + (inProgressData.bookings?.length || 0);
        setActiveRidesCount(activeRides);

        const availableDriversResponse = await fetch(`/api/operator/drivers?status=Active&limit=100`); 
        if (!availableDriversResponse.ok) {
            const errorText = await availableDriversResponse.text();
            console.error("Failed to fetch available drivers", errorText);
            let errorDetails = 'Failed to fetch available drivers.';
            if (errorText.includes("Query requires a Firestore index") || errorText.includes("Invalid query parameters")) {
                errorDetails = `Error fetching available drivers: ${errorText}`;
            }
            throw new Error(errorDetails);
        }
        const availableDriversData = await availableDriversResponse.json();
        setAvailableDriversCount(availableDriversData.drivers?.length || 0);

        const totalDriversResponse = await fetch(`/api/operator/drivers?limit=100`); 
        if (!totalDriversResponse.ok) {
            const errorText = await totalDriversResponse.text();
            console.error("Failed to fetch total drivers", errorText);
            let errorDetails = 'Failed to fetch total drivers.';
             if (errorText.includes("Query requires a Firestore index") || errorText.includes("Invalid query parameters")) { 
                errorDetails = `Error fetching total drivers: ${errorText}`;
            }
            throw new Error(errorDetails);
        }
        const totalDriversData = await totalDriversResponse.json();
        setTotalDriversCount(totalDriversData.drivers?.length || 0);

      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        const description = error instanceof Error ? error.message : "Could not load some dashboard statistics.";
        toast({
          title: "Error Loading Stats",
          description: description,
          variant: "destructive",
          duration: 10000,
        });
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

  const mapContainerClasses = cn(
    "h-80 md:h-96 bg-muted/50 rounded-md overflow-hidden border-4",
    {
      'border-border': mapBusynessLevel === 'idle',
      'animate-flash-yellow-border': mapBusynessLevel === 'moderate',
      'animate-flash-red-border': mapBusynessLevel === 'high',
    }
  );

  const toggleOperatorTaskCompletion = (taskId: string) => {
    setOperatorActionItems(prevList =>
      prevList.map(category => ({
        ...category,
        items: category.items.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
      }))
    );
  };


  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-2/3 space-y-6">
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
          <CardContent className={mapContainerClasses}>
              <GoogleMapDisplay
                  center={huddersfieldCenterGoogle}
                  zoom={13}
                  markers={mockFleetMarkersData} 
                  className="w-full h-full"
                  disableDefaultUI={true}
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
            title="Analytics &amp; Reports"
            description="Access detailed reports on rides, earnings, and driver activity."
            icon={BarChart3}
            link="/operator/analytics"
            actionText="View Analytics"
          />
        </div>
      </div>
      
      {/* Action Items Side Panel Column */}
      <div className="lg:w-1/3 space-y-6">
        <Card className="shadow-lg sticky top-20">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-accent" /> Fleet Status &amp; Alerts
            </CardTitle>
            <CardDescription>Actionable insights and tasks for your fleet.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <Accordion type="multiple" defaultValue={operatorActionItems.map(cat => cat.id)} className="w-full">
              {operatorActionItems.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                  <AccordionTrigger className="text-base hover:no-underline font-semibold">
                    <span className="flex items-center gap-1.5">
                      <category.icon className="w-5 h-5 text-muted-foreground" />
                      {category.name} ({category.items.filter(i => !i.completed).length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {category.items && category.items.length > 0 ? (
                      <ul className="space-y-2 pl-2">
                        {category.items.map(item => (
                          <li key={item.id} className="flex items-start space-x-2 p-1.5 rounded-md hover:bg-muted/50">
                            <Checkbox
                              id={`op-item-${item.id}`}
                              checked={item.completed}
                              onCheckedChange={() => toggleOperatorTaskCompletion(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`op-item-${item.id}`}
                                className={cn("text-sm cursor-pointer", mapOperatorPriorityToStyle(item.priority), item.completed ? 'line-through text-muted-foreground/70' : '')}
                              >
                                {item.label}
                              </Label>
                              {item.details && !item.completed && <p className="text-xs text-muted-foreground">{item.details}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground pl-2 py-1">No items in this category.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {operatorActionItems.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No specific action items currently.</p>
            )}
          </CardContent>
           <CardFooter className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                    This panel shows mock alerts and tasks for your operator fleet.
                </p>
            </CardFooter>
        </Card>
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

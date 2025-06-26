
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; 
import { Briefcase, Car, Users, BarChart3, AlertTriangle, Map, Loader2, ListChecks, ShieldCheck, TrafficCone, UserPlus, Edit, CheckCircle as CheckCircleIconLucide, TimerIcon } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import * as LucideIcons from 'lucide-react'; // For dynamic icon loading
import { getAdminActionItems, type AdminActionItemsInput } from '@/ai/flows/admin-action-items-flow'; // Re-using for demo structure
type AiActionItemType = import('@/ai/flows/admin-action-items-flow').ActionItem; // Correct import for type
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

type MapBusynessLevel = 'idle' | 'moderate' | 'high';

interface ActionableItem {
  id: string;
  label: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  details?: string;
  link?: string;
  iconName?: string; 
  category?: string;
}

interface ActionableCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  items: ActionableItem[];
}

const DefaultAiTaskIcon = ListChecks;

const mapOperatorPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return 'font-bold text-destructive';
    case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
    default: return '';
  }
};

interface OperatorSettings {
  dispatchMode?: 'auto' | 'manual';
  maxAutoAcceptWaitTimeMinutes?: number;
}

export default function OperatorDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeRidesCount, setActiveRidesCount] = useState<number | string>("...");
  const [availableDriversCount, setAvailableDriversCount] = useState<number | string>("...");
  const [totalDriversCount, setTotalDriversCount] = useState<number | string>("...");
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [mapBusynessLevel, setMapBusynessLevel] = useState<MapBusynessLevel>('idle');
  const [operatorActionItems, setOperatorActionItems] = useState<ActionableCategory[]>([]);
  const [isLoadingActionItems, setIsLoadingActionItems] = useState(true);
  const [pendingDriverApprovals, setPendingDriverApprovals] = useState(0);
  
  const [operatorSettings, setOperatorSettings] = useState<OperatorSettings>({ dispatchMode: 'auto', maxAutoAcceptWaitTimeMinutes: 30 });
  const [isLoadingOperatorSettings, setIsLoadingOperatorSettings] = useState(true);
  const [simulatedIsHighWaitTime, setSimulatedIsHighWaitTime] = useState(false);


   useEffect(() => {
    const busynessLevels: MapBusynessLevel[] = ['idle', 'moderate', 'high', 'moderate'];
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % busynessLevels.length;
      setMapBusynessLevel(busynessLevels[currentIndex]);
    }, 4000); 
    return () => clearInterval(intervalId);
  }, []);

  const fetchOperatorSettings = useCallback(async () => {
    setIsLoadingOperatorSettings(true);
    try {
      const [dispatchRes, operationalRes] = await Promise.all([
        fetch('/api/operator/settings/dispatch-mode'),
        fetch('/api/operator/settings/operational')
      ]);

      if (!dispatchRes.ok || !operationalRes.ok) {
        const dispatchError = !dispatchRes.ok ? await dispatchRes.json().catch(()=>null) : null;
        const operationalError = !operationalRes.ok ? await operationalRes.json().catch(()=>null) : null;
        console.error("Error fetching operator settings:", {dispatchError, operationalError});
        throw new Error("Failed to load some operator settings.");
      }
      const dispatchData = await dispatchRes.json();
      const operationalData = await operationalRes.json();
      
      setOperatorSettings({
        dispatchMode: dispatchData.dispatchMode || 'auto',
        maxAutoAcceptWaitTimeMinutes: operationalData.maxAutoAcceptWaitTimeMinutes === undefined ? 30 : operationalData.maxAutoAcceptWaitTimeMinutes,
      });

    } catch (error) {
      console.error("Error in fetchOperatorSettings:", error);
      toast({ title: "Settings Load Error", description: error instanceof Error ? error.message : "Could not load operator settings.", variant: "destructive" });
      setOperatorSettings({ dispatchMode: 'auto', maxAutoAcceptWaitTimeMinutes: 30 }); // Fallback
    } finally {
      setIsLoadingOperatorSettings(false);
    }
  }, [toast]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoadingStats(true);
    setIsLoadingActionItems(true);
    try {
      const mockAssignedRides = Math.floor(Math.random() * 5) + 2; 
      const mockInProgressRides = Math.floor(Math.random() * 8) + 3; 
      setActiveRidesCount(mockAssignedRides + mockInProgressRides);
      const mockTotalDrivers = Math.floor(Math.random() * 20) + 15; 
      const mockAvailableDrivers = Math.floor(Math.random() * (mockTotalDrivers - 5)) + 5; 
      setAvailableDriversCount(mockAvailableDrivers);
      setTotalDriversCount(mockTotalDrivers);
      const mockPendingApprovals = Math.floor(Math.random() * 3); 
      setPendingDriverApprovals(mockPendingApprovals);
      
      const mockAdminInput: AdminActionItemsInput = {
        pendingOperatorApprovals: 0, // Not relevant for operator's own dashboard
        activeSystemAlerts: Math.floor(Math.random() * 2), // Operator specific alerts
        unresolvedSupportTickets: Math.floor(Math.random() * 5), // Tickets relevant to THIS operator
        recentFeatureFeedbackCount: 0, // Not relevant for this quick view
        platformLoadPercentage: 0, // Not relevant for operator's view
      };
      const aiOutput = await getAdminActionItems(mockAdminInput);

      // Process AI output for operator's dashboard
      const groupedTasks: Record<string, ActionableItem[]> = {};
      (aiOutput.actionItems || []).forEach(item => {
          const categoryName = item.category || 'General Tasks';
          if (!groupedTasks[categoryName]) groupedTasks[categoryName] = [];
          groupedTasks[categoryName].push({ ...item, completed: false });
      });

      if (mockPendingApprovals > 0) {
          if (!groupedTasks['Driver Management']) groupedTasks['Driver Management'] = [];
          groupedTasks['Driver Management'].unshift({
              id: 'op-task-approve-drivers', label: `Review ${mockPendingApprovals} new driver application(s).`,
              completed: false, priority: 'high', iconName: 'UserPlus',
              link: '/operator/manage-drivers?status=Pending%20Approval'
          });
      }
      
      const fetchedActionCategories: ActionableCategory[] = Object.entries(groupedTasks).map(([catName, tasks]) => {
        const IconComponent = tasks[0]?.iconName && LucideIcons[tasks[0].iconName as keyof typeof LucideIcons]
            ? LucideIcons[tasks[0].iconName as keyof typeof LucideIcons] as LucideIcon
            : DefaultAiTaskIcon;
        return {
            id: catName.toLowerCase().replace(/\s+/g, '-'),
            name: catName,
            icon: IconComponent,
            items: tasks,
        };
      });
      setOperatorActionItems(fetchedActionCategories);

    } catch (error) {
      console.error("Error fetching dashboard data (mock):", error);
      toast({ title: "Error Loading Dashboard Data", description: "Could not load some dashboard elements.", variant: "destructive" });
      setActiveRidesCount("N/A"); setAvailableDriversCount("N/A"); setTotalDriversCount("N/A");
      setOperatorActionItems([]);
    } finally {
      setIsLoadingStats(false);
      setIsLoadingActionItems(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOperatorSettings();
    fetchDashboardData();
  }, [fetchOperatorSettings, fetchDashboardData]);
  
  useEffect(() => {
    // Simulate high wait time toggling for demo
    const waitTimeToggleInterval = setInterval(() => {
      setSimulatedIsHighWaitTime(prev => !prev);
    }, 20000); // Toggle every 20 seconds
    return () => clearInterval(waitTimeToggleInterval);
  }, []);

  const mapContainerClasses = cn(
    "h-80 md:h-96 rounded-md overflow-hidden border-4",
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
  
  const issuesReported = operatorActionItems.reduce((acc, category) => 
    acc + category.items.filter(item => !item.completed && item.priority === 'high').length, 0);

  const JobIntakeStatusDisplay = () => {
    if (isLoadingOperatorSettings) {
      return <div className="flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading status...</div>;
    }
    const maxWait = operatorSettings.maxAutoAcceptWaitTimeMinutes;
    if (operatorSettings.dispatchMode === 'manual') {
      return <div className="flex items-center text-blue-600"><Edit className="h-4 w-4 mr-2" />Manual Assignment Active</div>;
    }
    if (simulatedIsHighWaitTime && (maxWait === undefined || maxWait > 0)) { // Check maxWait to ensure "No Limit" (0) isn't paused
      return <div className="flex items-center text-orange-600"><AlertTriangle className="h-4 w-4 mr-2" />Automated Offers Paused (Est. Wait {maxWait ? `> ${maxWait}min` : 'High'})</div>;
    }
    return <div className="flex items-center text-green-600"><CheckCircleIconLucide className="h-4 w-4 mr-2" />Accepting Automated Offers</div>;
  };


  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-2/3 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Taxi Base Control Panel</CardTitle>
            <CardDescription>Welcome, {user?.name || 'Operator'} ({user?.operatorCode || user?.customId || "ID N/A"}). Manage your fleet and operations efficiently.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-4">
               <Card className="bg-secondary/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-1">
                    <TimerIcon className="w-4 h-4 text-muted-foreground"/> Fleet Job Intake Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                   <JobIntakeStatusDisplay />
                   <p className="text-xs text-muted-foreground mt-1">
                    Current dispatch mode: <span className="font-medium">{operatorSettings.dispatchMode === 'auto' ? 'Automatic' : 'Manual'}</span>.
                    {operatorSettings.dispatchMode === 'auto' && ` Max offer wait time: ${operatorSettings.maxAutoAcceptWaitTimeMinutes === 0 ? 'No Limit' : `${operatorSettings.maxAutoAcceptWaitTimeMinutes} min`}.`}
                    <Link href="/operator/settings/operational-settings" className="ml-1 text-primary hover:underline text-xs">(Change Settings)</Link>
                  </p>
                </CardContent>
              </Card>
              <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
          <StatCard title="Urgent Issues" value={isLoadingActionItems ? <Loader2 className="animate-spin h-5 w-5" /> : issuesReported.toString()} icon={AlertTriangle} color="text-red-500" />
          <StatCard title="System Status" value="Operational" icon={Briefcase} color="text-green-500" />
        </div>

        <Card>
          <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Map className="w-6 h-6 text-primary" /> Live Fleet Overview
              </CardTitle>
          </CardHeader>
          <CardContent className={cn(mapContainerClasses, "p-0")}>
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
            notificationCount={pendingDriverApprovals > 0 ? pendingDriverApprovals : undefined}
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
      
      <div className="lg:w-1/3 space-y-6">
        <Card className="shadow-lg sticky top-20">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-accent" /> Fleet Status & Alerts
            </CardTitle>
            <CardDescription>Actionable insights and tasks for your fleet.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            {isLoadingActionItems ? (
                <div className="flex justify-center items-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
            ) : operatorActionItems.length > 0 ? (
            <Accordion type="multiple" defaultValue={operatorActionItems.map(cat => cat.id)} className="w-full">
              {operatorActionItems.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                  <AccordionTrigger className="text-base hover:no-underline font-semibold">
                    <span className="flex items-center gap-1.5">
                      <category.icon className="w-5 h-5 text-muted-foreground" />
                      {category.name} 
                      {category.items.filter(i => !i.completed).length > 0 && (
                        <Badge variant="secondary" className="ml-2">{category.items.filter(i => !i.completed).length} pending</Badge>
                      )}
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
                              {item.link ? (
                                <Link href={item.link} className="hover:underline text-primary">
                                   <Label
                                    htmlFor={`op-item-${item.id}`}
                                    className={cn("text-sm cursor-pointer", mapOperatorPriorityToStyle(item.priority), item.completed ? 'line-through text-muted-foreground/70' : '')}
                                  >
                                    {item.label}
                                  </Label>
                                </Link>
                              ) : (
                                 <Label
                                  htmlFor={`op-item-${item.id}`}
                                  className={cn("text-sm cursor-pointer", mapOperatorPriorityToStyle(item.priority), item.completed ? 'line-through text-muted-foreground/70' : '')}
                                >
                                  {item.label}
                                </Label>
                              )}
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
            ) : (
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
  notificationCount?: number;
}

function FeatureCard({ title, description, icon: Icon, link, actionText, notificationCount }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center pb-4">
        <div className="relative">
          <Icon className="w-10 h-10 text-accent mb-3" />
           {notificationCount && notificationCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-2 text-xs px-1.5 py-0.5 h-5 min-w-[1.25rem] flex items-center justify-center rounded-full">
              {notificationCount}
            </Badge>
          )}
        </div>
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

// Listen for unresolved emergency reports
const q = query(
  collection(db, 'hazardReports'),
  where('resolved', '==', false),
  where('hazardType', '==', 'emergency')
);
const unsubscribe = onSnapshot(q, (snapshot) => {
  const emergencies = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      label: `EMERGENCY: ${data.reportedByDriverId || 'Unknown Driver'} at (${data.location?.lat?.toFixed(5)}, ${data.location?.lng?.toFixed(5)})`,
      completed: false,
      priority: 'high',
      details: `Reported at: ${data.reportedAt instanceof Timestamp ? data.reportedAt.toDate().toLocaleString() : ''}`,
      iconName: 'AlertTriangle',
      category: 'Emergencies',
      link: `/operator/emergency/${doc.id}`
    };
  });
  setOperatorActionItems(prev => {
    // Remove old emergencies
    const filtered = prev.filter(cat => cat.name !== 'Emergencies');
    if (emergencies.length === 0) return filtered;
    return [
      {
        id: 'emergencies',
        name: 'Emergencies',
        icon: AlertTriangle,
        items: emergencies
      },
      ...filtered
    ];
  });
});
// Removed: return () => unsubscribe();

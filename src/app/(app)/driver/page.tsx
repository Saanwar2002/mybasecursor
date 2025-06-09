
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Car, DollarSign, History, MessageCircle, Navigation, Bell, Users, ListChecks, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from 'react';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { DriverAccountHealthCard } from '@/components/driver/DriverAccountHealthCard'; // Added import

interface TaskItem {
  id: string;
  label: string;
  completed: boolean;
}

interface TaskSubCategory {
  id: string;
  name: string;
  tasks: TaskItem[];
}

interface TaskCategory {
  id: string;
  name: string;
  subCategories?: TaskSubCategory[];
  tasks?: TaskItem[];
}

const initialToDoData: TaskCategory[] = [
  {
    id: 'cat1',
    name: 'Vehicle Maintenance Checks',
    tasks: [
      { id: 't1', label: 'Check Tire Pressure (Weekly)', completed: false },
      { id: 't2', label: 'Top Up Windscreen Washer Fluid', completed: true },
      { id: 't2a', label: 'Inspect Wiper Blades', completed: false },
    ]
  },
  {
    id: 'cat2',
    name: 'Driver Documentation',
    subCategories: [
      {
        id: 'sc1',
        name: 'License & Permits',
        tasks: [
          { id: 't3', label: 'Driving License Renewal (Due: Jan 2025)', completed: false },
          { id: 't4', label: 'Taxi Permit Check (Due: Mar 2025)', completed: false },
        ]
      },
      {
        id: 'sc2',
        name: 'Insurance Policy',
        tasks: [
          { id: 't5', label: 'Vehicle Insurance Renewal (Due: Jun 2024)', completed: true },
          { id: 't5a', label: 'Public Liability Insurance (Due: Aug 2024)', completed: false },
        ]
      }
    ]
  },
  {
    id: 'cat3',
    name: 'Account & Platform Setup',
    tasks: [
        { id: 't6', label: 'Upload Updated Profile Picture', completed: false },
        { id: 't7', label: 'Link Bank Account for Payouts', completed: true },
        { id: 't8', label: 'Complete Platform Training Module', completed: false },
    ]
  }
];


export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [toDoList, setToDoList] = useState<TaskCategory[]>(initialToDoData);

  const activeRide = null; 
  const earningsToday = 75.50;

  const toggleTaskCompletion = (taskId: string) => {
    setToDoList(prevList =>
      prevList.map(category => ({
        ...category,
        tasks: category.tasks?.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
        subCategories: category.subCategories?.map(subCategory => ({
          ...subCategory,
          tasks: subCategory.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        })),
      }))
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Dashboard Content Column */}
      <div className="lg:w-2/3 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Driver'}!</CardTitle>
              <div className="flex items-center space-x-2">
                <Switch id="online-status" checked={isOnline} onCheckedChange={setIsOnline} />
                <Label htmlFor="online-status" className={isOnline ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {isOnline ? "Online" : "Offline"}
                </Label>
              </div>
            </div>
            <CardDescription>Manage your rides, track earnings, and stay connected.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-6"> {/* Changed md:flex-row and items-center to items-start */}
            <div className="w-full space-y-4"> {/* Changed flex-1 to w-full */}
              <p className="text-lg">You are currently <span className={isOnline ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{isOnline ? "Online and available" : "Offline"}</span> for new ride offers.</p>
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/driver/available-rides">
                  <Car className="mr-2 h-5 w-5" /> Check for Ride Offers
                </Link>
              </Button>
            </div>
            {/* Removed the Image component and its div wrapper */}
          </CardContent>
        </Card>

        {/* Account Health Card added here */}
        <DriverAccountHealthCard />

        <div className="grid gap-6 md:grid-cols-2">
          {activeRide && (
            <Card className="md:col-span-2 lg:col-span-1 bg-primary/10 border-primary/30">
              <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" /> Current Ride
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Passenger:</strong> {activeRide.passenger}</p>
                <p><strong>Pickup:</strong> {activeRide.pickup}</p>
                <p><strong>Dropoff:</strong> {activeRide.dropoff}</p>
                <Button variant="outline" className="w-full mt-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground">Navigate to Pickup</Button>
              </CardContent>
            </Card>
          )}
          <Card className={activeRide ? "" : "md:col-span-1"}>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" /> Earnings Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">£{earningsToday.toFixed(2)}</p>
              <Link href="/driver/earnings" className="text-sm text-accent hover:underline">View Detailed Earnings</Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            title="Manage Current Ride"
            description="View details and manage your active ride."
            icon={Car}
            link="/driver/available-rides"
            actionText="View Current Status"
          />
          <FeatureCard
            title="Earnings & History"
            description="Track your earnings and view past rides."
            icon={History}
            link="/driver/earnings"
            actionText="View Earnings"
          />
          <FeatureCard
            title="In-App Chat"
            description="Communicate with passengers or support."
            icon={MessageCircle}
            link="/driver/chat"
            actionText="Open Chat"
          />
        </div>
      </div>

      {/* "To Be Done" Side Panel Column */}
      <div className="lg:w-1/3 space-y-6">
        <Card className="shadow-lg sticky top-20">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-accent" /> To Be Done
            </CardTitle>
            <CardDescription>Tasks and reminders for your attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {toDoList.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                  <AccordionTrigger className="text-base hover:no-underline font-semibold">
                    {category.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    {category.tasks && category.tasks.length > 0 && (
                      <ul className="space-y-2 pl-2">
                        {category.tasks.map(task => (
                          <li key={task.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={task.id}
                              checked={task.completed}
                              onCheckedChange={() => toggleTaskCompletion(task.id)}
                            />
                            <Label
                              htmlFor={task.id}
                              className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                            >
                              {task.label}
                            </Label>
                          </li>
                        ))}
                      </ul>
                    )}
                    {category.subCategories && category.subCategories.length > 0 && (
                      <Accordion type="multiple" className="w-full pl-2">
                        {category.subCategories.map(subCat => (
                          <AccordionItem value={subCat.id} key={subCat.id} className="border-l-2 border-primary/20 pl-2 my-1 rounded-r-md">
                            <AccordionTrigger className="text-sm hover:no-underline py-2 font-medium">
                              {subCat.name}
                            </AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-2 pl-2">
                                {subCat.tasks.map(task => (
                                  <li key={task.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={task.id}
                                      checked={task.completed}
                                      onCheckedChange={() => toggleTaskCompletion(task.id)}
                                    />
                                    <Label
                                      htmlFor={task.id}
                                      className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                                    >
                                      {task.label}
                                    </Label>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {toDoList.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No tasks pending. Well done!</p>
            )}
          </CardContent>
           <CardFooter className="border-t pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Keep this list updated for smooth operations.
                </div>
            </CardFooter>
        </Card>
      </div>
    </div>
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

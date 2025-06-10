
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
import { useRouter } from 'next/navigation'; // Import useRouter

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false); // Default to Offline
  const router = useRouter(); // Initialize useRouter

  const activeRide = null; 
  const earningsToday = 75.50;

  const handleOnlineStatusChange = (checked: boolean) => {
    setIsOnline(checked);
    if (checked) {
      router.push('/driver/available-rides');
    }
    // In a real app, you'd also send this status update to your backend here.
    // e.g., updateDriverStatus(user.id, checked);
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
                <Switch 
                  id="online-status" 
                  checked={isOnline} 
                  onCheckedChange={handleOnlineStatusChange} 
                />
                <Label htmlFor="online-status" className={isOnline ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {isOnline ? "Online" : "Offline"}
                </Label>
              </div>
            </div>
            <CardDescription>Manage your rides, track earnings, and stay connected.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-6">
            <div className="w-full space-y-4">
              <p className="text-lg">You are currently <span className={isOnline ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{isOnline ? "Online and available" : "Offline"}</span> for new ride offers.</p>
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/driver/available-rides">
                  <Car className="mr-2 h-5 w-5" /> Check for Ride Offers
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

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

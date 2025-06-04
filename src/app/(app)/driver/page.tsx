
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, DollarSign, History, MessageCircle, Navigation, Bell, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from 'react';
import Image from 'next/image';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  // Mock data - in a real app, this would come from state/API
  const activeRide = null; // Example: { pickup: "123 Main St, London", dropoff: "City Center Mall, London", passenger: "Alice Wonderland" };
  const earningsToday = 75.50;
  // const pendingRequests = 2; // Removed as drivers won't see general pending requests

  return (
    <div className="space-y-6">
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
         <CardContent className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 space-y-4">
            <p className="text-lg">You are currently <span className={isOnline ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{isOnline ? "Online and available" : "Offline"}</span> for new ride offers.</p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/driver/available-rides">
                <Car className="mr-2 h-5 w-5" /> Check for Ride Offers
              </Link>
            </Button>
          </div>
           <div className="flex-shrink-0">
            <Image src="https://placehold.co/300x200.png" alt="Driver in car" data-ai-hint="driver car navigation" width={300} height={200} className="rounded-lg shadow-md" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        {/* The "Ride Requests" card was here and has been removed */}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Manage Current Ride"
          description="View details and manage your active ride."
          icon={Car} // Changed from Users to Car for consistency with other ride buttons
          link="/driver/available-rides" // This page will show active ride or "awaiting offers"
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

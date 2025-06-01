"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, Sparkles, History, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';

export default function PassengerDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Passenger'}!</CardTitle>
          <CardDescription>Manage your rides and explore Link Cabs features.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 space-y-4">
            <p className="text-lg">Ready for your next journey? Book a ride, track your taxi, or chat with your driver all in one place.</p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/dashboard/book-ride">
                <Car className="mr-2 h-5 w-5" /> Book a New Ride
              </Link>
            </Button>
          </div>
          <div className="flex-shrink-0">
            <Image src="https://placehold.co/300x200.png" alt="Happy passenger in a taxi" data-ai-hint="passenger taxi" width={300} height={200} className="rounded-lg shadow-md" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Book a Ride"
          description="Quickly find and book a taxi to your destination."
          icon={Car}
          link="/dashboard/book-ride"
          actionText="Book Now"
        />
        <FeatureCard
          title="AI Taxi Search"
          description="Let our AI suggest the best taxi for your specific needs."
          icon={Sparkles}
          link="/dashboard/ai-search"
          actionText="Try AI Search"
        />
        <FeatureCard
          title="My Rides"
          description="View your past rides and rate your experiences."
          icon={History}
          link="/dashboard/my-rides"
          actionText="View History"
        />
        <FeatureCard
          title="In-App Chat"
          description="Communicate with your driver for smooth pickups."
          icon={MessageCircle}
          link="/dashboard/chat"
          actionText="Open Chat"
        />
         <FeatureCard
          title="Real-Time Tracking"
          description="Track your taxi's location live on the map."
          icon={MapPin}
          link="/dashboard/track-ride" 
          actionText="Track a Ride"
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

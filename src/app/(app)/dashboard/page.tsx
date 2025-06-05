
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, Sparkles, History, MessageCircle, Cog, Users2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-lg shadow-md" />,
});

const huddersfieldCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const MOCK_OPERATORS = [
  { id: 'op1', name: 'City Taxis' },
  { id: 'op2', name: 'Speedy Cabs' },
  { id: 'op3', name: 'Local Cars' },
  { id: 'op4', name: 'Alpha Cars' },
];

type MapBusynessLevel = 'idle' | 'moderate' | 'high';

export default function PassengerDashboardPage() {
  const { user } = useAuth();
  const [bookingPreference, setBookingPreference] = useState<'app_chooses' | 'specific_operator'>('app_chooses');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [mapBusynessLevel, setMapBusynessLevel] = useState<MapBusynessLevel>('idle');

  const bookRideHref = bookingPreference === 'specific_operator' && selectedOperator
    ? `/dashboard/book-ride?operator_preference=${encodeURIComponent(selectedOperator)}`
    : '/dashboard/book-ride';

  useEffect(() => {
    const busynessLevels: MapBusynessLevel[] = ['idle', 'moderate', 'high'];
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % busynessLevels.length;
      setMapBusynessLevel(busynessLevels[currentIndex]);
    }, 5000); 

    return () => clearInterval(intervalId); 
  }, []);

  const mapContainerClasses = cn(
    "relative flex-shrink-0 w-full h-[200px] rounded-lg shadow-md overflow-hidden border-2 transition-colors duration-500 ease-in-out",
    {
      'border-muted bg-muted/5': mapBusynessLevel === 'idle',
      'border-yellow-500 bg-yellow-500/5': mapBusynessLevel === 'moderate',
      'border-red-500 bg-red-500/5': mapBusynessLevel === 'high',
    }
  );

  const getBusynessStatusText = () => {
    switch (mapBusynessLevel) {
      case 'idle': return "Ready for Bookings";
      case 'moderate': return "Moderately Busy";
      case 'high': return "Currently Very Busy";
      default: return "";
    }
  };

  const getBusynessStatusTextColor = () => {
    switch (mapBusynessLevel) {
      case 'idle': return "text-foreground";
      case 'moderate': return "text-yellow-600 dark:text-yellow-400";
      case 'high': return "text-red-600 dark:text-red-400";
      default: return "text-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Passenger'}!</CardTitle>
          <CardDescription>Manage your rides and explore Link Cabs features.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full space-y-4">
            <p className="text-lg text-center md:text-left">
              Ready for your next journey? Choose your preference below.
            </p>

            <div className="space-y-3 p-4 border bg-muted/30 rounded-lg">
              <Label className="text-base font-semibold">Booking Preference</Label>
              <RadioGroup
                value={bookingPreference}
                onValueChange={(value: 'app_chooses' | 'specific_operator') => {
                  setBookingPreference(value);
                  if (value === 'app_chooses') {
                    setSelectedOperator('');
                  }
                }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="app_chooses" id="app_chooses" />
                  <Label htmlFor="app_chooses" className="font-normal">Let Link Cabs find driver</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific_operator" id="specific_operator" />
                  <Label htmlFor="specific_operator" className="font-normal">Choose a specific Taxi Base</Label>
                </div>
              </RadioGroup>

              {bookingPreference === 'specific_operator' && (
                <div className="mt-3 space-y-1">
                  <Label htmlFor="operator-select">Select Taxi Base</Label>
                  <Select
                    value={selectedOperator}
                    onValueChange={setSelectedOperator}
                  >
                    <SelectTrigger id="operator-select">
                      <SelectValue placeholder="Select a taxi operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_OPERATORS.map(op => (
                        <SelectItem key={op.id} value={op.name}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedOperator && <p className="text-xs text-destructive">Please select an operator.</p>}
                </div>
              )}
            </div>

            <Button 
              asChild 
              size="lg" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
              disabled={bookingPreference === 'specific_operator' && !selectedOperator}
            >
              <Link href={bookRideHref}>
                <Car className="mr-2 h-5 w-5" /> Book a New Ride
              </Link>
            </Button>
          </div>
          <div className={mapContainerClasses}>
            <GoogleMapDisplay
              center={huddersfieldCenter}
              zoom={13}
              className="w-full h-full"
              disableDefaultUI={true}
            />
             <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card/95 dark:bg-background/95 border border-border/50 backdrop-blur-sm p-2 sm:p-3 rounded-md shadow-lg pointer-events-none z-10")}>
                <p className={cn("text-xs sm:text-sm font-semibold text-center", getBusynessStatusTextColor())}>
                    {getBusynessStatusText()}
                </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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


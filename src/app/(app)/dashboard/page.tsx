"use client"; 

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, Sparkles, History, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOperators } from '@/hooks/useOperators';
import { useNearbyDrivers } from '@/hooks/useNearbyDrivers';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-lg shadow-md" />,
});

const huddersfieldCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

type MapBusynessLevel = 'idle' | 'moderate' | 'high';

// Define the driver car icon SVG and Data URL (copied from driver's available-rides page)
const driverCarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
  <!-- Pin Needle (Black) -->
  <path d="M20 50 L15 35 H25 Z" fill="black"/>
  <!-- Yellow Taxi Circle with Black Border -->
  <circle cx="20" cy="18" r="15" fill="#FFD700" stroke="black" stroke-width="2"/>
  <!-- Taxi Sign on Top -->
  <rect x="18" y="8" width="4" height="3" fill="black" rx="1"/>
  <!-- White Taxi Body -->
  <rect x="14" y="12" width="12" height="6" fill="white" stroke="black" stroke-width="1" rx="2"/>
  <!-- Taxi Windows -->
  <rect x="15" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
  <rect x="22" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
  <!-- Taxi Wheels -->
  <circle cx="16" cy="20" r="2" fill="black"/>
  <circle cx="24" cy="20" r="2" fill="black"/>
  <!-- Taxi Light -->
  <rect x="19" y="10" width="2" height="1" fill="#FF6B35"/>
</svg>`;

const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(driverCarIconSvg)}` : '';

// Passenger marker SVG (Google-style, dark circle with person)
const passengerIconSvg = `<svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="28" width="4" height="18" rx="2" fill="#232B3A"/><circle cx="20" cy="20" r="16" fill="#232B3A" stroke="white" stroke-width="2"/><circle cx="20" cy="17" r="4" fill="white"/><rect x="14" y="22" width="12" height="5" rx="2.5" fill="white"/></svg>`;
const passengerIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(passengerIconSvg)}` : '';

interface MapMarker {
  position: google.maps.LatLngLiteral;
  title?: string;
  iconUrl?: string;
  iconScaledSize?: { width: number; height: number };
}

export default function PassengerDashboardPage() {
  const { user } = useAuth();
  const [bookingPreference, setBookingPreference] = useState<'app_chooses' | 'specific_operator'>('app_chooses');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [mapBusynessLevel, setMapBusynessLevel] = useState<MapBusynessLevel>('idle');
  const { operators, loading: loadingOperators, error: errorOperators } = useOperators();
  const { drivers, loading: loadingDrivers, error: errorDrivers } = useNearbyDrivers();

  // Add passenger location state
  const [passengerLocation, setPassengerLocation] = useState<google.maps.LatLngLiteral | null>(null);

  const bookRideHref = bookingPreference === 'specific_operator' && selectedOperator
    ? `/dashboard/book-ride?operator_preference=${encodeURIComponent(selectedOperator)}`
    : '/dashboard/book-ride';

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPassengerLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('Geolocation error:', err);
        }
      );
    }
  }, []);

  const mapContainerClasses = cn(
    "relative flex-shrink-0 w-full h-[200px] rounded-lg shadow-md overflow-hidden border-2 transition-colors duration-500 ease-in-out",
    {
      'border-muted bg-muted/5': mapBusynessLevel === 'idle',
      'border-yellow-500 bg-yellow-500/5': mapBusynessLevel === 'moderate',
      'border-red-500 bg-red-500/5': mapBusynessLevel === 'high',
    }
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Passenger'}!</CardTitle>
          <CardDescription>Manage your rides and explore MyBase features.</CardDescription> 
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full space-y-4">
            <div className="w-full p-3 border-4 border-accent rounded-lg shadow-sm my-3 bg-accent/5">
              <p className="text-lg text-center md:text-left font-bold text-primary-foreground">
                Ride with confidence! MyBase ensures your driver receives 100% of the fare and any tips you give. We take no commission from their earnings on your journey.
              </p>
            </div>

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
                  <Label htmlFor="app_chooses" className="font-normal">Let MyBase App Find Me Driver</Label> 
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
                      {loadingOperators && <div className="p-2 text-center text-muted-foreground">Loading operators...</div>}
                      {errorOperators && <div className="p-2 text-center text-destructive">Failed to load operators</div>}
                      {!loadingOperators && !errorOperators && operators.length === 0 && (
                        <div className="p-2 text-center text-muted-foreground">No operators found</div>
                      )}
                      {!loadingOperators && !errorOperators && operators.map(op => (
                        <SelectItem key={op.id} value={op.operatorCode}>
                          {op.name} ({op.operatorCode})
                        </SelectItem>
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
              className="w-full bg-primary hover:bg-primary/90 active:bg-accent active:text-accent-foreground active:scale-[0.98] transition-transform duration-100 ease-in-out text-primary-foreground mt-4"
              disabled={bookingPreference === 'specific_operator' && !selectedOperator}
            >
              <Link href={bookRideHref}>
                <Car className="mr-2 h-5 w-5" /> Book a New Ride
              </Link>
            </Button>
          </div>
          <div className={mapContainerClasses}>
            {loadingDrivers && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                <span className="text-muted-foreground">Loading drivers...</span>
              </div>
            )}
            {errorDrivers && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                <span className="text-destructive">Failed to load drivers</span>
              </div>
            )}
            <GoogleMapDisplay
              center={huddersfieldCenter}
              zoom={13}
              markers={[
                ...drivers.map(driver => ({
                  position: driver.location,
                  title: driver.name || 'Available Taxi',
                  iconUrl: driverCarIconDataUrl,
                  iconScaledSize: { width: 40, height: 50 },
                })),
                ...(passengerLocation ? [{
                  position: passengerLocation,
                  title: 'You',
                  iconUrl: passengerIconDataUrl,
                  iconScaledSize: { width: 40, height: 54 },
                }] : [])
              ]}
              className="w-full h-full"
              disableDefaultUI={true}
            />
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
          title="My Active Ride"
          description="Track your taxi's location live on the map."
          icon={MapPin}
          link="/dashboard/track-ride" 
          actionText="Track My Ride"
        />
        <FeatureCard
          title="Rides History"
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

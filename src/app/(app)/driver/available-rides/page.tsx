
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});


interface RideRequest {
  id: string;
  passengerName: string;
  passengerAvatar: string;
  pickupLocation: string;
  dropoffLocation: string;
  estimatedTime: string; 
  fareEstimate: number;
  status: 'pending' | 'accepted' | 'declined' | 'active';
  pickupCoords?: [number, number]; // latitude, longitude
  dropoffCoords?: [number, number];
}

// Default UK coordinates (London) for mock data
const defaultUKCenter: [number, number] = [51.5074, -0.1278];

const mockRideRequests: RideRequest[] = [
  { id: 'r1', passengerName: 'Alice Smith', passengerAvatar: 'https://placehold.co/40x40.png?text=AS', pickupLocation: '123 Oak St, London', dropoffLocation: 'City Mall, London', estimatedTime: '10 min', fareEstimate: 15.50, status: 'pending', pickupCoords: [51.510, -0.120], dropoffCoords: [51.505, -0.130] },
  { id: 'r2', passengerName: 'Bob Johnson', passengerAvatar: 'https://placehold.co/40x40.png?text=BJ', pickupLocation: 'Central Station, London', dropoffLocation: 'Airport Terminal 2, London', estimatedTime: '5 min', fareEstimate: 28.00, status: 'pending', pickupCoords: [51.500, -0.125], dropoffCoords: [51.470, -0.454] },
  { id: 'r3', passengerName: 'Carol White', passengerAvatar: 'https://placehold.co/40x40.png?text=CW', pickupLocation: 'Green Park, London', dropoffLocation: 'Downtown Office, London', estimatedTime: '12 min', fareEstimate: 12.75, status: 'active', pickupCoords: [51.507, -0.142], dropoffCoords: [51.515, -0.087] },
];

export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>(mockRideRequests);
  const { toast } = useToast();
  const [driverLocation] = useState<[number, number]>([51.500, -0.100]); // Mock driver location

  const handleRideAction = (rideId: string, newStatus: RideRequest['status']) => {
    setRideRequests(prevRequests =>
      prevRequests.map(req => 
        req.id === rideId ? { ...req, status: newStatus } : req
      )
    );
    toast({
      title: `Ride ${newStatus}`,
      description: `Ride request from ${rideRequests.find(r=>r.id === rideId)?.passengerName} has been ${newStatus}.`,
    });
  };

  const activeRide = rideRequests.find(r => r.status === 'active');
  const pendingRides = rideRequests.filter(r => r.status === 'pending');

  const getMapMarkersForActiveRide = () => {
    if (!activeRide || !activeRide.pickupCoords) return [];
    const markers = [{ position: driverLocation, popupText: "Your Location", iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png" }]; // Driver
    markers.push({ position: activeRide.pickupCoords, popupText: `Pickup: ${activeRide.passengerName}` });
    if (activeRide.dropoffCoords) {
        markers.push({ position: activeRide.dropoffCoords, popupText: "Drop-off" });
    }
    return markers;
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Ride Management</CardTitle>
          <CardDescription>View and manage incoming ride requests. Update your location for active rides.</CardDescription>
        </CardHeader>
      </Card>

      {activeRide && (
        <Card className="bg-primary/10 border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <Navigation className="w-6 h-6 text-primary" /> Current Active Ride
            </CardTitle>
            <CardDescription>Passenger: {activeRide.passengerName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {activeRide.pickupLocation}</p>
            <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {activeRide.dropoffLocation}</p>
            <p className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> <strong>Est. Time:</strong> {activeRide.estimatedTime}</p>
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">Live Ride Map:</p>
              <div className="h-64 bg-muted rounded-md overflow-hidden">
                <MapDisplay 
                    center={activeRide.pickupCoords || driverLocation} 
                    zoom={13} 
                    markers={getMapMarkersForActiveRide()}
                    className="w-full h-full"
                    scrollWheelZoom={true}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"><Navigation className="mr-2 h-4 w-4" /> Navigate to Pickup</Button>
              <Button variant="outline" className="flex-1" onClick={() => handleRideAction(activeRide.id, 'pending')}>Mark as Completed (Demo)</Button>
            </div>
            <Button variant="destructive" className="w-full mt-2" onClick={() => handleRideAction(activeRide.id, 'pending')}>Cancel Ride (Demo)</Button>
          </CardContent>
        </Card>
      )}

      <h2 className="text-2xl font-semibold pt-4">Pending Ride Requests ({pendingRides.length})</h2>
      {pendingRides.length === 0 && !activeRide && (
         <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No pending ride requests at the moment.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {pendingRides.map((req) => (
          <Card key={req.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
               <div className="flex items-center gap-3 mb-2">
                <Image src={req.passengerAvatar} alt={req.passengerName} width={40} height={40} className="rounded-full" data-ai-hint="avatar profile" />
                <div>
                  <CardTitle className="text-lg">{req.passengerName}</CardTitle>
                  <Badge variant="outline" className="mt-1">Fare: £{req.fareEstimate.toFixed(2)}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {req.pickupLocation}</p>
              <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {req.dropoffLocation}</p>
              <p className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> <strong>Pickup ETA:</strong> {req.estimatedTime}</p>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={() => handleRideAction(req.id, 'declined')}
              >
                <X className="mr-2 h-4 w-4" /> Decline
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={() => handleRideAction(req.id, 'active')}
              >
                <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}


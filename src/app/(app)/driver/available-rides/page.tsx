
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle } from "lucide-react";
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
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'completed' | 'cancelled_by_driver';
  pickupCoords?: [number, number]; 
  dropoffCoords?: [number, number];
  distanceMiles?: number;
}

const defaultUKCenter: [number, number] = [51.5074, -0.1278];

const mockRideRequests: RideRequest[] = [
  { id: 'r1', passengerName: 'Alice Smith', passengerAvatar: 'https://placehold.co/40x40.png?text=AS', pickupLocation: '123 Oak St, London', dropoffLocation: 'City Mall, London', estimatedTime: '10 min', fareEstimate: 15.50, status: 'pending', pickupCoords: [51.510, -0.120], dropoffCoords: [51.505, -0.130], distanceMiles: 2.5 },
  { id: 'r2', passengerName: 'Bob Johnson', passengerAvatar: 'https://placehold.co/40x40.png?text=BJ', pickupLocation: 'Central Station, London', dropoffLocation: 'Airport Terminal 2, London', estimatedTime: '5 min', fareEstimate: 28.00, status: 'pending', pickupCoords: [51.500, -0.125], dropoffCoords: [51.470, -0.454], distanceMiles: 15.2 },
  { id: 'r3', passengerName: 'Carol White', passengerAvatar: 'https://placehold.co/40x40.png?text=CW', pickupLocation: 'Green Park, London', dropoffLocation: 'Downtown Office, London', estimatedTime: '12 min', fareEstimate: 12.75, status: 'pending', pickupCoords: [51.507, -0.142], dropoffCoords: [51.515, -0.087], distanceMiles: 3.1 },
];

export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>(mockRideRequests);
  const { toast } = useToast();
  const [driverLocation] = useState<[number, number]>([51.500, -0.100]); 

  const handleRideAction = (rideId: string, newStatus: RideRequest['status']) => {
    setRideRequests(prevRequests => {
      if (newStatus === 'active') {
        // Ensure only one ride is active
        return prevRequests.map(req => {
          if (req.id === rideId) return { ...req, status: 'active' };
          if (req.status === 'active') return { ...req, status: 'pending' }; // Reset other active rides
          return req;
        });
      }
      return prevRequests.map(req => 
        req.id === rideId ? { ...req, status: newStatus } : req
      );
    });

    const ridePassengerName = rideRequests.find(r => r.id === rideId)?.passengerName;
    let toastMessage = `Ride request from ${ridePassengerName} has been ${newStatus}.`;
    if (newStatus === 'completed') toastMessage = `Ride with ${ridePassengerName} marked as completed.`;
    if (newStatus === 'cancelled_by_driver') toastMessage = `Active ride with ${ridePassengerName} cancelled.`;
    
    toast({
      title: `Ride ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      description: toastMessage,
    });
  };

  const activeRide = rideRequests.find(r => r.status === 'active');
  const pendingRides = rideRequests.filter(r => r.status === 'pending');

  const getMapMarkersForActiveRide = () => {
    if (!activeRide || !activeRide.pickupCoords) return [];
    const markers = [{ position: driverLocation, popupText: "Your Location", iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png" }]; // Placeholder for driver icon
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
          <CardDescription>
            {activeRide 
              ? "Focus on your current active ride." 
              : "View and manage incoming ride requests. Update your location for active rides."}
          </CardDescription>
        </CardHeader>
      </Card>

      {activeRide ? (
        <Card className="bg-primary/10 border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <Navigation className="w-7 h-7 text-primary" /> Current Active Ride
            </CardTitle>
            <CardDescription>Passenger: {activeRide.passengerName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 mb-3">
                <Image src={activeRide.passengerAvatar} alt={activeRide.passengerName} width={48} height={48} className="rounded-full border-2 border-primary" data-ai-hint="avatar passenger" />
                <div>
                  <p className="text-lg font-semibold">{activeRide.passengerName}</p>
                  <Badge variant="outline" className="border-primary text-primary">Fare: £{activeRide.fareEstimate.toFixed(2)}</Badge>
                </div>
            </div>
            <p className="flex items-center gap-1.5 text-md"><MapPin className="w-5 h-5 text-muted-foreground" /> <strong>From:</strong> {activeRide.pickupLocation}</p>
            <p className="flex items-center gap-1.5 text-md"><MapPin className="w-5 h-5 text-muted-foreground" /> <strong>To:</strong> {activeRide.dropoffLocation}</p>
            <p className="flex items-center gap-1.5 text-md"><Clock className="w-5 h-5 text-muted-foreground" /> <strong>Est. Time to Pickup:</strong> {activeRide.estimatedTime}</p>
            {activeRide.distanceMiles && (
                <p className="flex items-center gap-1.5 text-md"><Route className="w-5 h-5 text-muted-foreground" /> <strong>Ride Distance:</strong> {activeRide.distanceMiles.toFixed(1)} miles</p>
            )}
            <div className="mt-4">
              <p className="text-md font-medium mb-1">Live Ride Map:</p>
              <div className="h-72 bg-muted rounded-lg overflow-hidden border shadow-sm flex items-center justify-center text-muted-foreground">
                Map display temporarily disabled.
                {/* 
                <MapDisplay 
                    key={activeRide.id}
                    center={activeRide.pickupCoords || driverLocation} 
                    zoom={13} 
                    markers={getMapMarkersForActiveRide()}
                    className="w-full h-full"
                    scrollWheelZoom={true}
                />
                */}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base py-3">
                  <Navigation className="mr-2 h-5 w-5" /> Navigate to Pickup
              </Button>
              <Button variant="outline" className="w-full text-base py-3 border-green-500 text-green-600 hover:bg-green-500 hover:text-white" onClick={() => handleRideAction(activeRide.id, 'completed')}>
                  <CheckCircle className="mr-2 h-5 w-5" /> Complete Ride
                </Button>
            </div>
            <Button variant="destructive" className="w-full mt-3 text-base py-3" onClick={() => handleRideAction(activeRide.id, 'cancelled_by_driver')}>
                <XCircle className="mr-2 h-5 w-5" /> Cancel Active Ride
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <h2 className="text-2xl font-semibold pt-4">Pending Ride Requests ({pendingRides.length})</h2>
          {pendingRides.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No pending ride requests at the moment. You are all caught up!
              </CardContent>
            </Card>
          )}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {pendingRides.map((req) => (
              <Card key={req.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Image src={req.passengerAvatar} alt={req.passengerName} width={40} height={40} className="rounded-full" data-ai-hint="avatar passenger" />
                    <div>
                      <CardTitle className="text-lg">{req.passengerName}</CardTitle>
                      <Badge variant="outline" className="mt-1">Fare: £{req.fareEstimate.toFixed(2)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm flex-grow">
                  <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {req.pickupLocation}</p>
                  <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {req.dropoffLocation}</p>
                  <p className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> <strong>Pickup ETA:</strong> {req.estimatedTime}</p>
                  {req.distanceMiles && (
                    <p className="flex items-center gap-1"><Route className="w-4 h-4 text-muted-foreground" /> <strong>Distance:</strong> {req.distanceMiles.toFixed(1)} miles</p>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2 mt-auto">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    onClick={() => handleRideAction(req.id, 'declined')}
                    disabled={!!activeRide} 
                  >
                    <X className="mr-2 h-4 w-4" /> Decline
                  </Button>
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleRideAction(req.id, 'active')}
                    disabled={!!activeRide} 
                  >
                    <Check className="mr-2 h-4 w-4" /> Accept
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

    
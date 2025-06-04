
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

interface RideRequest {
  id: string;
  passengerName: string;
  passengerAvatar: string;
  pickupLocation: string;
  dropoffLocation: string;
  estimatedTime: string; // To pickup
  fareEstimate: number;
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'driver_assigned' | 'arrived_at_pickup' | 'in_progress' | 'completed' | 'cancelled_by_driver';
  pickupCoords?: [number, number];
  dropoffCoords?: [number, number];
  distanceMiles?: number; // Total ride distance
  passengerCount: number;
  passengerPhone?: string;
  passengerRating?: number;
  notifiedPassengerArrivalTimestamp?: string | null; // ISO string from API
  passengerAcknowledgedArrivalTimestamp?: string | null; // ISO string from API
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const mockRideRequests: RideRequest[] = [
  { id: 'r1', passengerName: 'Alice Smith', passengerAvatar: 'https://placehold.co/40x40.png?text=AS', pickupLocation: 'Kingsgate Centre, Huddersfield', dropoffLocation: 'Huddersfield Royal Infirmary', estimatedTime: '10 min', fareEstimate: 7.50, status: 'pending', pickupCoords: [53.6458, -1.7845], dropoffCoords: [53.6530, -1.8000], distanceMiles: 2.5, passengerCount: 1, passengerPhone: '555-0101', passengerRating: 4.5 },
  { id: 'r2', passengerName: 'Bob Johnson', passengerAvatar: 'https://placehold.co/40x40.png?text=BJ', pickupLocation: 'Huddersfield Station', dropoffLocation: 'University of Huddersfield, Queensgate', estimatedTime: '5 min', fareEstimate: 5.00, status: 'pending', pickupCoords: [53.6490, -1.7795], dropoffCoords: [53.6430, -1.7720], distanceMiles: 1.2, passengerCount: 2, passengerPhone: '555-0102', passengerRating: 4.8 },
  { id: 'r3', passengerName: 'Carol White', passengerAvatar: 'https://placehold.co/40x40.png?text=CW', pickupLocation: 'Greenhead Park, Huddersfield', dropoffLocation: 'Lindley Village', estimatedTime: '12 min', fareEstimate: 6.75, status: 'pending', pickupCoords: [53.6495, -1.7950], dropoffCoords: [53.6580, -1.8200], distanceMiles: 3.1, passengerCount: 1, passengerPhone: '555-0103', passengerRating: 3.2 },
];

export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>(mockRideRequests);
  const { toast } = useToast();
  const { user: driverUser } = useAuth();
  const [driverLocation] = useState<google.maps.LatLngLiteral>({ lat: 53.6430, lng: -1.7800 });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});


  const handleRideAction = async (rideId: string, actionType: 'accept' | 'decline' | 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active') => {
    if (!driverUser) {
      toast({ title: "Error", description: "Driver not logged in.", variant: "destructive"});
      return;
    }
    setActionLoading(prev => ({ ...prev, [rideId]: true }));

    let newStatus: RideRequest['status'] | undefined = undefined;
    let apiAction: string | undefined = undefined;
    let toastMessage = "";
    let toastTitle = "";

    const currentRide = rideRequests.find(r => r.id === rideId);
    if (!currentRide) {
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
        return;
    }

    switch(actionType) {
        case 'accept':
            newStatus = 'driver_assigned'; // Or 'active' if that's the immediate next state
            apiAction = undefined; // General update
            toastTitle = "Ride Accepted";
            toastMessage = `Ride request from ${currentRide.passengerName} accepted.`;
            // Ensure only one ride is active
            setRideRequests(prev => prev.map(r => {
                if (r.id === rideId) return { ...r, status: newStatus!, driverId: driverUser.id, driverName: driverUser.name }; // Add driver info
                if (r.status === 'driver_assigned' || r.status === 'active' || r.status === 'arrived_at_pickup' || r.status === 'in_progress') return { ...r, status: 'pending' }; // Revert other active rides
                return r;
            }));
            break;
        case 'decline':
            newStatus = 'declined'; // Local state, won't persist for mock
            apiAction = undefined; 
            toastTitle = "Ride Declined";
            toastMessage = `Ride request from ${currentRide.passengerName} declined.`;
            setRideRequests(prev => prev.filter(r => r.id !== rideId)); // Remove from list
            break;
        case 'notify_arrival':
            newStatus = 'arrived_at_pickup';
            apiAction = 'notify_arrival';
            toastTitle = "Passenger Notified";
            toastMessage = `Passenger ${currentRide.passengerName} has been notified of your arrival.`;
            break;
        case 'start_ride':
            newStatus = 'in_progress';
            apiAction = 'start_ride';
            toastTitle = "Ride Started";
            toastMessage = `Ride with ${currentRide.passengerName} is now in progress.`;
            break;
        case 'complete_ride':
            newStatus = 'completed';
            apiAction = 'complete_ride';
            toastTitle = "Ride Completed";
            toastMessage = `Ride with ${currentRide.passengerName} marked as completed.`;
            break;
        case 'cancel_active':
            newStatus = 'cancelled_by_driver';
            apiAction = undefined; // General update with status
            toastTitle = "Ride Cancelled";
            toastMessage = `Active ride with ${currentRide.passengerName} cancelled.`;
            break;
    }
    
    // Simulate API call for mock data or implement real API call
    // For now, just updating local state for mock data
    if (newStatus) {
        try {
            // In a real app, you'd make an API call here
            // For example:
            // const response = await fetch(`/api/operator/bookings/${rideId}`, {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ status: newStatus, action: apiAction, driverId: driverUser.id, driverName: driverUser.name }),
            // });
            // if (!response.ok) throw new Error(await response.text());
            // const updatedBooking = await response.json();
            //
            // Update local state based on API response
            // For mock:
             await new Promise(resolve => setTimeout(resolve, 700)); // Simulate delay
            
            setRideRequests(prevRequests =>
                prevRequests.map(req => {
                    if (req.id === rideId) {
                        const updatedReq = { ...req, status: newStatus! };
                        if (actionType === 'notify_arrival') updatedReq.notifiedPassengerArrivalTimestamp = new Date().toISOString();
                        if (actionType === 'accept') {
                            // updatedReq.driverId = driverUser.id; // Example if you store driverId
                            // updatedReq.driverName = driverUser.name;
                        }
                        return updatedReq;
                    }
                    return req;
                })
            );
            toast({ title: toastTitle, description: toastMessage });

        } catch (error) {
             toast({ title: "Action Failed", description: `Could not update ride: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive"});
        } finally {
            setActionLoading(prev => ({ ...prev, [rideId]: false }));
        }
    } else {
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };

  const activeRide = rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress'].includes(r.status));
  const pendingRides = rideRequests.filter(r => r.status === 'pending');

  const handleCallCustomer = (phoneNumber?: string) => {
    if (phoneNumber) {
      toast({ title: "Calling Customer", description: `Initiating call to ${phoneNumber}... (Demo)`});
    } else {
      toast({ title: "Call Not Available", description: "Customer phone number not provided.", variant: "default"});
    }
  };

  const renderPassengerRating = (rating?: number) => {
    if (typeof rating !== 'number' || rating <= 0) {
      return <span className="text-xs text-muted-foreground ml-1.5">(No rating)</span>;
    }
    const totalStars = 5;
    const filledStars = Math.round(rating);
    return (
      <div className="flex items-center ml-1.5">
        {[...Array(totalStars)].map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i < filledStars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const getMapMarkersForActiveRide = () => {
    if (!activeRide) return [];
    const markers = [];
    if (activeRide.pickupCoords) {
      markers.push({
        position: { lat: activeRide.pickupCoords[0], lng: activeRide.pickupCoords[1] },
        title: `Pickup: ${activeRide.pickupLocation}`, label: 'P'
      });
    }
    if (activeRide.dropoffCoords) {
      markers.push({
        position: { lat: activeRide.dropoffCoords[0], lng: activeRide.dropoffCoords[1] },
        title: `Dropoff: ${activeRide.dropoffLocation}`, label: 'D'
      });
    }
    markers.push({ position: driverLocation, title: "Your Location", iconUrl: "/icons/taxi-marker.png", iconScaledSize: {width: 32, height: 32} });
    return markers;
  };

  const getMapCenterForActiveRide = () => {
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupCoords) {
      return { lat: activeRide.pickupCoords[0], lng: activeRide.pickupCoords[1] };
    }
    if (activeRide?.status === 'in_progress' && activeRide.dropoffCoords) {
      return { lat: activeRide.dropoffCoords[0], lng: activeRide.dropoffCoords[1] };
    }
    return driverLocation || huddersfieldCenterGoogle;
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Ride Management</CardTitle>
          <CardDescription>
            {activeRide
              ? "Focus on your current active ride."
              : "View and manage incoming ride requests."}
          </CardDescription>
        </CardHeader>
      </Card>

      {activeRide ? (
        <Card className="bg-primary/10 border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <Navigation className="w-7 h-7 text-primary" /> Current Ride: {activeRide.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </CardTitle>
            <CardDescription>Passenger: {activeRide.passengerName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 mb-3">
                <Image src={activeRide.passengerAvatar} alt={activeRide.passengerName} width={48} height={48} className="rounded-full border-2 border-primary" data-ai-hint="avatar passenger" />
                <div>
                  <div className="flex items-center">
                    <p className="text-lg font-semibold">{activeRide.passengerName}</p>
                    {renderPassengerRating(activeRide.passengerRating)}
                  </div>
                  <Badge variant="outline" className="border-primary text-primary mr-2">Fare: £{activeRide.fareEstimate.toFixed(2)}</Badge>
                  <Badge variant="secondary" className="mt-1">
                    <UsersIcon className="w-3 h-3 mr-1" /> {activeRide.passengerCount} Passenger{activeRide.passengerCount > 1 ? 's' : ''}
                  </Badge>
                </div>
            </div>
            <p className="flex items-center gap-1.5 text-md"><Info className="w-5 h-5 text-muted-foreground" /> <strong>Ride ID:</strong> {activeRide.id}</p>
            <p className="flex items-center gap-1.5 text-md"><MapPin className="w-5 h-5 text-muted-foreground" /> <strong>From:</strong> {activeRide.pickupLocation}</p>
            <p className="flex items-center gap-1.5 text-md"><MapPin className="w-5 h-5 text-muted-foreground" /> <strong>To:</strong> {activeRide.dropoffLocation}</p>
            <p className="flex items-center gap-1.5 text-md"><Clock className="w-5 h-5 text-muted-foreground" /> <strong>Est. Time to Pickup:</strong> {activeRide.estimatedTime}</p>
            {activeRide.distanceMiles && (
                <p className="flex items-center gap-1.5 text-md"><Route className="w-5 h-5 text-muted-foreground" /> <strong>Ride Distance:</strong> {activeRide.distanceMiles.toFixed(1)} miles</p>
            )}

            {/* Arrival Status Section */}
            {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <div className="p-3 my-2 bg-blue-100 border border-blue-300 rounded-md text-blue-700 flex items-center gap-2">
                    <BellRing className="w-5 h-5 animate-pulse" />
                    <span>Passenger notified. Waiting for acknowledgment...</span>
                 </div>
            )}
            {activeRide.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <div className="p-3 my-2 bg-green-100 border border-green-300 rounded-md text-green-700 flex items-center gap-2">
                    <CheckCheck className="w-5 h-5" />
                    <span>Passenger acknowledged arrival!</span>
                 </div>
            )}


            <div className="mt-4">
              <p className="text-md font-medium mb-1">Live Ride Map:</p>
              <div className="h-72 bg-muted rounded-lg overflow-hidden border shadow-sm">
                 <GoogleMapDisplay
                    center={getMapCenterForActiveRide()}
                    zoom={15}
                    markers={getMapMarkersForActiveRide()}
                    className="w-full h-full"
                 />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {activeRide.status === 'driver_assigned' && (
                <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white text-base py-3" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}>
                  {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <BellRing className="mr-2 h-5 w-5" />} Notify Arrival
                </Button>
              )}
              {(activeRide.status === 'arrived_at_pickup' || activeRide.status === 'driver_assigned') && (
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base py-3" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}>
                   {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Navigation className="mr-2 h-5 w-5" />} Start Ride
                </Button>
              )}
              {activeRide.status === 'in_progress' && (
                <Button variant="outline" className="w-full text-base py-3 border-green-500 text-green-600 hover:bg-green-500 hover:text-white" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}>
                  {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CheckCircle className="mr-2 h-5 w-5" />} Complete Ride
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
             <Button asChild variant="outline" className="w-full text-base py-3">
                <Link href="/driver/chat">
                  <MessageSquare className="mr-2 h-5 w-5" /> Chat
                </Link>
              </Button>
              <Button variant="outline" className="w-full text-base py-3" onClick={() => handleCallCustomer(activeRide.passengerPhone)}>
                  <Phone className="mr-2 h-5 w-5" /> Call Customer
              </Button>
              {['driver_assigned', 'arrived_at_pickup', 'in_progress'].includes(activeRide.status) && (
                <Button variant="destructive" className="w-full text-base py-3" onClick={() => handleRideAction(activeRide.id, 'cancel_active')} disabled={actionLoading[activeRide.id]}>
                    {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <XCircle className="mr-2 h-5 w-5" />} Cancel Ride
                </Button>
              )}
            </div>
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
                      <div className="flex items-center">
                         <CardTitle className="text-lg">{req.passengerName}</CardTitle>
                         {renderPassengerRating(req.passengerRating)}
                      </div>
                      <Badge variant="outline" className="mt-1 mr-1">Fare: £{req.fareEstimate.toFixed(2)}</Badge>
                       <Badge variant="secondary" className="mt-1">
                        <UsersIcon className="w-3 h-3 mr-1" /> {req.passengerCount} Passenger{req.passengerCount > 1 ? 's' : ''}
                      </Badge>
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
                    onClick={() => handleRideAction(req.id, 'decline')}
                    disabled={!!activeRide || actionLoading[req.id]}
                  >
                    {actionLoading[req.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4" />} Decline
                  </Button>
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleRideAction(req.id, 'accept')}
                    disabled={!!activeRide || actionLoading[req.id]}
                  >
                    {actionLoading[req.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />} Accept
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


    
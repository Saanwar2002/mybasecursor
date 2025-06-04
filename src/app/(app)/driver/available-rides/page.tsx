
"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2, Building, Car as CarIcon, Power, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { RideOfferModal, type RideOffer } from '@/components/driver/ride-offer-modal';
import { cn } from '@/lib/utils';

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
  estimatedTime: string; 
  fareEstimate: number;
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'driver_assigned' | 'arrived_at_pickup' | 'in_progress' | 'completed' | 'cancelled_by_driver';
  pickupCoords?: { lat: number; lng: number };
  dropoffCoords?: { lat: number; lng: number };
  distanceMiles?: number; 
  passengerCount: number;
  passengerPhone?: string;
  passengerRating?: number;
  notifiedPassengerArrivalTimestamp?: string | null; 
  passengerAcknowledgedArrivalTimestamp?: string | null; 
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const mockRideRequests: RideRequest[] = [
  { id: 'r1', passengerName: 'Alice Smith', passengerAvatar: 'https://placehold.co/40x40.png?text=AS', pickupLocation: 'Kingsgate Centre, Huddersfield', dropoffLocation: 'Huddersfield Royal Infirmary', estimatedTime: '10 min', fareEstimate: 7.50, status: 'pending', pickupCoords: { lat: 53.6458, lng: -1.7845 }, dropoffCoords: { lat: 53.6530, lng: -1.8000 }, distanceMiles: 2.5, passengerCount: 1, passengerPhone: '555-0101', passengerRating: 4.5 },
  { id: 'r2', passengerName: 'Bob Johnson', passengerAvatar: 'https://placehold.co/40x40.png?text=BJ', pickupLocation: 'Huddersfield Station', dropoffLocation: 'University of Huddersfield, Queensgate', estimatedTime: '5 min', fareEstimate: 5.00, status: 'pending', pickupCoords: { lat: 53.6490, lng: -1.7795 }, dropoffCoords: { lat: 53.6430, lng: -1.7720 }, distanceMiles: 1.2, passengerCount: 2, passengerPhone: '555-0102', passengerRating: 4.8 },
];

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';


export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>(mockRideRequests);
  const { toast } = useToast();
  const { user: driverUser } = useAuth();
  const [driverLocation, setDriverLocation] = useState<google.maps.LatLngLiteral>(huddersfieldCenterGoogle);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [currentOfferDetails, setCurrentOfferDetails] = useState<RideOffer | null>(null);
  const [isDriverOnline, setIsDriverOnline] = useState(true);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);


  useEffect(() => {
    if (isDriverOnline && navigator.geolocation) {
      setGeolocationError(null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGeolocationError(null);
        },
        (error) => {
          console.warn("Error watching position:", error);
          let message = "Could not get your location.";
          if (error.code === 1) message = "Location permission denied by user.";
          else if (error.code === 2) message = "Location information unavailable.";
          else if (error.code === 3) message = "Location request timed out.";
          setGeolocationError(message);
          toast({ title: "Location Error", description: message, variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (!navigator.geolocation && isDriverOnline) {
        setGeolocationError("Geolocation is not supported by this browser.");
        toast({ title: "Location Error", description: "Geolocation is not supported or enabled in your browser.", variant: "destructive" });
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isDriverOnline, toast]);


  const handleSimulateOffer = () => {
    const mockOffer: RideOffer = {
      id: 'mock-offer-123',
      pickupLocation: "123 Main St, Huddersfield",
      pickupCoords: { lat: 53.6480, lng: -1.7800 },
      dropoffLocation: "456 Oak Ave, Huddersfield",
      dropoffCoords: { lat: 53.6420, lng: -1.7850 },
      fareEstimate: 15.75,
      passengerCount: 2,
      passengerName: "John Doe",
      notes: "Has a small dog."
    };
    setCurrentOfferDetails(mockOffer);
    setIsOfferModalOpen(true);
  };

  const handleAcceptOffer = (rideId: string) => {
    console.log("Offer accepted:", rideId);
    const acceptedRequest = rideRequests.find(r => r.id === rideId || rideId === 'mock-offer-123');
    if (acceptedRequest) {
        handleRideAction(acceptedRequest.id, 'accept');
    } else {
        toast({title: "Mock Ride Accepted", description: `Accepted offer for ride ID ${rideId}. Real assignment logic pending.`});
    }
    setIsOfferModalOpen(false);
    setCurrentOfferDetails(null);
  };

  const handleDeclineOffer = (rideId: string) => {
    console.log("Offer declined:", rideId);
     const declinedRequest = rideRequests.find(r => r.id === rideId || rideId === 'mock-offer-123');
    if (declinedRequest && declinedRequest.status !== 'pending') { 
        handleRideAction(declinedRequest.id, 'decline'); 
    } else {
         toast({title: "Mock Ride Declined", description: `Declined offer for ride ID ${rideId}.`});
    }
    setIsOfferModalOpen(false);
    setCurrentOfferDetails(null);
  };


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
    if (!currentRide && rideId !== 'mock-offer-123') { 
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
        toast({ title: "Error", description: `Ride with ID ${rideId} not found locally.`, variant: "destructive" });
        return;
    }
    
    let actualRideToUpdate = currentRide;
    if (rideId === 'mock-offer-123' && actionType === 'accept') {
        const firstPending = rideRequests.find(r => r.status === 'pending');
        if (firstPending) {
            actualRideToUpdate = firstPending;
            rideId = firstPending.id; 
        } else {
            toast({ title: "No Pending Rides", description: "No pending rides available to accept for this mock offer.", variant: "default"});
            setActionLoading(prev => ({ ...prev, [rideId]: false }));
            return;
        }
    }
    
    const rideDisplayName = actualRideToUpdate?.passengerName || "the passenger";

    switch(actionType) {
        case 'accept':
            newStatus = 'driver_assigned'; 
            apiAction = undefined; 
            toastTitle = "Ride Accepted";
            toastMessage = `Ride request from ${rideDisplayName} accepted.`;
            setRideRequests(prev => prev.map(r => {
                if (r.id === rideId) return { ...r, status: newStatus! };
                return r;
            }));
            break;
        case 'decline':
            if (rideId === 'mock-offer-123' || currentRide?.status === 'pending') {
                toastTitle = "Offer Declined";
                toastMessage = `Ride offer for ${rideDisplayName} declined.`;
                if (rideId !== 'mock-offer-123' && currentRide?.status === 'pending') {
                    setRideRequests(prev => prev.filter(r => r.id !== rideId)); 
                }
            } else {
                newStatus = 'declined'; 
                apiAction = undefined;
                toastTitle = "Ride Declined";
                toastMessage = `Ride request for ${rideDisplayName} declined.`;
                setRideRequests(prev => prev.filter(r => r.id !== rideId));
            }
            break;
        case 'notify_arrival':
            newStatus = 'arrived_at_pickup';
            apiAction = 'notify_arrival';
            toastTitle = "Passenger Notified";
            toastMessage = `Passenger ${rideDisplayName} has been notified of your arrival.`;
            break;
        case 'start_ride':
            newStatus = 'in_progress';
            apiAction = 'start_ride';
            toastTitle = "Ride Started";
            toastMessage = `Ride with ${rideDisplayName} is now in progress.`;
            break;
        case 'complete_ride':
            newStatus = 'completed';
            apiAction = 'complete_ride';
            toastTitle = "Ride Completed";
            toastMessage = `Ride with ${rideDisplayName} marked as completed.`;
            break;
        case 'cancel_active':
            newStatus = 'cancelled_by_driver';
            apiAction = undefined; 
            toastTitle = "Ride Cancelled";
            toastMessage = `Active ride with ${rideDisplayName} cancelled.`;
            setRideRequests(prev => prev.filter(r => r.id !== rideId)); 
            break;
    }
    
    if ((newStatus || apiAction) && rideId !== 'mock-offer-123') { 
        try {
            const payload: any = {};
            if (apiAction) {
                 payload.action = apiAction;
            } else if (newStatus) { 
                payload.status = newStatus;
                if (actionType === 'accept' && driverUser) {
                    payload.driverId = driverUser.id;
                    payload.driverName = driverUser.name;
                }
            } else {
                setActionLoading(prev => ({ ...prev, [rideId]: false }));
                return;
            }

            const response = await fetch(`/api/operator/bookings/${rideId}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload),
            });

             if (!response.ok) {
                let apiErrorMessage = `Failed to update ride status (Status: ${response.status}).`;
                const responseText = await response.text();
                try {
                    const errorData = JSON.parse(responseText);
                    console.error(`API Error for ride ${rideId}, action ${actionType}:`, errorData);
                    apiErrorMessage = errorData.message || errorData.details || JSON.stringify(errorData);
                } catch (parseError) {
                    console.warn(`API response for ride ${rideId} (status ${response.status}) not valid JSON or error parsing it:`, parseError);
                    console.log("Raw error response body:", responseText); 
                    apiErrorMessage = `Status: ${response.status}. Body: ${responseText.substring(0,200)}`;
                }
                throw new Error(apiErrorMessage);
            }

             const updatedBookingData = await response.json();
             const updatedBooking = updatedBookingData.booking; 
            
            setRideRequests(prevRequests =>
                prevRequests.map(req => {
                    if (req.id === rideId) {
                        const updatedReq: RideRequest = { ...req, status: updatedBooking.status };
                        if (updatedBooking.notifiedPassengerArrivalTimestamp) {
                            updatedReq.notifiedPassengerArrivalTimestamp = new Date(updatedBooking.notifiedPassengerArrivalTimestamp._seconds * 1000).toISOString();
                        }
                        if (updatedBooking.passengerAcknowledgedArrivalTimestamp) {
                           updatedReq.passengerAcknowledgedArrivalTimestamp = new Date(updatedBooking.passengerAcknowledgedArrivalTimestamp._seconds * 1000).toISOString();
                        }
                        return updatedReq;
                    }
                    return req;
                })
            );
            toast({ title: toastTitle, description: toastMessage });

        } catch (error) {
             console.error(`Error in handleRideAction for ride ${rideId}, action ${actionType}:`, error);
             toast({ title: "Action Failed", description: `Could not update ride: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive"});
        } finally {
            setActionLoading(prev => ({ ...prev, [rideId]: false }));
        }
    } else if (rideId === 'mock-offer-123' && (actionType === 'accept' || actionType === 'decline')) {
        toast({ title: toastTitle, description: toastMessage });
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
    } else {
        if (actionType !== 'decline' && actionType !== 'cancel_active') { 
             setActionLoading(prev => ({ ...prev, [rideId]: false }));
        }
    }
  };

  const activeRide = rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress'].includes(r.status));

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
    const markers = [];
     if (isDriverOnline && driverLocation && blueDotSvgDataUrl) {
        markers.push({ 
            position: driverLocation, 
            title: "Your Current Location",
            iconUrl: blueDotSvgDataUrl,
            iconScaledSize: { width: 24, height: 24 }
        });
    }
    if (!activeRide) return markers;
    
    if (activeRide.pickupCoords) {
      markers.push({
        position: activeRide.pickupCoords,
        title: `Pickup: ${activeRide.pickupLocation}`, label: 'P'
      });
    }
    if (activeRide.dropoffCoords) {
      markers.push({
        position: activeRide.dropoffCoords,
        title: `Dropoff: ${activeRide.dropoffLocation}`, label: 'D'
      });
    }
    return markers;
  };

  const getMapCenterForActiveRide = () => {
    if (isDriverOnline && driverLocation) return driverLocation;
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupCoords) {
      return activeRide.pickupCoords;
    }
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupCoords) {
      return activeRide.pickupCoords;
    }
    if (activeRide?.status === 'in_progress' && activeRide.dropoffCoords) {
      return activeRide.dropoffCoords;
    }
    return huddersfieldCenterGoogle;
  };

  const handleNavigate = (locationName: string, coords?: {lat: number, lng: number}) => {
      if(coords) {
        toast({title: "Navigation Started (Demo)", description: `Navigating to ${locationName} at ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`});
      } else {
        toast({title: "Navigation Error", description: `Coordinates for ${locationName} not available.` , variant: "destructive"});
      }
  };

  if (activeRide) {
    return (
      <div className="p-4 space-y-4">
        <Card className="bg-primary/10 border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <Navigation className="w-7 h-7 text-primary" /> Current Ride: {activeRide.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </CardTitle>
            <CardDescription>Passenger: {activeRide.passengerName}</CardDescription>
          </CardHeader>
           <CardContent className="space-y-3">
            <div className="flex items-center gap-3 mb-3">
                <Image src={activeRide.passengerAvatar} alt={activeRide.passengerName} width={48} height={48} className="rounded-full border-2 border-primary" data-ai-hint="avatar passenger"/>
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
            <p className="flex items-center gap-1.5 text-md"><MapPin className="w-5 h-5 text-muted-foreground" /> <strong>From:</strong> {activeRide.pickupLocation}</p>
            <p className="flex items-center gap-1.5 text-md"><Building className="w-5 h-5 text-muted-foreground" /> <strong>To:</strong> {activeRide.dropoffLocation}</p>
            
            {activeRide.status === 'driver_assigned' && 
                <p className="flex items-center gap-1.5 text-md"><Clock className="w-5 h-5 text-muted-foreground" /> <strong>Est. Time to Pickup:</strong> {activeRide.estimatedTime}</p>
            }
            {activeRide.distanceMiles && (
                <p className="flex items-center gap-1.5 text-md"><Route className="w-5 h-5 text-muted-foreground" /> <strong>Ride Distance:</strong> {activeRide.distanceMiles.toFixed(1)} miles</p>
            )}

            {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <div className="p-3 my-2 bg-blue-100 border border-blue-300 rounded-md text-blue-700 flex items-center gap-2">
                    <BellRing className="w-5 h-5 animate-pulse" />
                    <span>Passenger notified. Waiting for acknowledgment...</span>
                 </div>
            )}
            {activeRide.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <div className="p-3 my-2 bg-green-100 border border-green-300 rounded-md text-green-700 flex items-center gap-2">
                    <CheckCheck className="w-5 h-5" />
                    <span>Passenger acknowledged arrival! Ready to start.</span>
                 </div>
            )}

            <div className="mt-2">
              <p className="text-md font-medium mb-1">Live Ride Map:</p>
              <div className="h-60 bg-muted rounded-lg overflow-hidden border shadow-sm">
                 <GoogleMapDisplay
                    center={getMapCenterForActiveRide()}
                    zoom={15}
                    markers={getMapMarkersForActiveRide()}
                    className="w-full h-full"
                    disableDefaultUI={true} 
                    fitBoundsToMarkers={true}
                 />
              </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              {activeRide.status === 'driver_assigned' && (
                <>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-3" onClick={() => handleNavigate("Pickup", activeRide.pickupCoords)} disabled={actionLoading[activeRide.id]}>
                    <Navigation className="mr-2 h-5 w-5" /> Navigate to Pickup
                  </Button>
                   <Button className="w-full bg-green-500 hover:bg-green-600 text-white text-base py-3" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}>
                    {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <BellRing className="mr-2 h-5 w-5" />} I'm at Pickup Location
                  </Button>
                </>
              )}
              {activeRide.status === 'arrived_at_pickup' && (
                 <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base py-3 sm:col-span-2" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}>
                   {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CarIcon className="mr-2 h-5 w-5" />} Start Ride
                </Button>
              )}
              {activeRide.status === 'in_progress' && (
                <>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-3" onClick={() => handleNavigate("Dropoff", activeRide.dropoffCoords)} disabled={actionLoading[activeRide.id]}>
                     <Navigation className="mr-2 h-5 w-5" /> Navigate to Dropoff
                  </Button>
                  <Button variant="outline" className="w-full text-base py-3 border-green-500 text-green-600 hover:bg-green-500 hover:text-white" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}>
                    {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CheckCircle className="mr-2 h-5 w-5" />} Complete Ride
                  </Button>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
             <Button asChild variant="outline" className="w-full text-base py-3">
                <Link href="/driver/chat">
                  <MessageSquare className="mr-2 h-5 w-5" /> Chat
                </Link>
              </Button>
              <Button variant="outline" className="w-full text-base py-3" onClick={() => handleCallCustomer(activeRide.passengerPhone)}>
                  <Phone className="mr-2 h-5 w-5" /> Call
              </Button>
              {['driver_assigned', 'arrived_at_pickup'].includes(activeRide.status) && (
                <Button variant="destructive" className="w-full text-base py-3" onClick={() => handleRideAction(activeRide.id, 'cancel_active')} disabled={actionLoading[activeRide.id]}>
                    {actionLoading[activeRide.id] ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <XCircle className="mr-2 h-5 w-5" />} Cancel Ride
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const mapMarkers = [];
  if (isDriverOnline && driverLocation && blueDotSvgDataUrl) {
    mapMarkers.push({ 
        position: driverLocation, 
        title: "Your Current Location",
        iconUrl: blueDotSvgDataUrl,
        iconScaledSize: { width: 24, height: 24 }
    });
  }


  return (
    <div className="flex flex-col h-screen">
      <div className="h-[75vh] w-full relative">
        <GoogleMapDisplay
            center={driverLocation}
            zoom={15}
            markers={mapMarkers}
            className="w-full h-full"
            disableDefaultUI={true}
        />
      </div>
      <Card className="h-[25vh] w-full rounded-t-lg shadow-xl flex flex-col items-center justify-center p-4 border-t-4 border-primary">
        <CardHeader className="p-2 text-center">
          <CardTitle className={cn("text-2xl font-headline", isDriverOnline ? "text-green-600" : "text-red-600")}>
            {isDriverOnline ? "Online - Awaiting Offers" : "Offline"}
          </CardTitle>
           {geolocationError && isDriverOnline && (
            <p className="text-xs text-red-500 flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3"/> {geolocationError}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-2 w-full">
          {isDriverOnline ? (
            <>
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Actively searching for ride offers for you...</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">You are currently offline. Toggle on to receive ride offers.</p>
          )}
           <div className="flex items-center space-x-2 pt-1">
            <Switch 
              id="online-status-toggle" 
              checked={isDriverOnline} 
              onCheckedChange={setIsDriverOnline} 
              aria-label="Driver online status"
              className={cn(
                "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
              )}
            />
            <Label 
                htmlFor="online-status-toggle" 
                className={cn("text-lg font-medium", isDriverOnline ? "text-green-600" : "text-red-500")}
            >
              {isDriverOnline ? "Online" : "Offline"}
            </Label>
          </div>
          <Button onClick={handleSimulateOffer} variant="outline" size="sm" className="mt-1 text-xs">
            Simulate Incoming Ride Offer (Test)
          </Button>
        </CardContent>
      </Card>

      <RideOfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        rideDetails={currentOfferDetails}
        onAccept={handleAcceptOffer}
        onDecline={handleDeclineOffer}
      />
    </div>
  );
}


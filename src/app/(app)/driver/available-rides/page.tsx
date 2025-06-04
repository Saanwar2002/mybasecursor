
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2, Building, Car as CarIcon, Power, AlertTriangle, DollarSign as DollarSignIcon, MessageCircle as ChatIcon } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";


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
  stops?: Array<{ address: string; latitude: number; longitude: number }>;
  distanceMiles?: number;
  passengerCount: number;
  passengerPhone?: string;
  passengerRating?: number;
  notes?: string;
  notifiedPassengerArrivalTimestamp?: string | null;
  passengerAcknowledgedArrivalTimestamp?: string | null;
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';


export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const { toast } = useToast();
  const { user: driverUser } = useAuth();
  const [driverLocation, setDriverLocation] = useState<google.maps.LatLngLiteral>(huddersfieldCenterGoogle);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [currentOfferDetails, setCurrentOfferDetails] = useState<RideOffer | null>(null);
  const [isDriverOnline, setIsDriverOnline] = useState(true);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const activeRide = useMemo(() => rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress'].includes(r.status)), [rideRequests]);


// Geolocation useEffect remains commented out to prevent blank screen issues for now
/*
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
*/

  const handleSimulateOffer = () => {
    const mockOffer: RideOffer = {
      id: 'mock-offer-123',
      pickupLocation: "6 Colne Street Paddock Huddersfield HD1 4RX",
      pickupCoords: { lat: 53.6410, lng: -1.7950 },
      dropoffLocation: "12 Lindley Moor Road Lindley Huddersfield HD3 3RT",
      dropoffCoords: { lat: 53.6600, lng: -1.8200 },
      fareEstimate: 12.50,
      passengerCount: 1,
      passengerName: "Sarah Connor",
      notes: "Going to the hospital. Please be quick."
    };
    setCurrentOfferDetails(mockOffer);
    setIsOfferModalOpen(true);
  };

  const handleAcceptOffer = (rideId: string) => {
    setIsOfferModalOpen(false);
    const offerToAccept = currentOfferDetails;
    setCurrentOfferDetails(null);

    if (rideId === 'mock-offer-123' && offerToAccept) {
      const mockActiveRideData: RideRequest = {
        id: `active-mock-${Date.now()}`,
        passengerName: offerToAccept.passengerName || "Simulated Passenger",
        passengerAvatar: 'https://placehold.co/48x48.png?text=SP',
        pickupLocation: offerToAccept.pickupLocation,
        dropoffLocation: offerToAccept.dropoffLocation,
        estimatedTime: "12 mins",
        fareEstimate: offerToAccept.fareEstimate,
        status: 'driver_assigned', // Start with driver_assigned
        pickupCoords: offerToAccept.pickupCoords,
        dropoffCoords: offerToAccept.dropoffCoords,
        distanceMiles: 3.5,
        passengerCount: offerToAccept.passengerCount,
        notes: offerToAccept.notes,
        passengerPhone: "07123456001",
        passengerRating: 4.7,
        // notifiedPassengerArrivalTimestamp: new Date().toISOString(), // Simulate notified for 'arrived_at_pickup' testing
        // passengerAcknowledgedArrivalTimestamp: null, // For testing "waiting for ack"
      };
      setRideRequests([mockActiveRideData]);
      toast({title: "Mock Ride Accepted!", description: `Now managing mock ride for ${mockActiveRideData.passengerName}.`});
    } else {
      const acceptedRequest = rideRequests.find(r => r.id === rideId);
      if (acceptedRequest && acceptedRequest.status === 'pending') {
        handleRideAction(acceptedRequest.id, 'accept');
      } else {
        toast({title: "Error Accepting Ride", description: `Could not find pending ride with ID ${rideId} or it's not pending.`, variant: "destructive"});
      }
    }
  };


  const handleDeclineOffer = (rideId: string) => {
    console.log("Offer declined:", rideId);
    const declinedRequest = rideRequests.find(r => r.id === rideId || rideId === 'mock-offer-123');
    if (declinedRequest && declinedRequest.status === 'pending') {
      setRideRequests(prev => prev.filter(r => r.id !== rideId));
      toast({title: "Ride Declined", description: `Ride for ${declinedRequest.passengerName} declined.`});
    } else {
         toast({title: "Mock Ride Offer Declined", description: `Declined offer for ride ID ${rideId}.`});
    }
    setIsOfferModalOpen(false);
    setCurrentOfferDetails(null);
  };


 const handleRideAction = async (rideId: string, actionType: 'accept' | 'decline' | 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active') => {
    if (!driverUser && actionType !== 'decline') {
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
        toast({ title: "Error", description: `Ride with ID ${rideId} not found locally.`, variant: "destructive" });
        return;
    }
    const rideDisplayName = currentRide.passengerName || "the passenger";

    switch(actionType) {
        case 'accept':
            if (!driverUser) {
                toast({ title: "Error", description: "Driver details missing for accepting ride.", variant: "destructive"});
                setActionLoading(prev => ({ ...prev, [rideId]: false }));
                return;
            }
            newStatus = 'driver_assigned';
            toastTitle = "Ride Accepted";
            toastMessage = `Ride request from ${rideDisplayName} accepted.`;
            // Optimistic update for accept, real data comes from API for others
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, passengerAvatar: r.passengerAvatar || 'https://placehold.co/40x40.png?text=P' } : r));
            break;
        case 'decline':
            newStatus = 'declined';
            toastTitle = "Ride Declined";
            toastMessage = `Ride request for ${rideDisplayName} declined.`;
            setRideRequests(prev => prev.filter(r => r.id !== rideId));
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
            // No optimistic removal here if API call is made, let API response handle final state.
            break;
        case 'cancel_active':
            newStatus = 'cancelled_by_driver';
            // No direct API action string, status change implies cancellation by driver
            toastTitle = "Ride Cancelled";
            toastMessage = `Active ride with ${rideDisplayName} cancelled.`;
            // No optimistic removal here if API call is made.
            break;
    }

    if (newStatus && rideId !== 'mock-offer-123' && !rideId.startsWith('active-mock-')) {
        try {
            const payload: any = {};
            if (apiAction) {
                 payload.action = apiAction;
            } else {
                 payload.status = newStatus;
            }
            if ((actionType === 'accept' || actionType === 'decline') && driverUser) { // Include driver details on accept/decline
                payload.driverId = driverUser.id;
                payload.driverName = driverUser.name;
                // Potentially add driverAvatar if available in driverUser
            }
            // For cancel_active, the status change is enough if handled by a generic status update mechanism.
            // If specific cancel API endpoint is needed, it would be called here.
            // Let's assume for now it's handled by the booking/[bookingId] POST endpoint via status change.

            const response = await fetch(`/api/operator/bookings/${rideId}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let descriptiveError = `Failed to update ride (Status: ${response.status}).`;
                let responseBodyText: string | undefined;
                try {
                    responseBodyText = await response.text();
                    if (responseBodyText && responseBodyText.trim() !== "") {
                        try {
                            const errorData = JSON.parse(responseBodyText);
                            descriptiveError += ` Server: ${errorData.message || 'No specific message.'}`;
                            if(errorData.details) descriptiveError += ` Details: ${errorData.details}.`;
                        } catch (jsonParseError) {
                            descriptiveError += ` Raw server response: ${responseBodyText.substring(0,200)}${responseBodyText.length > 200 ? '...' : ''}`;
                        }
                    } else {
                        descriptiveError += " Server response body was empty.";
                    }
                } catch (readError) {
                    descriptiveError += " Could not read server response body.";
                }
                console.error("handleRideAction API error response:", response, "Constructed error:", descriptiveError);
                throw new Error(descriptiveError);
            }
            const updatedBookingData = await response.json();
            const updatedBooking = updatedBookingData.booking;

            setRideRequests(prevRequests =>
                prevRequests.map(req => {
                    if (req.id === rideId) {
                        const updatedReq: RideRequest = { ...req, status: updatedBooking.status };
                        if (updatedBooking.notifiedPassengerArrivalTimestamp) updatedReq.notifiedPassengerArrivalTimestamp = updatedBooking.notifiedPassengerArrivalTimestamp._seconds ? new Date(updatedBooking.notifiedPassengerArrivalTimestamp._seconds * 1000).toISOString() : updatedBooking.notifiedPassengerArrivalTimestamp;
                        if (updatedBooking.passengerAcknowledgedArrivalTimestamp) updatedReq.passengerAcknowledgedArrivalTimestamp = updatedBooking.passengerAcknowledgedArrivalTimestamp._seconds ? new Date(updatedBooking.passengerAcknowledgedArrivalTimestamp._seconds * 1000).toISOString() : updatedBooking.passengerAcknowledgedArrivalTimestamp;
                        // Add similar handling for rideStartedAt, completedAt if they come as timestamps
                        return updatedReq;
                    }
                    return req;
                })
            );
            toast({ title: toastTitle, description: toastMessage });

            if (newStatus === 'completed' || newStatus === 'cancelled_by_driver') {
                setTimeout(() => setRideRequests(prev => prev.filter(r => r.id !== rideId)), 2000);
            }

        } catch (error) {
             console.error(`Error in handleRideAction for ride ${rideId}, action ${actionType}:`, error);
             toast({ title: "Action Failed", description: `Could not update ride: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive"});
             // Revert optimistic update on failure if needed, or re-fetch state.
             // For 'accept' it was already optimistic, might need to revert if API fails.
             if (actionType === 'accept') {
                setRideRequests(prev => prev.map(r => r.id === rideId ? {...r, status: 'pending'} : r));
             }
        } finally {
            setActionLoading(prev => ({ ...prev, [rideId]: false }));
        }
    } else if (rideId.startsWith('active-mock-')) { // Handle mock active ride updates
        setRideRequests(prev => prev.map(r => {
          if (r.id === rideId && newStatus) {
            const updatedMockRide = { ...r, status: newStatus };
            if (newStatus === 'arrived_at_pickup') {
                updatedMockRide.notifiedPassengerArrivalTimestamp = new Date().toISOString();
            }
            if (newStatus === 'in_progress' && actionType === 'start_ride'){ // Simulate passenger ack for mock
                updatedMockRide.passengerAcknowledgedArrivalTimestamp = new Date().toISOString();
            }
            return updatedMockRide;
          }
          return r;
        }));
        toast({ title: toastTitle, description: toastMessage });
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
        if (newStatus === 'completed' || newStatus === 'cancelled_by_driver') {
            setTimeout(() => setRideRequests(prev => prev.filter(r => r.id !== rideId)), 1000);
        }
    } else { // For local 'decline' or other non-API affecting local updates
       setActionLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };


  const getMapMarkersForActiveRide = (): Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> => {
    if (!activeRide) return [];
    const markers = [];
    markers.push({
        position: driverLocation,
        title: "Your Location",
        iconUrl: blueDotSvgDataUrl,
        iconScaledSize: {width: 24, height: 24}
    });
    if (activeRide.pickupCoords) {
      markers.push({
        position: activeRide.pickupCoords,
        title: `Pickup: ${activeRide.pickupLocation}`,
        label: { text: "P", color: "white", fontWeight: "bold"}
      });
    }
    if (activeRide.status === 'in_progress' && activeRide.dropoffCoords) {
      markers.push({
        position: activeRide.dropoffCoords,
        title: `Dropoff: ${activeRide.dropoffLocation}`,
        label: { text: "D", color: "white", fontWeight: "bold" }
      });
    }
    activeRide.stops?.forEach((stop, index) => {
      if(stop.latitude && stop.longitude) {
        markers.push({
          position: {lat: stop.latitude, lng: stop.longitude},
          title: `Stop ${index+1}: ${stop.address}`,
          label: { text: `S${index+1}`, color: "white", fontWeight: "bold" }
        });
      }
    });
    return markers;
  };

  const getMapCenterForActiveRide = (): google.maps.LatLngLiteral => {
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupCoords) return activeRide.pickupCoords;
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupCoords) return activeRide.pickupCoords;
    if (activeRide?.status === 'in_progress' && activeRide.dropoffCoords) return activeRide.dropoffCoords;
    return driverLocation;
  };

  if (activeRide) {
    const showArrivedAtPickupStatus = activeRide.status === 'arrived_at_pickup';
    const showInProgressStatus = activeRide.status === 'in_progress';
    const showDriverAssignedStatus = activeRide.status === 'driver_assigned';

    return (
      <div className="flex flex-col h-full">
        <div className="h-[calc(60%-0.5rem)] w-full rounded-b-xl overflow-hidden shadow-lg border-b relative">
          <GoogleMapDisplay
            center={getMapCenterForActiveRide()}
            zoom={15}
            markers={getMapMarkersForActiveRide()}
            className="w-full h-full"
            disableDefaultUI={true}
            fitBoundsToMarkers={true}
          />
        </div>
        <Card className="flex-1 flex flex-col rounded-t-xl -mt-3 z-10 shadow-[-4px_0px_15px_rgba(0,0,0,0.1)] border-t-4 border-primary bg-card overflow-hidden">
           <CardContent className="p-3 space-y-2 flex-1 overflow-y-auto">
             {showArrivedAtPickupStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="outline" className="text-sm w-fit mx-auto border-blue-500 text-blue-500 py-1 px-3">
                        Arrived At Pickup
                    </Badge>
                </div>
            )}
            {showInProgressStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="default" className="text-sm w-fit mx-auto bg-green-600 text-white py-1 px-3">
                        Ride In Progress
                    </Badge>
                </div>
            )}
            {showDriverAssignedStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="secondary" className="text-sm w-fit mx-auto bg-sky-500 text-white py-1 px-3">
                       En Route to Pickup
                    </Badge>
                </div>
            )}


            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
              <Avatar className="h-12 w-12">
                <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/48x48.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar" />
                <AvatarFallback>{activeRide.passengerName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-base">{activeRide.passengerName}</p>
                {activeRide.passengerRating && (
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => <Star key={i} className={cn("w-3.5 h-3.5", i < Math.round(activeRide.passengerRating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />)}
                    <span className="ml-1 text-xs text-muted-foreground">({activeRide.passengerRating.toFixed(1)})</span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => toast({title: "Call Passenger", description: `Calling ${activeRide.passengerPhone || activeRide.passengerName} (Mock)`})}>
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                <Link href="/driver/chat"><ChatIcon className="w-4 h-4" /></Link>
              </Button>
            </div>

            <div className="space-y-1 text-sm">
              <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <strong>Pickup:</strong> {activeRide.pickupLocation}</p>
              <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" /> <strong>Dropoff:</strong> {activeRide.dropoffLocation}</p>
              {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => (
                <p key={index} className="flex items-start gap-1.5 pl-5"><Route className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index + 1}:</strong> {stop.address}</p>
              ))}
              <div className="grid grid-cols-2 gap-1 pt-1">
                  <p className="flex items-center gap-1"><DollarSignIcon className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> ~£{activeRide.fareEstimate.toFixed(2)}</p>
                  <p className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-muted-foreground" /> <strong>Pax:</strong> {activeRide.passengerCount}</p>
              </div>
            </div>

            {activeRide.notes && (
              <div className="border-l-4 border-accent pl-2 py-1 bg-accent/10 rounded-r-md">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap"><strong>Notes:</strong> {activeRide.notes}</p>
              </div>
            )}

             {activeRide.status === 'arrived_at_pickup' && activeRide.notifiedPassengerArrivalTimestamp && !activeRide.passengerAcknowledgedArrivalTimestamp && (
                <Alert variant="default" className="bg-blue-100 dark:bg-blue-700/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-100">
                    <BellRing className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Waiting for Passenger</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">
                        Waiting for passenger to acknowledge arrival...
                    </ShadAlertDescription>
                 </Alert>
            )}
            {activeRide.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <Alert variant="default" className="bg-green-100 dark:bg-green-700/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-100">
                    <CheckCheck className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Passenger Acknowledged</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">Passenger has confirmed your arrival.</ShadAlertDescription>
                 </Alert>
            )}
          </CardContent>

          <CardFooter className="p-3 border-t grid grid-cols-2 gap-2">
             {activeRide.status === 'driver_assigned' && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 col-span-2" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}>
                  {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Notify Passenger of Arrival
                </Button>
            )}
             {activeRide.status === 'arrived_at_pickup' && (
                <>
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}>
                        {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Start Ride
                    </Button>
                     <Button variant="outline" className="w-full" onClick={() => toast({title: "Navigate", description: `Mock navigating to pickup location for ${activeRide.passengerName}...`})}>
                        <Navigation className="mr-2"/> Navigate
                    </Button>
                </>
            )}
            {activeRide.status === 'in_progress' && (
                <>
                    <Button className="w-full bg-primary hover:bg-primary/80" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}>
                        {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Complete Ride
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => toast({title: "Navigate", description: `Mock navigating to dropoff for ${activeRide.passengerName}...`})}>
                        <Navigation className="mr-2"/> Navigate
                    </Button>
                </>
            )}

            {['driver_assigned', 'arrived_at_pickup', 'in_progress'].includes(activeRide.status) && (
                 <Button variant="destructive" className="w-full col-span-2" onClick={() => handleRideAction(activeRide.id, 'cancel_active')} disabled={actionLoading[activeRide.id]}>
                    {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Cancel Ride
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-2">
        <div className="h-[400px] w-full rounded-xl overflow-hidden shadow-lg border">
          <GoogleMapDisplay
              center={driverLocation}
              zoom={14}
              markers={[{
                  position: driverLocation,
                  title: "Your Current Location",
                  iconUrl: blueDotSvgDataUrl,
                  iconScaledSize: { width: 24, height: 24 }
              }]}
              className="w-full h-full"
              disableDefaultUI={true}
          />
        </div>

        <Card className="flex-1 flex flex-col rounded-xl shadow-lg bg-card border">
           <CardHeader className={cn( "p-2 border-b text-center", isDriverOnline ? "border-green-500" : "border-red-500")}>
            <CardTitle className={cn( "text-lg font-semibold", isDriverOnline ? "text-green-600" : "text-red-600")}>
              {isDriverOnline ? "Online - Awaiting Offers" : "Offline"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-3 space-y-1">
            {isDriverOnline ? (
              geolocationError ? (
                <div className="flex flex-col items-center text-center space-y-1 p-1 bg-destructive/10 rounded-md">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                  <p className="text-xs text-destructive">{geolocationError}</p>
                </div>
              ) : (
                <>
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground text-center">Actively searching for ride offers for you...</p>
                </>
              )
            ) : (
              <>
                <Power className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You are currently offline.</p>
              </>
            )}
            <div className="flex items-center space-x-2 pt-1">
              <Switch
                id="driver-online-toggle"
                checked={isDriverOnline}
                onCheckedChange={setIsDriverOnline}
                aria-label="Toggle driver online status"
                className={cn(!isDriverOnline && "data-[state=unchecked]:bg-red-600 data-[state=unchecked]:border-red-700")}
              />
              <Label
                htmlFor="driver-online-toggle"
                className={cn("text-sm font-medium", isDriverOnline ? 'text-green-600' : 'text-red-600')}
              >
                {isDriverOnline ? "Online" : "Offline"}
              </Label>
            </div>
            {isDriverOnline && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateOffer}
                className="mt-2 text-xs h-8 px-3 py-1"
              >
                Simulate Incoming Ride Offer (Test)
              </Button>
            )}
          </CardContent>
        </Card>
      <RideOfferModal
        isOpen={isOfferModalOpen}
        onClose={() => { setIsOfferModalOpen(false); setCurrentOfferDetails(null); }}
        onAccept={handleAcceptOffer}
        onDecline={handleDeclineOffer}
        rideDetails={currentOfferDetails}
      />
      </div>
  );
}

    
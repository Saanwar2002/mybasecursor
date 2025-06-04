
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'driver_assigned' | 'arrived_at_pickup' | 'in_progress' | 'In Progress' | 'completed' | 'cancelled_by_driver';
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
  rideStartedAt?: string | null;
  completedAt?: string | null;
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

  const [isCancelSwitchOn, setIsCancelSwitchOn] = useState(false);
  const [showCancelConfirmationDialog, setShowCancelConfirmationDialog] = useState(false);
  
  const [passengerRatingByDriver, setPassengerRatingByDriver] = useState(0);
  const [isPassengerRatingSubmitted, setIsPassengerRatingSubmitted] = useState(false);

  const activeRide = useMemo(() => rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress', 'completed'].includes(r.status)), [rideRequests]);


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
      pickupLocation: "Sarah's Home, 24 Oak Lane, Lindley, Huddersfield HD3 3WZ",
      pickupCoords: { lat: 53.6570, lng: -1.8195 },
      dropoffLocation: "Town Centre Cinema, King Street, Huddersfield HD1 2QR",
      dropoffCoords: { lat: 53.6465, lng: -1.7830 },
      fareEstimate: 7.50,
      passengerCount: 1,
      passengerName: "Sarah Connor",
      notes: "Main door, by the blue plant pot. Has a small suitcase."
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
        passengerName: "Sarah Connor", // From your image
        passengerAvatar: 'https://placehold.co/48x48.png?text=SC', // From your image
        pickupLocation: "Sarah's Home, 24 Oak Lane, Lindley, Huddersfield HD3 3WZ", // From your image
        dropoffLocation: "Town Centre Cinema, King Street, Huddersfield HD1 2QR", // From your image
        estimatedTime: "12 mins", // Placeholder
        fareEstimate: 7.50, // From your image
        status: 'driver_assigned', 
        pickupCoords: { lat: 53.6570, lng: -1.8195 }, // Placeholder
        dropoffCoords: { lat: 53.6465, lng: -1.7830 }, // Placeholder
        distanceMiles: 3.5, // Placeholder
        passengerCount: 1, // From your image
        notes: "Main door, by the blue plant pot. Has a small suitcase.", // From your image
        passengerPhone: "07123456001", // Placeholder
        passengerRating: 4.7, // From your image
      };
      setRideRequests([mockActiveRideData]);
      toast({title: "Mock Ride Accepted!", description: `En Route to Pickup for ${mockActiveRideData.passengerName}.`});
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
            // Simulate passenger acknowledgment after 3 seconds for demo
            if (rideId.startsWith('active-mock-') || true) { // Apply to real rides too for demo
                setTimeout(() => {
                  setRideRequests(prev => prev.map(r => {
                    if (r.id === rideId && r.status === 'arrived_at_pickup') {
                      console.log("Simulating passenger acknowledgment for ride:", rideId);
                      return { ...r, passengerAcknowledgedArrivalTimestamp: new Date().toISOString() };
                    }
                    return r;
                  }));
                }, 3000);
            }
            break;
        case 'start_ride':
            newStatus = 'In Progress';
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
            apiAction = 'cancel_ride';
            toastTitle = "Ride Cancelled";
            toastMessage = `Active ride with ${rideDisplayName} cancelled.`;
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
            if ((actionType === 'accept') && driverUser) {
                payload.driverId = driverUser.id;
                payload.driverName = driverUser.name;
            }

            const response = await fetch(`/api/operator/bookings/${rideId}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let descriptiveError = `Failed to update ride (Status: ${response.status}).`;
                try {
                    const responseBodyText = await response.text();
                    console.log("handleRideAction API error raw response text:", responseBodyText);
                    if (responseBodyText && responseBodyText.trim() !== "") {
                        try {
                            const errorData = JSON.parse(responseBodyText);
                            if(errorData.message) descriptiveError = `Server: ${errorData.message}`;
                            if(errorData.details) descriptiveError += ` Details: ${errorData.details}.`;
                        } catch (jsonParseError) {
                            descriptiveError += ` Response from server: ${responseBodyText.substring(0,150)}${responseBodyText.length > 150 ? '...' : ''}`;
                        }
                    } else {
                       descriptiveError += " Server returned an empty error response.";
                    }
                } catch (readError) {
                     descriptiveError += ` Could not read server response body. Server status: ${response.status} ${response.statusText}.`;
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
                        if (updatedBooking.rideStartedAt) updatedReq.rideStartedAt = updatedBooking.rideStartedAt._seconds ? new Date(updatedBooking.rideStartedAt._seconds * 1000).toISOString() : updatedBooking.rideStartedAt;
                        if (updatedBooking.completedAt) updatedReq.completedAt = updatedBooking.completedAt._seconds ? new Date(updatedBooking.completedAt._seconds * 1000).toISOString() : updatedBooking.completedAt;
                        return updatedReq;
                    }
                    return req;
                })
            );
            toast({ title: toastTitle, description: toastMessage });

        } catch (error) {
             console.error(`Error in handleRideAction for ride ${rideId}, action ${actionType}:`, error);
             toast({ title: "Action Failed", description: `Could not update ride: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive"});
             if (actionType === 'accept') { 
                setRideRequests(prev => prev.map(r => r.id === rideId ? {...r, status: 'pending'} : r));
             }
        } finally {
            setActionLoading(prev => ({ ...prev, [rideId]: false }));
        }
    } else if (rideId.startsWith('active-mock-') && newStatus) { // Handle mock rides
        setRideRequests(prev => prev.map(r => {
          if (r.id === rideId) {
            const updatedMockRide: RideRequest = { ...r, status: newStatus };
            if (newStatus === 'arrived_at_pickup' && actionType === 'notify_arrival') {
                updatedMockRide.notifiedPassengerArrivalTimestamp = new Date().toISOString();
            }
            if (newStatus === 'In Progress' && actionType === 'start_ride' && r.status === 'arrived_at_pickup'){
                // If simulating passenger ack, it would be set here too, or rely on the timeout for demo.
                // For this path, let's assume the timeout will handle passengerAck for demo.
                updatedMockRide.rideStartedAt = new Date().toISOString();
            }
            if (newStatus === 'completed' && actionType === 'complete_ride') {
                updatedMockRide.completedAt = new Date().toISOString();
            }
            return updatedMockRide;
          }
          return r;
        }));
        toast({ title: toastTitle, description: toastMessage });
        setActionLoading(prev => ({ ...prev, [rideId]: false }));
    } else {
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
    if ((activeRide.status.toLowerCase().includes('in progress') || activeRide.status === 'completed') && activeRide.dropoffCoords) {
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
    if (activeRide?.status.toLowerCase().includes('in progress') && activeRide.dropoffCoords) return activeRide.dropoffCoords;
    if (activeRide?.status === 'completed' && activeRide.dropoffCoords) return activeRide.dropoffCoords;
    return driverLocation;
  };

  const handleCancelSwitchChange = (checked: boolean) => {
    setIsCancelSwitchOn(checked);
    if (checked) {
      setShowCancelConfirmationDialog(true);
    }
  };

  const CancelRideInteraction = ({ ride, isLoading }: { ride: RideRequest, isLoading: boolean }) => (
    <div className="flex items-center justify-between space-x-2 bg-destructive/10 p-3 rounded-md mt-3">
      <Label htmlFor={`cancel-ride-switch-${ride.id}`} className="text-destructive font-medium text-sm">
        Initiate Cancellation
      </Label>
      <Switch
        id={`cancel-ride-switch-${ride.id}`}
        checked={isCancelSwitchOn}
        onCheckedChange={handleCancelSwitchChange}
        disabled={isLoading}
        className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted shrink-0"
      />
    </div>
  );


  if (activeRide) {
    const showDriverAssignedStatus = activeRide.status === 'driver_assigned';
    const showArrivedAtPickupStatus = activeRide.status === 'arrived_at_pickup';
    const showInProgressStatus = activeRide.status.toLowerCase().includes('in progress');
    const showCompletedStatus = activeRide.status === 'completed';

    return (
      <div className="flex flex-col h-full">
        {(!showCompletedStatus && (
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
        ))}
        <Card className={cn(
            "flex-1 flex flex-col rounded-t-xl z-10 shadow-[-4px_0px_15px_rgba(0,0,0,0.1)] border-t-4 border-primary bg-card overflow-hidden",
            showCompletedStatus ? "mt-0 rounded-b-xl" : "-mt-3" 
        )}>
           <CardContent className="p-3 space-y-2 flex-1 overflow-y-auto">
            {showDriverAssignedStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="secondary" className="text-sm w-fit mx-auto bg-sky-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md">
                       En Route to Pickup
                    </Badge>
                </div>
            )}
             {showArrivedAtPickupStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="outline" className="text-sm w-fit mx-auto border-blue-500 text-blue-500 py-1.5 px-4 rounded-md font-semibold shadow-md">
                        Arrived At Pickup
                    </Badge>
                </div>
            )}
            {showInProgressStatus && (
                <div className="flex justify-center mb-2">
                    <Badge variant="default" className="text-sm w-fit mx-auto bg-green-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md">
                        Ride In Progress
                    </Badge>
                </div>
            )}
            {showCompletedStatus && (
                <div className="flex justify-center my-4">
                    <Badge variant="default" className="text-lg w-fit mx-auto bg-primary text-primary-foreground py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2">
                        <CheckCircle className="w-6 h-6" /> Ride Completed
                    </Badge>
                </div>
            )}


            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
              <Avatar className="h-12 w-12">
                <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/48x48.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/>
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
              {!showCompletedStatus && (
                <>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => toast({title: "Call Passenger", description: `Calling ${activeRide.passengerPhone || activeRide.passengerName} (Mock)`})}>
                        <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                        <Link href="/driver/chat"><ChatIcon className="w-4 h-4" /></Link>
                    </Button>
                </>
              )}
            </div>

            <div className="space-y-1 text-sm py-1">
                <p className={cn(
                    "flex items-start gap-1.5",
                    (showInProgressStatus || showCompletedStatus) && "text-muted-foreground opacity-60"
                  )}>
                  <MapPin className={cn(
                      "w-4 h-4 mt-0.5 shrink-0",
                      (showInProgressStatus || showCompletedStatus) ? "text-muted-foreground" : "text-green-500"
                    )} />
                  <span><strong>Pickup:</strong> {activeRide.pickupLocation}</span>
                </p>
              <p className={cn(
                  "flex items-start gap-1.5",
                  (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus)) && "text-muted-foreground opacity-60"
                )}>
                <MapPin className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus)) ? "text-muted-foreground" : "text-orange-500"
                  )} />
                <span className={cn((showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus)) && "text-muted-foreground")}>
                  <strong>Dropoff:</strong> {activeRide.dropoffLocation}
                </span>
              </p>
              {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => (
                <p key={index} className={cn("flex items-start gap-1.5 pl-5", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus) && "text-muted-foreground opacity-60")}>
                  <Route className={cn("w-4 h-4 mt-0.5 shrink-0", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus) ? "text-muted-foreground" : "text-muted-foreground")} />
                  <strong>Stop {index + 1}:</strong> {stop.address}
                </p>
              ))}
              <div className="grid grid-cols-2 gap-1 pt-1">
                  <p className="flex items-center gap-1"><DollarSignIcon className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> ~£{activeRide.fareEstimate.toFixed(2)}</p>
                  <p className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-muted-foreground" /> <strong>Pax:</strong> {activeRide.passengerCount}</p>
              </div>
            </div>

            {activeRide.notes && !showCompletedStatus && (
              <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md my-1">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap"><strong>Notes:</strong> {activeRide.notes}</p>
              </div>
            )}

            {showArrivedAtPickupStatus && !activeRide.passengerAcknowledgedArrivalTimestamp && (
                <Alert variant="default" className="bg-blue-100 dark:bg-blue-700/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-100 my-1">
                    <BellRing className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Waiting for Passenger</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">
                        Passenger has been notified. Waiting for them to acknowledge arrival.
                    </ShadAlertDescription>
                 </Alert>
            )}
            {showArrivedAtPickupStatus && activeRide.passengerAcknowledgedArrivalTimestamp && (
                 <Alert variant="default" className="bg-green-100 dark:bg-green-700/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-100 my-1">
                    <CheckCheck className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Passenger Acknowledged</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">Passenger has confirmed your arrival and is on their way.</ShadAlertDescription>
                 </Alert>
            )}

            {showCompletedStatus && (
              <>
                {!isPassengerRatingSubmitted ? (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-center mb-2">How was your experience with {activeRide.passengerName}?</p>
                    <div className="flex justify-center space-x-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-7 h-7 cursor-pointer",
                            i < passengerRatingByDriver ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                          )}
                          onClick={() => {
                            setPassengerRatingByDriver(i + 1);
                          }}
                        />
                      ))}
                    </div>
                    {passengerRatingByDriver > 0 && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-1"
                            onClick={() => {
                                toast({ title: "Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${passengerRatingByDriver} stars.` });
                                setIsPassengerRatingSubmitted(true);
                            }}
                        >
                            Submit Rating for Passenger
                        </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t text-center">
                      <p className="text-sm text-green-600 flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4"/> You rated {activeRide.passengerName} {passengerRatingByDriver} stars.
                      </p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium text-center text-muted-foreground mb-1">
                    Remind your passenger to rate their ride!
                  </p>
                  <div className="flex justify-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-gray-300" />
                    ))}
                  </div>
                </div>
              </>
            )}

          </CardContent>

          <CardFooter className="p-3 border-t grid gap-2">
             {showDriverAssignedStatus && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                       <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => toast({title: "Navigate", description: `Mock navigating to pickup: ${activeRide.pickupLocation}`})}>
                          <Navigation className="mr-2"/> Navigate
                      </Button>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}>
                          {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Notify Arrival
                      </Button>
                  </div>
                  <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} />
                </>
            )}
             {showArrivedAtPickupStatus && (
                <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => toast({title: "Navigate", description: `Mock navigating to pickup location for ${activeRide.passengerName}...`})}>
                            <Navigation className="mr-2"/> Navigate
                        </Button>
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}>
                            {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Start Ride
                        </Button>
                    </div>
                    <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} />
                </div>
            )}
            {showInProgressStatus && (
                 <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => toast({title: "Navigate", description: `Mock navigating to dropoff for ${activeRide.passengerName} at ${activeRide.dropoffLocation}`})}>
                            <Navigation className="mr-2"/> Navigate
                        </Button>
                        <Button className="w-full bg-primary hover:bg-primary/80 text-base text-primary-foreground py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}>
                            {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Complete Ride
                        </Button>
                    </div>
                    <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} />
                </div>
            )}
            {showCompletedStatus && (
                <Button
                    className="w-full bg-slate-600 hover:bg-slate-700 text-lg text-white py-3 h-auto"
                    onClick={() => {
                        setRideRequests([]);
                        setPassengerRatingByDriver(0);
                        setIsPassengerRatingSubmitted(false);
                    }} 
                    disabled={activeRide ? actionLoading[activeRide.id] : false}
                >
                    {(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
                    Done
                </Button>
            )}
          </CardFooter>
        </Card>

        <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => {
            setShowCancelConfirmationDialog(isOpen);
            if (!isOpen && isCancelSwitchOn) {
                setIsCancelSwitchOn(false);
            }
        }}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel this ride?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. The passenger will be notified.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}} disabled={activeRide ? actionLoading[activeRide.id] : false}>Keep Ride</AlertDialogCancel>
            <AlertDialogAction
                onClick={() => {
                if (activeRide) {
                    handleRideAction(activeRide.id, 'cancel_active');
                }
                setIsCancelSwitchOn(false);
                setShowCancelConfirmationDialog(false);
                }}
                disabled={activeRide ? actionLoading[activeRide.id] : false}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
                {(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Cancel
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
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
       <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => {
          setShowCancelConfirmationDialog(isOpen);
          if (!isOpen && activeRide && isCancelSwitchOn) {
            setIsCancelSwitchOn(false);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel this ride?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. The passenger will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsCancelSwitchOn(false);
              setShowCancelConfirmationDialog(false);
            }} disabled={activeRide ? actionLoading[activeRide.id] : false}>Keep Ride</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeRide) {
                  handleRideAction(activeRide.id, 'cancel_active');
                }
                setIsCancelSwitchOn(false);
                setShowCancelConfirmationDialog(false);
              }}
              disabled={activeRide ? actionLoading[activeRide.id] : false}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
  );
}
    

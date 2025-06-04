
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
  requiredOperatorId?: string; // Added for operator-specific rides
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
  const [currentDriverOperatorPrefix, setCurrentDriverOperatorPrefix] = useState<string | null>(null);

  const activeRide = useMemo(() => rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress', 'completed', 'cancelled_by_driver'].includes(r.status)), [rideRequests]);

  useEffect(() => {
    if (driverUser?.id) {
      const parts = driverUser.id.split('/');
      if (parts.length > 0) {
        setCurrentDriverOperatorPrefix(parts[0]);
      } else {
        // Handle cases where ID might not have a prefix (e.g., guest drivers not following the pattern)
        // For simulation, we can assign a default or leave it null.
        // If it's null, all operator-specific offers will be "mismatched" unless the offer has no requiredOperatorId.
        setCurrentDriverOperatorPrefix('OP_DefaultGuest'); // Or null if preferred
        console.warn("Driver ID does not have an operator prefix:", driverUser.id);
      }
    }
  }, [driverUser]);

  const handleSimulateOffer = () => {
    const randomScenario = Math.random();
    let mockOffer: RideOffer;
    let offerTypeDescription = "";

    if (randomScenario < 0.33 && currentDriverOperatorPrefix) { // Mismatched Operator Offer
      const mismatchedOperatorId = currentDriverOperatorPrefix === "OP001" ? "OP002" : "OP001"; // Simple toggle for demo
      mockOffer = {
        id: `mock-offer-mismatch-${Date.now()}`,
        pickupLocation: "Tech Park Canteen, Leeds LS1 1AA",
        pickupCoords: { lat: 53.7986, lng: -1.5492 },
        dropoffLocation: "Art Gallery, The Headrow, Leeds LS1 3AA",
        dropoffCoords: { lat: 53.8008, lng: -1.5472 },
        fareEstimate: 9.00,
        passengerCount: 1,
        passengerName: "Mike Misken",
        notes: "Waiting by the main entrance, blue jacket.",
        requiredOperatorId: mismatchedOperatorId,
      };
      offerTypeDescription = `restricted to ${mismatchedOperatorId}`;
    } else if (randomScenario < 0.66 && currentDriverOperatorPrefix) { // Matching Operator Offer
      mockOffer = {
        id: `mock-offer-match-${Date.now()}`,
        pickupLocation: "Huddersfield Station, HD1 1JB",
        pickupCoords: { lat: 53.6488, lng: -1.7805 },
        dropoffLocation: "University of Huddersfield, Queensgate, HD1 3DH",
        dropoffCoords: { lat: 53.6430, lng: -1.7797 },
        fareEstimate: 6.50,
        passengerCount: 2,
        passengerName: "Alice Matching",
        notes: "2 small bags.",
        requiredOperatorId: currentDriverOperatorPrefix,
      };
      offerTypeDescription = `restricted to your operator (${currentDriverOperatorPrefix})`;
    } else { // General Platform Offer
      mockOffer = {
        id: `mock-offer-general-${Date.now()}`,
        pickupLocation: "Kingsgate Shopping Centre, Huddersfield HD1 2QB",
        pickupCoords: { lat: 53.6455, lng: -1.7850 },
        dropoffLocation: "Greenhead Park, Huddersfield HD1 4HS",
        dropoffCoords: { lat: 53.6520, lng: -1.7960 },
        fareEstimate: 7.50,
        passengerCount: 1,
        passengerName: "Gary General",
        notes: "Please call on arrival.",
        // No requiredOperatorId for general offers
      };
      offerTypeDescription = "a general platform offer";
    }

    console.log(`Simulating offer (${offerTypeDescription}). Current driver prefix: ${currentDriverOperatorPrefix}. Offer requires: ${mockOffer.requiredOperatorId || 'any'}`);

    if (mockOffer.requiredOperatorId && currentDriverOperatorPrefix && mockOffer.requiredOperatorId !== currentDriverOperatorPrefix) {
      toast({
        title: "Offer Skipped",
        description: `An offer ${offerTypeDescription} was received, but it's not for your operator group (${currentDriverOperatorPrefix}).`,
        variant: "default",
        duration: 7000,
      });
      return; // Don't show the modal
    }

    setCurrentOfferDetails(mockOffer);
    setIsOfferModalOpen(true);
  };

  const handleAcceptOffer = (rideId: string) => {
    setIsOfferModalOpen(false);
    const offerToAccept = currentOfferDetails;
    setCurrentOfferDetails(null);

    if (offerToAccept) { // Check if offerToAccept is not null
      const newActiveRideData: RideRequest = {
        id: `active-${offerToAccept.id}-${Date.now()}`, // Ensure unique ID for active ride
        passengerName: offerToAccept.passengerName || "Passenger",
        passengerAvatar: `https://placehold.co/48x48.png?text=${offerToAccept.passengerName ? offerToAccept.passengerName.charAt(0) : 'P'}`,
        pickupLocation: offerToAccept.pickupLocation,
        dropoffLocation: offerToAccept.dropoffLocation,
        estimatedTime: "10-15 mins", // Placeholder
        fareEstimate: offerToAccept.fareEstimate,
        status: 'driver_assigned', 
        pickupCoords: offerToAccept.pickupCoords, 
        dropoffCoords: offerToAccept.dropoffCoords,
        distanceMiles: Math.random() * 5 + 1, // Placeholder distance
        passengerCount: offerToAccept.passengerCount, 
        notes: offerToAccept.notes, 
        passengerPhone: "07123456789", // Placeholder
        passengerRating: Math.random() * 2 + 3, // Placeholder rating 3-5
        requiredOperatorId: offerToAccept.requiredOperatorId,
      };
      setRideRequests([newActiveRideData]); // Replace any existing ride with the new one for demo
      toast({title: "Ride Accepted!", description: `En Route to Pickup for ${newActiveRideData.passengerName}. ${newActiveRideData.requiredOperatorId ? '(Operator Restricted: ' + newActiveRideData.requiredOperatorId + ')' : '(General Ride)'}`});
    } else {
        // This case should ideally not be reached if modal was opened with details
        toast({title: "Error Accepting Ride", description: "No ride details found to accept.", variant: "destructive"});
    }
  };


  const handleDeclineOffer = (rideId: string) => {
    const declinedOffer = currentOfferDetails; // Use the offer that was in the modal
    setIsOfferModalOpen(false);
    setCurrentOfferDetails(null);
    
    if (declinedOffer) {
      toast({title: "Ride Offer Declined", description: `You declined the offer for ${declinedOffer.passengerName || 'a passenger'}.`});
    } else {
      toast({title: "Offer Declined", description: `Offer with ID ${rideId} declined (details not found).`});
    }
    // In a real app, you might send a decline status to the backend
    // For the prototype, we just close the modal and show a toast.
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
        case 'accept': // This case might be redundant if accept is handled by handleAcceptOffer
            if (!driverUser) { /* ... */ return; }
            newStatus = 'driver_assigned'; toastTitle = "Ride Accepted"; toastMessage = `Ride request from ${rideDisplayName} accepted.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, passengerAvatar: r.passengerAvatar || 'https://placehold.co/40x40.png?text=P' } : r));
            break;
        case 'decline': // This case might be redundant if decline is handled by handleDeclineOffer
            newStatus = 'declined'; toastTitle = "Ride Declined"; toastMessage = `Ride request for ${rideDisplayName} declined.`;
            setRideRequests(prev => prev.filter(r => r.id !== rideId));
            break;
        case 'notify_arrival':
            newStatus = 'arrived_at_pickup'; apiAction = 'notify_arrival'; toastTitle = "Passenger Notified"; toastMessage = `Passenger ${rideDisplayName} has been notified of your arrival.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, notifiedPassengerArrivalTimestamp: new Date().toISOString() } : r));
            // Simulate passenger acknowledgment after 3 seconds for demo
            setTimeout(() => {
                setRideRequests(prev => prev.map(r => {
                if (r.id === rideId && r.status === 'arrived_at_pickup') {
                    return { ...r, passengerAcknowledgedArrivalTimestamp: new Date().toISOString() };
                }
                return r;
                }));
            }, 3000);
            break;
        case 'start_ride':
            newStatus = 'In Progress'; apiAction = 'start_ride'; toastTitle = "Ride Started"; toastMessage = `Ride with ${rideDisplayName} is now in progress.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, rideStartedAt: new Date().toISOString() } : r));
            break;
        case 'complete_ride':
            newStatus = 'completed'; apiAction = 'complete_ride'; toastTitle = "Ride Completed"; toastMessage = `Ride with ${rideDisplayName} marked as completed.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, completedAt: new Date().toISOString() } : r));
            break;
        case 'cancel_active':
            newStatus = 'cancelled_by_driver'; apiAction = 'cancel_ride'; toastTitle = "Ride Cancelled"; toastMessage = `Active ride with ${rideDisplayName} cancelled by you.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus! } : r));
            break;
    }
    
    // For all actions except actual backend-dependent ones (like accept/decline which are now separate)
    // we'll just update UI and show toast for the prototype.
    if (newStatus && !['accept', 'decline'].includes(actionType)) {
        if(actionType !== 'cancel_active'){
             toast({ title: toastTitle, description: toastMessage });
        } else {
             toast({ title: "Ride Cancelled", description: "The ride has been marked as cancelled by you." });
        }
    }
    setActionLoading(prev => ({ ...prev, [rideId]: false }));
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
    const showCancelledByDriverStatus = activeRide.status === 'cancelled_by_driver';

    return (
      <div className="flex flex-col h-full">
        {(!showCompletedStatus && !showCancelledByDriverStatus && (
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
            (showCompletedStatus || showCancelledByDriverStatus) ? "mt-0 rounded-b-xl" : "-mt-3" 
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
             {showCancelledByDriverStatus && (
                 <div className="flex justify-center my-4">
                    <Badge variant="destructive" className="text-lg w-fit mx-auto py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2">
                        <XCircle className="w-6 h-6" /> Ride Cancelled by You
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
              {(!showCompletedStatus && !showCancelledByDriverStatus) && (
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
                    (showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60"
                  )}>
                  <MapPin className={cn(
                      "w-4 h-4 mt-0.5 shrink-0",
                      (showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-green-500"
                    )} />
                  <span><strong>Pickup:</strong> {activeRide.pickupLocation}</span>
                </p>
              <p className={cn(
                  "flex items-start gap-1.5",
                  (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground opacity-60"
                )}>
                <MapPin className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) ? "text-muted-foreground" : "text-orange-500"
                  )} />
                <span className={cn((showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground")}>
                  <strong>Dropoff:</strong> {activeRide.dropoffLocation}
                </span>
              </p>
              {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => (
                <p key={index} className={cn("flex items-start gap-1.5 pl-5", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60")}>
                  <Route className={cn("w-4 h-4 mt-0.5 shrink-0", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-muted-foreground")} />
                  <strong>Stop {index + 1}:</strong> {stop.address}
                </p>
              ))}
              <div className="grid grid-cols-2 gap-1 pt-1">
                  <p className="flex items-center gap-1"><DollarSignIcon className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> ~£{activeRide.fareEstimate.toFixed(2)}</p>
                  <p className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-muted-foreground" /> <strong>Pax:</strong> {activeRide.passengerCount}</p>
              </div>
            </div>

            {activeRide.notes && (!showCompletedStatus && !showCancelledByDriverStatus) && (
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

            {showCancelledByDriverStatus && (
                 <div className="mt-4 pt-4 border-t text-center">
                    <p className="text-sm text-muted-foreground">This ride was cancelled. You can now look for new offers.</p>
                 </div>
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
            {(showCompletedStatus || showCancelledByDriverStatus) && (
                <Button
                    className="w-full bg-slate-600 hover:bg-slate-700 text-lg text-white py-3 h-auto"
                    onClick={() => {
                        setRideRequests([]); // This clears the activeRide
                        setPassengerRatingByDriver(0);
                        setIsPassengerRatingSubmitted(false);
                        setIsCancelSwitchOn(false); 
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
    

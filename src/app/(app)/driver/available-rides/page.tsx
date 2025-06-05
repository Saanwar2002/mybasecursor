
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2, Building, Car as CarIcon, Power, AlertTriangle, DollarSign as DollarSignIcon, MessageCircle as ChatIcon, Briefcase, CreditCard, Coins, Timer } from "lucide-react";
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

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface ActiveRide {
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
  driverRatingForPassenger?: number | null; 
  notes?: string;
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  completedAt?: SerializedTimestamp | string | null;
  requiredOperatorId?: string;
  paymentMethod?: 'card' | 'cash';
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';

type MapBusynessLevel = 'idle' | 'moderate' | 'high';

const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60; // 3 minutes
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;


const parseTimestampToDate = (timestamp: SerializedTimestamp | string | null | undefined): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp === 'object' && ('_seconds' in timestamp) && ('_nanoseconds' in timestamp)) {
    return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  }
  return null;
};

const formatTimer = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<ActiveRide[]>([]);
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
  
  const [currentDriverOperatorPrefix, setCurrentDriverOperatorPrefix] = useState<string | null>(null);
  const [mapBusynessLevel, setMapBusynessLevel] = useState<MapBusynessLevel>('idle');
  const [driverRatingForPassenger, setDriverRatingForPassenger] = useState<number>(0);

  const [ackWindowSecondsLeft, setAckWindowSecondsLeft] = useState<number | null>(null);
  const [freeWaitingSecondsLeft, setFreeWaitingSecondsLeft] = useState<number | null>(null);
  const [extraWaitingSeconds, setExtraWaitingSeconds] = useState<number | null>(null);
  const [currentWaitingCharge, setCurrentWaitingCharge] = useState<number>(0);
  const waitingTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const activeRide = useMemo(() => rideRequests.find(r => ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'In Progress', 'completed', 'cancelled_by_driver'].includes(r.status)), [rideRequests]);

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
    if (driverUser?.operatorCode) {
      setCurrentDriverOperatorPrefix(driverUser.operatorCode);
    } else if (driverUser?.id && driverUser.id.includes('/')) {
      const parts = driverUser.id.split('/');
      if (parts.length > 0) {
        setCurrentDriverOperatorPrefix(parts[0]);
      }
    } else if (driverUser?.id) {
      setCurrentDriverOperatorPrefix('OP_DefaultGuest'); 
    }
  }, [driverUser]);


  useEffect(() => {
    if (waitingTimerIntervalRef.current) {
      clearInterval(waitingTimerIntervalRef.current);
      waitingTimerIntervalRef.current = null;
    }
  
    const notifiedTime = parseTimestampToDate(activeRide?.notifiedPassengerArrivalTimestamp);
    const ackTime = parseTimestampToDate(activeRide?.passengerAcknowledgedArrivalTimestamp);
  
    if (activeRide?.status === 'arrived_at_pickup' && notifiedTime) {
      const updateTimers = () => {
        const now = new Date();
        const secondsSinceNotified = Math.floor((now.getTime() - notifiedTime.getTime()) / 1000);
  
        if (!ackTime) { // Passenger hasn't acknowledged
          if (secondsSinceNotified < ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER) {
            setAckWindowSecondsLeft(ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER - secondsSinceNotified);
            setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_DRIVER);
            setExtraWaitingSeconds(null);
            setCurrentWaitingCharge(0);
          } else { // Ack window expired, passenger didn't acknowledge
            setAckWindowSecondsLeft(0);
            const effectiveFreeWaitStartTime = new Date(notifiedTime.getTime() + ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER * 1000);
            const secondsSinceEffectiveFreeWaitStart = Math.floor((now.getTime() - effectiveFreeWaitStartTime.getTime()) / 1000);
  
            if (secondsSinceEffectiveFreeWaitStart < FREE_WAITING_TIME_SECONDS_DRIVER) {
              setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_DRIVER - secondsSinceEffectiveFreeWaitStart);
              setExtraWaitingSeconds(null);
              setCurrentWaitingCharge(0);
            } else {
              setFreeWaitingSecondsLeft(0);
              const currentExtra = secondsSinceEffectiveFreeWaitStart - FREE_WAITING_TIME_SECONDS_DRIVER;
              setExtraWaitingSeconds(currentExtra);
              setCurrentWaitingCharge(Math.floor(currentExtra / 60) * WAITING_CHARGE_PER_MINUTE_DRIVER);
            }
          }
        } else { // Passenger has acknowledged
          setAckWindowSecondsLeft(null);
          const secondsSinceAck = Math.floor((now.getTime() - ackTime.getTime()) / 1000);
  
          if (secondsSinceAck < FREE_WAITING_TIME_SECONDS_DRIVER) {
            setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_DRIVER - secondsSinceAck);
            setExtraWaitingSeconds(null);
            setCurrentWaitingCharge(0);
          } else {
            setFreeWaitingSecondsLeft(0);
            const currentExtra = secondsSinceAck - FREE_WAITING_TIME_SECONDS_DRIVER;
            setExtraWaitingSeconds(currentExtra);
            setCurrentWaitingCharge(Math.floor(currentExtra / 60) * WAITING_CHARGE_PER_MINUTE_DRIVER);
          }
        }
      };
      updateTimers();
      waitingTimerIntervalRef.current = setInterval(updateTimers, 1000);
    } else if (activeRide?.status !== 'arrived_at_pickup') {
      setAckWindowSecondsLeft(null);
      setFreeWaitingSecondsLeft(null);
      setExtraWaitingSeconds(null);
      setCurrentWaitingCharge(0);
    }
  
    return () => {
      if (waitingTimerIntervalRef.current) {
        clearInterval(waitingTimerIntervalRef.current);
      }
    };
  }, [activeRide?.status, activeRide?.notifiedPassengerArrivalTimestamp, activeRide?.passengerAcknowledgedArrivalTimestamp]);


  const handleSimulateOffer = () => {
    const randomScenario = Math.random();
    let mockOffer: RideOffer;
    const distance = parseFloat((Math.random() * 10 + 2).toFixed(1)); 
    const paymentMethod: 'card' | 'cash' = Math.random() < 0.5 ? 'card' : 'cash';

    if (randomScenario < 0.33 && currentDriverOperatorPrefix) { 
      const mismatchedOperatorId = currentDriverOperatorPrefix === "OP001" ? "OP002" : "OP001"; 
      mockOffer = { id: `mock-offer-mismatch-${Date.now()}`, pickupLocation: "Tech Park Canteen, Leeds LS1 1AA", pickupCoords: { lat: 53.7986, lng: -1.5492 }, dropoffLocation: "Art Gallery, The Headrow, Leeds LS1 3AA", dropoffCoords: { lat: 53.8008, lng: -1.5472 }, fareEstimate: 9.00, passengerCount: 1, passengerName: "Mike Misken", notes: "Waiting by the main entrance, blue jacket.", requiredOperatorId: mismatchedOperatorId, distanceMiles: distance, paymentMethod: paymentMethod, };
    } else if (randomScenario < 0.66 && currentDriverOperatorPrefix) { 
      mockOffer = { id: `mock-offer-match-${Date.now()}`, pickupLocation: "Huddersfield Station, HD1 1JB", pickupCoords: { lat: 53.6488, lng: -1.7805 }, dropoffLocation: "University of Huddersfield, Queensgate, HD1 3DH", dropoffCoords: { lat: 53.6430, lng: -1.7797 }, fareEstimate: 6.50, passengerCount: 2, passengerName: "Alice Matching", notes: "2 small bags.", requiredOperatorId: currentDriverOperatorPrefix, distanceMiles: distance, paymentMethod: paymentMethod, };
    } else { 
      mockOffer = { id: `mock-offer-general-${Date.now()}`, pickupLocation: "Kingsgate Shopping Centre, Huddersfield HD1 2QB", pickupCoords: { lat: 53.6455, lng: -1.7850 }, dropoffLocation: "Greenhead Park, Huddersfield HD1 4HS", dropoffCoords: { lat: 53.6520, lng: -1.7960 }, fareEstimate: 7.50, passengerCount: 1, passengerName: "Gary General", notes: "Please call on arrival.", distanceMiles: distance, paymentMethod: paymentMethod, };
    }

    if (mockOffer.requiredOperatorId && currentDriverOperatorPrefix && mockOffer.requiredOperatorId !== currentDriverOperatorPrefix) {
      toast({ title: "Offer Skipped", description: `An offer restricted to ${mockOffer.requiredOperatorId} was received, but it's not for your operator group (${currentDriverOperatorPrefix}).`, variant: "default", duration: 7000, }); return; 
    }
    if (mockOffer.requiredOperatorId && !currentDriverOperatorPrefix) { toast({ title: "Offer Skipped", description: `An offer restricted to ${mockOffer.requiredOperatorId} was received, but your operator details are not clear.`, variant: "default", duration: 7000, }); return; }

    setCurrentOfferDetails(mockOffer); setIsOfferModalOpen(true);
  };

  const handleAcceptOffer = (rideId: string) => {
    setIsOfferModalOpen(false); const offerToAccept = currentOfferDetails; setCurrentOfferDetails(null);
    if (offerToAccept) { 
      const newActiveRideData: ActiveRide = { id: `active-${offerToAccept.id}-${Date.now()}`, passengerName: offerToAccept.passengerName || "Passenger", passengerAvatar: `https://placehold.co/48x48.png?text=${offerToAccept.passengerName ? offerToAccept.passengerName.charAt(0) : 'P'}`, pickupLocation: offerToAccept.pickupLocation, dropoffLocation: offerToAccept.dropoffLocation, estimatedTime: "10-15 mins", fareEstimate: offerToAccept.fareEstimate, status: 'driver_assigned', pickupCoords: offerToAccept.pickupCoords, dropoffCoords: offerToAccept.dropoffCoords, distanceMiles: offerToAccept.distanceMiles || Math.random() * 5 + 1, passengerCount: offerToAccept.passengerCount, notes: offerToAccept.notes, passengerPhone: "07123456789", passengerRating: Math.random() * 2 + 3, requiredOperatorId: offerToAccept.requiredOperatorId, paymentMethod: offerToAccept.paymentMethod, };
      setRideRequests([newActiveRideData]); 
      toast({title: "Ride Accepted!", description: `En Route to Pickup for ${newActiveRideData.passengerName}. Payment: ${newActiveRideData.paymentMethod === 'card' ? 'Card' : 'Cash'}.`});
    } else { toast({title: "Error Accepting Ride", description: "No ride details found to accept.", variant: "destructive"}); }
  };

  const handleDeclineOffer = (rideId: string) => {
    const declinedOffer = currentOfferDetails; setIsOfferModalOpen(false); setCurrentOfferDetails(null);
    if (declinedOffer) { toast({title: "Ride Offer Declined", description: `You declined the offer for ${declinedOffer.passengerName || 'a passenger'}.`}); } 
    else { toast({title: "Offer Declined", description: `Offer with ID ${rideId} declined (details not found).`}); }
  };

 const handleRideAction = async (rideId: string, actionType: 'accept' | 'decline' | 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active') => {
    if (!driverUser && actionType !== 'decline') { toast({ title: "Error", description: "Driver not logged in.", variant: "destructive"}); return; }
    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    let newStatus: ActiveRide['status'] | undefined = undefined; let toastMessage = ""; let toastTitle = "";
    const currentRide = rideRequests.find(r => r.id === rideId);
    if (!currentRide) { setActionLoading(prev => ({ ...prev, [rideId]: false })); toast({ title: "Error", description: `Ride with ID ${rideId} not found locally.`, variant: "destructive" }); return; }
    const rideDisplayName = currentRide.passengerName || "the passenger";

    switch(actionType) {
        case 'notify_arrival':
            newStatus = 'arrived_at_pickup'; toastTitle = "Passenger Notified"; toastMessage = `Passenger ${rideDisplayName} has been notified of your arrival.`;
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, notifiedPassengerArrivalTimestamp: new Date().toISOString() } : r));
            break;
        case 'start_ride':
            newStatus = 'in_progress'; toastTitle = "Ride Started"; toastMessage = `Ride with ${rideDisplayName} is now in progress.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current); 
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); 
            setAckWindowSecondsLeft(null);
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, rideStartedAt: new Date().toISOString() } : r));
            break;
        case 'complete_ride':
            newStatus = 'completed'; toastTitle = "Ride Completed"; toastMessage = `Ride with ${rideDisplayName} marked as completed.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            console.log(`Ride completed. Final waiting charge: £${currentWaitingCharge.toFixed(2)}`);
            setDriverRatingForPassenger(0); 
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus!, completedAt: new Date().toISOString() } : r));
            break;
        case 'cancel_active':
            newStatus = 'cancelled_by_driver'; toastTitle = "Ride Cancelled By You"; toastMessage = `Active ride with ${rideDisplayName} cancelled.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setAckWindowSecondsLeft(null);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
            setRideRequests(prev => prev.map(r => r.id === rideId ? { ...r, status: newStatus! } : r));
            break;
    }
    if (newStatus) { toast({ title: toastTitle, description: toastMessage }); }
    setActionLoading(prev => ({ ...prev, [rideId]: false }));
  };

  const getMapMarkersForActiveRide = (): Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> => {
    if (!activeRide) return []; const markers = [];
    markers.push({ position: driverLocation, title: "Your Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: {width: 24, height: 24} });
    if (activeRide.pickupCoords) { markers.push({ position: activeRide.pickupCoords, title: `Pickup: ${activeRide.pickupLocation}`, label: { text: "P", color: "white", fontWeight: "bold"} }); }
    if ((activeRide.status.toLowerCase().includes('in_progress') || activeRide.status === 'completed') && activeRide.dropoffCoords) { markers.push({ position: activeRide.dropoffCoords, title: `Dropoff: ${activeRide.dropoffLocation}`, label: { text: "D", color: "white", fontWeight: "bold" } }); }
    activeRide.stops?.forEach((stop, index) => { if(stop.latitude && stop.longitude) { markers.push({ position: {lat: stop.latitude, lng: stop.longitude}, title: `Stop ${index+1}: ${stop.address}`, label: { text: `S${index+1}`, color: "white", fontWeight: "bold" } }); } });
    return markers;
  };

  const getMapCenterForActiveRide = (): google.maps.LatLngLiteral => {
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupCoords) return activeRide.pickupCoords;
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupCoords) return activeRide.pickupCoords;
    if (activeRide?.status.toLowerCase().includes('in_progress') && activeRide.dropoffCoords) return activeRide.dropoffCoords;
    if (activeRide?.status === 'completed' && activeRide.dropoffCoords) return activeRide.dropoffCoords;
    return driverLocation;
  };

  const handleCancelSwitchChange = (checked: boolean) => { setIsCancelSwitchOn(checked); if (checked) { setShowCancelConfirmationDialog(true); } };

  const CancelRideInteraction = ({ ride, isLoading }: { ride: ActiveRide, isLoading: boolean }) => (
    <div className="flex items-center justify-between space-x-2 bg-destructive/10 p-3 rounded-md mt-3">
      <Label htmlFor={`cancel-ride-switch-${ride.id}`} className="text-destructive font-medium text-sm"> Initiate Cancellation </Label>
      <Switch id={`cancel-ride-switch-${ride.id}`} checked={isCancelSwitchOn} onCheckedChange={handleCancelSwitchChange} disabled={isLoading} className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted shrink-0" />
    </div>
  );

  if (activeRide) {
    const showDriverAssignedStatus = activeRide.status === 'driver_assigned';
    const showArrivedAtPickupStatus = activeRide.status === 'arrived_at_pickup';
    const showInProgressStatus = activeRide.status.toLowerCase().includes('in_progress');
    const showCompletedStatus = activeRide.status === 'completed';
    const showCancelledByDriverStatus = activeRide.status === 'cancelled_by_driver';
    const showNotes = activeRide.notes && !['in_progress', 'In Progress', 'completed', 'cancelled_by_driver'].includes(activeRide.status.toLowerCase());

    return (
      <div className="flex flex-col h-full">
        {(!showCompletedStatus && !showCancelledByDriverStatus && ( <div className="h-[calc(60%-0.5rem)] w-full rounded-b-xl overflow-hidden shadow-lg border-b relative"> <GoogleMapDisplay center={getMapCenterForActiveRide()} zoom={15} markers={getMapMarkersForActiveRide()} className="w-full h-full" disableDefaultUI={true} fitBoundsToMarkers={true} /> </div> ))}
        <Card className={cn( "flex-1 flex flex-col rounded-t-xl z-10 shadow-[-4px_0px_15px_rgba(0,0,0,0.1)] border-t-4 border-primary bg-card overflow-hidden", (showCompletedStatus || showCancelledByDriverStatus) ? "mt-0 rounded-b-xl" : "-mt-3" )}>
           <CardContent className="p-3 space-y-2 flex-1 overflow-y-auto">
            {showDriverAssignedStatus && ( <div className="flex justify-center mb-2"> <Badge variant="secondary" className="text-sm w-fit mx-auto bg-sky-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> En Route to Pickup </Badge> </div> )}
            {showArrivedAtPickupStatus && ( <div className="flex justify-center mb-2"> <Badge variant="outline" className="text-sm w-fit mx-auto border-blue-500 text-blue-500 py-1.5 px-4 rounded-md font-semibold shadow-md"> Arrived At Pickup </Badge> </div> )}
            {showInProgressStatus && ( <div className="flex justify-center mb-2"> <Badge variant="default" className="text-sm w-fit mx-auto bg-green-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> Ride In Progress </Badge> </div> )}
            {showCompletedStatus && ( <div className="flex justify-center my-4"> <Badge variant="default" className="text-lg w-fit mx-auto bg-primary text-primary-foreground py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <CheckCircle className="w-6 h-6" /> Ride Completed </Badge> </div> )}
            {showCancelledByDriverStatus && ( <div className="flex justify-center my-4"> <Badge variant="destructive" className="text-lg w-fit mx-auto py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <XCircle className="w-6 h-6" /> Ride Cancelled by You </Badge> </div> )}

            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
              <Avatar className="h-12 w-12"> <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/48x48.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/> <AvatarFallback>{activeRide.passengerName.charAt(0)}</AvatarFallback> </Avatar>
              <div className="flex-1"> <p className="font-semibold text-base">{activeRide.passengerName}</p> {activeRide.passengerRating && ( <div className="flex items-center"> {[...Array(5)].map((_, i) => <Star key={i} className={cn("w-3.5 h-3.5", i < Math.round(activeRide.passengerRating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />)} <span className="ml-1 text-xs text-muted-foreground">({activeRide.passengerRating.toFixed(1)})</span> </div> )} </div>
              {(!showCompletedStatus && !showCancelledByDriverStatus) && ( <> <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => toast({title: "Call Passenger", description: `Calling ${activeRide.passengerPhone || activeRide.passengerName} (Mock)`})}> <Phone className="w-4 h-4" /> </Button> 
              <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                <Link href="/driver/chat">
                  <ChatIcon className="w-4 h-4" />
                </Link>
              </Button>
               </> )}
            </div>
            {activeRide.requiredOperatorId && ( <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md text-center mt-1"> <p className="text-xs font-medium text-purple-600 dark:text-purple-300 flex items-center justify-center gap-1"> <Briefcase className="w-3 h-3"/> Operator Ride: {activeRide.requiredOperatorId} </p> </div> )}

            {showArrivedAtPickupStatus && (
              <Alert variant="default" className="bg-yellow-100 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 my-1">
                <Timer className="h-5 w-5 text-current" />
                <ShadAlertTitle className="font-semibold text-current">Passenger Waiting Status</ShadAlertTitle>
                <ShadAlertDescription className="text-current text-xs">
                  {ackWindowSecondsLeft !== null && ackWindowSecondsLeft > 0 && !activeRide.passengerAcknowledgedArrivalTimestamp && (
                    `Waiting for passenger acknowledgment: ${formatTimer(ackWindowSecondsLeft)} left.`
                  )}
                  {ackWindowSecondsLeft === 0 && !activeRide.passengerAcknowledgedArrivalTimestamp && freeWaitingSecondsLeft !== null && (
                    `Passenger did not ack. Free waiting: ${formatTimer(freeWaitingSecondsLeft)}.`
                  )}
                  {activeRide.passengerAcknowledgedArrivalTimestamp && freeWaitingSecondsLeft !== null && freeWaitingSecondsLeft > 0 && (
                    `Passenger acknowledged. Free waiting: ${formatTimer(freeWaitingSecondsLeft)}.`
                  )}
                  {extraWaitingSeconds !== null && extraWaitingSeconds >= 0 && freeWaitingSecondsLeft === 0 && (
                    `Extra waiting: ${formatTimer(extraWaitingSeconds)}. Charge: £${currentWaitingCharge.toFixed(2)}`
                  )}
                </ShadAlertDescription>
              </Alert>
            )}

            <div className="space-y-1 text-sm py-1">
                 <p className={cn("flex items-start gap-1.5", (showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60")}> <MapPin className={cn("w-4 h-4 mt-0.5 shrink-0", (showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-green-500")} /> <span><strong>Pickup:</strong> {activeRide.pickupLocation}</span> </p>
                 <p className={cn("flex items-start gap-1.5", (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground opacity-60")}> <MapPin className={cn("w-4 h-4 mt-0.5 shrink-0", (showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) ? "text-muted-foreground" : "text-orange-500")} /> <span className={cn((showDriverAssignedStatus && !(showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground")}> <strong>Dropoff:</strong> {activeRide.dropoffLocation} </span> </p>
                 {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => ( <p key={index} className={cn("flex items-start gap-1.5 pl-5", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60")}> <Route className={cn("w-4 h-4 mt-0.5 shrink-0", (showDriverAssignedStatus || showInProgressStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-muted-foreground")} /> <strong>Stop {index + 1}:</strong> {stop.address} </p> ))}
                 <div className="grid grid-cols-2 gap-1 pt-1 text-sm">
                    <p className="flex items-center gap-1"><DollarSignIcon className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> ~£{activeRide.fareEstimate.toFixed(2)}</p>
                    <p className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-muted-foreground" /> <strong>Passengers:</strong> {activeRide.passengerCount}</p>
                    {activeRide.paymentMethod && ( <p className="flex items-center gap-1 col-span-2 mt-1"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />} <strong>Payment:</strong> {activeRide.paymentMethod === 'card' ? 'Card' : 'Cash'} </p> )}
                    {activeRide.distanceMiles && ( <p className="flex items-center gap-1 col-span-2 mt-1"> <Route className="w-4 h-4 text-muted-foreground" /> <strong>Distance:</strong> ~{activeRide.distanceMiles.toFixed(1)} mi </p> )}
                 </div>
            </div>
            {showNotes && ( <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md my-1"> <p className="text-xs text-muted-foreground whitespace-pre-wrap"><strong>Notes:</strong> {activeRide.notes}</p> </div> )}
            
            {showCompletedStatus && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-sm font-medium mb-1">Rate {activeRide.passengerName}:</p>
                <div className="flex justify-center space-x-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-7 h-7 cursor-pointer",
                        i < driverRatingForPassenger ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                      )}
                      onClick={() => setDriverRatingForPassenger(i + 1)}
                    />
                  ))}
                </div>
              </div>
            )}
            {showCancelledByDriverStatus && ( <div className="mt-4 pt-4 border-t text-center"> <p className="text-sm text-muted-foreground">This ride was cancelled. You can now look for new offers.</p> </div> )}
          </CardContent>

          <CardFooter className="p-3 border-t grid gap-2">
             {showDriverAssignedStatus && ( <> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <span className="flex items-center justify-center"><Navigation className="mr-2"/> Navigate</span> </Button> <Button className="w-full bg-blue-600 hover:bg-blue-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}> <span className="flex items-center justify-center">{actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Notify Arrival</span> </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </> )}
             {showArrivedAtPickupStatus && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <span className="flex items-center justify-center"><Navigation className="mr-2"/> Navigate</span> </Button> <Button className="w-full bg-green-600 hover:bg-green-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}> <span className="flex items-center justify-center">{actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Start Ride</span> </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </div> )}
             {showInProgressStatus && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <span className="flex items-center justify-center"><Navigation className="mr-2"/> Navigate</span> </Button> <Button className="w-full bg-primary hover:bg-primary/80 text-base text-primary-foreground py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}> <span className="flex items-center justify-center">{actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Complete Ride</span> </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </div> )}
             {(showCompletedStatus || showCancelledByDriverStatus) && ( <Button className="w-full bg-slate-600 hover:bg-slate-700 text-lg text-white py-3 h-auto" onClick={() => { if(showCompletedStatus && driverRatingForPassenger > 0) { console.log(`Mock: Driver rated passenger ${activeRide.passengerName} with ${driverRatingForPassenger} stars.`); toast({title: "Passenger Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${driverRatingForPassenger} stars.`}); } setRideRequests([]); setIsCancelSwitchOn(false); setDriverRatingForPassenger(0); }} disabled={activeRide ? actionLoading[activeRide.id] : false} > <span className="flex items-center justify-center">{(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />} Done</span> </Button> )}
          </CardFooter>
        </Card>
        <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => { setShowCancelConfirmationDialog(isOpen); if (!isOpen && activeRide && isCancelSwitchOn) { setIsCancelSwitchOn(false); }}}> <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>Are you sure you want to cancel this ride?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. The passenger will be notified. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel onClick={() => { setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}} disabled={activeRide ? actionLoading[activeRide.id] : false}>Keep Ride</AlertDialogCancel> <AlertDialogAction onClick={() => { if (activeRide) { handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }} disabled={activeRide ? actionLoading[activeRide.id] : false} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" > <span className="flex items-center justify-center">{(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel</span> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent> </AlertDialog>
      </div>
    );
  }

  const mapContainerClasses = cn( "h-[400px] w-full rounded-xl overflow-hidden shadow-lg border-4", { 'border-border': mapBusynessLevel === 'idle', 'animate-flash-yellow-border': mapBusynessLevel === 'moderate', 'animate-flash-red-border': mapBusynessLevel === 'high', } );
  return ( <div className="flex flex-col h-full space-y-2"> <div className={mapContainerClasses}> <GoogleMapDisplay center={driverLocation} zoom={14} markers={[{ position: driverLocation, title: "Your Current Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: { width: 24, height: 24 } }]} className="w-full h-full" disableDefaultUI={true} /> </div> <Card className="flex-1 flex flex-col rounded-xl shadow-lg bg-card border"> <CardHeader className={cn( "p-2 border-b text-center", isDriverOnline ? "border-green-500" : "border-red-500")}> <CardTitle className={cn( "text-lg font-semibold", isDriverOnline ? "text-green-600" : "text-red-600")}> {isDriverOnline ? "Online - Awaiting Offers" : "Offline"} </CardTitle> </CardHeader> <CardContent className="flex-1 flex flex-col items-center justify-center p-3 space-y-1"> {isDriverOnline ? ( geolocationError ? ( <div className="flex flex-col items-center text-center space-y-1 p-1 bg-destructive/10 rounded-md"> <AlertTriangle className="w-6 h-6 text-destructive" /> <p className="text-xs text-destructive">{geolocationError}</p> </div> ) : ( <> <Loader2 className="w-6 h-6 text-primary animate-spin" /> <p className="text-xs text-muted-foreground text-center">Actively searching for ride offers for you...</p> </> ) ) : ( <> <Power className="w-8 h-8 text-muted-foreground" /> <p className="text-sm text-muted-foreground">You are currently offline.</p> </> )} <div className="flex items-center space-x-2 pt-1"> <Switch id="driver-online-toggle" checked={isDriverOnline} onCheckedChange={setIsDriverOnline} aria-label="Toggle driver online status" className={cn(!isDriverOnline && "data-[state=unchecked]:bg-red-600 data-[state=unchecked]:border-red-700")} /> <Label htmlFor="driver-online-toggle" className={cn("text-sm font-medium", isDriverOnline ? 'text-green-600' : 'text-red-600')} > {isDriverOnline ? "Online" : "Offline"} </Label> </div> {isDriverOnline && ( <Button variant="outline" size="sm" onClick={handleSimulateOffer} className="mt-2 text-xs h-8 px-3 py-1" > Simulate Incoming Ride Offer (Test) </Button> )} </CardContent> </Card> <RideOfferModal isOpen={isOfferModalOpen} onClose={() => { setIsOfferModalOpen(false); setCurrentOfferDetails(null); }} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} rideDetails={currentOfferDetails} /> <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => { setShowCancelConfirmationDialog(isOpen); if (!isOpen && activeRide && isCancelSwitchOn) { setIsCancelSwitchOn(false); }}}> <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>Are you sure you want to cancel this ride?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. The passenger will be notified. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel onClick={() => { setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}} disabled={activeRide ? actionLoading[activeRide.id] : false}>Keep Ride</AlertDialogCancel> <AlertDialogAction onClick={() => { if (activeRide) { handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }} disabled={activeRide ? actionLoading[activeRide.id] : false} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" > <span className="flex items-center justify-center">{(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel</span> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent> </AlertDialog> </div> );
}
    
  


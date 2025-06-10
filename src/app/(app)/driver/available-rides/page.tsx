
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2, Building, Car as CarIcon, Power, AlertTriangle, DollarSign as DollarSignIcon, MessageCircle as ChatIcon, Briefcase, CreditCard, Coins, Timer, UserX, RefreshCw, Crown, ShieldX, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, UserRole } from '@/contexts/auth-context';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface ActiveRide {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: Array<LocationPoint>;
  estimatedTime?: string;
  fareEstimate: number;
  priorityFeeAmount?: number;
  isPriorityPickup?: boolean;
  status: string; 
  pickupCoords?: { lat: number; lng: number };
  dropoffCoords?: { lat: number; lng: number };
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
  driverId?: string;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  vehicleType?: string;
  isSurgeApplied?: boolean;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  driverVehicleDetails?: string;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  dispatchMethod?: RideOffer['dispatchMethod'];
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

const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;
const STATIONARY_REMINDER_TIMEOUT_MS = 60000; 
const MOVEMENT_THRESHOLD_METERS = 50; 


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

function getDistanceBetweenPointsInMeters(
  coord1: google.maps.LatLngLiteral | null,
  coord2: google.maps.LatLngLiteral | null
): number {
  if (!coord1 || !coord2) return Infinity;

  const R = 6371e3; 
  const lat1Rad = coord1.lat * Math.PI / 180;
  const lat2Rad = coord2.lat * Math.PI / 180;
  const deltaLatRad = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLonRad = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideOffer[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { user: driverUser } = useAuth();
  const router = useRouter();
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

  const [isSosDialogOpen, setIsSosDialogOpen] = useState(false);
  const [isConfirmEmergencyOpen, setIsConfirmEmergencyOpen] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const rideRefreshIntervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const driverLocationAtAcceptanceRef = useRef<google.maps.LatLngLiteral | null>(null);
  const stationaryReminderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isStationaryReminderVisible, setIsStationaryReminderVisible] = useState(false);
  
  const [consecutiveMissedOffers, setConsecutiveMissedOffers] = useState(0);
  const MAX_CONSECUTIVE_MISSED_OFFERS = 3;


  const playBeep = useCallback(() => {
    if (!audioCtxRef.current) {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else {
        toast({ title: "Audio Error", description: "Web Audio API not supported.", variant: "destructive" });
        return;
      }
    }
    if (!audioCtxRef.current) return;

    const oscillator = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtxRef.current.currentTime); 
    gainNode.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.5); 
    oscillator.start();
    oscillator.stop(audioCtxRef.current.currentTime + 0.5);
  }, [toast]);


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

  const fetchActiveRide = useCallback(async () => {
    if (!driverUser?.id) {
      setIsLoading(false);
      return;
    }
    if (!activeRide && !error) setIsLoading(true); 

    try {
      const response = await fetch(`/api/driver/active-ride?driverId=${driverUser.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to fetch active ride: ${response.status}` }));
        throw new Error(errorData.details || errorData.message || `HTTP error ${response.status}`);
      }
      const data: ActiveRide | null = await response.json();
      setActiveRide(data); 
      if (data?.driverCurrentLocation) { 
        setDriverLocation(data.driverCurrentLocation);
      } else if (data?.pickupLocation) {
        setDriverLocation({ lat: data.pickupLocation.latitude, lng: data.pickupLocation.longitude });
      }
      if (data && error) setError(null); 
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error fetching active ride.";
      console.error("Error in fetchActiveRide:", message);
      if (!activeRide) setError(message); 
    } finally {
      if (!activeRide) setIsLoading(false);
    }
  }, [driverUser?.id, activeRide, error, toast]); 

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

        if (!ackTime) {
          if (secondsSinceNotified < ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER) {
            setAckWindowSecondsLeft(ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER - secondsSinceNotified);
            setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_DRIVER);
            setExtraWaitingSeconds(null);
            setCurrentWaitingCharge(0);
          } else {
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
        } else {
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


 useEffect(() => {
    if (rideRefreshIntervalIdRef.current) {
      clearInterval(rideRefreshIntervalIdRef.current);
      rideRefreshIntervalIdRef.current = null;
    }
    if (driverUser && isPollingEnabled) {
      console.log("POLLING EFFECT: Polling enabled, fetching active ride and starting interval.");
      fetchActiveRide(); 
      rideRefreshIntervalIdRef.current = setInterval(fetchActiveRide, 30000);
    } else {
      console.log("POLLING EFFECT: Polling disabled or no driver user.");
    }
    return () => {
      if (rideRefreshIntervalIdRef.current) {
        console.log("POLLING EFFECT: Clearing interval on cleanup.");
        clearInterval(rideRefreshIntervalIdRef.current);
        rideRefreshIntervalIdRef.current = null;
      }
    };
  }, [driverUser, fetchActiveRide, isPollingEnabled]);


  useEffect(() => {
    if (activeRide && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup')) {
      const interval = setInterval(() => {
        setActiveRide(prev => {
          if (!prev) return null;
          let newEta = prev.driverEtaMinutes ? Math.max(0, prev.driverEtaMinutes - 1) : (Math.floor(Math.random() * 5) + 2);
          if (prev.status === 'arrived_at_pickup') newEta = 0;
          return { ...prev, driverEtaMinutes: newEta };
        });
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeRide]);

  useEffect(() => {
    const clearStationaryLogic = () => {
      if (stationaryReminderTimerRef.current) {
        clearTimeout(stationaryReminderTimerRef.current);
        stationaryReminderTimerRef.current = null;
      }
      setIsStationaryReminderVisible(false);
      driverLocationAtAcceptanceRef.current = null;
    };

    if (activeRide && activeRide.status === 'driver_assigned') {
      if (!driverLocationAtAcceptanceRef.current && driverLocation) {
        console.log("Driver assigned: Setting initial location for stationary check and starting timer.");
        driverLocationAtAcceptanceRef.current = driverLocation;

        if (stationaryReminderTimerRef.current) clearTimeout(stationaryReminderTimerRef.current);
        stationaryReminderTimerRef.current = setTimeout(() => {
          if (activeRide && activeRide.status === 'driver_assigned' && driverLocationAtAcceptanceRef.current && driverLocation) {
            const distanceMoved = getDistanceBetweenPointsInMeters(driverLocationAtAcceptanceRef.current, driverLocation);
            console.log(`Stationary check: Distance moved since acceptance: ${distanceMoved}m`);
            if (distanceMoved < MOVEMENT_THRESHOLD_METERS) {
              setIsStationaryReminderVisible(true);
            } else {
              clearStationaryLogic(); 
            }
          }
          stationaryReminderTimerRef.current = null; 
        }, STATIONARY_REMINDER_TIMEOUT_MS);
      } else if (driverLocationAtAcceptanceRef.current && driverLocation) {
        const distanceMoved = getDistanceBetweenPointsInMeters(driverLocationAtAcceptanceRef.current, driverLocation);
        if (distanceMoved >= MOVEMENT_THRESHOLD_METERS) {
          console.log("Driver moved significantly. Clearing stationary reminder.");
          clearStationaryLogic();
        }
      }
    } else {
      clearStationaryLogic();
    }
    return () => { 
      clearStationaryLogic();
    };
  }, [activeRide, driverLocation]);


  const handleSimulateOffer = () => {
    const randomScenario = Math.random();
    let mockOffer: RideOffer;
    const distance = parseFloat((Math.random() * 10 + 2).toFixed(1));
    const paymentMethod: 'card' | 'cash' = Math.random() < 0.5 ? 'card' : 'cash';
    const isPriority = Math.random() < 0.4;
    const priorityFee = isPriority ? parseFloat((Math.random() * 3 + 1).toFixed(2)) : undefined;
    const dispatchMethods: RideOffer['dispatchMethod'][] = ['auto_system', 'manual_operator', 'priority_override'];
    const randomDispatchMethod = dispatchMethods[Math.floor(Math.random() * dispatchMethods.length)];


    if (randomScenario < 0.33 && currentDriverOperatorPrefix) {
      const mismatchedOperatorId = currentDriverOperatorPrefix === "OP001" ? "OP002" : "OP001";
      mockOffer = { id: `mock-offer-mismatch-${Date.now()}`, pickupLocation: "Tech Park Canteen, Leeds LS1 1AA", pickupCoords: { lat: 53.7986, lng: -1.5492 }, dropoffLocation: "Art Gallery, The Headrow, Leeds LS1 3AA", dropoffCoords: { lat: 53.8008, lng: -1.5472 }, fareEstimate: 9.00, passengerCount: 1, passengerName: "Mike Misken", notes: "Waiting by the main entrance, blue jacket.", requiredOperatorId: mismatchedOperatorId, distanceMiles: distance, paymentMethod: paymentMethod, passengerId: `pass-mismatch-${Date.now()}`, isPriorityPickup: isPriority, priorityFeeAmount: priorityFee, dispatchMethod: randomDispatchMethod };
    } else if (randomScenario < 0.66 && currentDriverOperatorPrefix) {
      mockOffer = { id: `mock-offer-match-${Date.now()}`, pickupLocation: "Huddersfield Station, HD1 1JB", pickupCoords: { lat: 53.6488, lng: -1.7805 }, dropoffLocation: "University of Huddersfield, Queensgate, HD1 3DH", dropoffCoords: { lat: 53.6430, lng: -1.7797 }, fareEstimate: 6.50, passengerCount: 2, passengerName: "Alice Matching", notes: "2 small bags.", requiredOperatorId: currentDriverOperatorPrefix, distanceMiles: distance, paymentMethod: paymentMethod, passengerId: `pass-match-${Date.now()}`, isPriorityPickup: isPriority, priorityFeeAmount: priorityFee, dispatchMethod: randomDispatchMethod };
    } else {
      mockOffer = { id: `mock-offer-general-${Date.now()}`, pickupLocation: "Kingsgate Shopping Centre, Huddersfield HD1 2QB", pickupCoords: { lat: 53.6455, lng: -1.7850 }, dropoffLocation: "Greenhead Park, Huddersfield HD1 4HS", dropoffCoords: { lat: 53.6520, lng: -1.7960 }, fareEstimate: 7.50, passengerCount: 1, passengerName: "Gary General", notes: "Please call on arrival.", distanceMiles: distance, paymentMethod: paymentMethod, passengerId: `pass-general-${Date.now()}`, isPriorityPickup: isPriority, priorityFeeAmount: priorityFee, dispatchMethod: randomDispatchMethod };
    }

    if (mockOffer.requiredOperatorId && currentDriverOperatorPrefix && mockOffer.requiredOperatorId !== currentDriverOperatorPrefix) {
      toast({ title: "Offer Skipped", description: `An offer restricted to ${mockOffer.requiredOperatorId} was received, but it's not for your operator group (${currentDriverOperatorPrefix}).`, variant: "default", duration: 7000, }); return;
    }
    if (mockOffer.requiredOperatorId && !currentDriverOperatorPrefix) { toast({ title: "Offer Skipped", description: `An offer restricted to ${mockOffer.requiredOperatorId} was received, but your operator details are not clear.`, variant: "default", duration: 7000, }); return; }

    setCurrentOfferDetails(mockOffer); setIsOfferModalOpen(true);
  };

  const handleAcceptOffer = async (rideId: string) => {
    setIsPollingEnabled(false); 
    if (rideRefreshIntervalIdRef.current) {
      clearInterval(rideRefreshIntervalIdRef.current);
      rideRefreshIntervalIdRef.current = null;
    }
    setConsecutiveMissedOffers(0); // Reset missed offers on acceptance

    setIsOfferModalOpen(false);
    const offerToAccept = currentOfferDetails;
    setCurrentOfferDetails(null);

    if (!offerToAccept || !driverUser) {
      toast({title: "Error Accepting Ride", description: "Offer details or driver session missing.", variant: "destructive"});
      setIsPollingEnabled(true); 
      return;
    }
    
    setActionLoading(prev => ({ ...prev, [offerToAccept.id]: true }));
    try {
      const updatePayload: any = {
        driverId: driverUser.id,
        driverName: driverUser.name || "Driver",
        status: 'driver_assigned',
        vehicleType: driverUser.vehicleCategory || 'Car',
        driverVehicleDetails: `${driverUser.vehicleCategory || 'Car'} - ${driverUser.customId || 'MOCKREG'}`,
        offerDetails: { ...offerToAccept }, 
        isPriorityPickup: offerToAccept.isPriorityPickup,
        priorityFeeAmount: offerToAccept.priorityFeeAmount,
        dispatchMethod: offerToAccept.dispatchMethod,
      };

      const response = await fetch(`/api/operator/bookings/${offerToAccept.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      let updatedBookingDataFromServer;
      if (response.ok) {
        updatedBookingDataFromServer = await response.json();
        if (!updatedBookingDataFromServer || !updatedBookingDataFromServer.booking) {
            throw new Error("Server returned success but booking data was missing in response.");
        }
      } else {
        const clonedResponse = response.clone();
        let errorDetailsText = `Server responded with status: ${response.status}.`;
        try {
            const errorDataJson = await response.json();
            errorDetailsText = errorDataJson.message || errorDataJson.details || JSON.stringify(errorDataJson);
        } catch (jsonParseError) {
            try {
                const rawResponseText = await clonedResponse.text();
                errorDetailsText += ` Non-JSON response from server. Response text: ${rawResponseText.substring(0, 200)}${rawResponseText.length > 200 ? '...' : ''}`;
                console.error("Raw non-JSON server response from handleAcceptOffer:", rawResponseText);
            } catch (textReadError) {
                errorDetailsText += " Additionally, failed to read response body as text.";
                console.error("Failed to read response body as text after JSON parse failed:", textReadError);
            }
        }
        throw new Error(errorDetailsText);
      }
      
      const serverBooking = updatedBookingDataFromServer.booking;
      const newActiveRideFromServer: ActiveRide = {
        id: serverBooking.id, 
        passengerId: serverBooking.passengerId,
        passengerName: serverBooking.passengerName,
        passengerAvatar: serverBooking.passengerAvatar,
        pickupLocation: serverBooking.pickupLocation,
        dropoffLocation: serverBooking.dropoffLocation,
        stops: serverBooking.stops,
        fareEstimate: serverBooking.fareEstimate,
        passengerCount: serverBooking.passengers, 
        status: serverBooking.status, 
        driverId: serverBooking.driverId,
        driverVehicleDetails: serverBooking.driverVehicleDetails,
        notes: serverBooking.driverNotes || serverBooking.notes,
        paymentMethod: serverBooking.paymentMethod,
        requiredOperatorId: serverBooking.requiredOperatorId,
        isPriorityPickup: serverBooking.isPriorityPickup,
        priorityFeeAmount: serverBooking.priorityFeeAmount,
        vehicleType: serverBooking.vehicleType,
        dispatchMethod: serverBooking.dispatchMethod,
        bookingTimestamp: serverBooking.bookingTimestamp, 
        scheduledPickupAt: serverBooking.scheduledPickupAt, 
        notifiedPassengerArrivalTimestamp: serverBooking.notifiedPassengerArrivalTimestamp, 
        passengerAcknowledgedArrivalTimestamp: serverBooking.passengerAcknowledgedArrivalTimestamp, 
        rideStartedAt: serverBooking.rideStartedAt, 
        driverCurrentLocation: serverBooking.driverCurrentLocation,
        driverEtaMinutes: serverBooking.driverEtaMinutes,
        waitAndReturn: serverBooking.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: serverBooking.estimatedAdditionalWaitTimeMinutes,
      };
      
      setActiveRide(newActiveRideFromServer);
      setRideRequests([]);

      let toastDesc = `En Route to Pickup for ${newActiveRideFromServer.passengerName}. Payment: ${newActiveRideFromServer.paymentMethod === 'card' ? 'Card' : 'Cash'}.`;
      if (newActiveRideFromServer.isPriorityPickup && newActiveRideFromServer.priorityFeeAmount) {
        toastDesc += ` Priority: +£${newActiveRideFromServer.priorityFeeAmount.toFixed(2)}.`;
      }
      if (newActiveRideFromServer.dispatchMethod) {
        toastDesc += ` Dispatched: ${newActiveRideFromServer.dispatchMethod.replace(/_/g, ' ')}.`;
      }
      toast({title: "Ride Accepted!", description: toastDesc});
      
    } catch(error) {
      console.error("Error in handleAcceptOffer process:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred while trying to accept the ride.";
      toast({title: "Acceptance Process Failed", description: message, variant: "destructive"});
      setIsPollingEnabled(true); 
    } finally {
      setActionLoading(prev => ({ ...prev, [offerToAccept.id]: false }));
    }
  };


  const handleDeclineOffer = (rideId: string) => {
    const offerThatWasDeclined = currentOfferDetails; 
    setIsOfferModalOpen(false);
    setCurrentOfferDetails(null);

    const newMissedCount = consecutiveMissedOffers + 1;
    setConsecutiveMissedOffers(newMissedCount);

    if (newMissedCount >= MAX_CONSECUTIVE_MISSED_OFFERS) {
        setIsDriverOnline(false);
        // In a real app, also call: updateDriverStatusInBackend(driverUser?.id, false);
        toast({
            title: "Automatically Set Offline",
            description: `You've missed ${MAX_CONSECUTIVE_MISSED_OFFERS} consecutive offers and have been set to Offline. You can go online again manually.`,
            variant: "default",
            duration: 8000,
        });
        setConsecutiveMissedOffers(0); // Reset for the next time they go online
    } else {
        const passengerName = offerThatWasDeclined?.passengerName || 'the passenger';
        toast({
            title: "Ride Offer Declined",
            description: `You declined the offer for ${passengerName}. (${newMissedCount}/${MAX_CONSECUTIVE_MISSED_OFFERS} consecutive before auto-offline).`
        });
    }
  };

 const handleRideAction = async (rideId: string, actionType: 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active' | 'accept_wait_and_return' | 'decline_wait_and_return') => {
    if (!driverUser || !activeRide) { toast({ title: "Error", description: "No active ride or driver session.", variant: "destructive"}); return; }

    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    let toastMessage = ""; let toastTitle = "";
    let payload: any = { action: actionType };

    switch(actionType) {
        case 'notify_arrival':
            toastTitle = "Passenger Notified"; toastMessage = `Passenger ${activeRide.passengerName} has been notified of your arrival.`;
            payload.notifiedPassengerArrivalTimestamp = true; 
            break;
        case 'start_ride':
            toastTitle = "Ride Started"; toastMessage = `Ride with ${activeRide.passengerName} is now in progress.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null);
            setAckWindowSecondsLeft(null);
            payload.rideStartedAt = true; 
            break;
        case 'complete_ride':
            const baseFare = activeRide.fareEstimate || 0;
            const priorityFee = activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0;
            const finalFare = baseFare + priorityFee + currentWaitingCharge;

            toastTitle = "Ride Completed";
            toastMessage = `Ride with ${activeRide.passengerName} marked as completed. Final fare (incl. priority & waiting): £${finalFare.toFixed(2)}.`;

            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            payload.finalFare = finalFare;
            payload.completedAt = true; 
            break;
        case 'cancel_active':
            toastTitle = "Ride Cancelled By You"; toastMessage = `Active ride with ${activeRide.passengerName} cancelled.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setAckWindowSecondsLeft(null);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
            break;
        case 'accept_wait_and_return':
            toastTitle = "Wait & Return Accepted"; toastMessage = `Wait & Return for ${activeRide.passengerName} has been activated.`;
            payload.waitAndReturn = true; 
            payload.status = 'in_progress_wait_and_return';
            break;
        case 'decline_wait_and_return':
            toastTitle = "Wait & Return Declined"; toastMessage = `Wait & Return for ${activeRide.passengerName} has been declined. Ride continues as normal.`;
            payload.status = 'in_progress'; 
            payload.waitAndReturn = false; 
            payload.estimatedAdditionalWaitTimeMinutes = null; 
            break;
    }

    try {
      const response = await fetch(`/api/operator/bookings/${rideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessageFromServer = `Action failed with status: ${response.status}`;
        const errorDetailsText = await response.text();
        try {
          const errorDataJson = JSON.parse(errorDetailsText);
          errorMessageFromServer = errorDataJson.message || errorDataJson.details || JSON.stringify(errorDataJson);
        } catch (jsonParseError) {
          console.error("Server returned non-JSON error response. Body:", errorDetailsText.substring(0, 500));
          if (errorDetailsText.toLowerCase().includes("<!doctype html")) {
            errorMessageFromServer = `Server returned an HTML error page (Status: ${response.status}). Check server logs for more details.`;
          } else {
            errorMessageFromServer = `Server error (Status: ${response.status}): ${errorDetailsText.substring(0, 100)}${errorDetailsText.length > 100 ? '...' : ''}`;
          }
        }
        throw new Error(errorMessageFromServer);
      }

      const updatedBookingFromServer = await response.json();

      setActiveRide(prev => {
        if (!prev) return null;
        const serverData = updatedBookingFromServer.booking;
        return {
          ...prev,
          status: serverData.status || prev.status,
          notifiedPassengerArrivalTimestamp: serverData.notifiedPassengerArrivalTimestamp,
          passengerAcknowledgedArrivalTimestamp: serverData.passengerAcknowledgedArrivalTimestamp,
          rideStartedAt: serverData.rideStartedAt,
          completedAt: serverData.completedAt,
          fareEstimate: actionType === 'complete_ride' && payload.finalFare !== undefined ? payload.finalFare : (serverData.fareEstimate ?? prev.fareEstimate),
          waitAndReturn: serverData.waitAndReturn ?? prev.waitAndReturn,
          estimatedAdditionalWaitTimeMinutes: serverData.estimatedAdditionalWaitTimeMinutes ?? prev.estimatedAdditionalWaitTimeMinutes,
          isPriorityPickup: serverData.isPriorityPickup ?? prev.isPriorityPickup,
          priorityFeeAmount: serverData.priorityFeeAmount ?? prev.priorityFeeAmount,
        };
      });

      toast({ title: toastTitle, description: toastMessage });
      if (actionType === 'cancel_active' || actionType === 'complete_ride') {
        setActiveRide(null);
        setIsPollingEnabled(true);
      }

    } catch(err) {
      const message = err instanceof Error ? err.message : "Unknown error processing ride action.";
      toast({ title: "Action Failed", description: message, variant: "destructive" });
      fetchActiveRide();
      setIsPollingEnabled(true);
    } finally {
      setActionLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };

  const memoizedMapMarkers = useMemo(() => {
    if (!activeRide) return [];
    const markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    if (activeRide.driverCurrentLocation) { 
        markers.push({ position: activeRide.driverCurrentLocation, title: "Your Current Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: {width: 24, height: 24} });
    } else { 
        markers.push({ position: driverLocation, title: "Your Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: {width: 24, height: 24} });
    }
    if (activeRide.pickupLocation) { markers.push({ position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude}, title: `Pickup: ${activeRide.pickupLocation.address}`, label: { text: "P", color: "white", fontWeight: "bold"} }); }
    if ((activeRide.status.toLowerCase().includes('in_progress') || activeRide.status === 'completed') && activeRide.dropoffLocation) { markers.push({ position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude}, title: `Dropoff: ${activeRide.dropoffLocation.address}`, label: { text: "D", color: "white", fontWeight: "bold" } }); }
    activeRide.stops?.forEach((stop, index) => { if(stop.latitude && stop.longitude) { markers.push({ position: {lat: stop.latitude, lng: stop.longitude}, title: `Stop ${index+1}: ${stop.address}`, label: { text: `S${index+1}`, color: "white", fontWeight: "bold" } }); } });
    return markers;
  }, [activeRide, driverLocation]);

  const memoizedMapCenter = useMemo(() => {
    if (activeRide?.driverCurrentLocation) return activeRide.driverCurrentLocation;
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status.toLowerCase().includes('in_progress') && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    if (activeRide?.status === 'completed' && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    return driverLocation;
  }, [activeRide, driverLocation]);

  const handleCancelSwitchChange = (checked: boolean) => { setIsCancelSwitchOn(checked); if (checked) { setShowCancelConfirmationDialog(true); } };

  const handleBlockPassenger = async () => {
    if (!driverUser || !activeRide || !activeRide.passengerId || !activeRide.passengerName) {
      toast({ title: "Cannot Block", description: "Passenger information is missing for this ride.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [`block-p-${activeRide.passengerId}`]: true }));
    try {
      const response = await fetch('/api/users/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerId: driverUser.id,
          blockedId: activeRide.passengerId,
          blockerRole: 'driver',
          blockedRole: 'passenger',
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to block passenger. Status: ${response.status}`);
      }
      toast({ title: "Passenger Blocked", description: `${activeRide.passengerName} has been added to your block list.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while blocking passenger.";
      toast({ title: "Blocking Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`block-p-${activeRide.passengerId}`]: false }));
    }
  };

  const CancelRideInteraction = ({ ride, isLoading: actionIsLoadingProp }: { ride: ActiveRide, isLoading: boolean }) => (
    <div className="flex items-center justify-between space-x-2 bg-destructive/10 p-3 rounded-md mt-3">
      <Label htmlFor={`cancel-ride-switch-${ride.id}`} className="text-destructive font-medium text-sm">
        <span>Initiate Cancellation</span>
      </Label>
      <Switch id={`cancel-ride-switch-${ride.id}`} checked={isCancelSwitchOn} onCheckedChange={handleCancelSwitchChange} disabled={actionIsLoadingProp} className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted shrink-0" />
    </div>
  );

  const handleConfirmEmergency = () => {
    toast({ title: "EMERGENCY ALERT SENT!", description: "Your operator has been notified of an emergency. Stay safe.", variant: "destructive", duration: 10000 });
    playBeep();
    setIsConfirmEmergencyOpen(false); 
    setIsSosDialogOpen(false); 
  };

  const handleToggleOnlineStatus = (newOnlineStatus: boolean) => {
    setIsDriverOnline(newOnlineStatus);
    if (newOnlineStatus) { // If toggling TO online
        setConsecutiveMissedOffers(0); // Reset miss count
        if (geolocationError) {
            setGeolocationError(null); 
            // Geolocation watch will be re-attempted by its own useEffect
        }
        // Start polling for active ride / offers if not already
        setIsPollingEnabled(true);
    } else { // If toggling TO offline manually
        setRideRequests([]); 
        setIsPollingEnabled(false); 
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }
    // In a real app, you'd also update the driver's status on the backend
    // e.g., updateDriverBackendStatus(driverUser?.id, newOnlineStatus);
  };


  if (isLoading && !activeRide) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (error && !activeRide) {
    return <div className="flex flex-col justify-center items-center h-full text-center p-4">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg font-semibold text-destructive">Error Loading Ride Data</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchActiveRide} variant="outline">Try Again</Button>
    </div>;
  }


  if (activeRide) {
    const showDriverAssignedStatus = activeRide.status === 'driver_assigned';
    const showArrivedAtPickupStatus = activeRide.status === 'arrived_at_pickup';
    const showInProgressStatus = activeRide.status.toLowerCase().includes('in_progress') && !activeRide.status.toLowerCase().includes('wait_and_return');
    const showPendingWRApprovalStatus = activeRide.status === 'pending_driver_wait_and_return_approval';
    const showInProgressWRStatus = activeRide.status === 'in_progress_wait_and_return';
    const showCompletedStatus = activeRide.status === 'completed';
    const showCancelledByDriverStatus = activeRide.status === 'cancelled_by_driver';

    const baseFare = activeRide.fareEstimate || 0;
    const priorityFee = activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0;
    let totalCalculatedFare = baseFare + priorityFee + currentWaitingCharge;

    let displayedFare = `£${totalCalculatedFare.toFixed(2)}`;
    if (activeRide.isPriorityPickup && activeRide.priorityFeeAmount) {
        displayedFare = `£${totalCalculatedFare.toFixed(2)} (Base: £${baseFare.toFixed(2)} + Prio: £${priorityFee.toFixed(2)} + Wait: £${currentWaitingCharge.toFixed(2)})`;
    } else if (currentWaitingCharge > 0) {
        displayedFare = `£${totalCalculatedFare.toFixed(2)} (incl. £${currentWaitingCharge.toFixed(2)} wait)`;
    }


    if (activeRide.waitAndReturn && activeRide.status === 'in_progress_wait_and_return' && activeRide.estimatedAdditionalWaitTimeMinutes !== undefined) {
        const waitingChargeForDisplay = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * WAITING_CHARGE_PER_MINUTE_DRIVER;
        const wrBaseWithPriority = (baseFare + priorityFee) * 1.70; 
        totalCalculatedFare = wrBaseWithPriority + waitingChargeForDisplay;
        displayedFare = `£${totalCalculatedFare.toFixed(2)} (W&R: Base £${baseFare.toFixed(2)} + Prio £${priorityFee.toFixed(2)} + Wait £${waitingChargeForDisplay.toFixed(2)})`;
    }


    return (
      <div className="flex flex-col h-full">
        {(!showCompletedStatus && !showCancelledByDriverStatus && ( 
        <div className="h-[calc(60%-0.5rem)] w-full rounded-b-xl overflow-hidden shadow-lg border-b relative"> 
            <GoogleMapDisplay center={memoizedMapCenter} zoom={14} markers={memoizedMapMarkers} className="w-full h-full" disableDefaultUI={true} fitBoundsToMarkers={true} />
            <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute bottom-4 right-4 rounded-full h-12 w-12 shadow-lg z-20 animate-pulse"
                  onClick={() => setIsSosDialogOpen(true)}
                  aria-label="SOS Panic Button"
                >
                  <ShieldAlert className="h-6 w-6" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-destructive"/>SOS - Request Assistance</AlertDialogTitle>
                  <AlertDialogDescription>
                    Select the type of assistance needed. Your current location will be shared with your operator.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setIsSosDialogOpen(false); 
                      setIsConfirmEmergencyOpen(true); 
                    }}
                  >
                    Emergency (Alert & Sound)
                  </Button>
                <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                    toast({ title: "Breakdown Reported", description: "Operator notified of vehicle breakdown." });
                    setIsSosDialogOpen(false);
                }}
                >
                Vehicle Breakdown
                </Button>
                <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                    toast({ title: "Callback Requested", description: "Operator has been asked to call you back." });
                    setIsSosDialogOpen(false);
                }}
                >
                Request Operator Callback
                </Button>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsSosDialogOpen(false)}>Cancel SOS</AlertDialogCancel>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
        <AlertDialog open={isConfirmEmergencyOpen} onOpenChange={setIsConfirmEmergencyOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" /> Confirm EMERGENCY?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will immediately alert your operator. Proceed with caution.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsConfirmEmergencyOpen(false)}>No, Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmEmergency} className="bg-destructive hover:bg-destructive/90">
                        Yes, Confirm Emergency!
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </div> 
        ))}
        <Card className={cn( "flex-1 flex flex-col rounded-t-xl z-10 shadow-[-4px_0px_15px_rgba(0,0,0,0.1)] border-t-4 border-primary bg-card overflow-hidden", (showCompletedStatus || showCancelledByDriverStatus) ? "mt-0 rounded-b-xl" : "-mt-3" )}>
           <CardContent className="p-3 space-y-2 flex-1 overflow-y-auto">
            {showDriverAssignedStatus && ( <div className="flex justify-center mb-2"> <Badge variant="secondary" className="text-sm w-fit mx-auto bg-sky-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> En Route to Pickup </Badge> </div> )}
            {showArrivedAtPickupStatus && ( <div className="flex justify-center mb-2"> <Badge variant="outline" className="text-sm w-fit mx-auto border-blue-500 text-blue-500 py-1.5 px-4 rounded-md font-semibold shadow-md"> Arrived At Pickup </Badge> </div> )}
            {showInProgressStatus && ( <div className="flex justify-center mb-2"> <Badge variant="default" className="text-sm w-fit mx-auto bg-green-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> Ride In Progress </Badge> </div> )}
            {showPendingWRApprovalStatus && ( <div className="flex justify-center mb-2"> <Badge variant="secondary" className="text-sm w-fit mx-auto bg-purple-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> W&R Request Pending </Badge> </div> )}
            {showInProgressWRStatus && ( <div className="flex justify-center mb-2"> <Badge variant="default" className="text-sm w-fit mx-auto bg-teal-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> Ride In Progress (W&R) </Badge> </div> )}
            {showCompletedStatus && ( <div className="flex justify-center my-4"> <Badge variant="default" className="text-lg w-fit mx-auto bg-primary text-primary-foreground py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <CheckCircle className="w-6 h-6" /> Ride Completed </Badge> </div> )}
            {showCancelledByDriverStatus && ( <div className="flex justify-center my-4"> <Badge variant="destructive" className="text-lg w-fit mx-auto py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <XCircle className="w-6 h-6" /> Ride Cancelled by You </Badge> </div> )}

            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
              <Avatar className="h-12 w-12"> <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/48x48.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/> <AvatarFallback>{activeRide.passengerName.charAt(0)}</AvatarFallback> </Avatar>
              <div className="flex-1"> <p className="font-semibold text-base">{activeRide.passengerName}</p> {activeRide.passengerRating && ( <div className="flex items-center"> {[...Array(5)].map((_, i) => <Star key={i} className={cn("w-3.5 h-3.5", i < Math.round(activeRide.passengerRating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />)} <span className="ml-1 text-xs text-muted-foreground">({activeRide.passengerRating.toFixed(1)})</span> </div> )} </div>
              {(!showCompletedStatus && !showCancelledByDriverStatus) && (
                <Button asChild variant="outline" size="icon" className="h-9 w-9">
                    <Link href="/driver/chat"><ChatIcon className="w-4 h-4" /></Link>
                </Button>
               )}
            </div>
            {activeRide.isPriorityPickup && (
                <Alert variant="default" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 my-1">
                    <Crown className="h-5 w-5" />
                    <ShadAlertTitle className="font-semibold">Priority Booking!</ShadAlertTitle>
                    <ShadAlertDescription>
                        Passenger offered an extra <strong>£{(activeRide.priorityFeeAmount || 0).toFixed(2)}</strong> for priority.
                    </ShadAlertDescription>
                </Alert>
            )}
            {activeRide.requiredOperatorId && ( <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-600 rounded-md text-center mt-1"> <p className="text-xs font-medium text-purple-600 dark:text-purple-300 flex items-center justify-center gap-1"> <Briefcase className="w-3 h-3"/> Operator Ride: {activeRide.requiredOperatorId} </p> </div> )}

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

            {showPendingWRApprovalStatus && activeRide.estimatedAdditionalWaitTimeMinutes !== undefined && (
                 <Alert variant="default" className="bg-purple-100 dark:bg-purple-800/30 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 my-1">
                    <RefreshCw className="h-5 w-5 text-current animate-spin" />
                    <ShadAlertTitle className="font-semibold text-current">Wait & Return Request</ShadAlertTitle>
                    <ShadAlertDescription className="text-current text-xs">
                        Passenger requests Wait & Return with an estimated <strong>{activeRide.estimatedAdditionalWaitTimeMinutes} minutes</strong> of waiting.
                        <br />
                        New estimated total fare (if accepted): ~£{((baseFare + priorityFee) * 1.70 + (Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * WAITING_CHARGE_PER_MINUTE_DRIVER)).toFixed(2)}.
                        <div className="flex gap-2 mt-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => handleRideAction(activeRide.id, 'accept_wait_and_return')} disabled={actionLoading[activeRide.id]}>Accept W&R</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRideAction(activeRide.id, 'decline_wait_and_return')} disabled={actionLoading[activeRide.id]}>Decline W&R</Button>
                        </div>
                    </ShadAlertDescription>
                </Alert>
            )}


            <div className="space-y-1 text-sm py-1">
                 <p className={cn("flex items-start gap-1.5", (showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60")}> <MapPin className={cn("w-4 h-4 mt-0.5 shrink-0", (showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-green-500")} /> <span><strong>Pickup:</strong> {activeRide.pickupLocation.address}</span> </p>
                 {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => ( <p key={index} className={cn("flex items-start gap-1.5 pl-5", (showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus) && "text-muted-foreground opacity-60")}> <MapPin className={cn("w-4 h-4 mt-0.5 shrink-0", (showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus) ? "text-muted-foreground" : "text-blue-500")} /> <strong>Stop {index + 1}:</strong> {stop.address} </p> ))}
                 <p className={cn("flex items-start gap-1.5", (showDriverAssignedStatus && !(showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground opacity-60")}> <MapPin className={cn("w-4 h-4 mt-0.5 shrink-0", (showDriverAssignedStatus && !(showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus)) ? "text-muted-foreground" : "text-orange-500")} /> <span className={cn((showDriverAssignedStatus && !(showInProgressStatus || showInProgressWRStatus || showCompletedStatus || showCancelledByDriverStatus)) && "text-muted-foreground")}> <strong>Dropoff:</strong> {activeRide.dropoffLocation.address} </span> </p>
                 <div className="grid grid-cols-2 gap-1 pt-1 text-sm">
                    <p className="flex items-center gap-1">
                      <DollarSignIcon className="w-4 h-4 text-muted-foreground" />
                      <strong>Fare:</strong> {displayedFare}
                    </p>
                    <p className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-muted-foreground" /> <strong>Passengers:</strong> {activeRide.passengerCount}</p>
                    {activeRide.paymentMethod && ( <p className="flex items-center gap-1 col-span-2 mt-1"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />} <strong>Payment:</strong> {activeRide.paymentMethod === 'card' ? 'Card' : 'Cash'} </p> )}
                    {activeRide.distanceMiles && ( <p className="flex items-center gap-1 col-span-2 mt-1"> <Route className="w-4 h-4 text-muted-foreground" /> <strong>Distance:</strong> ~{activeRide.distanceMiles.toFixed(1)} mi </p> )}
                 </div>
            </div>
            {activeRide.notes && !['in_progress', 'In Progress', 'completed', 'cancelled_by_driver', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase()) && ( <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md my-1"> <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap"><strong>Notes:</strong> {activeRide.notes}</p> </div> )}

             {showCompletedStatus && activeRide.passengerId && activeRide.passengerName && (
                <div className="pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={actionLoading[`block-p-${activeRide.passengerId}`]}>
                        {actionLoading[`block-p-${activeRide.passengerId}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                        Block Passenger
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle><span>Block {activeRide.passengerName}?</span></AlertDialogTitle>
                        <AlertDialogDescription>
                          <span>Are you sure you want to block this passenger? You will not be offered rides from them in the future. This action can be undone in your profile settings.</span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel><span>Cancel</span></AlertDialogCancel>
                        <AlertDialogAction onClick={handleBlockPassenger} className="bg-destructive hover:bg-destructive/90"><span>Block Passenger</span></AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

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
             {showDriverAssignedStatus && ( <> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-blue-600 hover:bg-blue-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'notify_arrival')} disabled={actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Notify Arrival </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </> )}
             {showArrivedAtPickupStatus && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-green-600 hover:bg-green-700 text-base text-white py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'start_ride')} disabled={actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Start Ride </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </div> )}
             {(showInProgressStatus || showInProgressWRStatus) && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto"> <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-primary hover:bg-primary/80 text-base text-primary-foreground py-2.5 h-auto" onClick={() => handleRideAction(activeRide.id, 'complete_ride')} disabled={actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Complete Ride </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={actionLoading[activeRide.id]} /> </div> )}
             {(showCompletedStatus || showCancelledByDriverStatus) && ( 
                <Button 
                    className="w-full bg-slate-600 hover:bg-slate-700 text-lg text-white py-3 h-auto" 
                    onClick={() => { 
                        if(showCompletedStatus && driverRatingForPassenger > 0) { 
                            console.log(`Mock: Driver rated passenger ${activeRide.passengerName} with ${driverRatingForPassenger} stars.`); 
                            toast({title: "Passenger Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${driverRatingForPassenger} stars.`}); 
                        } 
                        setDriverRatingForPassenger(0); 
                        setCurrentWaitingCharge(0); 
                        setIsCancelSwitchOn(false);
                        setActiveRide(null); 
                        setIsPollingEnabled(true);
                    }} 
                    disabled={activeRide ? actionLoading[activeRide.id] : false} 
                > 
                    {(activeRide && actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />} Done 
                </Button> 
             )}
          </CardFooter>
        </Card>
        <AlertDialog
          open={showCancelConfirmationDialog}
          onOpenChange={(isOpen) => {
              setShowCancelConfirmationDialog(isOpen);
              if (!isOpen && activeRide && isCancelSwitchOn) {
                  setIsCancelSwitchOn(false);
              }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle><span>Are you sure you want to cancel this ride?</span></AlertDialogTitle>
              <AlertDialogDescription><span>This action cannot be undone. The passenger will be notified.</span></AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => { setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}} 
                disabled={activeRide ? actionLoading[activeRide.id] : false}
              >
                <span>Keep Ride</span>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (activeRide) { handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
                disabled={!activeRide || (actionLoading[activeRide.id] || false)}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                  <span className="flex items-center justify-center">
                    {activeRide && (actionLoading[activeRide.id] || false) ? (
                       <>
                         <Loader2 className="animate-spin mr-2 h-4 w-4" />
                         <span>Cancelling...</span>
                       </>
                    ) : (
                       <>
                         <ShieldX className="mr-2 h-4 w-4" />
                         <span>Confirm Cancel</span>
                      </>
                    )}
                  </span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const mapContainerClasses = cn( "relative h-[400px] w-full rounded-xl overflow-hidden shadow-lg border-4", { 'border-border': mapBusynessLevel === 'idle', 'animate-flash-yellow-border': mapBusynessLevel === 'moderate', 'animate-flash-red-border': mapBusynessLevel === 'high', } );
  return ( <div className="flex flex-col h-full space-y-2"> 
    <div className={mapContainerClasses}> 
        <GoogleMapDisplay center={driverLocation} zoom={13} markers={[{ position: driverLocation, title: "Your Current Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: { width: 24, height: 24 } }]} className="w-full h-full" disableDefaultUI={true} />
        <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
            <AlertDialogTrigger asChild>
            <Button
                variant="destructive"
                size="icon"
                className="absolute bottom-4 right-4 rounded-full h-12 w-12 shadow-lg z-20 animate-pulse"
                onClick={() => setIsSosDialogOpen(true)}
                aria-label="SOS Panic Button"
            >
                <ShieldAlert className="h-6 w-6" />
            </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-destructive"/>SOS - Request Assistance</AlertDialogTitle>
                <AlertDialogDescription>
                Select the type of assistance needed. Your current location will be shared with your operator.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
                 <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setIsSosDialogOpen(false);
                      setIsConfirmEmergencyOpen(true);
                    }}
                  >
                    Emergency (Alert & Sound)
                  </Button>
                <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                    toast({ title: "Breakdown Reported", description: "Operator notified of vehicle breakdown." });
                    setIsSosDialogOpen(false);
                }}
                >
                Vehicle Breakdown
                </Button>
                <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                    toast({ title: "Callback Requested", description: "Operator has been asked to call you back." });
                    setIsSosDialogOpen(false);
                }}
                >
                Request Operator Callback
                </Button>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsSosDialogOpen(false)}>Cancel SOS</AlertDialogCancel>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
        <AlertDialog open={isConfirmEmergencyOpen} onOpenChange={setIsConfirmEmergencyOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" /> Confirm EMERGENCY?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will immediately alert your operator. Proceed with caution.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsConfirmEmergencyOpen(false)}>No, Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmEmergency} className="bg-destructive hover:bg-destructive/90">
                        Yes, Confirm Emergency!
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div> 
    <Card className="flex-1 flex flex-col rounded-xl shadow-lg bg-card border"> <CardHeader className={cn( "p-2 border-b text-center", isDriverOnline ? "border-green-500" : "border-red-500")}> <CardTitle className={cn( "text-lg font-semibold", isDriverOnline ? "text-green-600" : "text-red-600")}> {isDriverOnline ? "Online - Awaiting Offers" : "Offline"} </CardTitle> </CardHeader> <CardContent className="flex-1 flex flex-col items-center justify-center p-3 space-y-1"> {isDriverOnline ? ( geolocationError ? ( <div className="flex flex-col items-center text-center space-y-1 p-1 bg-destructive/10 rounded-md"> <AlertTriangle className="w-6 h-6 text-destructive" /> <p className="text-xs text-destructive">{geolocationError}</p> </div> ) : ( <> <Loader2 className="w-6 h-6 text-primary animate-spin" /> <p className="text-xs text-muted-foreground text-center">Actively searching for ride offers for you...</p> </> ) ) : ( <> <Power className="w-8 h-8 text-muted-foreground" /> <p className="text-sm text-muted-foreground">You are currently offline.</p> </>) } <div className="flex items-center space-x-2 pt-1"> <Switch id="driver-online-toggle" checked={isDriverOnline} onCheckedChange={handleToggleOnlineStatus} aria-label="Toggle driver online status" className={cn(!isDriverOnline && "data-[state=unchecked]:bg-red-600 data-[state=unchecked]:border-red-700")} /> <Label htmlFor="driver-online-toggle" className={cn("text-sm font-medium", isDriverOnline ? 'text-green-600' : 'text-red-600')} > {isDriverOnline ? "Online" : "Offline"} </Label> </div> {isDriverOnline && ( <Button variant="outline" size="sm" onClick={handleSimulateOffer} className="mt-2 text-xs h-8 px-3 py-1" > Simulate Incoming Ride Offer (Test) </Button> )} </CardContent> </Card> <RideOfferModal isOpen={isOfferModalOpen} onClose={() => { setIsOfferModalOpen(false); setCurrentOfferDetails(null); }} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} rideDetails={currentOfferDetails} />
    <AlertDialog
      open={isStationaryReminderVisible}
      onOpenChange={setIsStationaryReminderVisible}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" /> Time to Go!
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please proceed to the pickup location for {activeRide?.passengerName || 'the passenger'} at {activeRide?.pickupLocation.address || 'the specified address'}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setIsStationaryReminderVisible(false)}>
            Okay, I&apos;m Going!
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => { setShowCancelConfirmationDialog(isOpen); if (!isOpen && activeRide && isCancelSwitchOn) { setIsCancelSwitchOn(false); }}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle><span>Are you sure you want to cancel this ride?</span></AlertDialogTitle>
          <AlertDialogDescription><span>This action cannot be undone. The passenger will be notified.</span></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => { setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}} 
            disabled={activeRide ? actionLoading[activeRide.id] : false}
          >
            <span>Keep Ride</span>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (activeRide) { handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
            disabled={!activeRide || (actionLoading[activeRide.id] || false)}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <span className="flex items-center justify-center">
            {activeRide && (actionLoading[activeRide.id] || false) ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <ShieldX className="mr-2 h-4 w-4" />
            )}
            <span>
            {activeRide && (actionLoading[activeRide.id] || false)
              ? "Cancelling..."
              : "Confirm Cancel"}
            </span>
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div> );
}


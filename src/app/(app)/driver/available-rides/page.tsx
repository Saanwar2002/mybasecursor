
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Check, X, Navigation, Route, CheckCircle, XCircle, MessageSquare, Users as UsersIcon, Info, Phone, Star, BellRing, CheckCheck, Loader2, Building, Car as CarIcon, Power, AlertTriangle, DollarSign as DollarSignIcon, MessageCircle as ChatIcon, Briefcase, CreditCard, Coins, Timer, UserX, RefreshCw, Crown, ShieldX, ShieldAlert, PhoneCall, Construction, Gauge, MinusCircle, CarCrash, TrafficCone, ShieldCheck, LockKeyhole, AlertOctagon, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, UserRole, PLATFORM_OPERATOR_CODE, type User } from '@/contexts/auth-context';
import { RideOfferModal, type RideOffer } from '@/components/driver/ride-offer-modal';
import { cn } from "@/lib/utils";
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
  AlertDialogTitle as ShadAlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor, getCustomMapLabelOverlayClass, LabelType } from '@/components/ui/custom-map-label-overlay';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';


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
  passengerPhone?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: Array<LocationPoint>;
  fareEstimate: number;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  status: string;
  passengerCount: number;
  passengerRating?: number;
  driverRatingForPassenger?: number | null;
  notes?: string;
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  completedAt?: SerializedTimestamp | string | null;
  requiredOperatorId?: string;
  paymentMethod?: 'card' | 'cash' | 'account';
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
  accountJobPin?: string;
  distanceMiles?: number; 
}

interface MapHazard {
  id: string;
  hazardType: string;
  location: { latitude: number; longitude: number };
  reportedAt: string;
  status: string;
}


const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';


const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;
const STATIONARY_REMINDER_TIMEOUT_MS = 60000;
const MOVEMENT_THRESHOLD_METERS = 50;
const HAZARD_ALERT_DISTANCE_METERS = 500;
const HAZARD_ALERT_RESET_DISTANCE_METERS = 750;


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

const MOCK_HAZARDS_TO_SEED = [
  { id: 'mock-hazard-speedcam-001', hazardType: 'mobile_speed_camera', location: { latitude: 53.6450, longitude: -1.7850 } },
  { id: 'mock-hazard-roadworks-002', hazardType: 'road_works', location: { latitude: 53.6400, longitude: -1.7700 } },
  { id: 'mock-hazard-accident-003', hazardType: 'accident', location: { latitude: 53.6500, longitude: -1.7900 } },
  { id: 'mock-hazard-taxi-check-004', hazardType: 'roadside_taxi_checking', location: { latitude: 53.6488, longitude: -1.7805 } },
  { id: 'mock-hazard-traffic-005', hazardType: 'heavy_traffic', location: { latitude: 53.6430, longitude: -1.7797 } },
];

interface DispatchDisplayInfo {
  text: string;
  icon: LucideIcon;
  bgColorClassName: string;
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

  const [customMapLabel, setCustomMapLabel] = useState<{ position: google.maps.LatLngLiteral; content: string; type: LabelType } | null>(null);
  const CustomMapLabelOverlayClassRef = useRef<CustomMapLabelOverlayConstructor | null>(null);


  const [isWRRequestDialogOpen, setIsWRRequestDialogOpen] = useState(false);
  const [wrRequestDialogMinutes, setWrRequestDialogMinutes] = useState<string>("10");
  const [isRequestingWR, setIsRequestingWR] = useState(false);

  const [isHazardReportDialogOpen, setIsHazardReportDialogOpen] = useState(false);
  const [reportingHazard, setReportingHazard] = useState(false);

  const [activeMapHazards, setActiveMapHazards] = useState<MapHazard[]>([]);
  const [isLoadingHazards, setIsLoadingHazards] = useState(false);
  const hazardRefreshIntervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const [approachingHazardInfo, setApproachingHazardInfo] = useState<{ id: string, hazardType: string, reportedAt: string } | null>(null);
  const alertedForThisApproachRef = useRef<Set<string>>(new Set());

  const [isAccountPinDialogOpen, setIsAccountPinDialogOpen] = useState(false);
  const [enteredAccountPin, setEnteredAccountPin] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);


  const fetchActiveHazards = useCallback(async () => {
    if (!isDriverOnline) return;
    setIsLoadingHazards(true);
    try {
      const response = await fetch('/api/driver/map-hazards/active');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch active hazards.' }));
        throw new Error(errorData.message);
      }
      const data = await response.json();
      setActiveMapHazards(data.hazards || []);
    } catch (err: any) {
      console.warn("Error fetching active map hazards:", err);
    } finally {
      setIsLoadingHazards(false);
    }
  }, [isDriverOnline]);

  useEffect(() => {
    if (isDriverOnline) {
      fetchActiveHazards();
      hazardRefreshIntervalIdRef.current = setInterval(fetchActiveHazards, 60000);
    } else {
      if (hazardRefreshIntervalIdRef.current) {
        clearInterval(hazardRefreshIntervalIdRef.current);
        hazardRefreshIntervalIdRef.current = null;
      }
      setActiveMapHazards([]);
    }
    return () => {
      if (hazardRefreshIntervalIdRef.current) {
        clearInterval(hazardRefreshIntervalIdRef.current);
      }
    };
  }, [isDriverOnline, fetchActiveHazards]);


  useEffect(() => {
    if (activeRide) {
      let labelContent: string | null = null;
      let labelPosition: google.maps.LatLngLiteral | null = null;
      let labelType: LabelType = 'pickup';

      const pickupStreet = activeRide.pickupLocation.address.split(',')[0];
      const dropoffStreet = activeRide.dropoffLocation.address.split(',')[0];

      if (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') {
        if (activeRide.pickupLocation) {
          labelPosition = { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude };
          labelContent = `Pickup at\n${pickupStreet}`;
          labelType = 'pickup';
        }
      } else if (activeRide.status.toLowerCase().includes('in_progress')) {
        if (activeRide.dropoffLocation) {
          labelPosition = { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude };
          labelContent = `Dropoff at\n${dropoffStreet}`;
          labelType = 'dropoff';
        }
      }

      if (labelPosition && labelContent) {
        setCustomMapLabel({ position: labelPosition, content: labelContent, type: labelType });
      } else {
        setCustomMapLabel(null);
      }
    } else {
      setCustomMapLabel(null);
    }
  }, [activeRide]);

  useEffect(() => {
    if (!driverLocation || !activeMapHazards.length || !isDriverOnline) {
      if(approachingHazardInfo) setApproachingHazardInfo(null);
      return;
    }

    if (approachingHazardInfo) {
      const distanceToCurrentAlertedHazard = getDistanceBetweenPointsInMeters(driverLocation, activeMapHazards.find(h => h.id === approachingHazardInfo.id)?.location || null);
      if (distanceToCurrentAlertedHazard > HAZARD_ALERT_RESET_DISTANCE_METERS) {
        alertedForThisApproachRef.current.delete(approachingHazardInfo.id);
        setApproachingHazardInfo(null);
      }
      return;
    }

    let foundApproachingHazard = false;
    for (const hazard of activeMapHazards) {
      const distance = getDistanceBetweenPointsInMeters(driverLocation, hazard.location);

      if (distance < HAZARD_ALERT_DISTANCE_METERS && !alertedForThisApproachRef.current.has(hazard.id)) {
        setApproachingHazardInfo({ id: hazard.id, hazardType: hazard.hazardType, reportedAt: hazard.reportedAt });
        foundApproachingHazard = true;
        break;
      }
    }

    const newAlertedSet = new Set<string>();
    alertedForThisApproachRef.current.forEach(alertedId => {
      const hazard = activeMapHazards.find(h => h.id === alertedId);
      if (hazard) {
        const distance = getDistanceBetweenPointsInMeters(driverLocation, hazard.location);
        if (distance < HAZARD_ALERT_RESET_DISTANCE_METERS) {
          newAlertedSet.add(alertedId);
        }
      }
    });
    alertedForThisApproachRef.current = newAlertedSet;

  }, [driverLocation, activeMapHazards, isDriverOnline, approachingHazardInfo]);


  const handleHazardAlertResponse = async (hazardId: string, isStillPresent: boolean) => {
    console.log(`Hazard ${hazardId} response: ${isStillPresent ? 'Yes, still there' : 'No, it\'s gone'}`);

    if (!driverUser) {
      toast({ title: "Error", description: "Driver not identified for feedback.", variant: "destructive"});
      setApproachingHazardInfo(null);
      alertedForThisApproachRef.current.add(hazardId);
      return;
    }

    try {
      const response = await fetch('/api/driver/map-hazards/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          hazardId,
          driverId: driverUser.id,
          isStillPresent,
          feedbackTimestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: "Failed to submit feedback"}));
        throw new Error(errorData.message);
      }
      toast({ title: "Feedback Submitted", description: "Thank you for helping keep the map accurate!"});
      if (!isStillPresent) fetchActiveHazards();

    } catch (err: any) {
      toast({ title: "Feedback Error", description: err.message || "Could not submit feedback.", variant: "destructive"});
    } finally {
       setApproachingHazardInfo(null);
       alertedForThisApproachRef.current.add(hazardId);
    }
  };

  const seedMockHazards = async () => {
    if (!db) {
      toast({ title: "DB Error", description: "Firestore not initialized.", variant: "destructive" });
      return;
    }
    toast({ title: "Seeding...", description: "Attempting to add/update mock hazards." });
    let successCount = 0;
    let errorCount = 0;

    for (const mock of MOCK_HAZARDS_TO_SEED) {
      try {
        const hazardRef = doc(db, 'mapHazards', mock.id);
        await setDoc(hazardRef, {
          hazardType: mock.hazardType,
          location: mock.location,
          reportedByDriverId: driverUser?.id || "mock-seeder",
          reportedAt: serverTimestamp(),
          status: 'active',
          confirmations: 0,
          negations: 0,
          lastConfirmedAt: serverTimestamp(),
        }, { merge: true });
        successCount++;
      } catch (e) {
        console.error(`Failed to seed hazard ${mock.id}:`, e);
        errorCount++;
      }
    }

    if (errorCount > 0) {
      toast({ title: "Seeding Partially Failed", description: `${successCount} hazards seeded/updated. ${errorCount} failed. Check console.`, variant: "destructive" });
    } else {
      toast({ title: "Mock Hazards Seeded", description: `${successCount} hazards added or updated in Firestore.` });
    }
    fetchActiveHazards();
  };



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
          console.warn("Geolocation Error:", error.message);
          let message = "Could not get your location. Please enable location services.";
          if (error.code === error.PERMISSION_DENIED) {
            message = "Location access denied. Please enable it in your browser settings.";
            setIsDriverOnline(false);
            setIsPollingEnabled(false);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = "Location information is unavailable at the moment.";
          } else if (error.code === error.TIMEOUT) {
            message = "Getting location timed out. Please try again.";
          }
          setGeolocationError(message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (!navigator.geolocation) {
        setGeolocationError("Geolocation is not supported by your browser.");
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isDriverOnline]);

  const fetchActiveRide = useCallback(async () => {
    console.log("fetchActiveRide called. driverUser ID:", driverUser?.id);
    if (!driverUser?.id) {
      setIsLoading(false);
      return;
    }

    const initialLoad = !activeRide;
    if (initialLoad && !error) setIsLoading(true);

    try {
      const response = await fetch(`/api/driver/active-ride?driverId=${driverUser.id}`);
      console.log("fetchActiveRide response status:", response.status);
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ message: `Failed to fetch active ride: ${response.status}` })); 
        throw new Error(errorData.details || errorData.message || `HTTP error ${response.status}`); 
      }
      const data: ActiveRide | null = await response.json();
      console.log("fetchActiveRide - Data received from API:", data);
      
      setActiveRide(currentClientRide => {
        if (data === null && currentClientRide?.status === 'completed') {
          console.log("fetchActiveRide: API reports no active ride, but client has a 'completed' ride. Retaining client state for rating.");
          return currentClientRide;
        }
        if (JSON.stringify(data) !== JSON.stringify(currentClientRide)) {
            console.log("fetchActiveRide: API data differs from client, updating client state.");
            return data;
        }
        console.log("fetchActiveRide: API data matches client state, no update needed.");
        return currentClientRide;
      });

      if (data && error) setError(null); 
    } catch (err: any) { 
      const message = err instanceof Error ? err.message : "Unknown error fetching active ride."; 
      console.error("Error in fetchActiveRide:", message); 
      if (initialLoad) setError(message);
    } finally {
      if (initialLoad) setIsLoading(false);
    }
  }, [driverUser?.id, error, activeRide, toast]);


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
    if (!driverUser) {
        toast({ title: "Driver Info Missing", description: "Cannot simulate offer without driver details.", variant: "destructive" });
        return;
    }

    const operatorCode = driverUser.operatorCode || driverUser.customId || "OP_DefaultGuest";
    const acceptsPlatformJobs = driverUser.acceptsPlatformJobs || false;
    const maxDistancePref = driverUser.maxJourneyDistance || "no_limit";

    let simulatedOfferType: 'own_operator' | 'platform_op001' | 'general_pool';
    const canReceivePlatformOrGeneral = acceptsPlatformJobs || operatorCode === PLATFORM_OPERATOR_CODE;

    if (canReceivePlatformOrGeneral) {
        const rand = Math.random();
        if (rand < 0.4) simulatedOfferType = 'own_operator';
        else if (rand < 0.8) simulatedOfferType = 'platform_op001';
        else simulatedOfferType = 'general_pool';
    } else {
        simulatedOfferType = 'own_operator';
    }

    const distance = parseFloat((Math.random() * 35 + 1).toFixed(1)); 
    const paymentMethodOptions: Array<RideOffer['paymentMethod']> = ['card', 'cash', 'account'];
    const paymentMethod: RideOffer['paymentMethod'] = paymentMethodOptions[Math.floor(Math.random() * paymentMethodOptions.length)];
    const isPriority = Math.random() < 0.3;
    const priorityFee = isPriority ? parseFloat((Math.random() * 2.5 + 0.5).toFixed(2)) : undefined;
    const dispatchMethods: RideOffer['dispatchMethod'][] = ['auto_system', 'manual_operator', 'priority_override'];
    const randomDispatchMethod = dispatchMethods[Math.floor(Math.random() * dispatchMethods.length)];
    const mockPassengerId = `pass-mock-${Date.now().toString().slice(-5)}`;
    const mockPhone = `+447700900${Math.floor(Math.random() * 900) + 100}`;
    let accountJobPinForOffer: string | undefined = undefined;
    if (paymentMethod === 'account') {
      accountJobPinForOffer = Math.floor(1000 + Math.random() * 9000).toString();
    }


    let requiredOperatorIdForOffer: string | undefined = undefined;
    let passengerNameForOffer = "Simulated Passenger";
    let offerContextDescription = ""; 

    switch (simulatedOfferType) {
        case 'own_operator':
            requiredOperatorIdForOffer = operatorCode;
            passengerNameForOffer = `Passenger (for ${operatorCode})`;
            offerContextDescription = `for your operator (${operatorCode})`;
            break;
        case 'platform_op001':
            requiredOperatorIdForOffer = PLATFORM_OPERATOR_CODE;
            passengerNameForOffer = "Passenger (Platform MyBase)";
            offerContextDescription = `from MyBase platform pool (${PLATFORM_OPERATOR_CODE})`;
            break;
        case 'general_pool':
            requiredOperatorIdForOffer = undefined;
            passengerNameForOffer = "Passenger (General Pool)";
            offerContextDescription = `from the general MyBase pool`;
            break;
    }

    const mockOffer: RideOffer = {
        id: `mock-offer-${simulatedOfferType}-${Date.now()}`,
        passengerId: mockPassengerId,
        passengerName: passengerNameForOffer,
        passengerPhone: mockPhone,
        pickupLocation: "Simulated Pickup St, Townsville",
        pickupCoords: { lat: 53.6488 + (Math.random() - 0.5) * 0.02, lng: -1.7805 + (Math.random() - 0.5) * 0.02 },
        dropoffLocation: "Simulated Dropoff Ave, Cityburg",
        dropoffCoords: { lat: 53.6430 + (Math.random() - 0.5) * 0.02, lng: -1.7797 + (Math.random() - 0.5) * 0.02 },
        fareEstimate: parseFloat((Math.random() * 15 + 5).toFixed(2)),
        passengerCount: Math.floor(Math.random() * 3) + 1,
        notes: Math.random() < 0.3 ? "Simulated passenger note: please call on arrival." : undefined,
        requiredOperatorId: requiredOperatorIdForOffer,
        distanceMiles: distance,
        paymentMethod: paymentMethod,
        isPriorityPickup: isPriority,
        priorityFeeAmount: priorityFee,
        dispatchMethod: randomDispatchMethod,
        accountJobPin: accountJobPinForOffer,
    };

    let showThisOfferToDriver = false;
    if (mockOffer.requiredOperatorId === operatorCode) {
        showThisOfferToDriver = true;
    } else if ((!mockOffer.requiredOperatorId || mockOffer.requiredOperatorId === PLATFORM_OPERATOR_CODE) && canReceivePlatformOrGeneral) {
        showThisOfferToDriver = true;
    }

    let distanceLimitExceeded = false;
    if (maxDistancePref !== "no_limit") {
      const limitValue = parseInt(maxDistancePref.split('_')[1]);
      if (mockOffer.distanceMiles && mockOffer.distanceMiles > limitValue) {
        distanceLimitExceeded = true;
      }
    }

    if (showThisOfferToDriver && !distanceLimitExceeded) {
        setCurrentOfferDetails(mockOffer);
        setIsOfferModalOpen(true);
    } else {
        const currentOperatorDisplay = operatorCode || "N/A";
        let skipReason = `An offer ${offerContextDescription} was received, but your current preferences mean it wasn't shown. Your operator: ${currentOperatorDisplay}.`;
        if (distanceLimitExceeded) {
          skipReason = `An offer ${offerContextDescription} was received, but its distance of ${mockOffer.distanceMiles?.toFixed(1)} miles exceeds your preference of ${maxDistancePref.replace("_", " ")} miles.`;
        }
        toast({
            title: "Offer Skipped (Simulation)",
            description: skipReason,
            variant: "default",
            duration: 8000,
        });

        const newMissedCount = consecutiveMissedOffers + 1;
        setConsecutiveMissedOffers(newMissedCount);
        if (newMissedCount >= MAX_CONSECUTIVE_MISSED_OFFERS) {
            setIsDriverOnline(false);
            toast({
                title: "Automatically Set Offline (Simulation)",
                description: `You've missed/skipped ${MAX_CONSECUTIVE_MISSED_OFFERS} simulated offers and have been set to Offline. Please go Online manually if you wish to continue receiving offers.`,
                variant: "default",
                duration: 10000,
            });
            setConsecutiveMissedOffers(0);
        }
    }
};


  const handleAcceptOffer = async (rideId: string) => {
    console.log(`Attempting to accept offer: ${rideId}`);
    setIsPollingEnabled(false);
    if (rideRefreshIntervalIdRef.current) {
      clearInterval(rideRefreshIntervalIdRef.current);
      rideRefreshIntervalIdRef.current = null;
    }
    setConsecutiveMissedOffers(0);

    setIsOfferModalOpen(false);
    const offerToAccept = currentOfferDetails;
    setCurrentOfferDetails(null);

    if (!offerToAccept || !driverUser) {
      toast({title: "Error Accepting Ride", description: "Offer details or driver session missing.", variant: "destructive"});
      setIsPollingEnabled(true);
      return;
    }

    const currentActionRideId = offerToAccept.id;
    console.log(`Setting actionLoading for ${currentActionRideId} to true`);
    setActionLoading(prev => ({ ...prev, [currentActionRideId]: true }));
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
        driverCurrentLocation: driverLocation,
        accountJobPin: offerToAccept.accountJobPin,
      };
      console.log(`Sending accept payload for ${currentActionRideId}:`, updatePayload);

      const response = await fetch(`/api/operator/bookings/${offerToAccept.id}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      console.log(`Accept offer response status for ${currentActionRideId}: ${response.status}`);

      let updatedBookingDataFromServer;
      if (response.ok) {
        updatedBookingDataFromServer = await response.json();
        if (!updatedBookingDataFromServer || !updatedBookingDataFromServer.booking) {
            console.error(`Accept offer for ${currentActionRideId}: Server OK but booking data missing.`);
            throw new Error("Server returned success but booking data was missing in response.");
        }
        console.log(`Accept offer for ${currentActionRideId}: Server returned booking data:`, updatedBookingDataFromServer.booking);
      } else {
        const clonedResponse = response.clone();
        let errorDetailsText = `Server responded with status: ${response.status}.`;
        try {
            const errorDataJson = await response.json();
            errorDetailsText = errorDataJson.message || errorDataJson.details || JSON.stringify(errorDataJson);
        } catch (jsonParseError) {
            try {
                const rawResponseText = await clonedResponse.text();
                console.error("handleAcceptOffer - Server returned non-JSON or unparsable JSON. Raw text:", rawResponseText);
                errorDetailsText += ` Non-JSON response. Server said: ${rawResponseText.substring(0, 200)}${rawResponseText.length > 200 ? '...' : ''}`;
            } catch (textReadError) {
                errorDetailsText += " Additionally, failed to read response body as text.";
            }
        }
        console.error(`Accept offer for ${currentActionRideId} - Server error:`, errorDetailsText);
        toast({ title: "Acceptance Failed on Server", description: errorDetailsText, variant: "destructive", duration: 7000 });
        setIsPollingEnabled(true);
        setActionLoading(prev => ({ ...prev, [currentActionRideId]: false }));
        console.log(`Reset actionLoading for ${currentActionRideId} to false after server error.`);
        return;
      }

      const serverBooking = updatedBookingDataFromServer.booking;
      const newActiveRideFromServer: ActiveRide = {
        id: serverBooking.id,
        passengerId: serverBooking.passengerId,
        passengerName: serverBooking.passengerName,
        passengerAvatar: serverBooking.passengerAvatar,
        passengerPhone: serverBooking.passengerPhone,
        pickupLocation: serverBooking.pickupLocation,
        dropoffLocation: serverBooking.dropoffLocation,
        stops: serverBooking.stops,
        fareEstimate: serverBooking.fareEstimate,
        isPriorityPickup: serverBooking.isPriorityPickup,
        priorityFeeAmount: serverBooking.priorityFeeAmount,
        passengerCount: serverBooking.passengers, 
        status: serverBooking.status,
        driverId: serverBooking.driverId,
        driverVehicleDetails: serverBooking.driverVehicleDetails,
        notes: serverBooking.driverNotes || serverBooking.notes,
        paymentMethod: serverBooking.paymentMethod,
        requiredOperatorId: serverBooking.requiredOperatorId,
        vehicleType: serverBooking.vehicleType,
        dispatchMethod: serverBooking.dispatchMethod,
        bookingTimestamp: serverBooking.bookingTimestamp,
        scheduledPickupAt: serverBooking.scheduledPickupAt,
        notifiedPassengerArrivalTimestamp: serverBooking.notifiedPassengerArrivalTimestamp,
        passengerAcknowledgedArrivalTimestamp: serverBooking.passengerAcknowledgedArrivalTimestamp,
        rideStartedAt: serverBooking.rideStartedAt,
        completedAt: serverBooking.completedAt,
        driverCurrentLocation: serverBooking.driverCurrentLocation || driverLocation,
        driverEtaMinutes: serverBooking.driverEtaMinutes,
        waitAndReturn: serverBooking.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: serverBooking.estimatedAdditionalWaitTimeMinutes,
        accountJobPin: serverBooking.accountJobPin,
        distanceMiles: offerToAccept.distanceMiles, 
      };
      console.log(`Accept offer for ${currentActionRideId}: Setting activeRide:`, newActiveRideFromServer);
      setActiveRide(newActiveRideFromServer);
      setRideRequests([]);

      let toastDesc = `En Route to Pickup for ${newActiveRideFromServer.passengerName}. Payment: ${newActiveRideFromServer.paymentMethod === 'card' ? 'Card' : newActiveRideFromServer.paymentMethod === 'account' ? 'Account (PIN)' : 'Cash'}.`;
      if (newActiveRideFromServer.isPriorityPickup && newActiveRideFromServer.priorityFeeAmount) {
        toastDesc += ` Priority: +£${newActiveRideFromServer.priorityFeeAmount.toFixed(2)}.`;
      }
      if (newActiveRideFromServer.dispatchMethod) {
        toastDesc += ` Dispatched: ${newActiveRideFromServer.dispatchMethod.replace(/_/g, ' ')}.`;
      }
      toast({title: "Ride Accepted!", description: toastDesc});

    } catch(error: any) {
      console.error(`Error in handleAcceptOffer process for ${currentActionRideId} (outer catch):`, error);

      let detailedMessage = "An unknown error occurred during ride acceptance.";
      if (error instanceof Error) {
          detailedMessage = error.message;
      } else if (typeof error === 'object' && error !== null && (error as any).message) {
          detailedMessage = (error as any).message;
      } else if (typeof error === 'string') {
          detailedMessage = error;
      }

      toast({ title: "Acceptance Failed", description: detailedMessage, variant: "destructive" });
      setIsPollingEnabled(true);
    } finally {
      console.log(`Resetting actionLoading for ${currentActionRideId} to false in finally block.`);
      setActionLoading(prev => ({ ...prev, [currentActionRideId]: false }));
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
        toast({
            title: "Automatically Set Offline",
            description: `You've missed ${MAX_CONSECUTIVE_MISSED_OFFERS} consecutive offers and have been set to Offline. You can go online again manually.`,
            variant: "default",
            duration: 8000,
        });
        setConsecutiveMissedOffers(0);
    } else {
        const passengerName = offerThatWasDeclined?.passengerName || 'the passenger';
        toast({
            title: "Ride Offer Declined",
            description: `You declined the offer for ${passengerName}. (${newMissedCount}/${MAX_CONSECUTIVE_MISSED_OFFERS} consecutive before auto-offline).`
        });
    }
  };

 const handleRideAction = async (rideId: string, actionType: 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active' | 'accept_wait_and_return' | 'decline_wait_and_return') => {
    if (!driverUser || !activeRide || activeRide.id !== rideId) {
        console.error(`handleRideAction: Pre-condition failed. driverUser: ${!!driverUser}, activeRide: ${!!activeRide}, activeRide.id vs rideId: ${activeRide?.id} vs ${rideId}`);
        toast({ title: "Error", description: "No active ride context or ID mismatch.", variant: "destructive"});
        return;
    }
    console.log(`handleRideAction: rideId=${rideId}, actionType=${actionType}. Current activeRide status: ${activeRide.status}`);

    if (actionType === 'start_ride' && activeRide.paymentMethod === 'account' && activeRide.status === 'arrived_at_pickup') {
        if (!isAccountPinDialogOpen) { 
          setIsAccountPinDialogOpen(true);
          return;
        }
    }


    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    console.log(`actionLoading for ${rideId} SET TO TRUE`);

    let toastMessage = ""; let toastTitle = "";
    let payload: any = { action: actionType };

    if (['notify_arrival', 'start_ride'].includes(actionType) && driverLocation) {
      payload.driverCurrentLocation = driverLocation;
    }


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

            let wrCharge = 0;
            if(activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes) {
                wrCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * WAITING_CHARGE_PER_MINUTE_DRIVER;
            }
            const finalFare = baseFare + priorityFee + currentWaitingCharge + wrCharge;

            toastTitle = "Ride Completed";
            if (activeRide.paymentMethod === "account" && activeRide.accountJobPin) {
                 toastMessage = `Ride with ${activeRide.passengerName} completed. Account holder will be notified. PIN used: ${activeRide.accountJobPin}. Final Fare: £${finalFare.toFixed(2)}.`;
            } else {
                 toastMessage = `Ride with ${activeRide.passengerName} marked as completed. Final fare (incl. priority, waiting, W&R): £${finalFare.toFixed(2)}.`;
            }


            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            payload.finalFare = finalFare;
            payload.completedAt = true;
            break;
        case 'cancel_active':
            toastTitle = "Ride Cancelled By You"; toastMessage = `Active ride with ${activeRide.passengerName} cancelled.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setAckWindowSecondsLeft(null);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
            payload.status = 'cancelled_by_driver';
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
      console.log(`handleRideAction (${actionType}): API response status for ${rideId}: ${response.status}`);

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
      console.log(`handleRideAction (${actionType}): API success for ${rideId}. Server data:`, updatedBookingFromServer.booking);

      setActiveRide(prev => {
        if (!prev || prev.id !== rideId) {
             console.warn(`handleRideAction (${actionType}): setActiveRide callback - prev.id (${prev?.id}) !== rideId (${rideId}). This shouldn't happen if activeRide is the source of truth.`);
             return prev;
        }
        const serverData = updatedBookingFromServer.booking;
        const newClientState: ActiveRide = {
          ...prev,
          status: serverData.status || prev.status,
          notifiedPassengerArrivalTimestamp: serverData.notifiedPassengerArrivalTimestamp || prev.notifiedPassengerArrivalTimestamp,
          passengerAcknowledgedArrivalTimestamp: serverData.passengerAcknowledgedArrivalTimestamp || prev.passengerAcknowledgedArrivalTimestamp,
          rideStartedAt: serverData.rideStartedAt || prev.rideStartedAt,
          completedAt: serverData.completedAt || prev.completedAt,
          fareEstimate: actionType === 'complete_ride' && payload.finalFare !== undefined ? payload.finalFare : (serverData.fareEstimate ?? prev.fareEstimate),
          waitAndReturn: serverData.waitAndReturn ?? prev.waitAndReturn,
          estimatedAdditionalWaitTimeMinutes: serverData.estimatedAdditionalWaitTimeMinutes ?? prev.estimatedAdditionalWaitTimeMinutes,
          isPriorityPickup: serverData.isPriorityPickup ?? prev.isPriorityPickup,
          priorityFeeAmount: serverData.priorityFeeAmount ?? prev.priorityFeeAmount,
          passengerId: serverData.passengerId || prev.passengerId,
          passengerName: serverData.passengerName || prev.passengerName,
          passengerAvatar: serverData.passengerAvatar || prev.passengerAvatar,
          passengerPhone: serverData.passengerPhone || prev.passengerPhone,
          pickupLocation: serverData.pickupLocation || prev.pickupLocation,
          dropoffLocation: serverData.dropoffLocation || prev.dropoffLocation,
          stops: serverData.stops || prev.stops,
          vehicleType: serverData.vehicleType || prev.vehicleType,
          paymentMethod: serverData.paymentMethod || prev.paymentMethod,
          notes: serverData.notes || prev.notes,
          requiredOperatorId: serverData.requiredOperatorId || prev.requiredOperatorId,
          dispatchMethod: serverData.dispatchMethod || prev.dispatchMethod,
          driverCurrentLocation: serverData.driverCurrentLocation || driverLocation,
          accountJobPin: serverData.accountJobPin || prev.accountJobPin,
          distanceMiles: serverData.distanceMiles || prev.distanceMiles, 
        };
        console.log(`handleRideAction (${actionType}): Setting new activeRide state for ${rideId}:`, newClientState);
        return newClientState;
      });

      toast({ title: toastTitle, description: toastMessage });
      if (actionType === 'cancel_active' || actionType === 'complete_ride') {
        console.log(`handleRideAction (${actionType}): Action is terminal for ride ${rideId}. Enabling polling for new offers.`);
        // Polling is managed by isPollingEnabled and activeRide.status effect, so no direct setIsPollingEnabled(true) here.
        // The fact that activeRide.status is 'completed' or 'cancelled_by_driver' means the polling effect might stop itself.
        // However, if we want to ensure it *restarts* for new offers after these terminal actions, we need to make sure
        // the polling effect is re-evaluated. The state update to activeRide will trigger it.
      }


    } catch(err: any) {
      const message = err instanceof Error ? err.message : "Unknown error processing ride action.";
      console.error(`handleRideAction (${actionType}) for ${rideId}: Error caught:`, message);
      toast({ title: "Action Failed", description: message, variant: "destructive" });
      fetchActiveRide(); 
      // setIsPollingEnabled(true); // No, let the effect handle based on activeRide.status
    } finally {
      console.log(`Resetting actionLoading for ${rideId} to false after action ${actionType}`);
      setActionLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };

  const verifyAccountPinAndStartRide = async () => {
    if (!activeRide || !activeRide.accountJobPin) {
        toast({ title: "Error", description: "Account job details missing.", variant: "destructive" });
        return;
    }
    setIsVerifyingPin(true);
    if (enteredAccountPin === activeRide.accountJobPin) {
        toast({ title: "PIN Verified!", description: "Starting account job..." });
        setIsAccountPinDialogOpen(false);
        setEnteredAccountPin("");
        await handleRideAction(activeRide.id, 'start_ride');
    } else {
        toast({ title: "Incorrect PIN", description: "The PIN entered is incorrect. Please try again.", variant: "destructive" });
    }
    setIsVerifyingPin(false);
  };

  const handleStartRideWithManualPinOverride = async () => {
    if (!activeRide || !driverUser) return;
    setIsAccountPinDialogOpen(false);
    setEnteredAccountPin("");
    toast({ title: "Manual Override", description: "Starting account job without PIN verification. Operator will be notified for review.", variant: "default", duration: 7000 });
    console.warn(`Ride ${activeRide.id} for passenger ${activeRide.passengerName} (Account Job) started with manual PIN override by driver ${driverUser.id} (${driverUser.name}). Account PIN was: ${activeRide.accountJobPin || 'Not found in state'}.`);
    await handleRideAction(activeRide.id, 'start_ride');
  };


  const formatHazardType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getHazardMarkerLabel = (type: string): string => {
    switch (type) {
        case 'mobile_speed_camera': return 'SC';
        case 'roadside_taxi_checking': return 'TC';
        case 'road_closure': return 'RC';
        case 'accident': return 'AC';
        case 'road_works': return 'RW';
        case 'heavy_traffic': return 'HT';
        default: return '!';
    }
  };

  const memoizedMapMarkers = useMemo(() => {
    if (!activeRide && !isDriverOnline) return [];
    let baseMarkers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];

    if (activeRide) {
        const currentLocToDisplay = isDriverOnline && watchIdRef.current && driverLocation
            ? driverLocation
            : activeRide.driverCurrentLocation;

        if (currentLocToDisplay) {
            baseMarkers.push({ position: currentLocToDisplay, title: "Your Current Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: {width: 24, height: 24} });
        }
        if (activeRide.pickupLocation) { baseMarkers.push({ position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude}, title: `Pickup: ${activeRide.pickupLocation.address}`, label: { text: "P", color: "white", fontWeight: "bold"} }); }
        if ((activeRide.status.toLowerCase().includes('in_progress') || activeRide.status === 'completed') && activeRide.dropoffLocation) { baseMarkers.push({ position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude}, title: `Dropoff: ${activeRide.dropoffLocation.address}`, label: { text: "D", color: "white", fontWeight: "bold" } }); }
        activeRide.stops?.forEach((stop, index) => { if(stop.latitude && stop.longitude) { baseMarkers.push({ position: {lat: stop.latitude, lng: stop.longitude}, title: `Stop ${index + 1}: ${stop.address}`, label: { text: `S${index + 1}`, color: "white", fontWeight: "bold" } }); } });
    } else if (isDriverOnline && driverLocation) {
        baseMarkers.push({ position: driverLocation, title: "Your Current Location", iconUrl: blueDotSvgDataUrl, iconScaledSize: {width: 24, height: 24} });
    }

    const hazardMarkers = activeMapHazards.map(hazard => ({
      position: { lat: hazard.location.latitude, lng: hazard.location.longitude },
      title: formatHazardType(hazard.hazardType),
      label: { text: getHazardMarkerLabel(hazard.hazardType), color: 'black', fontWeight: 'bold', fontSize: '11px' },
    }));

    return [...baseMarkers, ...hazardMarkers];
  }, [activeRide, driverLocation, isDriverOnline, activeMapHazards]);

  const memoizedMapCenter = useMemo(() => {
    if (activeRide?.driverCurrentLocation) return activeRide.driverCurrentLocation;
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status.toLowerCase().includes('in_progress') && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    if (activeRide?.status === 'completed' && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    return driverLocation;
  }, [activeRide, driverLocation]);


  const handleCancelSwitchChange = (checked: boolean) => {
    console.log("handleCancelSwitchChange: Switch toggled to", checked);
    setIsCancelSwitchOn(checked);
    if (checked) {
        console.log("handleCancelSwitchChange: Showing cancel confirmation dialog.");
        setShowCancelConfirmationDialog(true);
    } else {
        console.log("handleCancelSwitchChange: Hiding cancel confirmation dialog (switch off).");
        setShowCancelConfirmationDialog(false);
    }
  };

  const CancelRideInteraction = ({ ride, isLoading: actionIsLoadingProp }: { ride: ActiveRide | null, isLoading: boolean }) => {
    if (!ride || !['driver_assigned', 'arrived_at_pickup'].includes(ride.status.toLowerCase())) return null;
    return (
        <div className="flex items-center justify-between space-x-2 bg-destructive/10 p-3 rounded-md mt-3">
        <Label htmlFor={`cancel-ride-switch-${ride.id}`} className="text-destructive font-medium text-sm">
            <span>Initiate Cancellation</span>
        </Label>
        <Switch
            id={`cancel-ride-switch-${ride.id}`}
            checked={isCancelSwitchOn}
            onCheckedChange={handleCancelSwitchChange}
            disabled={actionIsLoadingProp}
            className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted shrink-0"
        />
        </div>
    );
  };


  const handleConfirmEmergency = () => {
    toast({ title: "EMERGENCY ALERT SENT!", description: "Your operator has been notified of an emergency. Stay safe.", variant: "destructive", duration: 10000 });
    playBeep();
    setIsConfirmEmergencyOpen(false);
    setIsSosDialogOpen(false);
  };

  const handleToggleOnlineStatus = (newOnlineStatus: boolean) => {
    setIsDriverOnline(newOnlineStatus);
    if (newOnlineStatus) {
        setConsecutiveMissedOffers(0);
        if (geolocationError) {
            setGeolocationError(null);
        }
        setIsPollingEnabled(true);
    } else {
        setRideRequests([]);
        setIsPollingEnabled(false);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }
  };

  const handleRequestWaitAndReturn = async () => {
    if (!activeRide || !driverUser) return;
    const waitTimeMinutes = parseInt(wrRequestDialogMinutes, 10);
    if (isNaN(waitTimeMinutes) || waitTimeMinutes < 0) {
      toast({ title: "Invalid Wait Time", description: "Please enter a valid number of minutes (0 or more).", variant: "destructive" });
      return;
    }
    setIsRequestingWR(true);
    try {
      const response = await fetch(`/api/operator/bookings/${activeRide.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_wait_and_return',
          estimatedAdditionalWaitTimeMinutes: waitTimeMinutes
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to request Wait & Return.");
      }
      const updatedBooking = await response.json();
      setActiveRide(updatedBooking.booking);
      toast({ title: "Wait & Return Requested", description: "Your request has been sent to the passenger for confirmation." });
      setIsWRRequestDialogOpen(false);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Request Failed", description: message, variant: "destructive" });
    } finally {
      setIsRequestingWR(false);
    }
  };

  const handleReportHazard = async (hazardType: string) => {
    if (!driverUser || !driverLocation) {
      toast({ title: "Error", description: "Driver location or ID missing.", variant: "destructive" });
      return;
    }
    setReportingHazard(true);
    setIsHazardReportDialogOpen(false);
    toast({ title: "Reporting Hazard...", description: `Sending report for ${formatHazardType(hazardType)}.`});

    try {
      const response = await fetch('/api/driver/map-hazards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driverUser.id,
          hazardType: hazardType,
          latitude: driverLocation.lat,
          longitude: driverLocation.lng,
          reportedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: "Failed to report hazard."}));
        throw new Error(errorData.message);
      }
      toast({ title: "Hazard Reported!", description: `${formatHazardType(hazardType)} reported successfully.`, duration: 5000 });
      fetchActiveHazards();
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Unknown error reporting hazard.";
      toast({ title: "Report Failed", description: message, variant: "destructive" });
    } finally {
      setReportingHazard(false);
    }
  };

  const getActiveRideDispatchInfo = (
    ride: ActiveRide | null,
    currentUser: User | null
  ): DispatchDisplayInfo | null => {
    if (!ride || !currentUser) return null;
  
    const isPlatformRide = ride.requiredOperatorId === PLATFORM_OPERATOR_CODE;
    const isOwnOperatorRide = currentUser.operatorCode && ride.requiredOperatorId === currentUser.operatorCode && ride.requiredOperatorId !== PLATFORM_OPERATOR_CODE;
    
    const isManualDispatch = ride.dispatchMethod === 'manual_operator';
    const isPriorityOverride = ride.dispatchMethod === 'priority_override';
    const isAutoSystem = ride.dispatchMethod === 'auto_system' || !ride.dispatchMethod;
  
    if (isPlatformRide) {
      return isManualDispatch 
        ? { text: "Dispatched By App: MANUAL MODE", icon: Briefcase, bgColorClassName: "bg-blue-600" }
        : { text: "Dispatched By App: AUTO MODE", icon: CheckCircle, bgColorClassName: "bg-green-600" };
    }
    if (isOwnOperatorRide) {
      return isManualDispatch
        ? { text: "Dispatched By YOUR BASE: MANUAL MODE", icon: Briefcase, bgColorClassName: "bg-blue-600" }
        : { text: "Dispatched By YOUR BASE: AUTO MODE", icon: CheckCircle, bgColorClassName: "bg-green-600" };
    }
    
    if (isManualDispatch) {
      const dispatcher = ride.requiredOperatorId ? `Operator ${ride.requiredOperatorId}` : "Platform Admin";
      return { text: `Manually Dispatched by ${dispatcher}`, icon: Briefcase, bgColorClassName: "bg-blue-600" };
    }
    if (isPriorityOverride) {
      return { text: "Dispatched by Operator (Priority)", icon: AlertOctagon, bgColorClassName: "bg-purple-600" };
    }
    // Default for general pool auto-dispatches if not fitting above conditions
    return { text: "Dispatched By App (Auto)", icon: CheckCircle, bgColorClassName: "bg-green-600" };
  };
  const dispatchInfo = getActiveRideDispatchInfo(activeRide, driverUser);


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
    console.log("Rendering ActiveRide UI. Current activeRide.status:", activeRide.status, "activeRide.id:", activeRide.id);
    const showDriverAssignedStatus = activeRide.status === 'driver_assigned';
    const showArrivedAtPickupStatus = activeRide.status === 'arrived_at_pickup';
    const showInProgressStatus = activeRide.status.toLowerCase() === 'in_progress';
    const showPendingWRApprovalStatus = activeRide.status === 'pending_driver_wait_and_return_approval';
    const showInProgressWRStatus = activeRide.status === 'in_progress_wait_and_return';
    const showCompletedStatus = activeRide.status === 'completed';
    const showCancelledByDriverStatus = activeRide.status === 'cancelled_by_driver';

    const baseFare = activeRide.fareEstimate || 0;
    const priorityFee = activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0;

    let wrCharge = 0;
    if(activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes && activeRide.status === 'in_progress_wait_and_return') {
      wrCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * WAITING_CHARGE_PER_MINUTE_DRIVER;
    }
    const totalCalculatedFare = baseFare + priorityFee + currentWaitingCharge + wrCharge;


    let displayedFare = `£${totalCalculatedFare.toFixed(2)}`;
    let fareBreakdown = `(Base: £${baseFare.toFixed(2)}`;
    if (priorityFee > 0) fareBreakdown += ` + Prio: £${priorityFee.toFixed(2)}`;
    if (currentWaitingCharge > 0) fareBreakdown += ` + Wait: £${currentWaitingCharge.toFixed(2)}`;
    if (wrCharge > 0) fareBreakdown += ` + W&R Wait: £${wrCharge.toFixed(2)}`;
    fareBreakdown += ")";

    if (priorityFee > 0 || currentWaitingCharge > 0 || wrCharge > 0) {
        displayedFare += ` ${fareBreakdown}`;
    }


    return (
      <div className="flex flex-col h-full">
        {(!showCompletedStatus && !showCancelledByDriverStatus && (
        <div className="h-[calc(45%-0.5rem)] w-full rounded-b-xl overflow-hidden shadow-lg border-b relative">
            <GoogleMapDisplay center={memoizedMapCenter} zoom={14} markers={memoizedMapMarkers} customMapLabel={customMapLabel} className="w-full h-full" disableDefaultUI={true} fitBoundsToMarkers={true} />
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-20">
                <Button
                    variant="default" size="icon"
                    className="rounded-full h-8 w-8 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={() => setIsHazardReportDialogOpen(true)}
                    aria-label="Report Hazard Button"
                    disabled={reportingHazard || !isDriverOnline}
                >
                    {reportingHazard ? <Loader2 className="h-4 w-4 animate-spin"/> : <TrafficCone className="h-4 w-4" />}
                </Button>
                <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive" size="icon"
                      className="rounded-full h-8 w-8 shadow-lg animate-pulse"
                      onClick={() => setIsSosDialogOpen(true)}
                      aria-label="SOS Panic Button"
                      disabled={!isDriverOnline}
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <ShadAlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-destructive"/>SOS - Request Assistance</ShadAlertDialogTitle>
                      <AlertDialogDescription>
                        Select the type of assistance needed. Your current location will be shared with your operator.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-2">
                      <Button
                        variant="destructive" className="w-full"
                        onClick={() => { setIsSosDialogOpen(false); setIsConfirmEmergencyOpen(true); }}
                      >
                        Emergency (Alert & Sound)
                      </Button>
                       <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Passenger Issue Reported", description: "Operator notified about aggressive/suspicious passenger." }); setIsSosDialogOpen(false); }}
                      >
                        Passenger Aggressive/Suspicious
                      </Button>
                    <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Breakdown Reported", description: "Operator notified of vehicle breakdown." }); setIsSosDialogOpen(false); }}
                    >
                        Vehicle Breakdown
                    </Button>
                    <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Callback Requested", description: "Operator has been asked to call you back." }); setIsSosDialogOpen(false); }}
                    >
                        Request Operator Callback
                    </Button>
                </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setIsSosDialogOpen(false)}>Cancel SOS</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>

            <AlertDialog open={isConfirmEmergencyOpen} onOpenChange={setIsConfirmEmergencyOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <ShadAlertDialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6" /> Confirm EMERGENCY?
                        </ShadAlertDialogTitle>
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
        <Card className={cn( 
          "rounded-t-xl z-10 shadow-xl border-t-4 border-primary bg-card overflow-hidden", 
          (showCompletedStatus || showCancelledByDriverStatus) ? "mt-0 rounded-b-xl" : "flex-1 flex flex-col"
        )}>
           <CardContent className={cn(
             "p-3 space-y-2",
             !(showCompletedStatus || showCancelledByDriverStatus) && "flex-1 overflow-y-auto"
           )}>
            {showDriverAssignedStatus && ( <div className="flex justify-center mb-2"> <Badge variant="secondary" className="text-sm w-fit mx-auto bg-sky-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> En Route to Pickup </Badge> </div> )}
            {showArrivedAtPickupStatus && ( <div className="flex justify-center mb-2"> <Badge variant="outline" className="text-sm w-fit mx-auto border-blue-500 text-blue-500 py-1.5 px-4 rounded-md font-semibold shadow-md"> Arrived At Pickup </Badge> </div> )}
            {showInProgressStatus && ( <div className="flex justify-center mb-2"> <Badge variant="default" className="text-sm w-fit mx-auto bg-green-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> Ride In Progress </Badge> </div> )}
            {showPendingWRApprovalStatus && ( <div className="flex justify-center mb-2"> <Badge variant="secondary" className="text-sm w-fit mx-auto bg-purple-500 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> W&R Request Pending </Badge> </div> )}
            {showInProgressWRStatus && ( <div className="flex justify-center mb-2"> <Badge variant="default" className="text-sm w-fit mx-auto bg-teal-600 text-white py-1.5 px-4 rounded-md font-semibold shadow-md"> Ride In Progress (W&R) </Badge> </div> )}
            {showCompletedStatus && ( <div className="flex justify-center my-4"> <Badge variant="default" className="text-lg w-fit mx-auto bg-primary text-primary-foreground py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <CheckCircle className="w-6 h-6" /> Ride Completed </Badge> </div> )}
            {showCancelledByDriverStatus && ( <div className="flex justify-center my-4"> <Badge variant="destructive" className="text-lg w-fit mx-auto py-2 px-6 rounded-lg font-bold shadow-lg flex items-center gap-2"> <XCircle className="w-6 h-6" /> Ride Cancelled By You </Badge> </div> )}

            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
              <Avatar className="h-12 w-12"> <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/48x48.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/> <AvatarFallback>{activeRide.passengerName.charAt(0)}</AvatarFallback> </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-base">{activeRide.passengerName}</p>
                {activeRide.passengerPhone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3"/> {activeRide.passengerPhone}
                  </p>
                )}
                {activeRide.passengerRating && ( <div className="flex items-center"> {[...Array(5)].map((_, i) => <Star key={i} className={cn("w-3.5 h-3.5", i < Math.round(activeRide.passengerRating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />)} <span className="ml-1 text-xs text-muted-foreground">({activeRide.passengerRating.toFixed(1)})</span> </div> )}
              </div>
              {(!showCompletedStatus && !showCancelledByDriverStatus) && (
                <div className="flex items-center gap-1">
                  {activeRide.passengerPhone && (
                    <Button asChild variant="outline" size="icon" className="h-9 w-9">
                      <a href={`tel:${activeRide.passengerPhone}`} aria-label="Call passenger">
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="icon" className="h-9 w-9">
                      <Link href="/driver/chat"><ChatIcon className="w-4 h-4" /></Link>
                  </Button>
                </div>
               )}
            </div>
            
            {dispatchInfo && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
              <div className={cn("p-2 my-1.5 rounded-lg text-center text-white", dispatchInfo.bgColorClassName)}>
                <p className="text-sm font-medium flex items-center justify-center gap-1">
                  <dispatchInfo.icon className="w-4 h-4 text-white"/> {dispatchInfo.text}
                </p>
              </div>
            )}

            {activeRide.isPriorityPickup && !dispatchInfo?.text.toLowerCase().includes("priority") && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
                <Alert variant="default" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 p-2 text-xs my-1.5">
                    <Crown className="h-4 w-4" />
                    <ShadAlertTitle className="font-medium">Priority Booking</ShadAlertTitle>
                    <ShadAlertDescription>
                        Passenger offered +£{(activeRide.priorityFeeAmount || 0).toFixed(2)}.
                    </ShadAlertDescription>
                </Alert>
            )}

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
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => handleRideAction(activeRide.id, 'accept_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Accept W&R</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRideAction(activeRide.id, 'decline_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Decline W&R</Button>
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
                    {activeRide.distanceMiles != null && (
                      <p className="flex items-center gap-1"><Route className="w-4 h-4 text-muted-foreground" /> <strong>Distance:</strong> ~{activeRide.distanceMiles.toFixed(1)} mi</p>
                    )}
                    {activeRide.paymentMethod && ( <p className="flex items-center gap-1 col-span-2 mt-1"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : activeRide.paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-muted-foreground" /> : <Briefcase className="w-4 h-4 text-muted-foreground" />} <strong>Payment:</strong> {activeRide.paymentMethod === 'card' ? 'Card' : activeRide.paymentMethod === 'account' ? 'Account (PIN)' : 'Cash'} </p> )}
                 </div>
            </div>
            {activeRide.notes && !['in_progress', 'In Progress', 'completed', 'cancelled_by_driver', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase()) && ( <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md my-1"> <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap"><strong>Notes:</strong> {activeRide.notes}</p> </div> )}
            
            {showCompletedStatus && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-sm font-medium mb-1">Rate {activeRide.passengerName || "Passenger"} (for {activeRide.requiredOperatorId || "N/A"}):</p>
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
             {showDriverAssignedStatus && ( <> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => {console.log("Navigate (Driver Assigned) clicked for ride:", activeRide.id); toast({title: "Navigation (Mock)", description: "Would open maps to pickup."})}}> <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-blue-600 hover:bg-blue-700 text-base text-white py-2.5 h-auto" onClick={() => {console.log("Notify Arrival clicked for ride:", activeRide.id, "Current status:", activeRide.status); handleRideAction(activeRide.id, 'notify_arrival')}} disabled={!!actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Notify Arrival </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={!!actionLoading[activeRide.id]} /> </> )}
             {showArrivedAtPickupStatus && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => {console.log("Navigate (Arrived) clicked for ride:", activeRide.id); toast({title: "Navigation (Mock)", description: "Would open maps to dropoff."})}} > <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-green-600 hover:bg-green-700 text-base text-white py-2.5 h-auto" onClick={() => {console.log("Start Ride clicked for ride:", activeRide.id, "Current status:", activeRide.status); handleRideAction(activeRide.id, 'start_ride')}} disabled={!!actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Start Ride </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={!!actionLoading[activeRide.id]} /> </div> )}
             {(showInProgressStatus || showInProgressWRStatus) && ( <div className="grid grid-cols-1 gap-2"> <div className="grid grid-cols-2 gap-2"> <Button variant="outline" className="w-full text-base py-2.5 h-auto" onClick={() => {console.log("Navigate (In Progress) clicked for ride:", activeRide.id); toast({title: "Navigation (Mock)", description: "Continuing navigation to dropoff."})}}> <Navigation className="mr-2"/> Navigate </Button> <Button className="w-full bg-primary hover:bg-primary/80 text-base text-primary-foreground py-2.5 h-auto" onClick={() => {console.log("Complete Ride clicked for ride:", activeRide.id, "Current status:", activeRide.status); handleRideAction(activeRide.id, 'complete_ride')}} disabled={!!actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-2" />}Complete Ride </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={!!actionLoading[activeRide.id]} /> </div> )}
             {(showCompletedStatus || showCancelledByDriverStatus) && (
                <Button
                    className="w-full bg-slate-600 hover:bg-slate-700 text-lg text-white py-3 h-auto"
                    onClick={() => {
                        console.log("Done button clicked. Current status:", activeRide.status, "Rating given:", driverRatingForPassenger);
                        if(showCompletedStatus && driverRatingForPassenger > 0 && activeRide.passengerName) {
                            console.log(`Mock: Driver rated passenger ${activeRide.passengerName} with ${driverRatingForPassenger} stars.`);
                            toast({title: "Passenger Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${driverRatingForPassenger} stars.`});
                        }
                        setDriverRatingForPassenger(0);
                        setCurrentWaitingCharge(0);
                        setIsCancelSwitchOn(false);
                        setActiveRide(null); 
                        setIsPollingEnabled(true); 
                    }}
                    disabled={activeRide ? !!actionLoading[activeRide.id] : false}
                >
                    {(activeRide && !!actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />} Done
                </Button>
             )}
          </CardFooter>
        </Card>
        <AlertDialog
          open={showCancelConfirmationDialog}
          onOpenChange={(isOpen) => {
              console.log("Cancel Dialog onOpenChange, isOpen:", isOpen);
              setShowCancelConfirmationDialog(isOpen);
              if (!isOpen && activeRide && isCancelSwitchOn) {
                  console.log("Cancel Dialog closing, resetting isCancelSwitchOn from true to false.");
                  setIsCancelSwitchOn(false);
              }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <ShadAlertDialogTitle><span>Are you sure you want to cancel this ride?</span></ShadAlertDialogTitle>
              <AlertDialogDescription><span>This action cannot be undone. The passenger will be notified.</span></AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => { console.log("Cancel Dialog: 'Keep Ride' clicked."); setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}}
                disabled={activeRide ? !!actionLoading[activeRide.id] : false}
              >
                <span>Keep Ride</span>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (activeRide) { console.log("Cancel Dialog: 'Confirm Cancel' clicked for ride:", activeRide.id); handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
                disabled={!activeRide || (!!actionLoading[activeRide.id])}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                  <span className="flex items-center justify-center">
                    {activeRide && (!!actionLoading[activeRide.id]) ? (
                       <React.Fragment>
                         <Loader2 className="animate-spin mr-2 h-4 w-4" />
                         <span>Cancelling...</span>
                       </React.Fragment>
                    ) : (
                       <React.Fragment>
                         <ShieldX className="mr-2 h-4 w-4" />
                         <span>Confirm Cancel</span>
                      </React.Fragment>
                    )}
                  </span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</DialogTitle>
          <DialogDescription>
            Estimate additional waiting time at current drop-off. 10 mins free, then £{WAITING_CHARGE_PER_MINUTE_DRIVER.toFixed(2)}/min. Passenger must approve.
          </DialogDescription>
          <div className="py-4 space-y-2">
            <Label htmlFor="wr-wait-time-input">Additional Wait Time (minutes)</Label>
            <Input
              id="wr-wait-time-input"
              type="number"
              min="0"
              value={wrRequestDialogMinutes}
              onChange={(e) => setWrRequestDialogMinutes(e.target.value)}
              placeholder="e.g., 15"
              disabled={isRequestingWR}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsWRRequestDialogOpen(false)} disabled={isRequestingWR}>
              Cancel
            </Button>
            <Button type="button" onClick={handleRequestWaitAndReturn} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isRequestingWR}>
              {isRequestingWR ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAccountPinDialogOpen} onOpenChange={setIsAccountPinDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" />Account Job PIN Required</DialogTitle>
            <DialogDescription>
              Ask the passenger for their 4-digit PIN to start this account job.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="account-pin-input">Enter 4-Digit PIN</Label>
            <Input
              id="account-pin-input"
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={enteredAccountPin}
              onChange={(e) => setEnteredAccountPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="••••"
              className="text-center text-xl tracking-[0.3em]"
              disabled={isVerifyingPin}
            />
          </div>
          <DialogFooter className="grid grid-cols-1 gap-2">
            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => {setIsAccountPinDialogOpen(false); setEnteredAccountPin("");}} disabled={isVerifyingPin}>
                Cancel
                </Button>
                <Button type="button" onClick={verifyAccountPinAndStartRide} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isVerifyingPin || enteredAccountPin.length !== 4}>
                {isVerifyingPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Start Ride
                </Button>
            </div>
            <Button type="button" variant="link" size="sm" className="text-xs text-muted-foreground hover:text-primary h-auto p-1 mt-2" onClick={handleStartRideWithManualPinOverride} disabled={isVerifyingPin}>
              Problem with PIN? Start ride manually.
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/> Add a map report</DialogTitle>
              <DialogDescription>
                Select the type of hazard or observation you want to report at your current location.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-4">
              {[
                { label: "Mobile Speed Camera", type: "mobile_speed_camera", icon: Gauge },
                { label: "Roadside Taxi Checking", type: "roadside_taxi_checking", icon: ShieldCheck },
                { label: "Road Closure", type: "road_closure", icon: MinusCircle },
                { label: "Accident", type: "accident", icon: CarCrash },
                { label: "Road Works", type: "road_works", icon: Construction },
                { label: "Heavy Traffic", type: "heavy_traffic", icon: UsersIcon },
              ].map(hazard => (
                <Button
                  key={hazard.type}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-20 text-center"
                  onClick={() => handleReportHazard(hazard.type)}
                  disabled={reportingHazard}
                >
                  {hazard.icon && <hazard.icon className="w-6 h-6 mb-1 text-primary" />}
                  <span className="text-xs">{hazard.label}</span>
                </Button>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={reportingHazard}>Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }


  const mapContainerClasses = cn( "relative h-[400px] w-full rounded-xl overflow-hidden shadow-lg border-4 border-border");
  return ( <div className="flex flex-col h-full space-y-2">
    <div className={mapContainerClasses}>
        <GoogleMapDisplay center={driverLocation} zoom={13} markers={memoizedMapMarkers} customMapLabel={customMapLabel} className="w-full h-full" disableDefaultUI={true} />
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-20">
            <Button
                variant="default" size="icon"
                className="rounded-full h-8 w-8 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => setIsHazardReportDialogOpen(true)}
                aria-label="Report Hazard Button"
                disabled={reportingHazard || !isDriverOnline}
            >
                {reportingHazard ? <Loader2 className="h-4 w-4 animate-spin"/> : <TrafficCone className="h-4 w-4" />}
            </Button>
            <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
                <AlertDialogTrigger asChild>
                <Button
                    variant="destructive" size="icon"
                    className="rounded-full h-8 w-8 shadow-lg animate-pulse"
                    onClick={() => setIsSosDialogOpen(true)}
                    aria-label="SOS Panic Button"
                    disabled={!isDriverOnline}
                >
                    <ShieldAlert className="h-4 w-4" />
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <ShadAlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-destructive"/>SOS - Request Assistance</ShadAlertDialogTitle>
                    <AlertDialogDescription>
                    Select the type of assistance needed. Your current location will be shared with your operator.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2">
                    <Button
                        variant="destructive" className="w-full"
                        onClick={() => { setIsSosDialogOpen(false); setIsConfirmEmergencyOpen(true); }}
                    >
                        Emergency (Alert & Sound)
                    </Button>
                     <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Passenger Issue Reported", description: "Operator notified about aggressive/suspicious passenger." }); setIsSosDialogOpen(false); }}
                      >
                        Passenger Aggressive/Suspicious
                      </Button>
                    <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Breakdown Reported", description: "Operator notified of vehicle breakdown." }); setIsSosDialogOpen(false); }}
                    >
                        Vehicle Breakdown
                    </Button>
                    <Button variant="outline" className="w-full"
                        onClick={() => { toast({ title: "Callback Requested", description: "Operator has been asked to call you back." }); setIsSosDialogOpen(false); }}
                    >
                        Request Operator Callback
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsSosDialogOpen(false)}>Cancel SOS</AlertDialogCancel>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

        <AlertDialog open={isConfirmEmergencyOpen} onOpenChange={setIsConfirmEmergencyOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <ShadAlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" /> Confirm EMERGENCY?
                    </ShadAlertDialogTitle>
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
        <Dialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/> Add a map report</DialogTitle>
              <DialogDescription>
                Select the type of hazard or observation you want to report at your current location.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-4">
              {[
                { label: "Mobile Speed Camera", type: "mobile_speed_camera", icon: Gauge },
                { label: "Roadside Taxi Checking", type: "roadside_taxi_checking", icon: ShieldCheck },
                { label: "Road Closure", type: "road_closure", icon: MinusCircle },
                { label: "Accident", type: "accident", icon: CarCrash },
                { label: "Road Works", type: "road_works", icon: Construction },
                { label: "Heavy Traffic", type: "heavy_traffic", icon: UsersIcon },
              ].map(hazard => (
                <Button
                  key={hazard.type}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-20 text-center"
                  onClick={() => handleReportHazard(hazard.type)}
                  disabled={reportingHazard}
                >
                  {hazard.icon && <hazard.icon className="w-6 h-6 mb-1 text-primary" />}
                  <span className="text-xs">{hazard.label}</span>
                </Button>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={reportingHazard}>Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
    <Card className="flex-1 flex flex-col rounded-xl shadow-lg bg-card border"> <CardHeader className={cn( "p-2 border-b text-center", isDriverOnline ? "border-green-500" : "border-red-500")}> <CardTitle className={cn( "text-lg font-semibold", isDriverOnline ? "text-green-600" : "text-red-600")}> {isDriverOnline ? "Online - Awaiting Offers" : "Offline"} </CardTitle> </CardHeader> <CardContent className="flex-1 flex flex-col items-center justify-center p-3 space-y-1">
    {geolocationError && isDriverOnline && (
        <Alert variant="destructive" className="mb-2 text-xs">
            <AlertTriangle className="h-4 w-4" />
            <ShadAlertTitle>Location Error</ShadAlertTitle>
            <ShadAlertDescription>{geolocationError}</ShadAlertDescription>
        </Alert>
    )}
    {isDriverOnline ? ( !geolocationError && ( <> <Loader2 className="w-6 h-6 text-primary animate-spin" /> <p className="text-xs text-muted-foreground text-center">Actively searching for ride offers for you...</p> </> ) ) : ( <> <Power className="w-8 h-8 text-muted-foreground" /> <p className="text-sm text-muted-foreground">You are currently offline.</p> </>) } <div className="flex items-center space-x-2 pt-1"> <Switch id="driver-online-toggle" checked={isDriverOnline} onCheckedChange={handleToggleOnlineStatus} aria-label="Toggle driver online status" className={cn(!isDriverOnline && "data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted-foreground")} /> <Label htmlFor="driver-online-toggle" className={cn("text-sm font-medium", isDriverOnline ? 'text-green-600' : 'text-red-600')} > {isDriverOnline ? "Online" : "Offline"} </Label> </div>
    <div className="pt-2">
      <Button variant="outline" size="sm" onClick={seedMockHazards} className="text-xs h-8 px-3 py-1">Seed Mock Hazards (Test)</Button>
    </div>
    {isDriverOnline && ( <Button variant="outline" size="sm" onClick={handleSimulateOffer} className="mt-2 text-xs h-8 px-3 py-1" > Simulate Incoming Ride Offer (Test) </Button> )} </CardContent> </Card> <RideOfferModal isOpen={isOfferModalOpen} onClose={() => { setIsOfferModalOpen(false); setCurrentOfferDetails(null); }} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} rideDetails={currentOfferDetails} />
    <AlertDialog
      open={isStationaryReminderVisible}
      onOpenChange={setIsStationaryReminderVisible}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <ShadAlertDialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" /> Time to Go!
          </ShadAlertDialogTitle>
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
    <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => { console.log("Cancel Dialog Main onOpenChange, isOpen:", isOpen); setShowCancelConfirmationDialog(isOpen); if (!isOpen && activeRide && isCancelSwitchOn) { console.log("Cancel Dialog Main closing, resetting isCancelSwitchOn from true to false."); setIsCancelSwitchOn(false); }}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <ShadAlertDialogTitle><span>Are you sure you want to cancel this ride?</span></ShadAlertDialogTitle>
          <AlertDialogDescription><span>This action cannot be undone. The passenger will be notified.</span></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => { console.log("Cancel Dialog Main: 'Keep Ride' clicked."); setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}}
            disabled={activeRide ? !!actionLoading[activeRide.id] : false}
          >
            <span>Keep Ride</span>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (activeRide) { console.log("Cancel Dialog Main: 'Confirm Cancel' clicked for ride:", activeRide.id); handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
            disabled={!activeRide || (!!actionLoading[activeRide.id])}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <span className="flex items-center justify-center">
            {activeRide && (!!actionLoading[activeRide.id]) ? (
              <React.Fragment>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                <span>Cancelling...</span>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <ShieldX className="mr-2 h-4 w-4" />
                <span>Confirm Cancel</span>
             </React.Fragment>
            )}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
     <AlertDialog open={!!approachingHazardInfo} onOpenChange={(open) => { if (!open) {setApproachingHazardInfo(null); if(approachingHazardInfo) alertedForThisApproachRef.current.add(approachingHazardInfo.id);} }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <ShadAlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-yellow-500" /> Approaching Hazard</ShadAlertDialogTitle>
            <AlertDialogDescription>
              A <strong className="font-semibold">{approachingHazardInfo?.hazardType ? formatHazardType(approachingHazardInfo.hazardType) : 'hazard'}</strong> was reported nearby.
              <br />
              Is it still present?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => handleHazardAlertResponse(approachingHazardInfo!.id, false)}>No, It's Gone</Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => handleHazardAlertResponse(approachingHazardInfo!.id, true)}>Yes, Still There</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  </div> );
}

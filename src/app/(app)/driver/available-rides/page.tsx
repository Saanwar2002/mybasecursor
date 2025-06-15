
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MapPin, Car, Clock, Loader2, AlertTriangle, Edit, XCircle, DollarSign, Calendar as CalendarIconLucide, Users, MessageSquare, UserCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, PlusCircle, Timer, Info, Check, Navigation, Play, PhoneCall, RefreshCw, Briefcase, UserX as UserXIcon, TrafficCone, Gauge, ShieldCheck as ShieldCheckIcon, MinusCircle, Construction, Users as UsersIcon, Power, AlertOctagon, LockKeyhole, CheckCircle as CheckCircleIcon, Route, Crown, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, UserRole, PLATFORM_OPERATOR_CODE, type User } from "@/contexts/auth-context";
import { RideOfferModal, type RideOffer } from "@/components/driver/ride-offer-modal";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as ShadAlertDialogDescriptionForDialog, 
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as ShadAlertDialogTitleForDialog, 
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as ShadDialogDescriptionDialog, 
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor, getCustomMapLabelOverlayClass, LabelType } from '@/components/ui/custom-map-label-overlay';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, Timestamp, GeoPoint } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SpeedLimitDisplay } from '@/components/driver/SpeedLimitDisplay';
import type { LucideIcon } from 'lucide-react';


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
  cancellationFeeApplicable?: boolean;
  noShowFeeApplicable?: boolean;
  cancellationType?: string;
  driverCurrentLegIndex?: number;
  currentLegEntryTimestamp?: SerializedTimestamp | string | null;
  completedStopWaitCharges?: Record<number, number>;
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const driverCarIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#2563EB" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(driverCarIconSvg)}` : '';


const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;
const STATIONARY_REMINDER_TIMEOUT_MS = 60000;
const MOVEMENT_THRESHOLD_METERS = 50;
const STOP_FREE_WAITING_TIME_SECONDS = 3 * 60;
const STOP_WAITING_CHARGE_PER_MINUTE = 0.20;


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

interface DispatchDisplayInfo {
  text: string;
  icon: React.ElementType;
  bgColorClassName: string;
}

function formatAddressForMapLabel(fullAddress: string, type: string): string {
  if (!fullAddress) return `${type}:\nN/A`;

  let addressRemainder = fullAddress;
  let outwardPostcode = "";

  const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s*(?:[0-9][A-Z]{2})?\b/i;
  const postcodeMatch = fullAddress.match(postcodeRegex);

  if (postcodeMatch) {
    outwardPostcode = postcodeMatch[1].toUpperCase();
    addressRemainder = fullAddress.replace(postcodeMatch[0], '').replace(/,\s*$/, '').trim();
  }

  const parts = addressRemainder.split(',').map(p => p.trim()).filter(Boolean);

  let street = parts[0] || "Location";
  let area = "";

  if (parts.length > 1) {
    area = parts[1]; 
    if (street.toLowerCase().includes(area.toLowerCase()) && street.length > area.length + 2) {
        street = street.substring(0, street.toLowerCase().indexOf(area.toLowerCase())).replace(/,\s*$/,'').trim();
    }
  } else if (parts.length === 0 && outwardPostcode) {
    street = "Area"; 
  }
  
  if (!area && parts.length > 2) {
      area = parts.slice(1).join(', '); 
  }

  let locationLine = area;
  if (outwardPostcode) {
    locationLine = (locationLine ? locationLine + " " : "") + outwardPostcode;
  }

  if (locationLine.trim() === outwardPostcode && (street === "Location" || street === "Area" || street === "Unknown Street")) {
      street = ""; 
  }
  if (street && !locationLine) { 
     return `${type}:\n${street}`;
  }
  if (!street && locationLine) { 
     return `${type}:\n${locationLine}`;
  }
  if (!street && !locationLine) {
      return `${type}:\nDetails N/A`;
  }

  return `${type}:\n${street}\n${locationLine}`;
}

const mockHuddersfieldLocations: Array<{ address: string; coords: { lat: number; lng: number } }> = [
    { address: "Huddersfield Train Station, St George's Square, Huddersfield HD1 1JB", coords: { lat: 53.6483, lng: -1.7805 } },
    { address: "Kingsgate Shopping Centre, King Street, Huddersfield HD1 2QB", coords: { lat: 53.6465, lng: -1.7833 } },
    { address: "University of Huddersfield, Queensgate, Huddersfield HD1 3DH", coords: { lat: 53.6438, lng: -1.7787 } },
    { address: "Greenhead Park, Park Drive, Huddersfield HD1 4HS", coords: { lat: 53.6501, lng: -1.7969 } },
    { address: "Lindley Village, Lidget Street, Huddersfield HD3 3JB", coords: { lat: 53.6580, lng: -1.8280 } },
    { address: "Beaumont Park, Huddersfield HD4 7AY", coords: { lat: 53.6333, lng: -1.8080 } },
    { address: "Marsh, Westbourne Road, Huddersfield HD1 4LE", coords: { lat: 53.6531, lng: -1.8122 } },
    { address: "Almondbury Village, Huddersfield HD5 8XE", coords: { lat: 53.6391, lng: -1.7542 } },
    { address: "Paddock Head, Gledholt Road, Huddersfield HD1 4HP", coords: { lat: 53.6480, lng: -1.8000 } },
    { address: "Salendine Nook Shopping Centre, Huddersfield HD3 3XF", coords: { lat: 53.6612, lng: -1.8437 } },
    { address: "Newsome Road South, Newsome, Huddersfield HD4 6JJ", coords: { lat: 53.6310, lng: -1.7800 } },
    { address: "John Smith's Stadium, Stadium Way, Huddersfield HD1 6PG", coords: { lat: 53.6542, lng: -1.7677 } },
];

interface ActiveStopDetails {
  stopDataIndex: number;
  arrivalTime: Date;
}

interface CurrentStopTimerDisplay {
  stopDataIndex: number;
  freeSecondsLeft: number | null;
  extraSeconds: number | null;
  charge: number;
}

interface HazardType {
  id: string;
  label: string;
  icon: LucideIcon;
  className: string; 
}

const hazardTypes: HazardType[] = [
  { id: 'speed_camera', label: 'Mobile Speed Cam', icon: Gauge, className: 'bg-blue-500 hover:bg-blue-600 text-white border border-black' },
  { id: 'taxi_check', label: 'Roadside Check', icon: ShieldCheckIcon, className: 'bg-sky-500 hover:bg-sky-600 text-white border border-black' },
  { id: 'road_closure', label: 'Road Closure', icon: MinusCircle, className: 'bg-red-500 hover:bg-red-600 text-white border border-black' },
  { id: 'accident', label: 'Accident', icon: AlertTriangle, className: 'bg-orange-500 hover:bg-orange-600 text-white border border-black' },
  { id: 'road_works', label: 'Road Works', icon: Construction, className: 'bg-yellow-500 hover:bg-yellow-600 text-black border border-black' },
  { id: 'heavy_traffic', label: 'Heavy Traffic', icon: UsersIcon, className: 'bg-amber-500 hover:bg-amber-600 text-black border border-black' },
];


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

  const [isNoShowConfirmDialogOpen, setIsNoShowConfirmDialogOpen] = useState(false);
  const [rideToReportNoShow, setRideToReportNoShow] = useState<ActiveRide | null>(null);


  const [currentDriverOperatorPrefix, setCurrentDriverOperatorPrefix] = useState<string | null>(null);
  const [driverRatingForPassenger, setDriverRatingForPassenger] = useState<number>(0);

  const [ackWindowSecondsLeft, setAckWindowSecondsLeft] = useState<number | null>(null);
  const [freeWaitingSecondsLeft, setFreeWaitingSecondsLeft] = useState<number | null>(null);
  const [extraWaitingSeconds, setExtraWaitingSeconds] = useState<number | null>(null);
  const [currentWaitingCharge, setCurrentWaitingCharge] = useState<number>(0);
  const waitingTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const rideRefreshIntervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const driverLocationAtAcceptanceRef = useRef<google.maps.LatLngLiteral | null>(null);
  const stationaryReminderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isStationaryReminderVisible, setIsStationaryReminderVisible] = useState(false);

  const [consecutiveMissedOffers, setConsecutiveMissedOffers] = useState(0);
  const MAX_CONSECUTIVE_MISSED_OFFERS = 3;

  const CustomMapLabelOverlayClassRef = useRef<CustomMapLabelOverlayConstructor | null>(null);


  const [isWRRequestDialogOpen, setIsWRRequestDialogOpen] = useState(false);
  const [wrRequestDialogMinutes, setWrRequestDialogMinutes] = useState<string>("10");
  const [isRequestingWR, setIsRequestingWR] = useState(false);

  const [isAccountJobPinDialogOpen, setIsAccountJobPinDialogOpen] = useState(false);
  const [enteredAccountJobPin, setEnteredAccountJobPin] = useState("");
  const [isVerifyingAccountJobPin, setIsVerifyingAccountJobPin] = useState(false);

  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);
  const [isSosDialogOpen, setIsSosDialogOpen] = useState(false);
  const [isHazardReportDialogOpen, setIsHazardReportDialogOpen] = useState(false);


  const [localCurrentLegIndex, setLocalCurrentLegIndex] = useState(0);
  const journeyPoints = useMemo(() => {
    if (!activeRide) return [];
    const points: LocationPoint[] = [activeRide.pickupLocation];
    if (activeRide.stops) points.push(...activeRide.stops);
    points.push(activeRide.dropoffLocation);
    return points;
  }, [activeRide]);

  const [activeStopDetails, setActiveStopDetails] = useState<ActiveStopDetails | null>(null);
  const stopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentStopTimerDisplay, setCurrentStopTimerDisplay] = useState<CurrentStopTimerDisplay | null>(null);
  const [completedStopWaitCharges, setCompletedStopWaitCharges] = useState<Record<number, number>>({});
  const [accumulatedStopWaitingCharges, setAccumulatedStopWaitingCharges] = useState<number>(0);

  const [showEndOfRideReminder, setShowEndOfRideReminder] = useState(false);
  const endOfRideReminderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSpeedLimitFeatureEnabled, setIsSpeedLimitFeatureEnabled] = useState(false);
  const [currentMockSpeed, setCurrentMockSpeed] = useState(20);
  const [currentMockLimit, setCurrentMockLimit] = useState(30);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [driverCurrentStreetName, setDriverCurrentStreetName] = useState<string | null>(null);

  const [isJourneyDetailsModalOpen, setIsJourneyDetailsModalOpen] = useState(false);
  const [cancellationSuccess, setCancellationSuccess] = useState(false);

  useEffect(() => {
    if (isMapSdkLoaded && typeof window.google !== 'undefined' && window.google.maps) {
      if (!geocoderRef.current && window.google.maps.Geocoder) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
    }
  }, [isMapSdkLoaded]);


  useEffect(() => {
    if (activeRide?.driverCurrentLocation && geocoderRef.current && isMapSdkLoaded) {
      geocoderRef.current.geocode({ location: activeRide.driverCurrentLocation }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const routeComponent = results[0].address_components.find(c => c.types.includes('route'));
          if (routeComponent) {
            setDriverCurrentStreetName(routeComponent.long_name);
          } else {
            const addressParts = results[0].formatted_address.split(',');
            setDriverCurrentStreetName(addressParts[0] || "Tracking...");
          }
        } else {
          console.warn('Reverse geocoding for driver street failed:', status);
          setDriverCurrentStreetName("Location updating...");
        }
      });
    } else if (!activeRide?.driverCurrentLocation) {
      setDriverCurrentStreetName(null);
    }
  }, [activeRide?.driverCurrentLocation, isMapSdkLoaded]);

  useEffect(() => {
    if (!isSpeedLimitFeatureEnabled) return;
    const speedInterval = setInterval(() => {
      setCurrentMockSpeed(prev => {
        const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
        let newSpeed = prev + change;
        if (newSpeed < 0) newSpeed = 0;
        if (newSpeed > 70) newSpeed = 70;
        return newSpeed;
      });
      if (Math.random() < 0.1) { // 10% chance to change limit
        const limits = [20, 30, 40, 50, 60, 70];
        setCurrentMockLimit(limits[Math.floor(Math.random() * limits.length)]);
      }
    }, 3000);
    return () => clearInterval(speedInterval);
  }, [isSpeedLimitFeatureEnabled]);


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
          if (error.code === error.PERMISSION_DENIED || error.code === error.POSITION_UNAVAILABLE) {
            message = "Location access denied or unavailable. Please enable it in your browser/device settings.";
            setIsDriverOnline(false);
            setIsPollingEnabled(false);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
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

    const initialLoadOrNoRide = !activeRide;
    if (initialLoadOrNoRide) setIsLoading(true);

    try {
      const response = await fetch(`/api/driver/active-ride?driverId=${driverUser.id}`);
      console.log("fetchActiveRide response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to fetch active ride: ${response.status}` }));
        throw new Error(errorData.details || errorData.message || `HTTP error ${response.status}`);
      }
      const data: ActiveRide | null = await response.json();
      console.log("fetchActiveRide - Data received from API:", data);

      setError(null);

      setActiveRide(currentClientRide => {
        if (data === null && currentClientRide?.status === 'completed') {
          console.log("fetchActiveRide: API reports no active ride, but client has a 'completed' ride. Retaining client state for rating.");
          return currentClientRide;
        }
        if (JSON.stringify(data) !== JSON.stringify(currentClientRide)) {
            console.log("fetchActiveRide: API data differs from client, updating client state.");
            if (currentClientRide?.id !== data?.id || (currentClientRide && !data)) {
              setLocalCurrentLegIndex(0);
              setCompletedStopWaitCharges({});
              setAccumulatedStopWaitingCharges(0);
              setActiveStopDetails(null);
            }
            return data;
        }
        console.log("fetchActiveRide: API data matches client state, no update needed.");
        return currentClientRide;
      });
      if (data?.driverCurrentLegIndex !== undefined && data.driverCurrentLegIndex !== localCurrentLegIndex) {
        setLocalCurrentLegIndex(data.driverCurrentLegIndex);

        if (data.status === 'in_progress' || data.status === 'in_progress_wait_and_return') {
            const newLegIsIntermediateStop = data.driverCurrentLegIndex > 0 && data.driverCurrentLegIndex < (data.stops?.length || 0) + 1;
            if (newLegIsIntermediateStop) {
                setActiveStopDetails({ stopDataIndex: data.driverCurrentLegIndex - 1, arrivalTime: new Date() });
            } else {
                setActiveStopDetails(null);
            }
        }
      }
      if (data?.completedStopWaitCharges) {
        setCompletedStopWaitCharges(data.completedStopWaitCharges);
        setAccumulatedStopWaitingCharges(Object.values(data.completedStopWaitCharges).reduce((sum, charge) => sum + charge, 0));
      }


    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Unknown error fetching active ride.";
      console.error("Error in fetchActiveRide:", message);
      setError(message);
    } finally {
      if (initialLoadOrNoRide) setIsLoading(false);
    }
  }, [driverUser?.id, activeRide, localCurrentLegIndex]);


  useEffect(() => {
    if (stopIntervalRef.current) {
      clearInterval(stopIntervalRef.current);
      stopIntervalRef.current = null;
    }
    setCurrentStopTimerDisplay(null);

    const currentLegIdx = activeRide?.driverCurrentLegIndex;
    const isAtIntermediateStop = activeRide &&
                                 (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
                                 currentLegIdx !== undefined &&
                                 currentLegIdx > 0 &&
                                 currentLegIdx < journeyPoints.length -1;

    if (isAtIntermediateStop && activeStopDetails && activeStopDetails.stopDataIndex === (currentLegIdx! - 1)) {
      const { stopDataIndex, arrivalTime } = activeStopDetails;

      console.log(`[StopTimerEffect] Activating timer for Stop ${stopDataIndex + 1}. Arrival: ${arrivalTime}`);

      const intervalId = setInterval(() => {
        const now = new Date();
        const secondsSinceArrival = Math.floor((now.getTime() - arrivalTime.getTime()) / 1000);

        let newFreeSeconds = STOP_FREE_WAITING_TIME_SECONDS - secondsSinceArrival;
        let newExtraSeconds = 0;
        let newCharge = 0;

        if (newFreeSeconds < 0) {
          newExtraSeconds = -newFreeSeconds;
          newFreeSeconds = 0;
          newCharge = Math.floor(newExtraSeconds / 60) * STOP_WAITING_CHARGE_PER_MINUTE;
        }
        setCurrentStopTimerDisplay({
          stopDataIndex: stopDataIndex,
          freeSecondsLeft: newFreeSeconds,
          extraSeconds: newExtraSeconds,
          charge: newCharge,
        });
      }, 1000);

      stopIntervalRef.current = intervalId;


      const now = new Date();
      const secondsSinceArrival = Math.floor((now.getTime() - arrivalTime.getTime()) / 1000);
      let initialFreeSeconds = STOP_FREE_WAITING_TIME_SECONDS - secondsSinceArrival;
      let initialExtraSeconds = 0;
      let initialCharge = 0;
      if (initialFreeSeconds < 0) {
          initialExtraSeconds = -initialFreeSeconds;
          initialFreeSeconds = 0;
          initialCharge = Math.floor(initialExtraSeconds / 60) * STOP_WAITING_CHARGE_PER_MINUTE;
      }
      setCurrentStopTimerDisplay({
          stopDataIndex: stopDataIndex,
          freeSecondsLeft: initialFreeSeconds,
          extraSeconds: initialExtraSeconds,
          charge: initialCharge,
      });
    } else {
      console.log("[StopTimerEffect] Conditions not met or arrivalTime not set for current stop. Clearing timer display.");
    }

    return () => {
      if (stopIntervalRef.current) {
        console.log("[StopTimerEffect Cleanup] Clearing timer for stop index", activeStopDetails?.stopDataIndex);
        clearInterval(stopIntervalRef.current);
      }
    };
  }, [activeRide?.status, activeRide?.driverCurrentLegIndex, journeyPoints.length, activeStopDetails]);


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

  useEffect(() => {
    if (endOfRideReminderTimerRef.current) {
      clearTimeout(endOfRideReminderTimerRef.current);
    }
    if (activeRide?.status === 'in_progress') {
      setShowEndOfRideReminder(false);
      endOfRideReminderTimerRef.current = setTimeout(() => {
        setShowEndOfRideReminder(true);
      }, 8000);
    } else {
      setShowEndOfRideReminder(false);
    }
    return () => {
      if (endOfRideReminderTimerRef.current) {
        clearTimeout(endOfRideReminderTimerRef.current);
      }
    };
  }, [activeRide?.status]);

  const handleSimulateOffer = () => {
    const randomPickupIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    let randomDropoffIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    while (randomDropoffIndex === randomPickupIndex) {
      randomDropoffIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    }
    const pickup = mockHuddersfieldLocations[randomPickupIndex];
    const dropoff = mockHuddersfieldLocations[randomDropoffIndex];

    const isPriority = Math.random() < 0.4; 
    let currentPriorityFeeAmount = 0;
    if (isPriority) {
      currentPriorityFeeAmount = parseFloat((Math.random() * 2.5 + 1.0).toFixed(2)); 
    }

    const mockOffer: RideOffer = {
      id: `mock-offer-${Date.now()}`,
      pickupLocation: pickup.address,
      pickupCoords: pickup.coords,
      dropoffLocation: dropoff.address,
      dropoffCoords: dropoff.coords,
      fareEstimate: parseFloat((Math.random() * 15 + 5).toFixed(2)), 
      isPriorityPickup: isPriority,
      priorityFeeAmount: currentPriorityFeeAmount,
      passengerCount: Math.floor(Math.random() * 3) + 1,
      passengerId: `pass-mock-${Date.now().toString().slice(-4)}`,
      passengerName: `Passenger ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
      notes: Math.random() < 0.3 ? "Has some luggage." : undefined,
      requiredOperatorId: Math.random() < 0.5 ? PLATFORM_OPERATOR_CODE : driverUser?.operatorCode || PLATFORM_OPERATOR_CODE,
      distanceMiles: parseFloat((Math.random() * 9 + 1).toFixed(1)), 
      paymentMethod: Math.random() < 0.6 ? 'card' : (Math.random() < 0.8 ? 'cash' : 'account'),
      dispatchMethod: Math.random() < 0.7 ? 'auto_system' : 'manual_operator',
      accountJobPin: Math.random() < 0.1 ? Math.floor(1000 + Math.random() * 9000).toString() : undefined,
    };
    console.log("Simulating offer:", mockOffer);
    setCurrentOfferDetails(mockOffer);
    setIsOfferModalOpen(true);
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
      setLocalCurrentLegIndex(0);
      setRideRequests([]);

      let toastDesc = `En Route to Pickup for ${newActiveRideFromServer.passengerName}. Payment: ${newActiveRideFromServer.paymentMethod === 'card' ? 'Card' : newActiveRideFromServer.paymentMethod === 'account' ? 'Account' : 'Cash'}.`;
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

 const handleRideAction = async (rideId: string, actionType: 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active' | 'accept_wait_and_return' | 'decline_wait_and_return' | 'report_no_show' | 'proceed_to_next_leg') => {
    if (!driverUser || !activeRide || activeRide.id !== rideId) {
        console.error(`handleRideAction: Pre-condition failed. driverUser: ${!!driverUser}, activeRide: ${!!activeRide}, activeRide.id vs rideId: ${activeRide?.id} vs ${rideId}`);
        toast({ title: "Error", description: "No active ride context or ID mismatch.", variant: "destructive"});
        return;
    }
    console.log(`handleRideAction: rideId=${rideId}, actionType=${actionType}. Current activeRide status: ${activeRide.status}, localCurrentLegIndex: ${localCurrentLegIndex}`);

    if (actionType === 'start_ride' && activeRide.paymentMethod === 'account' && activeRide.status === 'arrived_at_pickup' && !activeRide.accountJobPin) {
        toast({title: "Account PIN Error", description: "This account job is missing its verification PIN. Cannot start ride. Please contact support.", variant: "destructive"});
        return;
    }
    if (actionType === 'start_ride' && activeRide.paymentMethod === 'account' && activeRide.status === 'arrived_at_pickup' && activeRide.accountJobPin) {
        if (!isAccountJobPinDialogOpen) {
          setIsAccountJobPinDialogOpen(true);
          return;
        }
    }

    let chargeForPreviousStop = 0;
    const currentStopArrayIndexForChargeCalc = localCurrentLegIndex - 1;
    if ((actionType === 'proceed_to_next_leg' || actionType === 'complete_ride') &&
        activeStopDetails &&
        activeStopDetails.stopDataIndex === currentStopArrayIndexForChargeCalc &&
        currentStopTimerDisplay &&
        currentStopTimerDisplay.stopDataIndex === currentStopArrayIndexForChargeCalc
    ) {
        chargeForPreviousStop = currentStopTimerDisplay.charge;
        setCompletedStopWaitCharges(prev => ({...prev, [currentStopArrayIndexForChargeCalc]: chargeForPreviousStop }));
        setAccumulatedStopWaitingCharges(prev => Object.values({...prev, [currentStopArrayIndexForChargeCalc]: chargeForPreviousStop}).reduce((sum, val) => sum + (val || 0), 0));
    }


    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    console.log(`actionLoading for ${rideId} SET TO TRUE`);

    let toastMessage = ""; let toastTitle = "";
    let payload: any = { action: actionType };

    if (['notify_arrival', 'start_ride', 'proceed_to_next_leg'].includes(actionType) && driverLocation) {
      payload.driverCurrentLocation = driverLocation;
    }

    const updateDataFromPayload = payload;

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
            payload.updatedLegDetails = { newLegIndex: 1, currentLegEntryTimestamp: true };
            setActiveStopDetails(null);
            break;
        case 'proceed_to_next_leg':
            const newLegIdxForProceed = localCurrentLegIndex + 1;
            const currentStopArrayIndexForCharge = localCurrentLegIndex - 1;

            const targetPoint = journeyPoints[newLegIdxForProceed];
            const targetType = newLegIdxForProceed === journeyPoints.length - 1 ? "final dropoff" : `stop ${newLegIdxForProceed}`;
            toastTitle = `Proceeding to ${targetType}`;
            toastMessage = `Navigating to ${targetPoint?.address || 'next location'}.`;

            payload.updatedLegDetails = {
                newLegIndex: newLegIdxForProceed,
                currentLegEntryTimestamp: true,
            };

            if (activeStopDetails && activeStopDetails.stopDataIndex === currentStopArrayIndexForCharge && currentStopTimerDisplay && currentStopTimerDisplay.stopDataIndex === currentStopArrayIndexForCharge) {
                chargeForPreviousStop = currentStopTimerDisplay.charge;
                payload.updatedLegDetails.previousStopIndex = currentStopArrayIndexForCharge;
                payload.updatedLegDetails.waitingChargeForPreviousStop = chargeForPreviousStop;
            }

            setActiveStopDetails(null);

            if (updateDataFromPayload.driverCurrentLocation) {
              payload.driverCurrentLocation = updateDataFromPayload.driverCurrentLocation;
            }
            break;
        case 'complete_ride':
            const baseFare = activeRide.fareEstimate || 0;
            const priorityFee = activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0;
            let wrCharge = 0;
            if(activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes) {
                wrCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
            }
            const finalFare = baseFare + priorityFee + currentWaitingCharge + accumulatedStopWaitingCharges + chargeForPreviousStop + wrCharge;

            toastTitle = "Ride Completed";
            if (activeRide.paymentMethod === "account" && activeRide.accountJobPin) {
                 toastMessage = `Ride with ${activeRide.passengerName} completed. Account holder will be notified. PIN used: ${activeRide.accountJobPin}. Final Fare: £${finalFare.toFixed(2)}.`;
            } else {
                 toastMessage = `Ride with ${activeRide.passengerName} marked as completed. Final fare (incl. priority, all waiting): £${finalFare.toFixed(2)}.`;
            }

            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            payload.finalFare = finalFare;
            payload.completedAt = true;
            setActiveStopDetails(null);

            break;
        case 'cancel_active':
            toastTitle = "Ride Cancelled By You"; toastMessage = `Active ride with ${activeRide.passengerName} cancelled.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setActiveStopDetails(null);
            setAccumulatedStopWaitingCharges(0); setCompletedStopWaitCharges({});
            setAckWindowSecondsLeft(null);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
            payload.status = 'cancelled_by_driver';
            payload.cancellationType = 'driver_cancelled_active';
            break;
        case 'report_no_show':
            toastTitle = "No Show Reported";
            toastMessage = `Passenger ${activeRide.passengerName} reported as no-show. Ride cancelled.`;
            if (waitingTimerIntervalRef.current) clearInterval(waitingTimerIntervalRef.current);
            setActiveStopDetails(null);
            setAccumulatedStopWaitingCharges(0); setCompletedStopWaitCharges({});
            setAckWindowSecondsLeft(null);
            setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
            payload.status = 'cancelled_no_show';
            payload.cancellationType = 'passenger_no_show';
            payload.noShowFeeApplicable = true;
            payload.cancelledAt = Timestamp.now();

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
          driverCurrentLocation: serverData.driverCurrentLocation,
          accountJobPin: serverData.accountJobPin || prev.accountJobPin,
          distanceMiles: serverData.distanceMiles || prev.distanceMiles,
          cancellationFeeApplicable: serverData.cancellationFeeApplicable,
          noShowFeeApplicable: serverData.noShowFeeApplicable,
          cancellationType: serverData.cancellationType,
          driverCurrentLegIndex: serverData.driverCurrentLegIndex !== undefined ? serverData.driverCurrentLegIndex : prev.driverCurrentLegIndex,
          currentLegEntryTimestamp: serverData.currentLegEntryTimestamp || prev.currentLegEntryTimestamp,
          completedStopWaitCharges: serverData.completedStopWaitCharges || prev.completedStopWaitCharges || {},
        };
        if (newClientState.driverCurrentLocation === undefined) {
           newClientState.driverCurrentLocation = driverLocation;
        }
        console.log(`handleRideAction (${actionType}): Setting new activeRide state for ${rideId}:`, newClientState);
        if (actionType === 'start_ride' || actionType === 'proceed_to_next_leg') {
          setLocalCurrentLegIndex(newClientState.driverCurrentLegIndex || 0);
        }
        return newClientState;
      });

      toast({ title: toastTitle, description: toastMessage });
      if (actionType === 'cancel_active' || actionType === 'complete_ride' || actionType === 'report_no_show') {
        console.log(`handleRideAction (${actionType}): Action is terminal for ride ${rideId}. Polling might resume if driver is online.`);
      }


    } catch(err: any) {
      const message = err instanceof Error ? err.message : "Unknown error processing ride action.";
      console.error(`handleRideAction (${actionType}) for ${rideId}: Error caught:`, message);
      toast({ title: "Action Failed", description: message, variant: "destructive" });
      fetchActiveRide();
    } finally {
      console.log(`Resetting actionLoading for ${rideId} to false after action ${actionType}`);
      setActionLoading(prev => ({ ...prev, [rideId]: false }));
    }
  };

  const verifyAndStartAccountJobRide = async () => {
    if (!activeRide || !activeRide.accountJobPin) {
      toast({ title: "Error", description: "Account job details or PIN missing.", variant: "destructive" });
      setIsAccountJobPinDialogOpen(false);
      return;
    }
    setIsVerifyingAccountJobPin(true);
    if (enteredAccountJobPin === activeRide.accountJobPin) {
      toast({ title: "Job PIN Verified!", description: "Starting account job..." });
      setIsAccountJobPinDialogOpen(false);
      setEnteredAccountJobPin("");
      await handleRideAction(activeRide.id, 'start_ride');
    } else {
      toast({ title: "Incorrect Job PIN", description: "The 4-digit PIN entered is incorrect. Please ask the passenger again.", variant: "destructive" });
    }
    setIsVerifyingAccountJobPin(false);
  };

  const handleStartRideWithManualPinOverride = async () => {
    if (!activeRide || !driverUser) return;
    setIsAccountJobPinDialogOpen(false);
    setEnteredAccountJobPin("");
    toast({ title: "Manual Override", description: "Starting account job without PIN verification. Operator will be notified for review.", variant: "default", duration: 7000 });
    console.warn(`Ride ${activeRide.id} for passenger ${activeRide.passengerName} (Account Job) started with manual PIN override by driver ${driverUser.id} (${driverUser.name}). Account PIN was: ${activeRide.accountJobPin || 'Not found in state'}.`);
    await handleRideAction(activeRide.id, 'start_ride');
  };


  const mapDisplayElements = useMemo(() => {
    const markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType, variant?: 'default' | 'compact' }> = [];

    const currentLegIdxToUse = activeRide?.driverCurrentLegIndex !== undefined ? activeRide.driverCurrentLegIndex : localCurrentLegIndex;
    const currentStatus = activeRide?.status?.toLowerCase();

    const currentLocToDisplay = isDriverOnline && watchIdRef.current && driverLocation
        ? driverLocation
        : activeRide?.driverCurrentLocation;

    if (currentLocToDisplay) {
        markers.push({
            position: currentLocToDisplay,
            title: "Your Current Location",
            iconUrl: driverCarIconDataUrl,
            iconScaledSize: {width: 30, height: 30}
        });
    }

    if (activeRide) {
        const isActiveRideStateForStopsAndDropoff = currentStatus && !['completed', 'cancelled_by_driver', 'cancelled_no_show', 'cancelled_by_operator'].includes(currentStatus);

        if (activeRide.pickupLocation) {
          markers.push({
            position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude},
            title: `Pickup: ${activeRide.pickupLocation.address}`,
            label: { text: "P", color: "white", fontWeight: "bold"}
          });

          if (currentLegIdxToUse === 0 && (currentStatus === 'driver_assigned' || currentStatus === 'arrived_at_pickup')) {
            labels.push({
              position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
              content: formatAddressForMapLabel(activeRide.pickupLocation.address, 'Pickup'),
              type: 'pickup'
            });
          }
        }

        activeRide.stops?.forEach((stop, index) => {
          const stopLegIndex = index + 1;
          if(stop.latitude && stop.longitude && isActiveRideStateForStopsAndDropoff) {
            markers.push({
              position: {lat: stop.latitude, lng: stop.longitude},
              title: `Stop ${index+1}: ${stop.address}`,
              label: { text: `S${index+1}`, color: "white", fontWeight: "bold" }
            });
            if (currentLegIdxToUse === stopLegIndex) {
                 labels.push({
                    position: { lat: stop.latitude, lng: stop.longitude },
                    content: formatAddressForMapLabel(stop.address, `Stop ${index+1}`),
                    type: 'stop'
                });
            } else if (currentLegIdxToUse < stopLegIndex) {
                 labels.push({
                    position: { lat: stop.latitude, lng: stop.longitude },
                    content: formatAddressForMapLabel(stop.address, `Next Stop ${index+1}`),
                    type: 'stop',
                    variant: 'compact'
                });
            }
          }
        });

        if (activeRide.dropoffLocation && isActiveRideStateForStopsAndDropoff) {
          const dropoffLegIndex = (activeRide.stops?.length || 0) + 1;
          markers.push({
            position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude},
            title: `Dropoff: ${activeRide.dropoffLocation.address}`,
            label: { text: "D", color: "white", fontWeight: "bold" }
          });
          if (currentLegIdxToUse === dropoffLegIndex) {
            labels.push({
              position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
              content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
              type: 'dropoff'
            });
          } else if (currentLegIdxToUse < dropoffLegIndex ) {
             labels.push({
                position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
                content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
                type: 'dropoff',
                variant: 'compact'
            });
          }
        }
    }
    return { markers: markers, labels };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide, driverLocation, isDriverOnline, journeyPoints, localCurrentLegIndex]);

  const memoizedMapCenter = useMemo(() => {
    if (activeRide) {
        const currentLegIdxToUse = activeRide.driverCurrentLegIndex !== undefined ? activeRide.driverCurrentLegIndex : localCurrentLegIndex;
        const currentTargetPoint = journeyPoints[currentLegIdxToUse];
        if (currentTargetPoint) {
            return {lat: currentTargetPoint.latitude, lng: currentTargetPoint.longitude};
        }
    }
    return driverLocation;
  }, [activeRide, driverLocation, journeyPoints, localCurrentLegIndex]);


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
    if (!ride || !['driver_assigned'].includes(ride.status.toLowerCase())) return null;
    if (ride.status.toLowerCase() === 'arrived_at_pickup') return null;

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
    toast({ title: "EMERGENCY ALERT SENT!", description: "Your operator has been notified. Stay safe.", variant: "destructive", duration: 10000 });
    setIsSosDialogOpen(false);
  };

  const handleQuickSOSAlert = (alertType: string) => {
    toast({
      title: "QUICK SOS ALERT SENT!",
      description: `Your operator has been notified: ${alertType}. Stay safe.`,
      variant: "destructive",
      duration: 10000
    });
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
    if (!driverLocation) {
      toast({ title: "Location Unknown", description: "Cannot report hazard, current location not available.", variant: "destructive" });
      return;
    }
    
    const payload = {
      hazardType: hazardType,
      location: driverLocation,
      reportedByDriverId: driverUser?.id || "unknown_driver",
      reportedAt: new Date().toISOString(),
      status: "active", 
    };
    console.log("Map Hazard Report Payload:", payload);

    try {
      const response = await fetch('/api/driver/map-hazards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit hazard report to server.");
      }
      toast({
        title: "Hazard Reported",
        description: `${hazardType} reported at your current location. Other drivers will be notified.`,
      });
    } catch (error) {
      console.error("Error reporting hazard:", error);
      toast({
        title: "Hazard Report Failed",
        description: error instanceof Error ? error.message : "Could not send hazard report.",
        variant: "destructive",
      });
    }
    setIsHazardReportDialogOpen(false); 
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

    if (isPlatformRide) {
      return isManualDispatch
        ? { text: "Dispatched By App: MANUAL MODE", icon: Briefcase, bgColorClassName: "bg-blue-600" }
        : { text: "Dispatched By App: AUTO MODE", icon: CheckCircleIcon, bgColorClassName: "bg-green-600" };
    }
    if (isOwnOperatorRide) {
      return isManualDispatch
        ? { text: "Dispatched By YOUR BASE: MANUAL MODE", icon: Briefcase, bgColorClassName: "bg-blue-600" }
        : { text: "Dispatched By YOUR BASE: AUTO MODE", icon: CheckCircleIcon, bgColorClassName: "bg-green-600" };
    }

    if (isManualDispatch) {
      const dispatcher = ride.requiredOperatorId ? `Operator ${ride.requiredOperatorId}` : "Platform Admin";
      return { text: `Manually Dispatched by ${dispatcher}`, icon: Briefcase, bgColorClassName: "bg-blue-600" };
    }
    if (isPriorityOverride) {
      return { text: "Dispatched by Operator (Priority)", icon: AlertOctagon, bgColorClassName: "bg-purple-600" };
    }
    return { text: "Dispatched By App (Auto)", icon: CheckCircleIcon, bgColorClassName: "bg-green-600" };
  };
  const dispatchInfo = getActiveRideDispatchInfo(activeRide, driverUser);


  if (isLoading && !activeRide) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (error && !activeRide && !isLoading) {
    return <div className="flex flex-col justify-center items-center h-full text-center p-4">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg font-semibold text-destructive">Error Loading Ride Data</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchActiveRide} variant="outline">Try Again</Button>
    </div>;
  }
  
  const isSosButtonVisible = activeRide && ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase());

  const CurrentNavigationLegBar = () => {
    if (!activeRide || !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase())) {
      return null;
    }
    const currentLeg = journeyPoints[localCurrentLegIndex];
    if (!currentLeg) return null;

    let bgColorClass = "bg-gray-100 dark:bg-gray-700";
    let textColorClass = "text-gray-800 dark:text-gray-200";
    let legTypeLabel = "";

    if (localCurrentLegIndex === 0) { // Pickup
      bgColorClass = "bg-green-100 dark:bg-green-900/50";
      textColorClass = "text-green-700 dark:text-green-300";
      legTypeLabel = activeRide.status === 'arrived_at_pickup' ? "AT PICKUP" : "TO PICKUP";
    } else if (localCurrentLegIndex < journeyPoints.length - 1) { // Stop
      bgColorClass = "bg-yellow-100 dark:bg-yellow-800/50";
      textColorClass = "text-yellow-700 dark:text-yellow-300";
      legTypeLabel = `TO STOP ${localCurrentLegIndex}`;
    } else { // Dropoff
      bgColorClass = "bg-red-100 dark:bg-red-800/50";
      textColorClass = "text-red-700 dark:text-red-300";
      legTypeLabel = "TO DROPOFF";
    }
    
    const addressParts = currentLeg.address.split(',');
    const primaryAddressLine = addressParts[0]?.trim();
    const secondaryAddressLine = addressParts.slice(1).join(',').trim();


    return (
      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-2.5 shadow-lg flex items-center justify-between gap-2",
        bgColorClass,
        "border-t-2 border-black/20 dark:border-white/20" 
      )}>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-bold uppercase tracking-wide", textColorClass)}>{legTypeLabel}</p>
          <p className={cn("text-base md:text-lg font-semibold truncate", textColorClass)}>
            {primaryAddressLine}
          </p>
          {secondaryAddressLine && <p className={cn("text-xs truncate", textColorClass, "opacity-80")}>{secondaryAddressLine}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 md:h-10 md:w-10 bg-white/80 dark:bg-slate-700/80 border-slate-400 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
            onClick={() => setIsJourneyDetailsModalOpen(true)}
            title="View Full Journey Details"
          >
            <Info className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button 
            variant="default" 
            size="icon" 
            className="h-9 w-9 md:h-10 md:w-10 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => toast({ title: "Navigation (Mock)", description: `Would navigate to ${currentLeg.address}`})}
            title={`Navigate to ${legTypeLabel}`}
          >
            <Navigation className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  };


  if (!activeRide) {
    const mapContainerClasses = cn( "relative h-[400px] w-full rounded-xl overflow-hidden shadow-lg border-4 border-border");
    return (
      <div className="flex flex-col h-full space-y-2 p-2 md:p-4">
        {isSpeedLimitFeatureEnabled &&
          <SpeedLimitDisplay
            currentSpeed={currentMockSpeed}
            speedLimit={currentMockLimit}
            isEnabled={isSpeedLimitFeatureEnabled}
          />
        }
        <div className={cn(mapContainerClasses, "relative")}> 
            <GoogleMapDisplay
              center={driverLocation}
              zoom={15}
              markers={mapDisplayElements.markers}
              customMapLabels={mapDisplayElements.labels}
              className="w-full h-full"
              disableDefaultUI={true}
              onSdkLoaded={(loaded) => { setIsMapSdkLoaded(loaded); if (loaded && typeof window !== 'undefined' && window.google?.maps) { CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(window.google.maps); if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder(); } }}
            />
            
            <AlertDialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                    variant="default"
                    size="icon"
                    className={cn(
                        "absolute right-2 z-[1001] h-8 w-8 md:h-9 md:w-9 rounded-full shadow-lg bg-yellow-500 hover:bg-yellow-600 text-black border border-black/50",
                         "top-3" 
                    )}
                    aria-label="Report Road Hazard"
                    title="Report Road Hazard"
                    onClick={() => setIsHazardReportDialogOpen(true)}
                    >
                    <TrafficCone className="h-4 w-4 md:h-5 md:h-5" />
                    </Button>
                </AlertDialogTrigger>
            </AlertDialog>
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
        <div className="pt-1">
            <Switch id="speed-limit-mock-toggle" checked={isSpeedLimitFeatureEnabled} onCheckedChange={setIsSpeedLimitFeatureEnabled} aria-label="Toggle speed limit mock UI"/>
            <Label htmlFor="speed-limit-mock-toggle" className="text-xs ml-2 text-muted-foreground">Show Speed Limit Mock UI</Label>
        </div>
        {isDriverOnline && ( <Button variant="outline" size="sm" onClick={() => {
            if (!activeRide) {
              handleSimulateOffer();
            } else {
              toast({ title: "Action Not Allowed", description: "Please complete your current ride before simulating a new offer.", variant: "default" });
            }
          }} className="mt-2 text-xs h-8 px-3 py-1" disabled={!!activeRide}> Simulate Incoming Ride Offer (Test) </Button> )} </CardContent> </Card> <RideOfferModal isOpen={isOfferModalOpen} onClose={() => { setIsOfferModalOpen(false); setCurrentOfferDetails(null); }} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} rideDetails={currentOfferDetails} />
        <AlertDialog
          open={isStationaryReminderVisible}
          onOpenChange={setIsStationaryReminderVisible}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <ShadAlertDialogTitleForDialog className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" /> Time to Go!
              </ShadAlertDialogTitleForDialog>
              <ShadAlertDialogDescriptionForDialog>
                Please proceed to the pickup location for {activeRide?.passengerName || 'the passenger'} at {activeRide?.pickupLocation.address || 'the specified address'}.
              </ShadAlertDialogDescriptionForDialog>
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
              <ShadAlertDialogTitleForDialog><span>Are you sure you want to cancel this ride?</span></ShadAlertDialogTitleForDialog>
              <ShadAlertDialogDescriptionForDialog><span>This action cannot be undone. The passenger will be notified.</span></ShadAlertDialogDescriptionForDialog>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel
                    onClick={() => { console.log("Cancel Dialog: 'Keep Ride' clicked."); setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}}
                    disabled={activeRide ? !!actionLoading[activeRide.id] : false}
                >
                  Keep Ride
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (activeRide) { console.log("Cancel Dialog: 'Confirm Cancel' clicked for ride:", activeRide.id); handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
                  disabled={!activeRide || (!!actionLoading[activeRide?.id ?? ''])}
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
         <AlertDialog open={isNoShowConfirmDialogOpen} onOpenChange={setIsNoShowConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <ShadAlertDialogTitleForDialog className="text-destructive">Confirm Passenger No-Show</ShadAlertDialogTitleForDialog>
                    <ShadAlertDialogDescriptionForDialog>
                        Are you sure the passenger ({rideToReportNoShow?.passengerName || 'N/A'}) did not show up at the pickup location ({rideToReportNoShow?.pickupLocation.address || 'N/A'})? This will cancel the ride and may impact the passenger's account.
                    </ShadAlertDialogDescriptionForDialog>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsNoShowConfirmDialogOpen(false)}><span>Back</span></AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            if (rideToReportNoShow) handleRideAction(rideToReportNoShow.id, 'report_no_show');
                            setIsNoShowConfirmDialogOpen(false);
                        }}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                       <span>Confirm No-Show</span>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</DialogTitle>
            <ShadDialogDescriptionDialog>
              Estimate additional waiting time at current drop-off. 10 mins free, then £{STOP_WAITING_CHARGE_PER_MINUTE.toFixed(2)}/min. Passenger must approve.
            </ShadDialogDescriptionDialog>
          </DialogHeader>
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

    <Dialog open={isAccountJobPinDialogOpen} onOpenChange={setIsAccountJobPinDialogOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" />Account Job PIN Required</DialogTitle>
          <ShadDialogDescriptionDialog>
            Ask the passenger for their 4-digit Job PIN to start this account ride.
          </ShadDialogDescriptionDialog>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="account-job-pin-input">Enter 4-Digit Job PIN</Label>
          <Input
            id="account-job-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={enteredAccountJobPin}
            onChange={(e) => setEnteredAccountJobPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="••••"
            className="text-center text-xl tracking-[0.3em]"
            disabled={isVerifyingAccountJobPin}
          />
        </div>
        <DialogFooter className="grid grid-cols-1 gap-2">
          <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => {setIsAccountJobPinDialogOpen(false); setEnteredAccountJobPin("");}} disabled={isVerifyingAccountJobPin}>
              Cancel
              </Button>
              <Button type="button" onClick={verifyAndStartAccountJobRide} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isVerifyingAccountJobPin || enteredAccountJobPin.length !== 4}>
              {isVerifyingAccountJobPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & Start Ride
              </Button>
          </div>
          <Button type="button" variant="link" size="sm" className="text-xs text-muted-foreground hover:text-primary h-auto p-1 mt-2" onClick={handleStartRideWithManualPinOverride} disabled={isVerifyingAccountJobPin}>
            Problem with PIN? Start ride manually.
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/>Add a map report</DialogTitle>
          <ShadDialogDescriptionDialog>Select the type of hazard or observation you want to report at your current location.</ShadDialogDescriptionDialog>
        </DialogHeader>
        <div className="py-4 grid grid-cols-2 gap-3">
          {hazardTypes.map((hazard) => (
            <Button
              key={hazard.id}
              variant="outline"
              className={cn("h-auto py-3 flex flex-col items-center gap-1.5 text-xs font-medium", hazard.className)}
              onClick={() => handleReportHazard(hazard.label)}
            >
              <hazard.icon className="w-6 h-6 mb-1" />
              {hazard.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  );
  }

  const {
    status,
    passengerName,
    pickupLocation,
    dropoffLocation,
    stops,
    fareEstimate,
    passengerCount,
    notes,
    paymentMethod,
    isPriorityPickup,
    priorityFeeAmount,
    waitAndReturn,
    estimatedAdditionalWaitTimeMinutes,
    accountJobPin,
    distanceMiles
  } = activeRide;

  const currentStatusNormalized = activeRide?.status?.toLowerCase();
  const isChatDisabled = currentStatusNormalized?.includes('in_progress') ||
    currentStatusNormalized?.includes('completed') ||
    currentStatusNormalized?.includes('cancelled');

  const showDriverAssignedStatus = status === 'driver_assigned';
  const showArrivedAtPickupStatus = status === 'arrived_at_pickup';
  const showInProgressStatus = status.toLowerCase() === 'in_progress';
  const showPendingWRApprovalStatus = status === 'pending_driver_wait_and_return_approval';
  const showInProgressWRStatus = status === 'in_progress_wait_and_return';
  const showCompletedStatus = status === 'completed';
  const showCancelledByDriverStatus = status === 'cancelled_by_driver';
  const showCancelledNoShowStatus = status === 'cancelled_no_show';

  const isRideInProgressOrFurther =
      status.toLowerCase().includes('in_progress') ||
      status.toLowerCase().includes('completed') ||
      status.toLowerCase().includes('cancelled');


  const totalFare = (fareEstimate || 0) + (priorityFeeAmount || 0) + currentWaitingCharge + accumulatedStopWaitingCharges + (currentStopTimerDisplay?.charge || 0);
  let displayedFare = `£${totalFare.toFixed(2)}`;
  if (activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes) {
    const wrWaitCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
    const wrBaseFare = (activeRide.fareEstimate || 0) * 1.70; 
    displayedFare = `£${(wrBaseFare + wrWaitCharge + (priorityFeeAmount || 0) + currentWaitingCharge + accumulatedStopWaitingCharges + (currentStopTimerDisplay?.charge || 0)).toFixed(2)} (W&R)`;
  }

  const paymentMethodDisplay =
      activeRide?.paymentMethod === 'card' ? 'Card'
      : activeRide?.paymentMethod === 'cash' ? 'Cash'
      : activeRide?.paymentMethod === 'account' ? 'Account'
      : 'Payment N/A';

  const isEditingDisabled = activeRide?.status !== 'pending_assignment';

  const mainButtonText = () => {
    const currentLegIdx = localCurrentLegIndex;
    if (status === 'arrived_at_pickup') return "Start Ride";
    if ((status === 'in_progress' || status === 'in_progress_wait_and_return') && currentLegIdx < journeyPoints.length -1) {
      const nextLegIsDropoff = currentLegIdx + 1 === journeyPoints.length - 1;
      if(activeStopDetails && activeStopDetails.stopDataIndex === (currentLegIdx -1)) {
          return `Depart Stop ${currentLegIdx} / Proceed to ${nextLegIsDropoff ? "Dropoff" : `Stop ${currentLegIdx +1}`}`;
      } else {
          return `Arrived at Stop ${currentLegIdx} / Start Timer`;
      }
    }
    if ((status === 'in_progress' || status === 'in_progress_wait_and_return') && currentLegIdx === journeyPoints.length -1) {
      return "Complete Ride";
    }
    return "Status Action";
  };

  const mainButtonAction = () => {
    const currentLegIdx = localCurrentLegIndex;
    if (status === 'arrived_at_pickup') {

      handleRideAction(activeRide.id, 'start_ride');
    }
    else if ((status === 'in_progress' || status === 'in_progress_wait_and_return') && currentLegIdx < journeyPoints.length -1) {
        if(activeStopDetails && activeStopDetails.stopDataIndex === (currentLegIdx -1)) {
            handleRideAction(activeRide.id, 'proceed_to_next_leg');
        } else {
            setActiveStopDetails({stopDataIndex: currentLegIdx - 1, arrivalTime: new Date()});
        }
    }
    else if ((status === 'in_progress' || status === 'in_progress_wait_and_return') && currentLegIdx === journeyPoints.length -1) { handleRideAction(activeRide.id, 'complete_ride'); }
  };

  const mainActionBtnText = mainButtonText();
  const mainActionBtnAction = mainButtonAction;

  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      {isSpeedLimitFeatureEnabled &&
        <SpeedLimitDisplay
          currentSpeed={currentMockSpeed}
          speedLimit={currentMockLimit}
          isEnabled={isSpeedLimitFeatureEnabled}
        />
      }
      {(!showCompletedStatus && !showCancelledByDriverStatus && !showCancelledNoShowStatus) && (
      <div className={cn(
        "relative w-full rounded-b-xl overflow-hidden shadow-lg border-b",
        activeRide ? "h-[calc(45%-0.5rem)]" : "h-[400px]" 
      )}>
          <GoogleMapDisplay
            center={memoizedMapCenter}
            zoom={15}
            fitBoundsToMarkers={true}
            markers={mapDisplayElements.markers}
            customMapLabels={mapDisplayElements.labels}
            className="w-full h-full"
            disableDefaultUI={true}
            onSdkLoaded={(loaded) => { setIsMapSdkLoaded(loaded); if (loaded && typeof window !== 'undefined' && window.google?.maps) { CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(window.google.maps); if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder(); } }}
          />
          {isSosButtonVisible && (
            <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 z-[1001] h-8 w-8 md:h-9 md:w-9 rounded-full shadow-lg animate-pulse"
                  aria-label="SOS Emergency Alert"
                  title="SOS Emergency Alert"
                  onClick={() => setIsSosDialogOpen(true)}
                >
                  <AlertTriangle className="h-4 w-4 md:h-5 md:h-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <ShadAlertDialogTitleForDialog className="text-2xl flex items-center gap-2">
                    <AlertTriangle className="w-7 h-7 text-destructive" /> Confirm Emergency Alert
                  </ShadAlertDialogTitleForDialog>
                  <ShadAlertDialogDescriptionForDialog className="text-base py-2">
                    Select a quick alert or send a general emergency notification.
                    Your operator will be notified immediately.
                    <strong>Use this for genuine emergencies only.</strong>
                  </ShadAlertDialogDescriptionForDialog>
                </AlertDialogHeader>
                <div className="grid grid-cols-2 gap-2 my-3">
                    <Button onClick={() => handleQuickSOSAlert("Emergency")} className="bg-red-500 hover:bg-red-600 text-white border border-black" size="sm">Emergency</Button>
                    <Button onClick={() => handleQuickSOSAlert("Car Broken Down")} className="bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm">Car Broken Down</Button>
                    <Button onClick={() => handleQuickSOSAlert("Customer Aggressive")} className="bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm">Customer Aggressive</Button>
                    <Button onClick={() => handleQuickSOSAlert("Call Me Back")} className="bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm">Call Me Back</Button>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmEmergency}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Send General Alert Now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
           <AlertDialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
              <AlertDialogTrigger asChild>
                  <Button
                  variant="default"
                  size="icon"
                  className={cn(
                    "absolute right-2 z-[1001] rounded-full shadow-lg bg-yellow-500 hover:bg-yellow-600 text-black border border-black/50",
                    "h-8 w-8 md:h-9 md:w-9", 
                    isSosButtonVisible ? "top-12 md:top-[3.0rem]" : "top-2" 
                  )}
                  aria-label="Report Road Hazard"
                  title="Report Road Hazard"
                  onClick={() => setIsHazardReportDialogOpen(true)}
                  >
                  <TrafficCone className="h-4 w-4 md:h-5 md:h-5" />
                  </Button>
              </AlertDialogTrigger>
          </AlertDialog>
          <CurrentNavigationLegBar />
      </div>
      )}
      <Card className={cn(
        "rounded-t-xl z-10 shadow-xl border-t-4 border-primary bg-card flex flex-col overflow-hidden",
        (showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus)
          ? "mt-0 rounded-b-xl"
          : "flex-1"
      )}>
        <ScrollArea className={cn( (showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus) ? "" : "flex-1" )}>
          <CardContent className="p-2 space-y-1.5">
          {showDriverAssignedStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="secondary" className="text-xs w-fit mx-auto bg-sky-500 text-white py-1 px-3 rounded-md font-semibold shadow"> En Route to Pickup </Badge> </div> )}
          {showArrivedAtPickupStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="outline" className="text-xs w-fit mx-auto border-blue-500 text-blue-500 py-1 px-3 rounded-md font-semibold shadow"> Arrived At Pickup </Badge> </div> )}
          {showInProgressStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="default" className="text-xs w-fit mx-auto bg-green-600 text-white py-1 px-3 rounded-md font-semibold shadow"> Ride In Progress </Badge> </div> )}
          {showPendingWRApprovalStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="secondary" className="text-xs w-fit mx-auto bg-purple-500 text-white py-1 px-3 rounded-md font-semibold shadow"> W&R Request Pending </Badge> </div> )}
          {showInProgressWRStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="default" className="text-xs w-fit mx-auto bg-teal-600 text-white py-1 px-3 rounded-md font-semibold shadow"> Ride In Progress (W&R) </Badge> </div> )}
          {showCompletedStatus && ( <div className="flex justify-center my-3"> <Badge variant="default" className="text-base w-fit mx-auto bg-primary text-primary-foreground py-1.5 px-4 rounded-lg font-bold shadow-lg flex items-center gap-2"> <CheckCircleIcon className="w-5 h-5" /> Ride Completed </Badge> </div> )}
          {showCancelledByDriverStatus && ( <div className="flex justify-center my-3"> <Badge variant="destructive" className="text-base w-fit mx-auto py-1.5 px-4 rounded-lg font-bold shadow-lg flex items-center gap-2"> <XCircle className="w-5 h-5" /> Ride Cancelled By You </Badge> </div> )}
          {showCancelledNoShowStatus && ( <div className="flex justify-center my-3"> <Badge variant="destructive" className="text-base w-fit mx-auto py-1.5 px-4 rounded-lg font-bold shadow-lg flex items-center gap-2"> <UserXIcon className="w-5 h-5" /> Passenger No-Show </Badge> </div> )}


          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 border">
            <Avatar className="h-7 w-7 md:h-8 md:h-8">
                <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/40x40.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/>
                <AvatarFallback className="text-sm">{activeRide.passengerName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm md:text-base">{activeRide.passengerName}</p>
              {activeRide.passengerPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <PhoneCall className="w-2.5 h-2.5"/> {activeRide.passengerPhone}
                </p>
              )}
            </div>
              {(!showCompletedStatus && !showCancelledByDriverStatus && !showCancelledNoShowStatus) && (
                <div className="flex items-center gap-0.5">
                  {activeRide.passengerPhone && (
                    <Button asChild variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                      <a href={`tel:${activeRide.passengerPhone}`} aria-label="Call passenger">
                        <PhoneCall className="w-3.5 h-3.5 md:w-4 md:w-4" />
                      </a>
                    </Button>
                  )}
                  {isChatDisabled ? (
                      <Button variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8" disabled>
                        <MessageSquare className="w-3.5 h-3.5 md:w-4 md:w-4 text-muted-foreground opacity-50" />
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                        <Link href="/driver/chat"><MessageSquare className="w-3.5 h-3.5 md:w-4 md:w-4" /></Link>
                      </Button>
                    )}
                </div>
               )}
          </div>
          
          {dispatchInfo && (status === 'driver_assigned' || status === 'arrived_at_pickup') && (
              <div className={cn("p-1 my-1.5 rounded-lg text-center text-white font-semibold", dispatchInfo.bgColorClassName, "border border-black")}>
                <p className="text-sm flex items-center justify-center gap-1">
                  <dispatchInfo.icon className="w-4 h-4 text-white"/> {dispatchInfo.text}
                </p>
              </div>
          )}

          {isPriorityPickup && !dispatchInfo?.text.toLowerCase().includes("priority") && (status === 'driver_assigned' || status === 'arrived_at_pickup') && (
              <Alert variant="default" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 p-1.5 text-[10px] my-1">
                  <Crown className="h-3.5 w-3.5" />
                  <ShadAlertTitle className="font-medium text-xs">Priority Booking</ShadAlertTitle>
                  <ShadAlertDescription className="text-[10px]">
                      Passenger offered +£{(priorityFeeAmount || 0).toFixed(2)}.
                  </ShadAlertDescription>
              </Alert>
          )}
          {showArrivedAtPickupStatus && (
            <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-300 my-1 p-1.5">
              <Timer className="h-4 w-4 text-current" />
              <ShadAlertTitle className="font-semibold text-current text-xs">Passenger Waiting Status</ShadAlertTitle>
              <ShadAlertDescription className="text-current text-[10px] font-semibold">
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
         {currentStopTimerDisplay &&
            activeRide.driverCurrentLegIndex &&
            activeRide.driverCurrentLegIndex > 0 &&
            activeRide.driverCurrentLegIndex < journeyPoints.length -1 &&
            currentStopTimerDisplay.stopDataIndex === (activeRide.driverCurrentLegIndex -1) &&
            (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
          (
            <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-300 my-1 p-1.5">
              <Timer className="h-4 w-4 text-current" />
              <ShadAlertTitle className="font-bold text-current text-xs">
                Waiting at Stop {currentStopTimerDisplay.stopDataIndex + 1}
              </ShadAlertTitle>
              <ShadAlertDescription className="font-semibold text-current text-[10px]">
                {currentStopTimerDisplay.freeSecondsLeft !== null && currentStopTimerDisplay.freeSecondsLeft > 0 && (
                  `Free waiting time: ${formatTimer(currentStopTimerDisplay.freeSecondsLeft)} remaining.`
                )}
                {currentStopTimerDisplay.extraSeconds !== null && currentStopTimerDisplay.extraSeconds >= 0 && currentStopTimerDisplay.freeSecondsLeft === 0 && (
                  `Extra waiting: ${formatTimer(currentStopTimerDisplay.extraSeconds)}. Current Charge: £${currentStopTimerDisplay.charge.toFixed(2)}`
                )}
              </ShadAlertDescription>
            </Alert>
          )}
          {showPendingWRApprovalStatus && activeRide.estimatedAdditionalWaitTimeMinutes !== undefined && (
               <Alert variant="default" className="bg-purple-100 dark:bg-purple-800/30 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 my-1 p-1.5">
                  <RefreshCw className="h-4 w-4 text-current animate-spin" />
                  <ShadAlertTitle className="font-semibold text-current text-xs">Wait & Return Request</ShadAlertTitle>
                  <ShadAlertDescription className="text-current text-[10px]">
                      Passenger requests Wait & Return with an estimated <strong>{activeRide.estimatedAdditionalWaitTimeMinutes} minutes</strong> of waiting.
                      <br />
                      New estimated total fare (if accepted): £{(( (fareEstimate || 0) + (priorityFeeAmount || 0) ) * 1.70 + (Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE)).toFixed(2)}.
                      <div className="flex gap-1 mt-1">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'accept_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Accept W&R</Button>
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'decline_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Decline W&R</Button>
                      </div>
                  </ShadAlertDescription>
              </Alert>
          )}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-black/70 dark:border-green-700 text-green-900 dark:text-green-100 text-sm">
                <div className={cn("col-span-2 border-2 border-black dark:border-gray-700 rounded-md px-2 py-1 my-1 font-bold")}>
                  <p className="flex items-center gap-1.5 font-bold text-base">
                    <DollarSign className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                    Fare: {displayedFare}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 font-medium"><UsersIcon className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Passengers: {activeRide.passengerCount}</p>
                {activeRide.distanceMiles != null && (
                  <p className="flex items-center gap-1.5 font-medium"><Route className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Dist: ~{activeRide.distanceMiles.toFixed(1)} mi</p>
                )}
                {paymentMethod && ( <p className="flex items-center gap-1.5 col-span-2 font-medium"> {paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : <Briefcase className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />} Payment: {paymentMethodDisplay} </p> )}
                 {(showCompletedStatus || showCancelledNoShowStatus) && (
                  <>
                    <Separator className="col-span-2 my-1 bg-green-300 dark:bg-green-700/50" />
                    {journeyPoints.map((point, index) => {
                      const isPickup = index === 0;
                      const isDropoff = index === journeyPoints.length - 1;
                      let legType = "";
                      if (isPickup) legType = "Pickup";
                      else if (isDropoff) legType = "Dropoff";
                      else legType = `Stop ${index}`;
                      return (
                        <div key={`completed-leg-${index}`} className="col-span-2 flex items-start gap-1.5">
                          <MapPin className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", isPickup ? "text-green-700 dark:text-green-300" : isDropoff ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300")} />
                          <div className="text-xs">
                            <span className="font-semibold">{legType}:</span> {point.address}
                            {point.doorOrFlat && <span className="text-green-800 dark:text-green-200/80"> ({point.doorOrFlat})</span>}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
          </div>
          {notes && !isRideInProgressOrFurther && (
              <div className="rounded-md p-2 my-1.5 bg-yellow-300 dark:bg-yellow-700/50 border-l-4 border-purple-600 dark:border-purple-400">
                  <p className="text-yellow-900 dark:text-yellow-200 text-xs md:text-sm font-semibold whitespace-pre-wrap">
                  <strong>Notes:</strong> {notes}
                  </p>
              </div>
          )}
          {(showCompletedStatus || showCancelledNoShowStatus) && (
            <div className="mt-2 pt-2 border-t text-center">
              <p className="text-xs font-medium mb-0.5">Rate {passengerName || "Passenger"} (for {activeRide.requiredOperatorId || "N/A"}):</p>
              <div className="flex justify-center space-x-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-6 h-6 cursor-pointer",
                      i < driverRatingForPassenger ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                    )}
                    onClick={() => setDriverRatingForPassenger(i + 1)}
                  />
                ))}
              </div>
            </div>
          )}
          {(showCancelledByDriverStatus || showCancelledNoShowStatus) && ( <div className="mt-2 pt-2 border-t text-center"> <p className="text-xs text-muted-foreground">This ride was cancelled. You can now look for new offers.</p> </div> )}
          </CardContent>
        </ScrollArea>

        {!(showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus) && (
          <div className="p-2 border-t grid gap-1.5 shrink-0">
            {showDriverAssignedStatus && ( <> <div className="grid grid-cols-2 gap-1.5"> <Button variant="outline" className="w-full text-sm py-2 h-auto" onClick={() => {console.log("Navigate (Driver Assigned) clicked for ride:", activeRide.id); toast({title: "Navigation (Mock)", description: "Would open maps to pickup."})}}> <Navigation className="mr-1.5 h-4 w-4"/> Navigate </Button> <Button className="w-full bg-blue-600 hover:bg-blue-700 text-sm text-white py-2 h-auto" onClick={() => {console.log("Notify Arrival clicked for ride:", activeRide.id, "Current status:", activeRide.status); handleRideAction(activeRide.id, 'notify_arrival')}} disabled={!!actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-1.5 h-4 w-4" />}Notify Arrival </Button> </div> <CancelRideInteraction ride={activeRide} isLoading={!!actionLoading[activeRide.id]} /> </> )}
            {showArrivedAtPickupStatus && ( <div className="grid grid-cols-1 gap-1.5"> <div className="grid grid-cols-2 gap-1.5"> <Button variant="outline" className="w-full text-sm py-2 h-auto" onClick={() => {console.log("Navigate (Arrived) clicked for ride:", activeRide.id); toast({title: "Navigation (Mock)", description: "Would open maps to dropoff."})}} > <Navigation className="mr-1.5 h-4 w-4"/> Navigate </Button> <Button className="w-full bg-green-600 hover:bg-green-700 text-sm text-white py-2 h-auto" onClick={() => {console.log("Start Ride clicked for ride:", activeRide.id, "Current status:", activeRide.status); handleRideAction(activeRide.id, 'start_ride')}} disabled={!!actionLoading[activeRide.id]}> {actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-1.5 h-4 w-4" />}Start Ride </Button> </div>
            <Button
                variant="destructive"
                className="w-full text-sm py-2 h-auto bg-red-700 hover:bg-red-800"
                onClick={() => {
                    setRideToReportNoShow(activeRide);
                    setIsNoShowConfirmDialogOpen(true);
                }}
                disabled={!!actionLoading[activeRide.id]}
              >
                {actionLoading[activeRide.id] && activeRide.status === 'cancelled_no_show' ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <UserXIcon className="mr-1.5 h-4 w-4"/>}
                Report No Show
            </Button>
            </div> )}
            {(showInProgressStatus || showInProgressWRStatus) && (
              <div className="grid grid-cols-1 gap-1.5">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm text-white py-2 h-auto"
                  onClick={mainActionBtnAction}
                  disabled={!!actionLoading[activeRide.id]}
                >
                  {actionLoading[activeRide.id] ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Navigation className="mr-1.5 h-4 w-4" />}
                  {mainActionBtnText}
                </Button>
                {showInProgressStatus && !activeRide.waitAndReturn && (
                  <Button
                    variant="outline"
                    className="w-full text-sm py-2 h-auto border-accent text-accent hover:bg-accent/10"
                    onClick={() => setIsWRRequestDialogOpen(true)}
                    disabled={isRequestingWR || !!actionLoading[activeRide.id]}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Request Wait & Return
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
         {(showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus) && (
              <div className="p-2 border-t grid gap-1.5 shrink-0">
                <Button
                    className="w-full bg-slate-600 hover:bg-slate-700 text-base text-white py-2.5 h-auto"
                    onClick={() => {
                        console.log("Done button clicked. Current status:", activeRide.status, "Rating given:", driverRatingForPassenger);
                        if(showCompletedStatus && driverRatingForPassenger > 0 && activeRide.passengerName) {
                            console.log(`Mock: Driver rated passenger ${activeRide.passengerName} with ${driverRatingForPassenger} stars.`);
                            toast({title: "Passenger Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${driverRatingForPassenger} stars.`});
                        }
                        setDriverRatingForPassenger(0);
                        setCurrentWaitingCharge(0);
                        setAccumulatedStopWaitingCharges(0);
                        setCompletedStopWaitCharges({});
                        setCurrentStopTimerDisplay(null);
                        setActiveStopDetails(null);
                        setIsCancelSwitchOn(false);
                        setActiveRide(null);
                        setIsPollingEnabled(true);
                    }}
                    disabled={activeRide ? !!actionLoading[activeRide.id] : false}
                >
                    {(activeRide && !!actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />} Done
                </Button>
              </div>
           )}
        </Card>
        <AlertDialog
          open={isStationaryReminderVisible}
          onOpenChange={setIsStationaryReminderVisible}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <ShadAlertDialogTitleForDialog className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" /> Time to Go!
              </ShadAlertDialogTitleForDialog>
              <ShadAlertDialogDescriptionForDialog>
                Please proceed to the pickup location for {activeRide?.passengerName || 'the passenger'} at {activeRide?.pickupLocation.address || 'the specified address'}.
              </ShadAlertDialogDescriptionForDialog>
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
              <ShadAlertDialogTitleForDialog><span>Are you sure you want to cancel this ride?</span></ShadAlertDialogTitleForDialog>
              <ShadAlertDialogDescriptionForDialog><span>This action cannot be undone. The passenger will be notified.</span></ShadAlertDialogDescriptionForDialog>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel
                    onClick={() => { console.log("Cancel Dialog: 'Keep Ride' clicked."); setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}}
                    disabled={activeRide ? !!actionLoading[activeRide.id] : false}
                >
                  Keep Ride
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (activeRide) { console.log("Cancel Dialog: 'Confirm Cancel' clicked for ride:", activeRide.id); handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
                  disabled={!activeRide || (!!actionLoading[activeRide?.id ?? ''])}
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
         <AlertDialog open={isNoShowConfirmDialogOpen} onOpenChange={setIsNoShowConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <ShadAlertDialogTitleForDialog className="text-destructive">Confirm Passenger No-Show</ShadAlertDialogTitleForDialog>
                    <ShadAlertDialogDescriptionForDialog>
                        Are you sure the passenger ({rideToReportNoShow?.passengerName || 'N/A'}) did not show up at the pickup location ({rideToReportNoShow?.pickupLocation.address || 'N/A'})? This will cancel the ride and may impact the passenger's account.
                    </ShadAlertDialogDescriptionForDialog>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsNoShowConfirmDialogOpen(false)}><span>Back</span></AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            if (rideToReportNoShow) handleRideAction(rideToReportNoShow.id, 'report_no_show');
                            setIsNoShowConfirmDialogOpen(false);
                        }}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                       <span>Confirm No-Show</span>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</DialogTitle>
            <ShadDialogDescriptionDialog>
              Estimate additional waiting time at current drop-off. 10 mins free, then £{STOP_WAITING_CHARGE_PER_MINUTE.toFixed(2)}/min. Passenger must approve.
            </ShadDialogDescriptionDialog>
          </DialogHeader>
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

    <Dialog open={isAccountJobPinDialogOpen} onOpenChange={setIsAccountJobPinDialogOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" />Account Job PIN Required</DialogTitle>
          <ShadDialogDescriptionDialog>
            Ask the passenger for their 4-digit Job PIN to start this account ride.
          </ShadDialogDescriptionDialog>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="account-job-pin-input">Enter 4-Digit Job PIN</Label>
          <Input
            id="account-job-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={enteredAccountJobPin}
            onChange={(e) => setEnteredAccountJobPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="••••"
            className="text-center text-xl tracking-[0.3em]"
            disabled={isVerifyingAccountJobPin}
          />
        </div>
        <DialogFooter className="grid grid-cols-1 gap-2">
          <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => {setIsAccountJobPinDialogOpen(false); setEnteredAccountJobPin("");}} disabled={isVerifyingAccountJobPin}>
              Cancel
              </Button>
              <Button type="button" onClick={verifyAndStartAccountJobRide} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isVerifyingAccountJobPin || enteredAccountJobPin.length !== 4}>
              {isVerifyingAccountJobPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & Start Ride
              </Button>
          </div>
          <Button type="button" variant="link" size="sm" className="text-xs text-muted-foreground hover:text-primary h-auto p-1 mt-2" onClick={handleStartRideWithManualPinOverride} disabled={isVerifyingAccountJobPin}>
            Problem with PIN? Start ride manually.
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={isHazardReportDialogOpen} onOpenChange={setIsHazardReportDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/>Add a map report</DialogTitle>
          <ShadDialogDescriptionDialog>Select the type of hazard or observation you want to report at your current location.</ShadDialogDescriptionDialog>
        </DialogHeader>
        <div className="py-4 grid grid-cols-2 gap-3">
          {hazardTypes.map((hazard) => (
            <Button
              key={hazard.id}
              variant="outline"
              className={cn("h-auto py-3 flex flex-col items-center gap-1.5 text-xs font-medium", hazard.className)}
              onClick={() => handleReportHazard(hazard.label)}
            >
              <hazard.icon className="w-6 h-6 mb-1" />
              {hazard.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     <Dialog open={isJourneyDetailsModalOpen} onOpenChange={setIsJourneyDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2"><Route className="w-5 h-5 text-primary" /> Full Journey Details</DialogTitle>
            <ShadDialogDescriptionDialog>
              Overview of all legs for the current ride (ID: {activeRide?.id || 'N/A'}).
            </ShadDialogDescriptionDialog>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-1 -mx-1">
            <div className="p-4 space-y-3">
              {activeRide && journeyPoints.map((point, index) => {
                const isCurrentLeg = index === localCurrentLegIndex;
                const isPastLeg = index < localCurrentLegIndex;
                const isPickup = index === 0;
                const isDropoff = index === journeyPoints.length - 1;
                let legType = "";
                let Icon = MapPin;
                let iconColor = "text-muted-foreground";

                if (isPickup) { legType = "Pickup"; iconColor = "text-green-500"; }
                else if (isDropoff) { legType = "Dropoff"; iconColor = "text-orange-500"; }
                else { legType = `Stop ${index}`; iconColor = "text-blue-500"; }

                return (
                  <div 
                    key={`modal-leg-${index}`} 
                    className={cn(
                      "p-2.5 rounded-md border",
                      isPastLeg ? "bg-muted/30 border-muted-foreground/30" : "bg-card",
                      isCurrentLeg && "ring-2 ring-primary shadow-md"
                    )}
                  >
                    <p className={cn("font-semibold flex items-center gap-2", iconColor, isPastLeg && "line-through text-muted-foreground/70")}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {legType}
                    </p>
                    <p className={cn("text-sm text-foreground pl-6", isPastLeg && "line-through text-muted-foreground/70")}>
                      {point.address}
                    </p>
                    {point.doorOrFlat && (
                      <p className={cn("text-xs text-muted-foreground pl-6", isPastLeg && "line-through text-muted-foreground/70")}>
                        (Unit/Flat: {point.doorOrFlat})
                      </p>
                    )}
                  </div>
                );
              })}
              {!activeRide && <p>No active ride details to display.</p>}
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
);
}


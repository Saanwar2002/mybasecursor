
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MapPin, Car, Clock, Loader2, AlertTriangle, Edit, XCircle, DollarSign, Calendar as CalendarIconLucide, Users, MessageSquare, UserCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, PlusCircle, Timer, Info, Check, Navigation, Play, PhoneCall, RefreshCw, Briefcase, UserX as UserXIcon, TrafficCone, Gauge, ShieldCheck as ShieldCheckIcon, MinusCircle, Construction, Users as UsersIcon, Power, AlertOctagon, LockKeyhole, CheckCircle as CheckCircleIcon, Route, Crown, Star, ShieldAlert } from "lucide-react";
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, UserRole, PLATFORM_OPERATOR_CODE, type User } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format, parseISO, isValid, differenceInMinutes, addMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from "@/components/ui/separator";
import Image from 'next/image';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescriptionDialog, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Renamed DialogDescription
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BookingUpdatePayload } from '@/app/api/operator/bookings/[bookingId]/route';
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescriptionForAlert } from "@/components/ui/alert"; // Renamed AlertDescription for Alert
import type { ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor, LabelType } from '@/components/ui/custom-map-label-overlay';
import { getCustomMapLabelOverlayClass } from '@/components/ui/custom-map-label-overlay';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const carIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#2563EB" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(driverCarIconSvg)}` : '';


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

interface MapHazard {
  id: string;
  hazardType: string;
  location: { latitude: number; longitude: number };
  reportedAt: string;
  status: string;
}


const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const driverCarIconSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(driverCarIconSvg)}` : '';


const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;
const STATIONARY_REMINDER_TIMEOUT_MS = 60000;
const MOVEMENT_THRESHOLD_METERS = 50;
const HAZARD_ALERT_DISTANCE_METERS = 500;
const HAZARD_ALERT_RESET_DISTANCE_METERS = 750;
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

const MOCK_HAZARDS_TO_SEED = [
  { id: 'mock-hazard-speedcam-001', hazardType: 'mobile_speed_camera', location: { latitude: 53.6450, longitude: -1.7850 } },
  { id: 'mock-hazard-roadworks-002', hazardType: 'road_works', location: { latitude: 53.6400, longitude: -1.7700 } },
  { id: 'mock-hazard-accident-003', hazardType: 'accident', location: { latitude: 53.6500, longitude: -1.7900 } },
  { id: 'mock-hazard-taxi-check-004', hazardType: 'roadside_taxi_checking', location: { latitude: 53.6488, longitude: -1.7805 } },
  { id: 'mock-hazard-traffic-005', hazardType: 'heavy_traffic', location: { latitude: 53.6430, longitude: -1.7797 } },
];

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

const mockHuddersfieldLocations: Array<{address: string, coords: {lat: number, lng: number}}> = [
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
import { RideOfferModal, type RideOffer } from "@/components/driver/ride-offer-modal";
import { SpeedLimitDisplay } from '@/components/driver/SpeedLimitDisplay';
import { db } from '@/lib/firebase';
import { GeoPoint, Timestamp as FirestoreTimestampFirebase, doc, setDoc } from 'firebase/firestore'; // Renamed to avoid clash


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
  const alertedForThisApproachRef = useRef<Set<string>>(new Set<string>());

  const [isAccountJobPinDialogOpen, setIsAccountJobPinDialogOpen] = useState(false);
  const [enteredAccountJobPin, setEnteredAccountJobPin] = useState("");
  const [isVerifyingAccountJobPin, setIsVerifyingAccountJobPin] = useState(false);

  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);

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
    if (driverUser) {
      fetchActiveRide();
      const rideRefreshInterval = setInterval(fetchActiveRide, 30000);
      return () => clearInterval(rideRefreshInterval);
    } else {
      setIsLoading(false);
    }
  }, [driverUser, fetchActiveRide]);

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
          location: new GeoPoint(mock.location.latitude, mock.location.longitude),
          reportedByDriverId: driverUser?.id || "mock-seeder",
          reportedAt: FirestoreTimestampFirebase.now(),
          status: 'active',
          confirmations: 0,
          negations: 0,
          lastConfirmedAt: FirestoreTimestampFirebase.now(),
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

    let availableLocations = [...mockHuddersfieldLocations];
    const numStops = Math.floor(Math.random() * 3); // 0, 1, or 2 stops

    const getRandomLocation = () => {
      if (availableLocations.length === 0) {
          availableLocations = [...mockHuddersfieldLocations];
          console.warn("Ran out of unique mock locations, reusing.");
      }
      const index = Math.floor(Math.random() * availableLocations.length);
      const selected = availableLocations[index];
      availableLocations.splice(index, 1);
      return selected;
    };

    const pickup = getRandomLocation();
    const stops: RideOffer['stops'] = [];
    for (let i = 0; i < numStops; i++) {
      if (availableLocations.length > 0) {
        const stopLoc = getRandomLocation();
        stops.push({
          address: stopLoc.address,
          coords: stopLoc.coords,
        });
      }
    }
    const dropoff = getRandomLocation();

    const distance = parseFloat((Math.random() * 10 + 1).toFixed(1));
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
      pickupLocation: pickup.address,
      pickupCoords: pickup.coords,
      dropoffLocation: dropoff.address,
      dropoffCoords: dropoff.coords,
      stops: stops.length > 0 ? stops : undefined,
      fareEstimate: parseFloat((Math.random() * 15 + 5).toFixed(2)),
      passengerCount: Math.floor(Math.random() * 3) + 1,
      notes: Math.random() < 0.3 ? "Simulated: Passenger has luggage and needs assistance." : undefined,
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
            payload.cancelledAt = FirestoreTimestampFirebase.now();

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

  const mapDisplayElements = useMemo(() => {
    const markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    // Labels are handled by currentLegDisplayInfo now
    // const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType, variant?: 'default' | 'compact' }> = [];


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
        const currentStatus = activeRide.status?.toLowerCase();
        const isActiveRideStateForStopsAndDropoff = currentStatus && !['completed', 'cancelled_by_driver', 'cancelled_no_show', 'cancelled_by_operator'].includes(currentStatus);


        if (activeRide.pickupLocation) {
          markers.push({
            position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude},
            title: `Pickup: ${activeRide.pickupLocation.address}`,
            label: { text: "P", color: "white", fontWeight: "bold"}
          });
        }

        activeRide.stops?.forEach((stop, index) => {
          const stopLegIndex = index + 1;
          if(stop.latitude && stop.longitude && isActiveRideStateForStopsAndDropoff) {
            markers.push({
              position: {lat: stop.latitude, lng: stop.longitude},
              title: `Stop ${index+1}: ${stop.address}`,
              label: { text: `S${index+1}`, color: "white", fontWeight: "bold" }
            });
          }
        });

        if (activeRide.dropoffLocation && isActiveRideStateForStopsAndDropoff) {
          markers.push({
            position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude},
            title: `Dropoff: ${activeRide.dropoffLocation.address}`,
            label: { text: "D", color: "white", fontWeight: "bold" }
          });
        }
    }
    return { markers, labels: [] }; // Return empty labels array
  }, [activeRide, driverLocation, isDriverOnline, journeyPoints]);

  const memoizedMapCenter = useMemo(() => {
    if (activeRide) {
        const currentLegIdxToUse = activeRide.driverCurrentLegIndex !== undefined ? activeRide.driverCurrentLegIndex : localCurrentLegIndex;
        const targetPoint = journeyPoints[currentLegIdxToUse];
        if (targetPoint) {
            return {lat: targetPoint.latitude, lng: targetPoint.longitude};
        }
    }
    return driverLocation;
  }, [activeRide, driverLocation, journeyPoints, localCurrentLegIndex]);

  const currentLegDisplayInfo = useMemo(() => {
    if (!activeRide || !journeyPoints.length) return null;

    const currentLegIdx = localCurrentLegIndex;
    const currentStatus = activeRide.status.toLowerCase();
    const relevantStatuses = ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'];

    if (!relevantStatuses.includes(currentStatus) || currentLegIdx < 0 || currentLegIdx >= journeyPoints.length) {
      return null;
    }

    const targetPoint = journeyPoints[currentLegIdx];
    let label = "";
    let address = targetPoint.doorOrFlat ? `${targetPoint.doorOrFlat}, ${targetPoint.address}` : targetPoint.address;
    let bgColor = "bg-gray-600";
    let textColor = "text-white";

    if (currentLegIdx === 0) { // Pickup leg
      label = currentStatus === 'arrived_at_pickup' ? "At Pickup" : "Next: Pickup";
      bgColor = "bg-green-600";
    } else if (currentLegIdx < journeyPoints.length - 1) { // Intermediate stop leg
      label = `Next: Stop ${currentLegIdx}`;
      bgColor = "bg-yellow-400";
      textColor = "text-black";
    } else { // Final dropoff leg
      label = "Next: Final Dropoff";
      bgColor = "bg-red-600";
    }
    return { label, address, bgColor, textColor };
  }, [activeRide, localCurrentLegIndex, journeyPoints]);


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

  // Conditional early returns for loading and error states
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

  // Destructure activeRide properties after ensuring it's not null
  const {
    status,
    passengerName,
    fareEstimate,
    passengerCount,
    notes,
    paymentMethod,
    isPriorityPickup,
    priorityFeeAmount,
    waitAndReturn,
    estimatedAdditionalWaitTimeMinutes,
    accountJobPin
  } = activeRide || {}; 

  const currentStatusNormalized = status?.toLowerCase();
  const isChatDisabled = currentStatusNormalized?.includes('in_progress') ||
    currentStatusNormalized?.includes('completed') ||
    currentStatusNormalized?.includes('cancelled');

  const showDriverAssignedStatus = status === 'driver_assigned';
  const showArrivedAtPickupStatus = status === 'arrived_at_pickup';
  const showInProgressStatus = status?.toLowerCase() === 'in_progress';
  const showPendingWRApprovalStatus = status === 'pending_driver_wait_and_return_approval';
  const showInProgressWRStatus = status === 'in_progress_wait_and_return';
  const showCompletedStatus = status === 'completed';
  const showCancelledByDriverStatus = status === 'cancelled_by_driver';
  const showCancelledNoShowStatus = status === 'cancelled_no_show';
  
  const isRideInProgressOrFurther =
      status && (status.toLowerCase().includes('in_progress') ||
      status.toLowerCase().includes('completed') ||
      status.toLowerCase().includes('cancelled'));
  
  
  const totalFare = (fareEstimate || 0) + (priorityFeeAmount || 0) + currentWaitingCharge + accumulatedStopWaitingCharges + (currentStopTimerDisplay?.charge || 0);
  let displayedFare = `£${totalFare.toFixed(2)}`;
  if (activeRide && activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes) {
    const wrWaitCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
    const wrBaseFare = (activeRide.fareEstimate || 0) * 1.70;
    displayedFare = `£${(wrBaseFare + wrWaitCharge + (priorityFeeAmount || 0) + currentWaitingCharge + accumulatedStopWaitingCharges + (currentStopTimerDisplay?.charge || 0)).toFixed(2)} (W&R)`;
  }
  
  const paymentMethodDisplay =
      paymentMethod === 'card' ? 'Card'
      : paymentMethod === 'cash' ? 'Cash'
      : paymentMethod === 'account' ? 'Account Job'
      : 'Payment N/A';
  
  const isEditingDisabled = activeRide?.status !== 'pending_assignment';

  const mainButtonText = () => {
    if (!activeRide) return "Error";
    if (showInProgressStatus || showInProgressWRStatus) {
      if (localCurrentLegIndex < journeyPoints.length - 1) {
        const nextLegType = localCurrentLegIndex === 0 ? "Pickup" : (localCurrentLegIndex < journeyPoints.length - 2 ? `Stop ${localCurrentLegIndex}`: "Final Dropoff");
        return `Proceed to ${nextLegType}`;
      }
      return "Complete Ride";
    }
    return "Action"; 
  };

  const mainButtonAction = () => {
    if (!activeRide) return;
    if (showInProgressStatus || showInProgressWRStatus) {
      if (localCurrentLegIndex < journeyPoints.length - 1) {
        handleRideAction(activeRide.id, 'proceed_to_next_leg');
      } else {
        handleRideAction(activeRide.id, 'complete_ride');
      }
    }
  };
  
  const dispatchInfo = getActiveRideDispatchInfo(activeRide, driverUser);
  
  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      {isSpeedLimitFeatureEnabled &&
        <SpeedLimitDisplay
          currentSpeed={currentMockSpeed}
          speedLimit={currentMockLimit}
          isEnabled={isSpeedLimitFeatureEnabled}
        />
      }
      {(!showCompletedStatus && !showCancelledByDriverStatus && !showCancelledNoShowStatus && activeRide) && (
      <div className="h-[calc(45%-0.5rem)] w-full rounded-b-xl overflow-hidden shadow-lg border-b relative">
          <GoogleMapDisplay
            center={memoizedMapCenter}
            zoom={15}
            markers={mapDisplayElements.markers}
            customMapLabels={mapDisplayElements.labels} 
            className="w-full h-full"
            disableDefaultUI={true}
            fitBoundsToMarkers={activeRide.status === 'driver_assigned' || !activeRide}
            onSdkLoaded={(loaded) => { setIsMapSdkLoaded(loaded); if (loaded && typeof window !== 'undefined' && window.google?.maps) { CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(window.google.maps); if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder(); } }}
          />
            {currentLegDisplayInfo && (
                <div className={cn(
                  "absolute bottom-4 left-4 z-20 p-2 md:p-3 rounded-lg shadow-xl border-2 border-black dark:border-gray-300 max-w-[calc(100%-6rem)] sm:max-w-sm", 
                  currentLegDisplayInfo.bgColor,
                  currentLegDisplayInfo.textColor
                )}>
                  <div className="flex justify-between items-center gap-1">
                    <p className="text-xs md:text-sm font-medium truncate">{currentLegDisplayInfo.label}</p>
                     <Button variant="ghost" size="icon" className={cn("h-5 w-5 sm:h-6 sm:w-6 p-0 shrink-0", currentLegDisplayInfo.textColor)} onClick={() => setIsJourneyDetailsModalOpen(true)}>
                          <Info className="h-3.5 w-3.5 sm:h-4 sm:h-4" />
                          <span className="sr-only">View Full Journey</span>
                      </Button>
                  </div>
                  <p className="text-lg md:text-xl font-bold leading-tight truncate" title={currentLegDisplayInfo.address}>{currentLegDisplayInfo.address}</p>
                </div>
              )}
          <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-20">
              <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-10 w-10 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-background"
                  onClick={() => setIsHazardReportDialogOpen(true)}
                  aria-label="Report Hazard Button"
                  disabled={reportingHazard || !isDriverOnline}
              >
                  {reportingHazard ? <Loader2 className="h-5 w-5 animate-spin"/> : <TrafficCone className="h-5 w-5" />}
              </Button>
              <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive" size="icon"
                    className="rounded-full h-10 w-10 shadow-lg animate-pulse"
                    onClick={() => setIsSosDialogOpen(true)}
                    aria-label="SOS Panic Button"
                    disabled={!isDriverOnline}
                  >
                    <ShieldAlert className="h-5 w-5" />
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
                        variant="destructive" className="w-full"
                        onClick={() => { setIsSosDialogOpen(false); setIsConfirmEmergencyOpen(true); }}
                    >
                        Emergency (Alert & Sound)
                    </Button>
                    <Button
                        className="w-full bg-yellow-100 dark:bg-yellow-800/30 border-2 border-red-500 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700/40 hover:border-red-600"
                        onClick={() => { toast({ title: "Passenger Issue Reported", description: "Operator notified about aggressive/suspicious passenger." }); setIsSosDialogOpen(false); }}
                      >
                        Passenger Aggressive/Suspicious
                      </Button>
                    <Button
                        className="w-full bg-yellow-100 dark:bg-yellow-800/30 border-2 border-red-500 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700/40 hover:border-red-600"
                        onClick={() => { toast({ title: "Breakdown Reported", description: "Operator notified of vehicle breakdown." }); setIsSosDialogOpen(false); }}
                    >
                        Vehicle Breakdown
                    </Button>
                    <Button
                        className="w-full bg-yellow-100 dark:bg-yellow-800/30 border-2 border-red-500 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700/40 hover:border-red-600"
                        onClick={() => { toast({ title: "Callback Requested", description: "Operator has been asked to call you back." }); setIsSosDialogOpen(false); }}
                    >
                        Request Operator Callback
                    </Button>
                </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                       onClick={() => setIsSosDialogOpen(false)}
                       className="w-full bg-green-200 hover:bg-green-300 dark:bg-green-700/30 dark:hover:bg-green-600/40 border border-black dark:border-neutral-700 text-green-900 dark:text-green-100"
                    >
                        <span>Cancel SOS</span>
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
  
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
                      <AlertDialogCancel onClick={() => setIsConfirmEmergencyOpen(false)}><span>No, Cancel</span></AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmEmergency} className="bg-destructive hover:bg-destructive/90">
                          <span>Yes, Confirm Emergency!</span>
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      </div>
      )}
      {activeRide && (
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
    
            {dispatchInfo && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
                <div className={cn("p-1 my-1 rounded-lg text-center text-white", dispatchInfo.bgColorClassName)}>
                  <p className="text-[10px] md:text-xs font-medium flex items-center justify-center gap-1">
                    <dispatchInfo.icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-white"/> {dispatchInfo.text}
                  </p>
                </div>
            )}
    
            {activeRide.isPriorityPickup && !dispatchInfo?.text.toLowerCase().includes("priority") && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
                <Alert variant="default" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 p-1.5 text-[10px] my-1">
                    <Crown className="h-3.5 w-3.5" />
                    <ShadAlertTitle className="font-medium text-xs">Priority Booking</ShadAlertTitle>
                    <ShadAlertDescriptionForAlert className="text-[10px]">
                        Passenger offered +£{(activeRide.priorityFeeAmount || 0).toFixed(2)}.
                    </ShadAlertDescriptionForAlert>
                </Alert>
            )}
    
    
            {showArrivedAtPickupStatus && (
              <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-300 my-1 p-1.5">
                <Timer className="h-4 w-4 text-current" />
                <ShadAlertTitle className="font-semibold text-current text-xs">Passenger Waiting Status</ShadAlertTitle>
                <ShadAlertDescriptionForAlert className="text-current text-[10px] font-semibold">
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
                </ShadAlertDescriptionForAlert>
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
                <ShadAlertDescriptionForAlert className="font-semibold text-current text-[10px]">
                  {currentStopTimerDisplay.freeSecondsLeft !== null && currentStopTimerDisplay.freeSecondsLeft > 0 && (
                    `Free waiting time: ${formatTimer(currentStopTimerDisplay.freeSecondsLeft)} remaining.`
                  )}
                  {currentStopTimerDisplay.extraSeconds !== null && currentStopTimerDisplay.extraSeconds >= 0 && currentStopTimerDisplay.freeSecondsLeft === 0 && (
                    `Extra waiting: ${formatTimer(currentStopTimerDisplay.extraSeconds)}. Current Charge: £${currentStopTimerDisplay.charge.toFixed(2)}`
                  )}
                </ShadAlertDescriptionForAlert>
              </Alert>
            )}
    
            {activeRide.notes && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
                <div className="rounded-md p-2 my-1.5 bg-yellow-300 dark:bg-yellow-700/50 border-l-4 border-purple-600 dark:border-purple-400">
                      <p className="text-yellow-900 dark:text-yellow-200 text-xs md:text-sm font-semibold whitespace-pre-wrap">
                        <strong>Notes:</strong> {activeRide.notes}
                      </p>
                   </div>
            )}
    
    
            {showPendingWRApprovalStatus && activeRide.estimatedAdditionalWaitTimeMinutes !== undefined && (
                 <Alert variant="default" className="bg-purple-100 dark:bg-purple-800/30 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 my-1 p-1.5">
                    <RefreshCw className="h-4 w-4 text-current animate-spin" />
                    <ShadAlertTitle className="font-semibold text-current text-xs">Wait & Return Request</ShadAlertTitle>
                    <ShadAlertDescriptionForAlert className="text-current text-[10px]">
                        Passenger requests Wait & Return with an estimated <strong>{activeRide.estimatedAdditionalWaitTimeMinutes} minutes</strong> of waiting.
                        <br />
                        New estimated total fare (if accepted): £{(( (fareEstimate || 0) + (priorityFeeAmount || 0) ) * 1.70 + (Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE)).toFixed(2)}.
                        <div className="flex gap-1 mt-1">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'accept_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Accept W&R</Button>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'decline_wait_and_return')} disabled={!!actionLoading[activeRide.id]}>Decline W&R</Button>
                        </div>
                    </ShadAlertDescriptionForAlert>
                </Alert>
            )}
    
            {/* Ride Summary Information */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-black/70 dark:border-green-700 text-green-900 dark:text-green-100 text-base">
              <div className={cn("col-span-1 border-2 border-black dark:border-gray-700 rounded-md px-2 py-1 mb-1 font-bold")}>
                <p className="font-bold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                  Fare: {displayedFare}
                </p>
              </div>
              <p className="font-bold flex items-center gap-1.5"><UsersIcon className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Passengers: {activeRide.passengerCount}</p>
              {activeRide.distanceMiles != null && (
                <p className="font-bold flex items-center gap-1.5"><Route className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Dist: ~{activeRide.distanceMiles.toFixed(1)} mi</p>
              )}
              {paymentMethod && (
                <p className="font-bold flex items-center gap-1.5 col-span-2">
                  {paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : <Briefcase className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />}
                  Payment: {paymentMethodDisplay}
                </p>
              )}
            </div>
            
            {/* Journey Details for Completed/Cancelled View */}
            {(showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus) && (
              <>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Journey Summary:</p>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    <div><strong>Pickup:</strong> {activeRide.pickupLocation.doorOrFlat && `(${activeRide.pickupLocation.doorOrFlat}) `}{activeRide.pickupLocation.address}</div>
                  </div>
                  {activeRide.stops?.map((stop, index) => (
                    <div key={`summary-stop-${index}`} className="flex items-start gap-1.5 pl-5">
                      <MapPin className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      <div><strong>Stop {index + 1}:</strong> {stop.doorOrFlat && `(${stop.doorOrFlat}) `}{stop.address}</div>
                    </div>
                  ))}
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div><strong>Dropoff:</strong> {activeRide.dropoffLocation.doorOrFlat && `(${activeRide.dropoffLocation.doorOrFlat}) `}{activeRide.dropoffLocation.address}</div>
                  </div>
                </div>
              </>
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
                    onClick={mainButtonAction}
                    disabled={!!actionLoading[activeRide.id]}
                  >
                    {actionLoading[activeRide.id] ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Navigation className="mr-1.5 h-4 w-4" />}
                    {mainButtonText()}
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
      )}
          <AlertDialog
            open={showCancelConfirmationDialog}
            onOpenChange={(isOpen) => {
                console.log("Cancel Dialog Main onOpenChange, isOpen:", isOpen);
                setShowCancelConfirmationDialog(isOpen);
                if (!isOpen && activeRide && isCancelSwitchOn) {
                    console.log("Cancel Dialog Main closing, resetting isCancelSwitchOn from true to false.");
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
                      <AlertDialogTitle className="text-destructive">Confirm Passenger No-Show</AlertDialogTitle>
                      <AlertDialogDescription>
                          Are you sure the passenger ({rideToReportNoShow?.passengerName || 'N/A'}) did not show up at the pickup location ({rideToReportNoShow?.pickupLocation.address || 'N/A'})? This will cancel the ride and may impact the passenger's account.
                      </AlertDialogDescription>
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
              <ShadDialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</ShadDialogTitle>
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
              <ShadDialogTitle className="flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" />Account Job PIN Required</ShadDialogTitle>
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
                <ShadDialogTitle className="flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/> Add a map report</ShadDialogTitle>
                <ShadDialogDescriptionDialog>
                  Select the type of hazard or observation you want to report at your current location.
                </ShadDialogDescriptionDialog>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-4">
                {[
                  { label: "Mobile Speed Camera", type: "mobile_speed_camera", icon: Gauge },
                  { label: "Roadside Taxi Checking", type: "roadside_taxi_checking", icon: ShieldCheckIcon },
                  { label: "Road Closure", type: "road_closure", icon: MinusCircle },
                  { label: "Accident", type: "accident", icon: AlertTriangle },
                  { label: "Road Works", type: "road_works", icon: Construction },
                  { label: "Heavy Traffic", type: "heavy_traffic", icon: UsersIcon },
                ].map(hazard => (
                  <Button
                    key={hazard.type}
                    className="flex flex-col items-center justify-center h-24 text-center bg-yellow-100 dark:bg-yellow-800/30 border-2 border-red-500 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700/40 hover:border-red-600"
                    onClick={() => handleReportHazard(hazard.type)}
                    disabled={reportingHazard}
                  >
                    {hazard.icon && <hazard.icon className="w-7 h-7 mb-1" />}
                    <span className="text-sm font-semibold">{hazard.label}</span>
                  </Button>
                ))}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={reportingHazard}>Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Journey Details Modal */}
          <Dialog open={isJourneyDetailsModalOpen} onOpenChange={setIsJourneyDetailsModalOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <ShadDialogTitle className="flex items-center gap-2 text-xl font-headline"><Route className="w-5 h-5 text-primary" /> Full Journey Details</ShadDialogTitle>
                <ShadDialogDescriptionDialog>Review the complete route for your active ride.</ShadDialogDescriptionDialog>
              </DialogHeader>
              {activeRide && (
                <ScrollArea className="max-h-[60vh] my-4">
                  <div className="space-y-3 p-1 pr-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-green-500 shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-green-600 dark:text-green-400">Pickup:</p>
                        <p className="text-sm">{activeRide.pickupLocation.doorOrFlat && `${activeRide.pickupLocation.doorOrFlat}, `}{activeRide.pickupLocation.address}</p>
                      </div>
                    </div>
                    {activeRide.stops?.map((stop, index) => (
                      <div key={`detail-stop-${index}`} className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-yellow-500 shrink-0 mt-1" />
                        <div>
                          <p className="font-semibold text-yellow-600 dark:text-yellow-400">Stop {index + 1}:</p>
                          <p className="text-sm">{stop.doorOrFlat && `${stop.doorOrFlat}, `}{stop.address}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-red-600 dark:text-red-400">Final Dropoff:</p>
                        <p className="text-sm">{activeRide.dropoffLocation.doorOrFlat && `${activeRide.dropoffLocation.doorOrFlat}, `}{activeRide.dropoffLocation.address}</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>
  );
}

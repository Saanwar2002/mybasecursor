
"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MapPin, Car, Clock, Loader2, AlertTriangle, Edit, XCircle, DollarSign, Calendar as CalendarIconLucide, Users, MessageSquare, UserCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, PlusCircle, Timer, Info, Check, Navigation, Play, PhoneCall, RefreshCw, Briefcase, UserX as UserXIcon, TrafficCone, Gauge, ShieldCheck as ShieldCheckIcon, MinusCircle, Construction, Users as UsersIcon, Power, AlertOctagon, LockKeyhole, CheckCircle as CheckCircleIcon, Route, Crown, Star, ChevronDown, ChevronUp } from "lucide-react";
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
import { formatAddressForMapLabel, formatAddressForDisplay } from '@/lib/utils';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const driverCarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="45" viewBox="0 0 30 45">
  <!-- Pin Needle (Black) -->
  <path d="M15 45 L10 30 H20 Z" fill="black"/>
  <!-- Blue Circle with Thick Black Border -->
  <circle cx="15" cy="16" r="12" fill="#3B82F6" stroke="black" stroke-width="2"/>
  <!-- White Car Silhouette -->
  <rect x="12" y="10.5" width="6" height="4" fill="white" rx="1"/> <!-- Cabin -->
  <rect x="9" y="14.5" width="12" height="5" fill="white" rx="1"/> <!-- Body -->
</svg>`;

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
  displayBookingId?: string;
  originatingOperatorId?: string;
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

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';


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

const PLATFORM_OPERATOR_ID_PREFIX = "001";

function getOperatorPrefix(operatorCode?: string | null): string {
  if (operatorCode && operatorCode.startsWith("OP") && operatorCode.length >= 5) {
    const numericPart = operatorCode.substring(2);
    if (/^\d{3,}$/.test(numericPart)) {
      return numericPart.slice(0, 3);
    }
  }
  return PLATFORM_OPERATOR_ID_PREFIX;
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

const isRideTerminated = (status?: string): boolean => {
  if (!status) return true;
  const terminalStatuses = ['completed', 'cancelled', 'cancelled_by_driver', 'cancelled_no_show', 'cancelled_by_operator'];
  return terminalStatuses.includes(status.toLowerCase());
};

const ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER = 30;
const FREE_WAITING_TIME_SECONDS_DRIVER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_DRIVER = 0.20;

const MOVEMENT_THRESHOLD_METERS = 50;
const STATIONARY_REMINDER_TIMEOUT_MS = 2 * 60 * 1000;

const STOP_FREE_WAITING_TIME_SECONDS = 2 * 60;
const STOP_WAITING_CHARGE_PER_MINUTE = 0.25;

const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;


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
  const [stagedOfferDetails, setStagedOfferDetails] = useState<RideOffer | null>(null);

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
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const [currentRoutePolyline, setCurrentRoutePolyline] = useState<{ path: google.maps.LatLngLiteral[]; color: string; } | null>(null);
  const [driverMarkerHeading, setDriverMarkerHeading] = useState<number | null>(null);
  const [driverCurrentStreetName, setDriverCurrentStreetName] = useState<string | null>(null);

  const [isJourneyDetailsModalOpen, setIsJourneyDetailsModalOpen] = useState(false);
  const [cancellationSuccess, setCancellationSuccess] = useState(false);

  const [isRideDetailsPanelMinimized, setIsRideDetailsPanelMinimized] = useState(true);
  const [shouldFitMapBounds, setShouldFitMapBounds] = useState<boolean>(true);


  const journeyPoints = useMemo(() => {
    if (!activeRide) return [];
    const points: LocationPoint[] = [activeRide.pickupLocation];
    if (activeRide.stops) points.push(...activeRide.stops);
    points.push(activeRide.dropoffLocation);
    return points;
  }, [activeRide]);

  const isChatDisabled = useMemo(() => {
    return !(activeRide?.status === 'driver_assigned' ||
             activeRide?.status === 'arrived_at_pickup' ||
             activeRide?.status === 'in_progress' ||
             activeRide?.status === 'in_progress_wait_and_return')
  }, [activeRide?.status]);

  const mapDisplayElements = useMemo(() => {
    const markers: Array<{ position: google.maps.LatLngLiteral; title?: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType, variant?: 'default' | 'compact' }> = [];

    if (!activeRide) {
       if (isDriverOnline && driverLocation) {
        markers.push({
            position: driverLocation,
            title: "Your Current Location",
            iconUrl: driverCarIconDataUrl,
            iconScaledSize: {width: 30, height: 45}
        });
        if (driverCurrentStreetName) {
            labels.push({
                position: driverLocation,
                content: driverCurrentStreetName,
                type: 'driver',
                variant: 'compact'
            });
        }
      }
      return { markers, labels };
    }

    const currentStatusLower = activeRide.status.toLowerCase();
    const currentLegIdx = localCurrentLegIndex;

    const currentLocToDisplay = isDriverOnline && watchIdRef.current && driverLocation
        ? driverLocation
        : activeRide.driverCurrentLocation;

    if (currentLocToDisplay) {
        markers.push({
            position: currentLocToDisplay,
            title: "Your Current Location",
            iconUrl: driverCarIconDataUrl,
            iconScaledSize: {width: 30, height: 45}
        });
        if (driverCurrentStreetName && (currentStatusLower === 'driver_assigned' || currentStatusLower === 'in_progress' || currentStatusLower === 'in_progress_wait_and_return')) {
            let driverLabelContent = driverCurrentStreetName;
            if (activeRide.driverEtaMinutes !== undefined && activeRide.driverEtaMinutes !== null && currentStatusLower === 'driver_assigned') {
                driverLabelContent += `\nETA: ${activeRide.driverEtaMinutes} min${activeRide.driverEtaMinutes !== 1 ? 's' : ''}`;
            }
            labels.push({
                position: currentLocToDisplay,
                content: driverLabelContent,
                type: 'driver',
                variant: 'compact'
            });
        }
    }

    const isEnRouteToPickup = currentStatusLower === 'driver_assigned';
    const isAtPickup = currentStatusLower === 'arrived_at_pickup';
    const isRideInProgress = currentStatusLower === 'in_progress' || currentStatusLower === 'in_progress_wait_and_return';

    if (activeRide.pickupLocation && (isEnRouteToPickup || isAtPickup || (isRideInProgress && currentLegIdx > 0 ))) {
      if (isEnRouteToPickup || isAtPickup) {
        markers.push({
            position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude},
            title: `Pickup: ${activeRide.pickupLocation.address}`,
            label: { text: "P", color: "white", fontWeight: "bold"}
        });
      }
      if (isEnRouteToPickup || isAtPickup) {
        labels.push({
            position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
            content: formatAddressForMapLabel(activeRide.pickupLocation.address, 'Pickup'),
            type: 'pickup',
            variant: (isAtPickup && (currentLegIdx === 0 || journeyPoints.length === 2)) ? 'default' : 'compact'
        });
      }
    }

    if (isRideInProgress || isAtPickup) {
        const dropoffLegIndex = journeyPoints.length -1;

        activeRide.stops?.forEach((stop, index) => {
            const stopLegIndex = index + 1;
            if(stop.latitude && stop.longitude) {
                if (currentLegIdx !== undefined && stopLegIndex >= currentLegIdx) {
                    markers.push({
                        position: {lat: stop.latitude, lng: stop.longitude},
                        title: `Stop ${index+1}: ${stop.address}`,
                        label: { text: `S${index+1}`, color: "white", fontWeight: "bold"}
                    });
                    labels.push({
                        position: { lat: stop.latitude, lng: stop.longitude },
                        content: formatAddressForMapLabel(stop.address, `Stop ${index+1}`),
                        type: 'stop',
                        variant: (localCurrentLegIndex === stopLegIndex) ? 'default' : 'compact'
                    });
                }
            }
        });

        if (activeRide.dropoffLocation) {
            if (currentLegIdx !== undefined && dropoffLegIndex >= currentLegIdx) {
                markers.push({
                    position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude},
                    title: `Dropoff: ${activeRide.dropoffLocation.address}`,
                    label: { text: "D", color: "white", fontWeight: "bold"}
                });
                labels.push({
                    position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
                    content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
                    type: 'dropoff',
                    variant: (isAtPickup && localCurrentLegIndex === 0 && journeyPoints.length === 2 && dropoffLegIndex === 1) ||
                               (localCurrentLegIndex === dropoffLegIndex)
                               ? 'default' : 'compact'
                });
            }
        }
    }
    return { markers, labels };
  }, [activeRide, driverLocation, isDriverOnline, localCurrentLegIndex, journeyPoints, driverCurrentStreetName]);


  useEffect(() => {
    if (activeRide) {
      console.log("FitBoundsEffect: activeRide.id or driverCurrentLegIndex changed. Setting shouldFitMapBounds to true.");
      setShouldFitMapBounds(true);
      const timer = setTimeout(() => {
        console.log("FitBoundsEffect: Timeout expired. Setting shouldFitMapBounds to false.");
        setShouldFitMapBounds(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeRide?.id, activeRide?.driverCurrentLegIndex]);

  const memoizedMapCenter = useMemo(() => {
    if (shouldFitMapBounds) {
      const currentTargetPoint = journeyPoints[localCurrentLegIndex];
      if (currentTargetPoint) {
        return { lat: currentTargetPoint.latitude, lng: currentTargetPoint.longitude };
      }
    }
    if (!shouldFitMapBounds && currentRoutePolyline) {
        return undefined;
    }
    return driverLocation || (activeRide?.pickupLocation ? {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude } : huddersfieldCenterGoogle);
  }, [activeRide?.pickupLocation, driverLocation, journeyPoints, localCurrentLegIndex, shouldFitMapBounds, currentRoutePolyline]);

  const mapZoomToUse = useMemo(() => {
    if (shouldFitMapBounds) {
      return undefined;
    }
    if (currentRoutePolyline) {
      return undefined;
    }
    return 16;
  }, [shouldFitMapBounds, currentRoutePolyline]);


  useEffect(() => {
    if (isMapSdkLoaded && typeof window.google !== 'undefined' && window.google.maps) {
      if (!geocoderRef.current && window.google.maps.Geocoder) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
      if (!directionsServiceRef.current && window.google.maps.DirectionsService) {
        directionsServiceRef.current = new window.google.maps.DirectionsService();
      }
    }
  }, [isMapSdkLoaded]);


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
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
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

      setActiveRide(data);


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
  }, [driverUser?.id, localCurrentLegIndex, activeRide]);


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
        const change = Math.floor(Math.random() * 7) - 3;
        let newSpeed = prev + change;
        if (newSpeed < 0) newSpeed = 0;
        if (newSpeed > 70) newSpeed = 70;
        return newSpeed;
      });
      if (Math.random() < 0.1) {
        const limits = [20, 30, 40, 50, 60, 70];
        setCurrentMockLimit(limits[Math.floor(Math.random() * limits.length)]);
      }
    }, 3000);
    return () => clearInterval(speedInterval);
  }, [isSpeedLimitFeatureEnabled]);

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
    console.log("WAITING TIMER EFFECT: Status:", activeRide?.status, "Notified:", notifiedTime, "Acked:", ackTime);

    if (activeRide?.status === 'arrived_at_pickup' && notifiedTime) {
      console.log("WAITING TIMER EFFECT: Entered main condition for 'arrived_at_pickup'.")
      const updateTimers = () => {
        const now = new Date();
        const secondsSinceNotified = Math.floor((now.getTime() - notifiedTime.getTime()) / 1000);

        let currentAckLeft: number | null = null;
        let currentFreeLeft: number | null = null;
        let currentExtraSecs: number | null = null;
        let currentChargeVal = 0;

        if (!ackTime) {
          if (secondsSinceNotified < ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER) {
            currentAckLeft = ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER - secondsSinceNotified;
            currentFreeLeft = FREE_WAITING_TIME_SECONDS_DRIVER;
          } else {
            currentAckLeft = 0;
            const effectiveFreeWaitStartTime = new Date(notifiedTime.getTime() + ACKNOWLEDGMENT_WINDOW_SECONDS_DRIVER * 1000);
            const secondsSinceEffectiveFreeWaitStart = Math.floor((now.getTime() - effectiveFreeWaitStartTime.getTime()) / 1000);

            if (secondsSinceEffectiveFreeWaitStart < FREE_WAITING_TIME_SECONDS_DRIVER) {
              currentFreeLeft = FREE_WAITING_TIME_SECONDS_DRIVER - secondsSinceEffectiveFreeWaitStart;
            } else {
              currentFreeLeft = 0;
              currentExtraSecs = secondsSinceEffectiveFreeWaitStart - FREE_WAITING_TIME_SECONDS_DRIVER;
              currentChargeVal = Math.floor((currentExtraSecs ?? 0) / 60) * WAITING_CHARGE_PER_MINUTE_DRIVER;
            }
          }
        } else {
          currentAckLeft = null;
          const secondsSinceAck = Math.floor((now.getTime() - ackTime.getTime()) / 1000);
          if (secondsSinceAck < FREE_WAITING_TIME_SECONDS_DRIVER) {
            currentFreeLeft = FREE_WAITING_TIME_SECONDS_DRIVER - secondsSinceAck;
          } else {
            currentFreeLeft = 0;
            currentExtraSecs = secondsSinceAck - FREE_WAITING_TIME_SECONDS_DRIVER;
            currentChargeVal = Math.floor((currentExtraSecs ?? 0) / 60) * WAITING_CHARGE_PER_MINUTE_DRIVER;
          }
        }

        setAckWindowSecondsLeft(currentAckLeft);
        setFreeWaitingSecondsLeft(currentFreeLeft);
        setExtraWaitingSeconds(currentExtraSecs);
        setCurrentWaitingCharge(currentChargeVal);
      };
      updateTimers();
      waitingTimerIntervalRef.current = setInterval(updateTimers, 1000);
    } else if (activeRide?.status !== 'arrived_at_pickup') {
      console.log("WAITING TIMER EFFECT: Status is NOT 'arrived_at_pickup'. Clearing timers.");
      setAckWindowSecondsLeft(null);
      setFreeWaitingSecondsLeft(null);
      setExtraWaitingSeconds(null);
      setCurrentWaitingCharge(0);
    } else if (activeRide?.status === 'arrived_at_pickup' && !notifiedTime) {
       console.warn("WAITING TIMER EFFECT: Status is 'arrived_at_pickup' BUT notifiedTime is null. This should not happen. Timers not started.");
        setAckWindowSecondsLeft(null); setFreeWaitingSecondsLeft(null); setExtraWaitingSeconds(null); setCurrentWaitingCharge(0);
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

  useEffect(() => {
    if (!activeRide || !driverLocation || !isMapSdkLoaded || !directionsServiceRef.current) {
      setCurrentRoutePolyline(null);
      setDriverMarkerHeading(null);
      return;
    }

    const currentLeg = journeyPoints[localCurrentLegIndex];
    if (!currentLeg || !currentLeg.latitude || !currentLeg.longitude) {
      setCurrentRoutePolyline(null);
      setDriverMarkerHeading(null);
      return;
    }

    const origin = driverLocation;
    const destination = { lat: currentLeg.latitude, lng: currentLeg.longitude };

    let routeColor = "#808080";
    if (localCurrentLegIndex === 0) routeColor = "#008000";
    else if (localCurrentLegIndex === journeyPoints.length - 1) routeColor = "#FF0000";
    else routeColor = "#FFD700";

    directionsServiceRef.current.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && result.routes && result.routes.length > 0) {
          const overviewPath = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
          setCurrentRoutePolyline({ path: overviewPath, color: routeColor });

          if (window.google && window.google.maps && window.google.maps.geometry && window.google.maps.geometry.spherical) {
            const heading = window.google.maps.geometry.spherical.computeHeading(
              new window.google.maps.LatLng(origin.lat, origin.lng),
              new window.google.maps.LatLng(destination.lat, destination.lng)
            );
            setDriverMarkerHeading(heading);
          } else {
            setDriverMarkerHeading(null);
          }
        } else {
          setCurrentRoutePolyline(null);
          setDriverMarkerHeading(null);
          console.warn("Directions request failed due to " + status);
        }
      }
    );
  }, [activeRide, localCurrentLegIndex, driverLocation, isMapSdkLoaded, journeyPoints]);


  useEffect(() => {
    if (stagedOfferDetails) {
      setCurrentOfferDetails(stagedOfferDetails);
      setIsOfferModalOpen(true);
      setStagedOfferDetails(null);
    }
  }, [stagedOfferDetails]);

  const handleSimulateOffer = () => {
    setIsPollingEnabled(false);
    const randomPickupIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    let randomDropoffIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    while (randomDropoffIndex === randomPickupIndex) {
      randomDropoffIndex = Math.floor(Math.random() * mockHuddersfieldLocations.length);
    }
    const pickup = mockHuddersfieldLocations[randomPickupIndex];
    const dropoff = mockHuddersfieldLocations[randomDropoffIndex];
    const passengerPhone = `+447700900${Math.floor(Math.random() * 900) + 100}`;

    let stopsForOffer: Array<{ address: string; coords: { lat: number; lng: number } }> = [];
    if (Math.random() < 0.5) { // 50% chance of having at least one stop
        let stop1Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        while (stop1Index === randomPickupIndex || stop1Index === randomDropoffIndex) {
            stop1Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        }
        stopsForOffer.push(mockHuddersfieldLocations[stop1Index]);

        if (Math.random() < 0.5) { // 50% chance of a second stop if there's one already
            let stop2Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
            while (stop2Index === randomPickupIndex || stop2Index === randomDropoffIndex || stop2Index === stop1Index) {
                stop2Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
            }
            stopsForOffer.push(mockHuddersfieldLocations[stop2Index]);
        }
    }


    const isPriority = Math.random() < 0.4;
    let currentPriorityFeeAmount = 0;
    if (isPriority) {
      currentPriorityFeeAmount = parseFloat((Math.random() * 2.5 + 1.0).toFixed(2));
    }

    const paymentType = Math.random();
    let paymentMethodChoice: 'card' | 'cash' | 'account';
    let jobPinForOffer: string | undefined = undefined;

    if (paymentType < 0.5) {
      paymentMethodChoice = 'card';
    } else if (paymentType < 0.85) {
      paymentMethodChoice = 'cash';
    } else {
      paymentMethodChoice = 'account';
      jobPinForOffer = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const offer: Omit<RideOffer, 'id' | 'displayBookingId' | 'originatingOperatorId'> = {
      pickupLocation: pickup.address,
      pickupCoords: pickup.coords,
      dropoffLocation: dropoff.address,
      dropoffCoords: dropoff.coords,
      stops: stopsForOffer,
      fareEstimate: parseFloat((Math.random() * 15 + 5 + (stopsForOffer.length * 3)).toFixed(2)), // Add a bit for stops
      isPriorityPickup: isPriority,
      priorityFeeAmount: currentPriorityFeeAmount,
      passengerCount: Math.floor(Math.random() * 3) + 1,
      passengerId: `pass-mock-${Date.now().toString().slice(-4)}`,
      passengerName: `Passenger ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
      passengerPhone: passengerPhone,
      notes: Math.random() < 0.3 ? `Test note: ${Math.random() < 0.5 ? "Luggage." : "Call on arrival."}` : undefined,
      requiredOperatorId: Math.random() < 0.5 ? PLATFORM_OPERATOR_CODE : driverUser?.operatorCode || PLATFORM_OPERATOR_CODE,
      distanceMiles: parseFloat((Math.random() * 9 + 1 + (stopsForOffer.length * 2)).toFixed(1)),
      paymentMethod: paymentMethodChoice,
      dispatchMethod: Math.random() < 0.7 ? 'auto_system' : 'manual_operator',
      accountJobPin: jobPinForOffer,
    };

    const mockFirestoreId = `mock-offer-${Date.now()}`;
    const mockOriginatingOperatorId = offer.requiredOperatorId || PLATFORM_OPERATOR_CODE;
    const mockDisplayPrefix = getOperatorPrefix(mockOriginatingOperatorId);

    const timestampPartForSuffix = Date.now().toString().slice(-4);
    const randomPartForSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const numericSuffix = `${timestampPartForSuffix}${randomPartForSuffix}`;
    const mockDisplayBookingId = `${mockDisplayPrefix}/${numericSuffix}`;


    const mockOfferWithDisplayId: RideOffer = {
      ...offer,
      id: mockFirestoreId,
      displayBookingId: mockDisplayBookingId,
      originatingOperatorId: mockOriginatingOperatorId,
    };
    console.log("[handleSimulateOffer] Generated Mock Offer:", JSON.stringify(mockOfferWithDisplayId, null, 2));
    setStagedOfferDetails(mockOfferWithDisplayId);
  };


  const handleAcceptOffer = async (rideId: string) => {
    console.log(`[handleAcceptOffer] Attempting to accept offer: ${rideId}`);
    setIsPollingEnabled(false);
    if (rideRefreshIntervalIdRef.current) {
      clearInterval(rideRefreshIntervalIdRef.current);
      rideRefreshIntervalIdRef.current = null;
    }
    setConsecutiveMissedOffers(0);

    const offerToAccept = currentOfferDetails;

    if (!offerToAccept || !driverUser) {
      toast({title: "Error Accepting Ride", description: "Offer details or driver session missing.", variant: "destructive"});
      return;
    }

    const currentActionRideId = offerToAccept.id;
    console.log(`[handleAcceptOffer] Setting actionLoading for ${currentActionRideId} to true`);
    setActionLoading(prev => ({ ...prev, [currentActionRideId]: true }));

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
        driverCurrentLocation: driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null,
        accountJobPin: offerToAccept.accountJobPin,
      };
    console.log(`[handleAcceptOffer] Sending accept payload for ${currentActionRideId}:`, JSON.stringify(updatePayload, null, 2));


    try {
      const response = await fetch(`/api/operator/bookings/${offerToAccept.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      console.log(`[handleAcceptOffer] Accept offer response status for ${currentActionRideId}: ${response.status}`);

      let updatedBookingDataFromServer;
      if (response.ok) {
        updatedBookingDataFromServer = await response.json();
        if (!updatedBookingDataFromServer || !updatedBookingDataFromServer.booking) {
            console.error(`[handleAcceptOffer] Accept offer for ${currentActionRideId}: Server OK but booking data missing.`);
            throw new Error("Server returned success but booking data was missing in response.");
        }
        console.log(`[handleAcceptOffer] Accept offer for ${currentActionRideId}: Server returned booking data:`, JSON.stringify(updatedBookingDataFromServer.booking, null, 2));
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
        console.error(`[handleAcceptOffer] Accept offer for ${currentActionRideId} - Server error:`, errorDetailsText);
        toast({ title: "Acceptance Failed on Server", description: errorDetailsText, variant: "destructive", duration: 7000 });
        setActionLoading(prev => ({ ...prev, [currentActionRideId]: false }));
        console.log(`[handleAcceptOffer] Reset actionLoading for ${currentActionRideId} to false after server error.`);
        setIsOfferModalOpen(false);
        setCurrentOfferDetails(null);
        setIsPollingEnabled(true);
        return;
      }

      const serverBooking = updatedBookingDataFromServer.booking;
      const newActiveRideFromServer: ActiveRide = {
        id: serverBooking.id,
        displayBookingId: serverBooking.displayBookingId,
        originatingOperatorId: serverBooking.originatingOperatorId,
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
      console.log(`[handleAcceptOffer] Accept offer for ${currentActionRideId}: Setting activeRide:`, JSON.stringify(newActiveRideFromServer, null, 2));
      setActiveRide(newActiveRideFromServer);
      setLocalCurrentLegIndex(0);
      setRideRequests([]);
      setIsOfferModalOpen(false);
      setCurrentOfferDetails(null);


      let toastDesc = `En Route to Pickup for ${newActiveRideFromServer.passengerName}. Payment: ${newActiveRideFromServer.paymentMethod === 'card' ? 'Card' : newActiveRideFromServer.paymentMethod === 'account' ? 'Account' : 'Cash'}.`;
      if (newActiveRideFromServer.isPriorityPickup && newActiveRideFromServer.priorityFeeAmount) {
        toastDesc += ` Priority: +£${newActiveRideFromServer.priorityFeeAmount.toFixed(2)}.`;
      }
      if (newActiveRideFromServer.dispatchMethod) {
        toastDesc += ` Dispatched: ${newActiveRideFromServer.dispatchMethod.replace(/_/g, ' ')}.`;
      }
      toast({title: "Ride Accepted!", description: toastDesc});

    } catch(error: any) {
      console.error(`[handleAcceptOffer] Error in handleAcceptOffer process for ${currentActionRideId} (outer catch):`, error);

      let detailedMessage = "An unknown error occurred during ride acceptance.";
      if (error instanceof Error) {
          detailedMessage = error.message;
      } else if (typeof error === 'object' && error !== null && (error as any).message) {
          detailedMessage = (error as any).message;
      } else if (typeof error === 'string') {
          detailedMessage = error;
      }

      toast({ title: "Acceptance Failed", description: detailedMessage, variant: "destructive" });
      setIsOfferModalOpen(false);
      setCurrentOfferDetails(null);
      setIsPollingEnabled(true);
    } finally {
      console.log(`[handleAcceptOffer] Resetting actionLoading for ${currentActionRideId} to false in finally block.`);
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
        if (isDriverOnline && !activeRide) {
            setIsPollingEnabled(true);
        }
    }
  };

  async function handleRideAction(rideId: string, actionType: 'notify_arrival' | 'start_ride' | 'complete_ride' | 'cancel_active' | 'accept_wait_and_return' | 'decline_wait_and_return' | 'report_no_show' | 'proceed_to_next_leg') {
    if (!driverUser || !activeRide || activeRide.id !== rideId) {
        console.error(`handleRideAction: Pre-condition failed. driverUser: ${!!driverUser}, activeRide: ${!!activeRide}, activeRide.id vs rideId: ${activeRide?.id} vs ${rideId}`);
        toast({ title: "Error", description: "No active ride context or ID mismatch.", variant: "destructive"});
        return;
    }
    console.log(`handleRideAction: rideId=${rideId}, actionType=${actionType}. Current activeRide status: ${activeRide.status}, localCurrentLegIndex: ${localCurrentLegIndex}`);

    if (actionType === 'start_ride' && activeRide.paymentMethod === 'account' && activeRide.status === 'arrived_at_pickup') {
        if (!activeRide.accountJobPin) {
            toast({title: "Account PIN Missing", description: "This Account Job is missing its verification PIN. Cannot start ride. Please contact support or use manual override if available.", variant: "destructive", duration: 7000});
            return;
        }
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
            setIsPollingEnabled(false);
            const baseFare = activeRide.fareEstimate || 0;
            const priorityFee = activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0;
            let wrCharge = 0;
            if(activeRide.waitAndReturn && activeRide.estimatedAdditionalWaitTimeMinutes) {
                wrCharge = Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
            }
            const finalFare = baseFare + priorityFee + currentWaitingCharge + accumulatedStopWaitingCharges + chargeForPreviousStop + wrCharge;

            toastTitle = "Ride Completed";
            if (activeRide.paymentMethod === "account" && activeRide.accountJobPin) {
                 toastMessage = `Ride with ${activeRide.passengerName} completed. Account holder will be notified. PIN used: ${activeRide.accountJobPin}. Final Fare: £${finalFare.toFixed(2)}. (Job ID: ${activeRide.displayBookingId || activeRide.id})`;
            } else {
                 toastMessage = `Ride with ${activeRide.passengerName} marked as completed. Final fare (incl. priority, all waiting): £${finalFare.toFixed(2)}. (Job ID: ${activeRide.displayBookingId || activeRide.id})`;
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

      toast({ title: toastTitle, description: toastMessage, duration: 6000 });

      if (actionType === 'complete_ride') {
        router.push(`/driver/ride-summary/${rideId}`);
      } else {
        const serverData = updatedBookingFromServer.booking;
        const newClientState: ActiveRide = {
        ...activeRide,
        status: serverData.status || activeRide.status,
        notifiedPassengerArrivalTimestamp: serverData.notifiedPassengerArrivalTimestamp || activeRide.notifiedPassengerArrivalTimestamp,
        passengerAcknowledgedArrivalTimestamp: serverData.passengerAcknowledgedArrivalTimestamp || activeRide.passengerAcknowledgedArrivalTimestamp,
        rideStartedAt: serverData.rideStartedAt || activeRide.rideStartedAt,
        completedAt: serverData.completedAt || activeRide.completedAt,
        fareEstimate: actionType === 'complete_ride' && payload.finalFare !== undefined ? payload.finalFare : (serverData.fareEstimate ?? activeRide.fareEstimate),
        waitAndReturn: serverData.waitAndReturn ?? activeRide.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: serverData.estimatedAdditionalWaitTimeMinutes ?? activeRide.estimatedAdditionalWaitTimeMinutes,
        driverCurrentLocation: serverData.driverCurrentLocation || activeRide.driverCurrentLocation || driverLocation,
        driverCurrentLegIndex: serverData.driverCurrentLegIndex !== undefined ? serverData.driverCurrentLegIndex : activeRide.driverCurrentLegIndex,
        currentLegEntryTimestamp: serverData.currentLegEntryTimestamp || activeRide.currentLegEntryTimestamp,
        completedStopWaitCharges: serverData.completedStopWaitCharges || activeRide.completedStopWaitCharges || {},
        };
        console.log(`handleRideAction (${actionType}): Setting new activeRide state for ${rideId}:`, newClientState);
        if (actionType === 'start_ride' || actionType === 'proceed_to_next_leg') {
        setLocalCurrentLegIndex(newClientState.driverCurrentLegIndex || 0);
        }
        setActiveRide(newClientState);
      }


      if (actionType === 'cancel_active' || actionType === 'report_no_show') {
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
  }

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

  async function handleRequestWaitAndReturnAction() {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Request Failed", description: message, variant: "destructive" });
    } finally {
      setIsRequestingWR(false);
    }
  }


  const mainButtonText = () => {
    if (!activeRide) return "Status Action";
    const currentLegIdx = localCurrentLegIndex;
    if (activeRide.status === 'driver_assigned') return "Notify Arrival";
    if (activeRide.status === 'arrived_at_pickup') return "Start Ride";
    if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') && currentLegIdx < journeyPoints.length -1) {
      const nextLegIsDropoff = currentLegIdx + 1 === journeyPoints.length - 1;
      if(activeStopDetails && activeStopDetails.stopDataIndex === (currentLegIdx -1)) {
          return `Depart Stop ${currentLegIdx} / Proceed to ${nextLegIsDropoff ? "Dropoff" : `Stop ${currentLegIdx +1}`}`;
      } else {
          return `Arrived at Stop ${currentLegIdx} / Start Timer`;
      }
    }
    if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') && currentLegIdx === journeyPoints.length -1) {
      return "Complete Ride";
    }
    return "Status Action";
  };

  const mainActionBtnAction = () => {
    if (!activeRide) return;
    const currentLegIdx = localCurrentLegIndex;
    if (activeRide.status === 'driver_assigned') {
      handleRideAction(activeRide.id, 'notify_arrival');
    } else if (activeRide.status === 'arrived_at_pickup') {
      handleRideAction(activeRide.id, 'start_ride');
    }
    else if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') && currentLegIdx < journeyPoints.length -1) {
        if(activeStopDetails && activeStopDetails.stopDataIndex === (currentLegIdx -1)) {
            handleRideAction(activeRide.id, 'proceed_to_next_leg');
        } else {
            setActiveStopDetails({stopDataIndex: currentLegIdx - 1, arrivalTime: new Date()});
        }
    }
    else if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') && currentLegIdx === journeyPoints.length -1) {
        handleRideAction(activeRide.id, 'complete_ride');
    }
  };


  const isMainButtonDisabled = () => {
    if (!activeRide || (actionLoading[activeRide.id] ?? false)) return true;
    if (activeRide.status === 'pending_driver_wait_and_return_approval') return true;
    return false;
  };
  const mainButtonIsDisabledValue = isMainButtonDisabled();
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

    if (localCurrentLegIndex === 0) {
      bgColorClass = "bg-green-100 dark:bg-green-900/50";
      textColorClass = "text-green-700 dark:text-green-300";
      legTypeLabel = activeRide.status === 'arrived_at_pickup' ? "AT PICKUP" : "TO PICKUP";
    } else if (localCurrentLegIndex < journeyPoints.length - 1) {
      bgColorClass = "bg-yellow-100 dark:bg-yellow-800/50";
      textColorClass = "text-yellow-700 dark:text-yellow-300";
      legTypeLabel = `TO STOP ${localCurrentLegIndex}`;
    } else {
      bgColorClass = "bg-red-100 dark:bg-red-800/50";
      textColorClass = "text-red-700 dark:text-red-300";
      legTypeLabel = "TO DROPOFF";
    }

    const parsedAddress = formatAddressForDisplay(currentLeg.address);

    const currentMainActionText = mainButtonText();
    let primaryButtonBgClass = "bg-blue-600 hover:bg-blue-700";
    if (currentMainActionText.toLowerCase().includes("start ride")) primaryButtonBgClass = "bg-green-600 hover:bg-green-700";
    if (currentMainActionText.toLowerCase().includes("notify arrival")) primaryButtonBgClass = "bg-sky-600 hover:bg-sky-700";
    if (currentMainActionText.toLowerCase().includes("complete ride")) primaryButtonBgClass = "bg-red-600 hover:bg-red-700";
    if (currentMainActionText.toLowerCase().includes("depart stop") || currentMainActionText.toLowerCase().includes("proceed to")) primaryButtonBgClass = "bg-indigo-600 hover:bg-indigo-700";
    if (currentMainActionText.toLowerCase().includes("arrived at stop")) primaryButtonBgClass = "bg-yellow-500 hover:bg-yellow-600 text-black";

    const showPassengerNameAndContact = (activeRide?.status === 'arrived_at_pickup' || activeRide?.status === 'driver_assigned');
    const passengerPhone = activeRide?.passengerPhone;


    return (
      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-2.5 shadow-lg flex items-start justify-between gap-2",
        bgColorClass,
        "border-t-2 border-black/20 dark:border-white/20"
      )}>
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold text-xs uppercase tracking-wide", textColorClass)}>{legTypeLabel}</p>
          <p className={cn("font-bold text-sm md:text-base", textColorClass)}>{parsedAddress.line1}</p>
          {parsedAddress.line2 && <p className={cn("font-bold text-xs md:text-sm opacity-80", textColorClass)}>{parsedAddress.line2}</p>}
          {parsedAddress.line3 && <p className={cn("font-bold text-xs opacity-70", textColorClass)}>{parsedAddress.line3}</p>}

          {showPassengerNameAndContact && activeRide?.passengerName && (
            <div className="mt-0.5">
              <Badge
                variant="outline"
                className="font-semibold text-[10px] md:text-xs px-1.5 py-0 leading-tight border-purple-400 bg-purple-100 text-purple-700 dark:bg-purple-800/60 dark:text-purple-300 dark:border-purple-600"
              >
                Passenger: {activeRide.passengerName}
              </Badge>
              <div className="flex items-center gap-1.5 mt-0.5">
                {passengerPhone && (
                  <>
                    <Button asChild variant="ghost" size="icon" className={cn("h-5 w-5 p-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-700/50 rounded")}>
                      <a href={`tel:${passengerPhone}`} aria-label={`Call ${activeRide.passengerName}`}>
                        <PhoneCall className="w-3 h-3" />
                      </a>
                    </Button>
                    <span className="font-bold text-xs text-muted-foreground">{passengerPhone}</span>
                    {!isChatDisabled && <Separator orientation="vertical" className="h-3 bg-muted-foreground/50 mx-0.5" />}
                  </>
                )}
                {!isChatDisabled && (
                  <Button asChild variant="ghost" size="icon" className={cn("h-5 w-5 p-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-700/50 rounded")}>
                    <Link href="/driver/chat" aria-label={`Chat with ${activeRide.passengerName}`}>
                      <MessageSquare className="w-3 h-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 md:h-8 md:h-8 bg-white/80 dark:bg-slate-700/80 border-slate-400 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
                    onClick={() => setIsJourneyDetailsModalOpen(true)}
                    title="View Full Journey Details"
                >
                    <Info className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </Button>
                <Button
                    variant="default"
                    size="icon"
                    className="h-7 w-7 md:h-8 md:h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                        if (currentLeg && currentLeg.latitude && currentLeg.longitude) {
                            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${currentLeg.latitude},${currentLeg.longitude}`;
                            window.open(mapsUrl, '_blank');
                        } else {
                            toast({ title: "Navigation Error", description: "Destination coordinates are not available for this leg.", variant: "destructive"});
                        }
                    }}
                    title={`Navigate to ${legTypeLabel}`}
                >
                    <Navigation className="h-4 w-4" />
                </Button>
            </div>
             <Button
                className={cn("font-bold text-xs text-white py-1 h-7 px-2 w-full", primaryButtonBgClass)}
                onClick={mainActionBtnAction}
                disabled={mainButtonIsDisabledValue}
                size="sm"
            >
                {activeRide && actionLoading[activeRide.id] && <Loader2 className="animate-spin mr-1.5 h-3 w-3" />}
                {currentMainActionText}
            </Button>
            {activeRide && isRideDetailsPanelMinimized && !isRideTerminated(activeRide.status) && (
                <Button
                    onClick={() => setIsRideDetailsPanelMinimized(false)}
                    variant="outline"
                    size="sm"
                    className="bg-background/70 hover:bg-background/90 text-foreground shadow-sm px-2 py-1 h-auto text-[10px] font-semibold w-full mt-1"
                >
                    JOB DETAIL <ChevronUp className="ml-1 h-3 w-3"/>
                </Button>
            )}
        </div>
      </div>
    );
  };

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
        <Label htmlFor={`cancel-ride-switch-${ride.id}`} className="font-bold text-destructive text-sm">
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

  const mainActionBtnText = mainButtonText();

  const showCompletedStatus = activeRide?.status === 'completed';
  const showCancelledByDriverStatus = activeRide?.status === 'cancelled_by_driver';
  const showCancelledNoShowStatus = activeRide?.status === 'cancelled_no_show';

  const showDriverAssignedStatus = activeRide?.status === 'driver_assigned';
  const showArrivedAtPickupStatus = activeRide?.status === 'arrived_at_pickup';
  const showInProgressStatus = activeRide?.status === 'in_progress';
  const showPendingWRApprovalStatus = activeRide?.status === 'pending_driver_wait_and_return_approval';
  const showInProgressWRStatus = activeRide?.status === 'in_progress_wait_and_return';

  const passengerPhone = activeRide?.passengerPhone;

  let displayedFare = "£0.00";
  let numericGrandTotal = 0;
  let hasPriority = false;
  let currentPriorityAmount = 0;
  let basePlusWRFare = 0;
  let paymentMethodDisplay = "N/A";

  if (activeRide) {
    let baseFareWithWRSurchargeForDisplay = activeRide.fareEstimate || 0;
    if (activeRide.waitAndReturn) {
      const wrBaseFare = (activeRide.fareEstimate || 0) * 1.70;
      const additionalWaitCharge = Math.max(0, (activeRide.estimatedAdditionalWaitTimeMinutes || 0) - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
      baseFareWithWRSurchargeForDisplay = wrBaseFare + additionalWaitCharge;
    }

    numericGrandTotal = baseFareWithWRSurchargeForDisplay + (activeRide.isPriorityPickup && activeRide.priorityFeeAmount ? activeRide.priorityFeeAmount : 0) + accumulatedStopWaitingCharges + currentWaitingCharge;
    displayedFare = `£${numericGrandTotal.toFixed(2)}`;

    paymentMethodDisplay =
      activeRide.paymentMethod === 'card' ? 'Card'
      : activeRide.paymentMethod === 'cash' ? 'Cash'
      : activeRide.paymentMethod === 'account' ? 'Account'
      : 'Payment N/A';

    hasPriority = !!(activeRide.isPriorityPickup && activeRide.priorityFeeAmount && activeRide.priorityFeeAmount > 0);
    currentPriorityAmount = hasPriority ? activeRide.priorityFeeAmount! : 0;
    basePlusWRFare = numericGrandTotal - currentPriorityAmount;
  }

  return (
      <div className="flex flex-col h-full p-2 md:p-4 relative overflow-hidden">
        {isSpeedLimitFeatureEnabled &&
          <SpeedLimitDisplay
            currentSpeed={currentMockSpeed}
            speedLimit={currentMockLimit}
            isEnabled={isSpeedLimitFeatureEnabled}
          />
        }
        <div className={cn(
            "relative w-full rounded-b-xl overflow-hidden shadow-lg border",
            activeRide && !isRideTerminated(activeRide.status) ? "flex-1" : "h-[calc(100%-10rem)]",
             activeRide && !isRideTerminated(activeRide.status) ? "pb-[calc(var(--navigation-bar-height,11rem)+env(safe-area-inset-bottom)))]" : ""
        )}>
            <GoogleMapDisplay
              center={memoizedMapCenter}
              zoom={mapZoomToUse}
              mapHeading={driverMarkerHeading ?? 0}
              mapRotateControl={false}
              fitBoundsToMarkers={shouldFitMapBounds}
              markers={mapDisplayElements.markers}
              customMapLabels={mapDisplayElements.labels}
              className="w-full h-full"
              disableDefaultUI={true}
              onSdkLoaded={(loaded) => { setIsMapSdkLoaded(loaded); if (loaded && typeof window !== 'undefined' && window.google?.maps) { CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(window.google.maps); if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder(); if (!directionsServiceRef.current) directionsServiceRef.current = new window.google.maps.DirectionsService(); } }}
              polylines={currentRoutePolyline ? [{ path: currentRoutePolyline.path, color: currentRoutePolyline.color, weight: 4, opacity: 0.7 }] : []}
              driverIconRotation={driverMarkerHeading ?? undefined}
              gestureHandling="greedy"
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
                    <ShadAlertDialogTitleForDialog className="font-bold text-2xl flex items-center gap-2">
                      <AlertTriangle className="w-7 h-7 text-destructive" /><span>Confirm Emergency Alert</span>
                    </ShadAlertDialogTitleForDialog>
                    <ShadAlertDialogDescriptionForDialog className="text-base py-2">
                      <span>Select a quick alert or send a general emergency notification. Your operator has been notified immediately.</span>
                      <strong className="block mt-1">Use this for genuine emergencies only.</strong>
                    </ShadAlertDialogDescriptionForDialog>
                  </AlertDialogHeader>
                  <div className="grid grid-cols-2 gap-2 my-3">
                      <Button onClick={() => handleQuickSOSAlert("Emergency")} className="font-bold bg-red-500 hover:bg-red-600 text-white border border-black" size="sm"><span>Emergency</span></Button>
                      <Button onClick={() => handleQuickSOSAlert("Car Broken Down")} className="font-bold bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm"><span>Car Broken Down</span></Button>
                      <Button onClick={() => handleQuickSOSAlert("Customer Aggressive")} className="font-bold bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm"><span>Customer Aggressive</span></Button>
                      <Button onClick={() => handleQuickSOSAlert("Call Me Back")} className="font-bold bg-yellow-400 hover:bg-yellow-500 text-black border border-black" size="sm"><span>Call Me Back</span></Button>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel><span>Cancel</span></AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmEmergency}
                      className="bg-destructive hover:bg-destructive/90 font-bold"
                    >
                      <span>Send General Alert Now</span>
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
                       isSosButtonVisible ? "top-12 md:top-[3.0rem]" : "top-3"
                    )}
                    aria-label="Report Road Hazard"
                    title="Report Road Hazard"
                    onClick={() => setIsHazardReportDialogOpen(true)}
                    >
                    <TrafficCone className="h-4 w-4 md:h-5 md:h-5" />
                    </Button>
                </AlertDialogTrigger>
                 <AlertDialogContent className="sm:max-w-md">
                  <AlertDialogHeader>
                    <ShadAlertDialogTitleForDialog className="font-bold flex items-center gap-2"><TrafficCone className="w-6 h-6 text-yellow-500"/><span>Add a map report</span></ShadAlertDialogTitleForDialog>
                    <ShadAlertDialogDescriptionForDialog><span>Select the type of hazard or observation you want to report at your current location.</span></ShadAlertDialogDescriptionForDialog>
                  </AlertDialogHeader>
                  <div className="py-4 grid grid-cols-2 gap-3">
                    {hazardTypes.map((hazard) => (
                      <Button
                        key={hazard.id}
                        variant="outline"
                        className={cn("h-auto py-3 flex flex-col items-center gap-1.5 text-xs font-bold", hazard.className)}
                        onClick={() => handleReportHazard(hazard.label)}
                      >
                        <hazard.icon className="w-6 h-6 mb-1" />
                        <span>{hazard.label}</span>
                      </Button>
                    ))}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button type="button" variant="outline"><span>Cancel</span></Button>
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {activeRide && !isRideTerminated(activeRide.status) && <CurrentNavigationLegBar />}
        </div>
         {activeRide?.notes && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (
            <div className="rounded-md p-2 my-2 bg-yellow-300 dark:bg-yellow-700/50 border-l-4 border-purple-600 dark:border-purple-400 shadow">
                <p className="font-bold text-yellow-900 dark:text-yellow-200 text-xs md:text-sm whitespace-pre-wrap">
                    <strong>Notes from Passenger:</strong> {activeRide.notes.trim() || "(empty note)"}
                </p>
            </div>
        )}

        {activeRide?.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ackWindowSecondsLeft !== null && ackWindowSecondsLeft > 0 && (
            <Alert variant="default" className="my-2 bg-orange-100 dark:bg-orange-700/40 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-200 p-1.5 text-xs">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-current" />
                        <span className="font-semibold text-current">Waiting Passenger Ack.</span>
                    </div>
                    <span className="font-bold text-white bg-pink-600 dark:bg-pink-700 px-1.5 py-0.5 rounded text-xs">
                        {formatTimer(ackWindowSecondsLeft)}
                    </span>
                </div>
            </Alert>
        )}
        {activeRide?.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ackWindowSecondsLeft === 0 && freeWaitingSecondsLeft !== null && (
            <Alert variant="default" className="my-2 bg-yellow-100 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 p-1.5 text-xs">
            <Timer className="h-4 w-4 text-current" />
            <div className="flex justify-between items-center w-full">
                <span className="font-semibold text-current">Free Waiting Period</span>
                <span className="font-bold text-current">
                    {formatTimer(freeWaitingSecondsLeft)}
                </span>
            </div>
             <ShadAlertDescription className="text-xs text-current/80 pl-[calc(1rem+0.375rem)] -mt-1">
                Ack. window expired. Waiting charges apply after this.
            </ShadAlertDescription>
            </Alert>
        )}
        {activeRide?.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && freeWaitingSecondsLeft !== null && (
            <Alert variant="default" className={cn("my-2 p-1.5 text-xs",
                (extraWaitingSeconds !== null && extraWaitingSeconds > 0) ? "bg-red-100 dark:bg-red-700/40 border-red-400 dark:border-red-600 text-red-700 dark:text-red-200"
                                     : "bg-green-100 dark:bg-green-700/40 border-green-400 dark:border-green-600 text-green-700 dark:text-green-200"
            )}>
            <Timer className="h-4 w-4 text-current" />
            <div className="flex justify-between items-center w-full">
                <span className="font-semibold text-current">
                    {(extraWaitingSeconds !== null && extraWaitingSeconds > 0) ? "Extra Waiting" : "Free Waiting"}
                </span>
                <span className="font-bold text-current">
                    {(extraWaitingSeconds !== null && extraWaitingSeconds > 0)
                        ? `${formatTimer(extraWaitingSeconds)} (+£${currentWaitingCharge.toFixed(2)})`
                        : formatTimer(freeWaitingSecondsLeft)}
                </span>
            </div>
            <ShadAlertDescription className="text-xs text-current/80 pl-[calc(1rem+0.375rem)] -mt-1">
                 {freeWaitingSecondsLeft > 0 && (extraWaitingSeconds === null || extraWaitingSeconds <= 0) && (
                    <span>Passenger Acknowledged.</span>
                )}
                {freeWaitingSecondsLeft === 0 && (extraWaitingSeconds === null || extraWaitingSeconds === 0) && <span>Free time expired. Charges apply.</span>}
            </ShadAlertDescription>
            </Alert>
        )}

        {activeRide && !isRideDetailsPanelMinimized && (
            <Card
                className={cn(
                "absolute bottom-0 left-0 right-0 z-30 bg-card shadow-2xl border-t-4 border-primary rounded-t-xl flex flex-col overflow-hidden transition-transform duration-300 ease-in-out",
                isRideDetailsPanelMinimized ? "translate-y-full" : "translate-y-0",
                "max-h-[60vh] md:max-h-[55vh]"
                )}
            >
                <CardHeader className="p-3 flex-row items-center justify-between shrink-0 border-b bg-muted/30">
                    <CardTitle className="text-base md:text-lg font-semibold">
                    {activeRide.status === 'completed' ? "Ride Summary" :
                    activeRide.status === 'cancelled_by_driver' || activeRide.status === 'cancelled_no_show' ? "Ride Cancelled" :
                    "Active Ride Details"}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setIsRideDetailsPanelMinimized(true)} className="h-7 w-7">
                    <ChevronDown className="h-5 w-5" />
                    <span className="sr-only">Minimize Details</span>
                    </Button>
                </CardHeader>

                <ScrollArea className="flex-1 min-h-0">
                    <CardContent className="p-2 space-y-1.5">
                        {activeRide.status === 'completed' ? (
                            <div className="text-center">
                                <Badge variant="default" className="font-bold text-base w-fit mx-auto bg-primary text-primary-foreground py-1.5 px-4 rounded-lg shadow-lg flex items-center gap-2">
                                    <CheckCircleIconLucide className="w-5 h-5" /> <span>Ride Completed</span>
                                </Badge>
                                <p className="mt-3 font-semibold text-lg">{activeRide.passengerName}</p>
                                <p className="text-2xl font-bold text-primary">{displayedFare}</p>
                                <p className="text-xs text-muted-foreground mt-1">Job ID: {activeRide.displayBookingId || activeRide.id}</p>
                                 <Separator className="my-3"/>
                                <p className="font-bold text-sm mb-1"><span>Rate {activeRide.passengerName || "Passenger"}:</span></p>
                                <div className="flex justify-center space-x-1 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                        key={i}
                                        className={cn("w-7 h-7 cursor-pointer", i < driverRatingForPassenger ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300")}
                                        onClick={() => setDriverRatingForPassenger(i + 1)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : activeRide.status === 'cancelled_by_driver' || activeRide.status === 'cancelled_no_show' ? (
                            <div className="text-center">
                                <Badge variant="destructive" className="font-bold text-base w-fit mx-auto py-1.5 px-4 rounded-lg shadow-lg flex items-center gap-2">
                                    <XCircle className="w-5 h-5" /> <span>{activeRide.status === 'cancelled_no_show' ? "Passenger No-Show" : "Ride Cancelled By You"}</span>
                                </Badge>
                                <p className="mt-3 text-sm text-muted-foreground"><span>This ride (ID: {activeRide.displayBookingId || activeRide.id}) was cancelled.</span></p>
                                <p className="mt-1 text-sm text-muted-foreground"><span>Passenger: {activeRide.passengerName}</span></p>
                            </div>
                        ) : (
                        <> {}
                            {showDriverAssignedStatus && ( <div className="flex justify-center mb-1.5"> <Badge variant="secondary" className="font-bold text-xs w-fit mx-auto bg-sky-500 text-white py-1 px-3 rounded-md shadow"> En Route to Pickup </Badge> </div> )}

                            <div className="flex items-center gap-3 p-1.5 rounded-lg bg-muted/30 border">
                                <Avatar className="h-7 w-7 md:h-8 md:h-8">
                                    <AvatarImage src={activeRide.passengerAvatar || `https://placehold.co/40x40.png?text=${activeRide.passengerName.charAt(0)}`} alt={activeRide.passengerName} data-ai-hint="passenger avatar"/>
                                    <AvatarFallback className="text-sm">{activeRide.passengerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-bold text-sm md:text-base">{activeRide.passengerName}</p>
                                    {passengerPhone && (
                                      <p className="font-bold text-xs text-muted-foreground flex items-center gap-0.5">
                                        <PhoneCall className="w-2.5 h-2.5"/> {passengerPhone}
                                      </p>
                                    )}
                                </div>
                                {(!showCompletedStatus && !showCancelledByDriverStatus && !showCancelledNoShowStatus) && (
                                  <div className="flex items-center gap-1">
                                    {passengerPhone && !isChatDisabled && (
                                      <Button asChild variant="outline" size="icon" className="h-7 w-7 md:h-8 md:h-8">
                                        <a href={`tel:${passengerPhone}`} aria-label="Call passenger">
                                          <PhoneCall className="w-3.5 h-3.5 md:w-4 md:w-4" />
                                        </a>
                                      </Button>
                                    )}
                                    {isChatDisabled ? (
                                      <Button variant="outline" size="icon" className="h-7 w-7 md:h-8 md:h-8" disabled>
                                        <MessageSquare className="w-3.5 h-3.5 md:w-4 md:w-4 text-muted-foreground opacity-50" />
                                      </Button>
                                    ) : (
                                      <Button asChild variant="outline" size="icon" className="h-7 w-7 md:h-8 md:h-8">
                                        <Link href="/driver/chat"><MessageSquare className="w-3.5 h-3.5 md:w-4 md:w-4" /></Link>
                                      </Button>
                                    )}
                                  </div>
                                )}
                            </div>
                            {activeRide.isPriorityPickup && (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived_at_pickup') && (<Alert variant="default" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 p-1.5 text-[10px] my-1"><Crown className="h-3.5 w-3.5" /><ShadAlertTitle className="font-bold text-xs"><span>Priority Booking</span></ShadAlertTitle><ShadAlertDescription className="font-bold text-[10px]"><span>Passenger offered +£{(activeRide.priorityFeeAmount || 0).toFixed(2)}.</span></ShadAlertDescription></Alert>)}

                           {currentStopTimerDisplay &&
                              activeRide.driverCurrentLegIndex &&
                              activeRide.driverCurrentLegIndex > 0 &&
                              activeRide.driverCurrentLegIndex < journeyPoints.length -1 &&
                              currentStopTimerDisplay.stopDataIndex === (activeRide.driverCurrentLegIndex -1) &&
                              (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
                            (
                              <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-300 my-1 p-1.5"><Timer className="h-4 w-4 text-current" /><ShadAlertTitle className="font-bold text-current text-xs">
                                <span>Waiting at Stop {currentStopTimerDisplay.stopDataIndex + 1}</span>
                              </ShadAlertTitle><ShadAlertDescription className="font-bold text-current text-[10px]"><span>
                                {currentStopTimerDisplay.freeSecondsLeft !== null && currentStopTimerDisplay.freeSecondsLeft > 0 && (`Free waiting time: ${formatTimer(currentStopTimerDisplay.freeSecondsLeft)} remaining.`)}
                                {currentStopTimerDisplay.extraSeconds !== null && currentStopTimerDisplay.extraSeconds >= 0 && currentStopTimerDisplay.freeSecondsLeft === 0 && (`Extra waiting: ${formatTimer(currentStopTimerDisplay.extraSeconds)}. Current Charge: £${currentStopTimerDisplay.charge.toFixed(2)}`)}
                              </span></ShadAlertDescription></Alert>
                            )}
                            {showPendingWRApprovalStatus && activeRide.estimatedAdditionalWaitTimeMinutes !== undefined && (
                                 <Alert variant="default" className="bg-purple-100 dark:bg-purple-800/30 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 my-1 p-1.5"><RefreshCw className="h-4 w-4 text-current animate-spin" /><ShadAlertTitle className="font-bold text-current text-xs"><span>Wait & Return Request</span></ShadAlertTitle><ShadAlertDescription className="font-bold text-current text-[10px]">
                                    <span>Passenger requests Wait & Return with an estimated <strong>{activeRide.estimatedAdditionalWaitTimeMinutes} minutes</strong> of waiting.</span>
                                    <br />
                                    <span>New estimated total fare (if accepted): £{(( (activeRide.fareEstimate || 0) + (activeRide.priorityFeeAmount || 0) ) * 1.70 + (Math.max(0, activeRide.estimatedAdditionalWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE)).toFixed(2)}.</span>
                                    <div className="flex gap-1 mt-1">
                                        <Button size="sm" className="font-bold bg-green-600 hover:bg-green-700 text-white h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'accept_wait_and_return')} disabled={!!actionLoading[activeRide.id]}><span>Accept W&R</span></Button>
                                        <Button size="sm" variant="destructive" className="font-bold h-6 text-[10px] px-1.5" onClick={() => handleRideAction(activeRide.id, 'decline_wait_and_return')} disabled={!!actionLoading[activeRide.id]}><span>Decline W&R</span></Button>
                                    </div>
                                </ShadAlertDescription></Alert>
                            )}

                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-black/70 dark:border-green-700 text-green-900 dark:text-green-100 text-sm">
                                <div className={cn("col-span-2 border-2 border-black dark:border-gray-700 rounded-md px-2 py-1 my-1")}>
                                  <p className="font-bold flex items-center gap-1.5 text-base">
                                    <DollarSign className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                                    <span>Fare: {displayedFare}</span>
                                  </p>
                                </div>
                                <p className="font-bold flex items-center gap-1.5"><UsersIcon className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> <span>Passengers: {activeRide.passengerCount}</span></p>
                                {activeRide.distanceMiles != null && (<p className="font-bold flex items-center gap-1.5"><Route className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> <span>Dist: ~{activeRide.distanceMiles.toFixed(1)} mi</span></p>)}
                                {activeRide.paymentMethod && ( <p className="font-bold flex items-center gap-1.5 col-span-2"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : activeRide.paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> : <Briefcase className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />} <span>Payment: {paymentMethodDisplay}</span> </p> )}
                            </div>
                             <div className="text-sm space-y-1 mt-2">
                                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> <strong className="shrink-0">From:</strong> <span className="font-bold">{activeRide?.pickupLocation?.address || 'Pickup N/A'}</span></p>
                                {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => ( <p key={index} className="flex items-start gap-1.5 pl-5"><MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> <strong className="shrink-0">Stop {index+1}:</strong> <span className="font-bold">{stop.address}</span> </p> ))}
                                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> <strong className="shrink-0">To:</strong> <span className="font-bold">{activeRide?.dropoffLocation?.address || 'Dropoff N/A'}</span></p>
                            </div>
                        </>
                        )}
                    </CardContent>
                </ScrollArea>
                <CardFooter className="p-2 border-t shrink-0">
                    {showCompletedStatus || showCancelledByDriverStatus || showCancelledNoShowStatus ? (
                        <Button
                            className="font-bold w-full bg-slate-600 hover:bg-slate-700 text-base text-white py-2.5 h-auto"
                            onClick={() => {
                                console.log("Done button clicked. Current status:", activeRide?.status, "Rating given:", driverRatingForPassenger);
                                if(showCompletedStatus && driverRatingForPassenger > 0 && activeRide?.passengerName) {
                                    console.log(`Mock: Driver rated passenger ${activeRide.passengerName} with ${driverRatingForPassenger} stars.`);
                                    toast({title: "Passenger Rating Submitted (Mock)", description: `You rated ${activeRide.passengerName} ${driverRatingForPassenger} stars.`});
                                }
                                setDriverRatingForPassenger(0);
                                setCurrentWaitingCharge(0); setAccumulatedStopWaitingCharges(0); setCompletedStopWaitCharges({}); setCurrentStopTimerDisplay(null); setActiveStopDetails(null); setIsCancelSwitchOn(false); setActiveRide(null); setIsPollingEnabled(true); setIsRideDetailsPanelMinimized(true);
                            }}
                            disabled={activeRide ? !!actionLoading[activeRide.id] : false}
                        >
                            <span>
                                {(activeRide && !!actionLoading[activeRide.id]) ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />} Done
                            </span>
                        </Button>
                    ) : (
                        <div className="grid gap-1.5 w-full">
                           {showDriverAssignedStatus && (
                             <CancelRideInteraction ride={activeRide} isLoading={!!actionLoading[activeRide.id]} />
                           )}
                           {showArrivedAtPickupStatus && (
                             <div className="grid grid-cols-1 gap-1.5">
                               <Button
                                 variant="destructive"
                                 className="font-bold w-full text-sm py-2 h-auto bg-red-700 hover:bg-red-800"
                                 onClick={() => {
                                     setRideToReportNoShow(activeRide);
                                     setIsNoShowConfirmDialogOpen(true);
                                 }}
                                 disabled={!!actionLoading[activeRide.id]}
                               >
                                 <span>{actionLoading[activeRide.id] && activeRide.status === 'cancelled_no_show' ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <UserXIcon className="mr-1.5 h-4 w-4"/>}
                                 Report No Show</span>
                               </Button>
                             </div>
                           )}
                           {(showInProgressStatus || showInProgressWRStatus) && (
                             <div className="grid grid-cols-1 gap-1.5">
                               {showInProgressStatus && !activeRide.waitAndReturn && (
                                 <Button
                                   variant="outline"
                                   className="font-bold w-full text-sm py-2 h-auto border-accent text-accent hover:bg-accent/10"
                                   onClick={() => setIsWRRequestDialogOpen(true)}
                                   disabled={isRequestingWR || !!actionLoading[activeRide.id]}
                                 >
                                   <span><RefreshCw className="mr-1.5 h-4 w-4" /> Request Wait & Return</span>
                                 </Button>
                               )}
                             </div>
                           )}
                        </div>
                    )}
                </CardFooter>
            </Card>
        )}

      {!activeRide && !isLoading && (
        <Card className="flex-1 flex flex-col rounded-xl shadow-lg bg-card border max-h-40 relative">
           <div className="absolute top-3 left-3 z-10 flex items-center space-x-1 p-1 bg-background/70 backdrop-blur-sm rounded-md">
            <Switch id="speed-limit-mock-toggle-main" checked={isSpeedLimitFeatureEnabled} onCheckedChange={setIsSpeedLimitFeatureEnabled} aria-label="Toggle speed limit mock UI" className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3 data-[state=unchecked]:[&>span]:translate-x-0.5" />
            <Label htmlFor="speed-limit-mock-toggle-main" className="text-xs font-medium text-muted-foreground">Speed Mock</Label>
          </div>
          <CardHeader className={cn( "p-2 border-b text-center", isDriverOnline ? "border-green-500" : "border-red-500")}>
            <CardTitle className={cn( "font-bold text-lg", isDriverOnline ? "text-green-600" : "text-red-600")}>
              <span>{isDriverOnline ? "Online - Awaiting Offers" : "Offline"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-3 space-y-1">
        {geolocationError && isDriverOnline && (
            <Alert variant="destructive" className="mb-2 text-xs">
                <AlertTriangle className="h-4 w-4" />
                <ShadAlertTitle className="font-bold"><span>Location Error</span></ShadAlertTitle>
                <ShadAlertDescription><span>{geolocationError}</span></ShadAlertDescription>
            </Alert>
        )}
        {isDriverOnline ? ( !geolocationError && ( <> <Loader2 className="w-6 h-6 text-primary animate-spin" /> <p className="font-bold text-xs text-muted-foreground text-center">Actively searching for ride offers for you...</p> </>) ) : ( <> <Power className="w-8 h-8 text-muted-foreground" /> <p className="font-bold text-sm text-muted-foreground">You are currently offline.</p> </>) } <div className="flex items-center space-x-2 pt-1"> <Switch id="driver-online-toggle" checked={isDriverOnline} onCheckedChange={handleToggleOnlineStatus} aria-label="Toggle driver online status" className={cn(!isDriverOnline && "data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted-foreground")} /> <Label htmlFor="driver-online-toggle" className={cn("font-bold text-sm", isDriverOnline ? 'text-green-600' : 'text-red-600')} > <span>{isDriverOnline ? "Online" : "Offline"}</span> </Label> </div>
        {isDriverOnline && ( <Button variant="outline" size="sm" onClick={() => {
            if (!activeRide) {
              handleSimulateOffer();
            } else {
              toast({ title: "Action Not Allowed", description: "Please complete your current ride before simulating a new offer.", variant: "default" });
            }
          }} className="mt-2 text-xs h-8 px-3 py-1 font-bold" disabled={!!activeRide}> <span>Simulate Incoming Ride Offer (Test)</span> </Button> )} </CardContent> </Card>
      )}
      <RideOfferModal
        isOpen={isOfferModalOpen}
        onClose={() => {
            setIsOfferModalOpen(false);
            setCurrentOfferDetails(null);
        }}
        onAccept={handleAcceptOffer}
        onDecline={handleDeclineOffer}
        rideDetails={currentOfferDetails}
      />
          <AlertDialog
            open={isStationaryReminderVisible}
            onOpenChange={setIsStationaryReminderVisible}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <ShadAlertDialogTitleForDialog className="font-bold flex items-center gap-2"><Navigation className="w-5 h-5 text-primary" /> <span>Time to Go!</span></ShadAlertDialogTitleForDialog>
                <ShadAlertDialogDescriptionForDialog><span>Please proceed to the pickup location for {activeRide?.passengerName || 'the passenger'} at {activeRide?.pickupLocation.address || 'the specified address'}.</span></ShadAlertDialogDescriptionForDialog>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsStationaryReminderVisible(false)}>
                  <span>Okay, I&apos;m Going!</span>
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
                    <span>Keep Ride</span>
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { if (activeRide) { console.log("Cancel Dialog: 'Confirm Cancel' clicked for ride:", activeRide.id); handleRideAction(activeRide.id, 'cancel_active'); } setShowCancelConfirmationDialog(false); }}
                    disabled={!activeRide || (!!actionLoading[activeRide?.id ?? ''])}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <span className="font-bold flex items-center justify-center">
                    {activeRide && (!!actionLoading[activeRide.id]) ? (
                         <React.Fragment>
                           <Loader2 key="loader-cancel" className="animate-spin mr-2 h-4 w-4" />
                           <span>Cancelling...</span>
                         </React.Fragment>
                      ) : (
                         <React.Fragment>
                           <ShieldX key="icon-cancel" className="mr-2 h-4 w-4" />
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
                      <ShadAlertDialogTitleForDialog className="font-bold text-destructive"><span>Confirm Passenger No-Show</span></ShadAlertDialogTitleForDialog>
                      <ShadAlertDialogDescriptionForDialog>
                          <span>Are you sure the passenger ({rideToReportNoShow?.passengerName || 'N/A'}) did not show up at the pickup location ({rideToReportNoShow?.pickupLocation.address || 'N/A'})? This will cancel the ride and may impact the passenger's account.</span>
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
                         <span className="font-bold">Confirm No-Show</span>
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
         <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-bold text-xl flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> <span>Request Wait & Return</span></DialogTitle>
              <ShadDialogDescriptionDialog>
                <span>Estimate additional waiting time at current drop-off. {FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER} mins free, then £{WAITING_CHARGE_PER_MINUTE_DRIVER.toFixed(2)}/min. Passenger must approve.</span>
              </ShadDialogDescriptionDialog>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="wr-wait-time-input" className="font-bold"><span>Additional Wait Time (minutes)</span></Label>
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
                <span>Cancel</span>
              </Button>
              <Button type="button" onClick={handleRequestWaitAndReturnAction} className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isRequestingWR}>
                {isRequestingWR ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <span>Request</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <Dialog open={isAccountJobPinDialogOpen} onOpenChange={setIsAccountJobPinDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-bold flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary" /><span>Account Job PIN Required</span></DialogTitle>
            <ShadDialogDescriptionDialog>
              <span>Ask the passenger for their 4-digit Job PIN to start this account ride.</span>
            </ShadDialogDescriptionDialog>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="account-job-pin-input" className="font-bold"><span>Enter 4-Digit Job PIN</span></Label>
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
                <span>Cancel</span>
                </Button>
                <Button type="button" onClick={verifyAndStartAccountJobRide} className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isVerifyingAccountJobPin || enteredAccountJobPin.length !== 4}>
                  {isVerifyingAccountJobPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  <span>Verify & Start Ride</span>
                </Button>
            </div>
            <Button type="button" variant="link" size="sm" className="font-bold text-xs text-muted-foreground hover:text-primary h-auto p-1 mt-2" onClick={handleStartRideWithManualPinOverride} disabled={isVerifyingAccountJobPin}>
              <span>Problem with PIN? Start ride manually.</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={isJourneyDetailsModalOpen} onOpenChange={setIsJourneyDetailsModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-bold text-xl flex items-center gap-2"><Route className="w-5 h-5 text-primary" /> <span>Full Journey Details</span></DialogTitle>
              <ShadDialogDescriptionDialog>
                <span>Overview of all legs for the current ride (ID: {activeRide?.displayBookingId || activeRide?.id || 'N/A'}).</span>
              </ShadDialogDescriptionDialog>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] p-1 -mx-1">
              <div className="p-4 space-y-3">
                {activeRide && journeyPoints.map((point, index) => {
                  const isCurrentLeg = index === localCurrentLegIndex;
                  const isPastLeg = index < localCurrentLegIndex;
                  let legType = "";
                  let Icon = MapPin;
                  let iconColor = "text-muted-foreground";

                  if (index === 0) { legType = "Pickup"; iconColor = "text-green-500"; }
                  else if (index === journeyPoints.length - 1) { legType = "Dropoff"; iconColor = "text-orange-500"; }
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
                      <p className={cn("font-bold flex items-center gap-2", iconColor, isPastLeg && "line-through text-muted-foreground/70")}>
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{legType}</span>
                      </p>
                      <p className={cn("font-bold text-sm text-foreground pl-6", isPastLeg && "line-through text-muted-foreground/70")}>
                        <span>{point.address}</span>
                      </p>
                      {point.doorOrFlat && (
                        <p className={cn("font-bold text-xs text-muted-foreground pl-6", isPastLeg && "line-through text-muted-foreground/70")}>
                          <span>(Unit/Flat: {point.doorOrFlat})</span>
                        </p>
                      )}
                    </div>
                  );
                })}
                {!activeRide && <p><span>No active ride details to display.</span></p>}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="font-bold"><span>Close</span></Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

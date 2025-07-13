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
import { db as importedDb } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, Timestamp, GeoPoint, updateDoc, getDoc, deleteField } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SpeedLimitDisplay } from '@/components/driver/SpeedLimitDisplay';
import type { LucideIcon } from 'lucide-react';
import { formatAddressForMapLabel, formatAddressForDisplay } from '@/lib/utils';
import * as RadixSwitch from "@radix-ui/react-switch";

if (!importedDb) {
  throw new Error('Firestore db is not initialized. Check your Firebase config.');
}
const db = importedDb;

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

const STOP_FREE_WAITING_TIME_SECONDS = 1 * 60; // Changed to 1 minute
const STOP_WAITING_CHARGE_PER_MINUTE = 0.25;

const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER = 10;

// Add a type for hazard markers
interface HazardMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  label: string;
  iconUrl: string;
  iconScaledSize: { width: number; height: number };
}

// MOCK: Always use Huddersfield for driver location (for testing)
const HUDDERSFIELD_LOCATION = { lat: 53.645792, lng: -1.785035 };

export default function AvailableRidesPage() {
  const [rideRequests, setRideRequests] = useState<RideOffer[]>([]);
 const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
 const isOnARide = !!activeRide && [
  'driver_assigned',
  'arrived_at_pickup',
  'in_progress',
  'in_progress_wait_and_return'
].includes(activeRide.status?.toLowerCase() ?? '');
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

  const [useMockLocation, setUseMockLocation] = useState(false);
  const useMockLocationRef = useRef(useMockLocation);
  useEffect(() => {
    useMockLocationRef.current = useMockLocation;
  }, [useMockLocation]);
  const HUDDERSFIELD_LOCATION = { lat: 53.645792, lng: -1.785035 };

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        isDriverOnline &&
        geolocationError &&
        geolocationError.toLowerCase().includes('location access denied')
      ) {
        if (navigator.geolocation && driverUser) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Initial geolocation:', position.coords);
              setGeolocationError(null);
              setDriverLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              // Restart watcher
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
              }
              watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                  setDriverLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  });
                  setGeolocationError(null);
                },
                (error) => {
                  setGeolocationError(error.message);
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
              );
            },
            (error) => {
              setGeolocationError('Location access denied. You must allow location to go online.');
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDriverOnline, geolocationError, driverUser]);
  

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

// Hazard markers state (must be inside component)
const [hazardMarkers, setHazardMarkers] = useState<HazardMarker[]>([]);
const [hazardConfirmationDialog, setHazardConfirmationDialog] = useState<{ open: boolean; hazard: HazardMarker | null }>({ open: false, hazard: null });
const [recentlyPromptedHazardIds, setRecentlyPromptedHazardIds] = useState<string[]>([]);

useEffect(() => {
  if (!driverLocation || !hazardMarkers.length) return;
  const NEARBY_DISTANCE_METERS = 100;
  for (const marker of hazardMarkers) {
    if (!marker.id) continue;
    const distance = getDistanceBetweenPointsInMeters(driverLocation, marker.position);
    if (distance < NEARBY_DISTANCE_METERS && !recentlyPromptedHazardIds.includes(marker.id)) {
      setHazardConfirmationDialog({ open: true, hazard: marker });
      setRecentlyPromptedHazardIds((ids: string[]) => [...ids, marker.id]);
      break;
    }
  }
}, [driverLocation, hazardMarkers]);

const handleHazardFeedback = async (hazardId: string, isPresent: boolean) => {
  try {
    await fetch('/api/driver/map-hazards/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hazardId, isPresent }),
    });
  } catch (e) {}
  setHazardConfirmationDialog({ open: false, hazard: null });
};

useEffect(() => {
  if (!driverLocation) return;
  async function fetchNearbyHazards() {
    try {
      const response = await fetch(`/api/driver/map-hazards/active?lat=${driverLocation.lat}&lng=${driverLocation.lng}`);
      if (!response.ok) throw new Error('Failed to fetch hazards');
      const data = await response.json();
      if (data && Array.isArray(data.hazards)) {
        const RADIUS_METERS = 500;
        const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const toRad = (x: number) => x * Math.PI / 180;
          const R = 6371000;
          const dLat = toRad(lat2 - lat1);
          const dLng = toRad(lng2 - lng1);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        setHazardMarkers(
          data.hazards
            .filter(hazard => getDistance(driverLocation.lat, driverLocation.lng, hazard.location.latitude, hazard.location.longitude) <= RADIUS_METERS)
            .map((hazard: any) => ({
              id: hazard.id || hazard.hazardId || String(Math.random()),
              position: { lat: hazard.location.latitude, lng: hazard.location.longitude },
              title: hazard.hazardType,
              label: hazard.hazardType[0],
              iconUrl: hazard.hazardType === 'Roadwork' ? '/icons/cone-yellow.svg' : '/icons/alert-red.svg',
              iconScaledSize: { width: 32, height: 32 },
            }))
        );
      }
    } catch (e) {
      // Optionally handle error
    }
  }
  fetchNearbyHazards();
}, [driverLocation]);

  const [isAccountJobPinDialogOpen, setIsAccountJobPinDialogOpen] = useState(false);
  const [pauseOffers, setPauseOffers] = useState(false);
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

  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const mapAndRideDetails = useMemo(() => {
    let baseFareWithWRSurchargeForDisplay = activeRide?.fareEstimate || 0;
    if (activeRide?.waitAndReturn) {
      const wrBaseFare = (activeRide.fareEstimate || 0) * 1.70;
      const additionalWaitCharge = Math.max(0, (activeRide.estimatedAdditionalWaitTimeMinutes || 0) - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR_DRIVER) * STOP_WAITING_CHARGE_PER_MINUTE;
      baseFareWithWRSurchargeForDisplay = wrBaseFare + additionalWaitCharge;
    }

    const numericGrandTotal = baseFareWithWRSurchargeForDisplay + (activeRide?.isPriorityPickup && activeRide?.priorityFeeAmount ? activeRide.priorityFeeAmount : 0) + accumulatedStopWaitingCharges + currentWaitingCharge;
    const displayedFare = `£${numericGrandTotal.toFixed(2)}`;

    const paymentMethodDisplay =
      activeRide?.paymentMethod === 'card' ? 'Card'
      : activeRide?.paymentMethod === 'cash' ? 'Cash'
      : activeRide?.paymentMethod === 'account' ? 'Account'
      : 'Payment N/A';

    const hasPriority = !!(activeRide?.isPriorityPickup && activeRide?.priorityFeeAmount && activeRide.priorityFeeAmount > 0);
    const currentPriorityAmount = hasPriority ? activeRide?.priorityFeeAmount! : 0;
    const basePlusWRFare = numericGrandTotal - currentPriorityAmount;

    // Map elements
    const rideMarkers: google.maps.MarkerOptions[] = [];
    const rideLabels: ICustomMapLabelOverlay[] = [];

    if (activeRide) {
      rideMarkers.push({
        position: activeRide.pickupLocation,
        icon: {
          url: "/icons/pickup-marker.svg",
          scaledSize: new google.maps.Size(32, 32),
        },
      });
      rideLabels.push({
        position: activeRide.pickupLocation,
        text: formatAddressForMapLabel(activeRide.pickupLocation.address),
        type: LabelType.Pickup,
        color: "#2196F3",
      });

      rideMarkers.push({
        position: activeRide.dropoffLocation,
        icon: {
          url: "/icons/dropoff-marker.svg",
          scaledSize: new google.maps.Size(32, 32),
        },
      });
      rideLabels.push({
        position: activeRide.dropoffLocation,
        text: formatAddressForMapLabel(activeRide.dropoffLocation.address),
        type: LabelType.Dropoff,
        color: "#F44336",
      });

      activeRide.stops?.forEach((stop, index) => {
        rideMarkers.push({
          position: stop,
          icon: {
            url: `/icons/stop-marker-${index + 1}.svg`,
            scaledSize: new google.maps.Size(32, 32),
          },
        });
        rideLabels.push({
          position: stop,
          text: formatAddressForMapLabel(stop.address),
          type: LabelType.Stop,
          color: "#FFC107",
        });
      });
    }

    if (driverLocation) {
      rideMarkers.push({
        position: driverLocation,
        icon: {
          url: driverCarIconDataUrl,
          scaledSize: new google.maps.Size(30, 45),
          anchor: new google.maps.Point(15, 45),
        },
      });
    }

    hazardMarkers.forEach(marker => {
      rideMarkers.push(marker);
      rideLabels.push({
        position: marker.position,
        text: marker.title,
        type: LabelType.Hazard,
        color: "#FF5722",
      });
    });

    return {
      numericGrandTotal,
      displayedFare,
      paymentMethodDisplay,
      hasPriority,
      currentPriorityAmount,
      basePlusWRFare,
      markers: rideMarkers,
      labels: rideLabels,
    };
  }, [
    activeRide,
    accumulatedStopWaitingCharges,
    currentWaitingCharge,
    driverLocation,
    hazardMarkers,
  ]);

  const memoizedMarkers = mapAndRideDetails.markers;
  const memoizedLabels = mapAndRideDetails.labels;

  // Helper to always get the correct location (mock or real)
  function getDriverLocationFromPosition(position: GeolocationPosition): google.maps.LatLngLiteral {
    return useMockLocationRef.current
      ? HUDDERSFIELD_LOCATION
      : { lat: position.coords.latitude, lng: position.coords.longitude };
  }

  const startLocationWatcher = () => {
    if (navigator.geolocation && driverUser) {
      // Clear any previous interval
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
        locationUpdateIntervalRef.current = null;
      }
      // Start a new interval to update location every 7 seconds
      locationUpdateIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            console.log('Interval geolocation:', position.coords);
            const location = getDriverLocationFromPosition(position);
            try {
              // Update driver location in drivers collection
              await updateDoc(doc(db, 'drivers', driverUser.id), { location });
              console.log('Driver location updated in Firestore:', location);
              
              // If driver is on an active ride, also update the booking document for passenger tracking
              if (activeRide && activeRide.id && isOnARide) {
                try {
                  await updateDoc(doc(db, 'bookings', activeRide.id), {
                    driverCurrentLocation: location,
                    updatedAt: serverTimestamp()
                  });
                  console.log('Driver location updated in booking document for passenger tracking:', location);
                } catch (bookingUpdateErr) {
                  console.error('Error updating driver location in booking document:', bookingUpdateErr);
                  // Don't fail the entire location update if booking update fails
                }
              }
            } catch (err) {
              console.error('Error updating driver location:', err);
            }
            setDriverLocation(location);
          },
          (error) => {
            console.error('Geolocation error (interval):', error);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
      }, 7000); // 7 seconds
    }
  };

  const stopLocationWatcher = () => {
    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current);
      locationUpdateIntervalRef.current = null;
    }
  };

  // Update handleToggleOnlineStatus to start/stop watcher
  const handleToggleOnlineStatus = (newOnlineStatus: boolean) => {
    console.log('[handleToggleOnlineStatus] Toggle changed:', newOnlineStatus);
    setIsDriverOnline(newOnlineStatus);
    if (newOnlineStatus) {
      setConsecutiveMissedOffers(0);
      if (geolocationError) {
        setGeolocationError(null);
      }
      setIsPollingEnabled(true);
      // Write driver location to Firestore when going online
      if (navigator.geolocation && driverUser) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = getDriverLocationFromPosition(position);
            console.log('[handleToggleOnlineStatus] Attempting to set driver online with location:', location);
            try {
              await setDoc(
                doc(db, 'drivers', driverUser.id),
                {
                  name: driverUser.name,
                  email: driverUser.email,
                  status: 'Active',
                  availability: 'online', // <-- Add this line
                  location: useMockLocationRef.current ? HUDDERSFIELD_LOCATION : location,
                  createdAt: serverTimestamp(),
                  vehicleCategory: driverUser.vehicleCategory || '',
                  operatorCode: driverUser.operatorCode || '',
                },
                { merge: true }
              );
              console.log('[handleToggleOnlineStatus] Driver location written to Firestore:', location);
              await updateDoc(doc(db, 'users', driverUser.id), { status: 'Active' });
              console.log('[handleToggleOnlineStatus] Driver status set to Active in both collections.');
              startLocationWatcher(); // Start real-time updates
            } catch (err) {
              console.error('[handleToggleOnlineStatus] Error setting driver online:', err);
            }
          },
          (error) => {
            console.error('[handleToggleOnlineStatus] Geolocation error:', error);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
      }
    } else {
      setRideRequests([]);
      setIsPollingEnabled(false);
      stopLocationWatcher(); // Stop real-time updates
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPauseOffers(false); // Auto-reset Pause Ride Offers when going offline
      // --- Update Firestore to set driver offline ---
      if (driverUser && db) {
        (async () => {
          try {
            // Find driver document by email (for safety, but use ID if possible)
            const driverDocRef = doc(db, 'drivers', driverUser.id);
            await updateDoc(driverDocRef, {
              status: 'Inactive',
              availability: 'offline',
              location: deleteField(),
            });
            console.log('[handleToggleOnlineStatus] Driver document updated to offline in Firestore');
            // Also update status in the users collection
            await updateDoc(doc(db, 'users', driverUser.id), { status: 'Inactive' });
            console.log('[handleToggleOnlineStatus] User document updated to offline in Firestore');
          } catch (err) {
            console.error('[handleToggleOnlineStatus] Error setting driver offline:', err);
          }
        })();
      }
      console.log('[handleToggleOnlineStatus] Set driver offline, stopped polling and location watcher.');
    }
  };

// Real-time ride offer subscription
useEffect(() => {
  if (!driverUser?.id || pauseOffers === true) return;
  const offersQuery = query(
    collection(db, 'rideOffers'),
    where('driverId', '==', driverUser.id),
    where('status', '==', 'pending'),
  );
  const unsubscribe = onSnapshot(offersQuery, (snapshot) => {
    console.log('[RideOfferLoader] Firestore snapshot received:', snapshot.docs.map(doc => doc.id));
    const offers = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: data.bookingId, // Always use bookingId as id
      };
    });
    if (offers.length > 0 && (offers[0].offerDetails || offers[0].id)) {
      const freshOffer = {
        ...((offers[0].offerDetails || {})),
        id: offers[0].id || offers[0].bookingId || "",
      };
      console.log('[RideOfferLoader] Setting currentOfferDetails:', freshOffer);
      setCurrentOfferDetails(freshOffer);
      setIsOfferModalOpen(true);
    } else {
      // No offers, clear modal and state
      setCurrentOfferDetails(null);
      setIsOfferModalOpen(false);
    }
  });
  return () => unsubscribe();
}, [driverUser?.id, pauseOffers]);

// Sync polling with pauseOffers toggle
useEffect(() => {
  if (pauseOffers) {
    setIsPollingEnabled(false);
  } else {
    setIsPollingEnabled(true);
  }
}, [pauseOffers]);


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

  // Memoize map markers and labels to prevent unnecessary re-renders from timer state changes
const mapDisplayElements = useMemo(() => {
    const markers: Array<{ position: google.maps.LatLngLiteral; title?: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType, variant?: 'default' | 'compact' }> = [];

    if (!activeRide) {
       if (isDriverOnline && driverLocation) {
        if (driverLocation.lat && driverLocation.lng) {
          markers.push({
              position: driverLocation,
              title: "Your Current Location",
              iconUrl: driverCarIconDataUrl,
              iconScaledSize: {width: 30, height: 45}
          });
        } else {
          console.warn('Invalid driverLocation for marker:', driverLocation);
        }
        if (driverCurrentStreetName) {
            labels.push({
                position: driverLocation,
                content: driverCurrentStreetName,
                type: 'driver',
                variant: 'compact'
            });
        }
      }
      console.log('Map Markers:', markers);
      return { markers, labels };
    }

    const currentStatusLower = activeRide?.status ? activeRide.status.toLowerCase() : "";
    const currentLegIdx = localCurrentLegIndex;

    const currentLocToDisplay = isDriverOnline && watchIdRef.current && driverLocation
        ? driverLocation
        : activeRide.driverCurrentLocation;

    if (currentLocToDisplay && currentLocToDisplay.lat && currentLocToDisplay.lng) {
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
    } else if (currentLocToDisplay) {
      console.warn('Invalid currentLocToDisplay for marker:', currentLocToDisplay);
    }

    const isEnRouteToPickup = currentStatusLower === 'driver_assigned';
    const isAtPickup = currentStatusLower === 'arrived_at_pickup';
    const isRideInProgress = currentStatusLower === 'in_progress' || currentStatusLower === 'in_progress_wait_and_return';

    if (activeRide.pickupLocation && (isEnRouteToPickup || isAtPickup || (isRideInProgress && currentLegIdx > 0 ))) {
      if (isEnRouteToPickup || isAtPickup) {
        markers.push({
            position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude},
            title: `Pickup: ${activeRide.pickupLocation?.address}`,
            label: { text: "P", color: "white", fontWeight: "bold"}
        });
      }
      if (isEnRouteToPickup || isAtPickup) {
        labels.push({
            position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
            content: formatAddressForMapLabel(activeRide.pickupLocation?.address, 'Pickup'),
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
                        content: formatAddressForMapLabel(stop.address, `Stop ${index + 1}`),
                        type: 'stop',
                        variant: (localCurrentLegIndex === stopLegIndex) ? 'default' : 'compact'
                    });
                }
            }
        });

        // Show dropoff label only for the final leg (when localCurrentLegIndex === dropoffLegIndex)
        if (activeRide.dropoffLocation) {
            if (localCurrentLegIndex === dropoffLegIndex) {
                markers.push({
                    position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude},
                    title: `Dropoff: ${activeRide.dropoffLocation.address}`,
                    label: { text: "D", color: "white", fontWeight: "bold"}
                });
                labels.push({
                    position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
                    content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
                    type: 'dropoff',
                    variant: 'default'
                });
            }
        }

    }
    // At the end, before returning
    console.log('Map Markers:', markers.map(m => m.position));
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

  useEffect(() => {
    // On component mount or when driver logs in, fetch last known location from Firestore
    if (driverUser) {
      const driverDocRef = doc(db, 'drivers', driverUser.id);
      getDoc(driverDocRef).then((docSnap) => {
        if (docSnap.exists() && docSnap.data().location) {
          setDriverLocation(useMockLocationRef.current ? HUDDERSFIELD_LOCATION : docSnap.data().location); // Set map to last known location
        }
      });
    }
  }, [driverUser, useMockLocationRef]);

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
      }
      if (data?.completedStopWaitCharges) {
        setCompletedStopWaitCharges(data.completedStopWaitCharges);
        setAccumulatedStopWaitingCharges(Object.values(data.completedStopWaitCharges).reduce((sum: number, charge: number) => sum + charge, 0));
      }


    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Unknown error fetching active ride.";
      console.error("Error in fetchActiveRide:", message);
      setError(message);
    } finally {
      if (initialLoadOrNoRide) setIsLoading(false);
    }
  }, [driverUser?.id]);


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

    const currentLegIdx = activeRide?.driverCurrentLegIndex;
    const isAtIntermediateStop = activeRide &&
                                 (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
                                 currentLegIdx !== undefined &&
                                 currentLegIdx > 0 &&
                                 currentLegIdx < journeyPoints.length -1;

    console.log("[StopTimerEffect Main Condition Check]", {
        status: activeRide?.status,
        currentLegIdx,
        journeyPointsLength: journeyPoints.length,
        isAtIntermediateStop,
        activeStopDetails_stopDataIndex: activeStopDetails?.stopDataIndex,
        activeStopDetails_arrivalTime: activeStopDetails?.arrivalTime,
        condition3_match: activeStopDetails ? activeStopDetails.stopDataIndex === (currentLegIdx! - 1) : "N/A (no activeStopDetails)"
    });

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
      console.log("[StopTimerEffect] Condition NOT met or currentStopDetails not matching current leg. Clearing timer display.");
      setCurrentStopTimerDisplay(null);
    }

    return () => {
      if (stopIntervalRef.current) {
        console.log("[StopTimerEffect Cleanup] Clearing timer for stop index", activeStopDetails?.stopDataIndex);
        clearInterval(stopIntervalRef.current);
      }
    };
  }, [activeRide?.status, activeRide?.driverCurrentLegIndex, journeyPoints, activeStopDetails]);


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
    // Prevent multiple intervals from being created
    if (rideRefreshIntervalIdRef.current) {
      clearInterval(rideRefreshIntervalIdRef.current);
      rideRefreshIntervalIdRef.current = null;
    }
    if (driverUser && isPollingEnabled) {
      console.log("POLLING EFFECT: Polling enabled, fetching active ride and starting interval.");
      fetchActiveRide();
      // Only set interval if not already set
      if (!rideRefreshIntervalIdRef.current) {
        rideRefreshIntervalIdRef.current = setInterval(fetchActiveRide, 30000);
      }
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
    const passengerPhoneNumber = `+447700900${Math.floor(Math.random() * 900) + 100}`;

    const stopsForOffer: Array<{ address: string; coords: { lat: number; lng: number } }> = [];
    const numberOfStops = Math.random() < 0.5 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    
    if (numberOfStops >= 1) {
        let stop1Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        while ([randomPickupIndex, randomDropoffIndex].includes(stop1Index)) {
            stop1Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        }
        stopsForOffer.push(mockHuddersfieldLocations[stop1Index]);
    }
    if (numberOfStops === 2) {
        let stop2Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        while ([randomPickupIndex, randomDropoffIndex, stopsForOffer[0] ? mockHuddersfieldLocations.findIndex(loc => loc.address === stopsForOffer[0].address) : -1].includes(stop2Index)) {
            stop2Index = Math.floor(Math.random() * mockHuddersfieldLocations.length);
        }
        stopsForOffer.push(mockHuddersfieldLocations[stop2Index]);
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
      fareEstimate: parseFloat((Math.random() * 15 + 5 + (stopsForOffer.length * 3)).toFixed(2)),
      isPriorityPickup: isPriority,
      priorityFeeAmount: currentPriorityFeeAmount,
      passengerCount: Math.floor(Math.random() * 3) + 1,
      passengerId: `pass-mock-${Date.now().toString().slice(-4)}`,
      passengerName: `Passenger ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
      passengerPhone: passengerPhoneNumber,
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
    console.log("[handleSimulateOffer] Generated Mock Offer with phone & stops:", JSON.stringify(mockOfferWithDisplayId, null, 2));
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

    if (!rideId || !driverUser) {
      toast({title: "Error Accepting Ride", description: "Offer details or driver session missing.", variant: "destructive"});
      return;
    }

    // Fetch the latest offer from Firestore
    let offerToAccept = null;
    try {
      const offerDocRef = doc(db, 'rideOffers', rideId);
      const offerDocSnap = await getDoc(offerDocRef);
      if (offerDocSnap.exists()) {
        offerToAccept = { ...offerDocSnap.data(), id: offerDocSnap.id };
        console.log('[handleAcceptOffer] Fetched latest offer from Firestore:', offerToAccept);
      } else {
        toast({ title: "Error", description: "Ride offer not found in Firestore.", variant: "destructive" });
        setIsOfferModalOpen(false);
        setCurrentOfferDetails(null);
        setIsPollingEnabled(true);
        return;
      }
    } catch (err) {
      console.error('[handleAcceptOffer] Error fetching offer from Firestore:', err);
      toast({ title: "Error", description: "Failed to fetch latest ride offer.", variant: "destructive" });
      setIsOfferModalOpen(false);
      setCurrentOfferDetails(null);
      setIsPollingEnabled(true);
      return;
    }

    // Patch: Ensure all required fields are present and non-null for offerDetailsSchema
    const safeOfferDetails = {
      id: offerToAccept.id || rideId || "",
      pickupLocation: offerToAccept.offerDetails?.pickupLocation?.address || offerToAccept.offerDetails?.pickupLocation || "",
      pickupCoords: offerToAccept.offerDetails?.pickupCoords || (offerToAccept.offerDetails?.pickupLocation && offerToAccept.offerDetails?.pickupLocation.latitude && offerToAccept.offerDetails?.pickupLocation.longitude ? { lat: offerToAccept.offerDetails.pickupLocation.latitude, lng: offerToAccept.offerDetails.pickupLocation.longitude } : { lat: 0, lng: 0 }),
      dropoffLocation: offerToAccept.offerDetails?.dropoffLocation?.address || offerToAccept.offerDetails?.dropoffLocation || "",
      dropoffCoords: offerToAccept.offerDetails?.dropoffCoords || (offerToAccept.offerDetails?.dropoffLocation && offerToAccept.offerDetails?.dropoffLocation.latitude && offerToAccept.offerDetails?.dropoffLocation.longitude ? { lat: offerToAccept.offerDetails.dropoffLocation.latitude, lng: offerToAccept.offerDetails.dropoffLocation.longitude } : { lat: 0, lng: 0 }),
      stops: Array.isArray(offerToAccept.offerDetails?.stops) ? offerToAccept.offerDetails.stops.map((s: any) => ({ address: s.address || "", coords: s.coords || (s.latitude && s.longitude ? { lat: s.latitude, lng: s.longitude } : { lat: 0, lng: 0 }) })) : [],
      fareEstimate: typeof offerToAccept.offerDetails?.fareEstimate === 'number' ? offerToAccept.offerDetails.fareEstimate : 0,
      passengerCount: typeof offerToAccept.offerDetails?.passengerCount === 'number' ? offerToAccept.offerDetails.passengerCount : 1,
      passengerId: offerToAccept.offerDetails?.passengerId || "",
      passengerName: offerToAccept.offerDetails?.passengerName || "",
      passengerPhone: offerToAccept.offerDetails?.passengerPhone || "",
      notes: offerToAccept.offerDetails?.notes || "",
      requiredOperatorId: offerToAccept.offerDetails?.requiredOperatorId || "",
      distanceMiles: typeof offerToAccept.offerDetails?.distanceMiles === 'number' ? offerToAccept.offerDetails.distanceMiles : 0,
      paymentMethod: offerToAccept.offerDetails?.paymentMethod || 'card',
      isPriorityPickup: !!offerToAccept.offerDetails?.isPriorityPickup,
      priorityFeeAmount: typeof offerToAccept.offerDetails?.priorityFeeAmount === 'number' ? offerToAccept.offerDetails.priorityFeeAmount : 0,
      dispatchMethod: offerToAccept.offerDetails?.dispatchMethod || 'auto_system',
      accountJobPin: offerToAccept.offerDetails?.accountJobPin || "",
    };

    const updatePayload: any = {
      driverId: driverUser.id || "",
      driverName: driverUser.name || "Driver",
      status: 'driver_assigned',
      vehicleType: driverUser.vehicleCategory || 'Car',
      driverVehicleDetails: `${driverUser.vehicleCategory || 'Car'} - ${driverUser.customId || 'MOCKREG'}`,
      offerDetails: safeOfferDetails,
      isPriorityPickup: !!offerToAccept.offerDetails?.isPriorityPickup,
      priorityFeeAmount: typeof offerToAccept.offerDetails?.priorityFeeAmount === 'number' ? offerToAccept.offerDetails.priorityFeeAmount : 0,
      dispatchMethod: offerToAccept.dispatchMethod || '',
      driverCurrentLocation: driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : { lat: 0, lng: 0 },
      accountJobPin: offerToAccept.offerDetails?.accountJobPin ?? "",
      waitAndReturn: false,
      estimatedAdditionalWaitTimeMinutes: null,
      noShowFeeApplicable: false,
      cancellationFeeApplicable: false,
      cancellationType: '',
      updatedLegDetails: undefined,
      pickupWaitingCharge: undefined,
      action: undefined,
    };
    console.log(`[handleAcceptOffer] Sending accept payload for ${rideId}:`, JSON.stringify(updatePayload, null, 2));


    try {
      const bookingId = offerToAccept.id || offerToAccept.bookingId || rideId;
      if (!bookingId) {
        toast({ title: "Error", description: "Booking ID missing for ride acceptance.", variant: "destructive" });
        setIsOfferModalOpen(false);
        setCurrentOfferDetails(null);
        setIsPollingEnabled(true);
        return;
      }
      const response = await fetch(`/api/operator/bookings/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      console.log(`[handleAcceptOffer] Accept offer response status for ${rideId}: ${response.status}`);

      let updatedBookingDataFromServer;
      if (response.ok) {
        updatedBookingDataFromServer = await response.json();
        if (!updatedBookingDataFromServer || !updatedBookingDataFromServer.booking) {
            console.error(`[handleAcceptOffer] Accept offer for ${rideId}: Server OK but booking data missing.`);
            throw new Error("Server returned success but booking data was missing in response.");
        }
        console.log(`[handleAcceptOffer] Accept offer for ${rideId}: Server returned booking data:`, JSON.stringify(updatedBookingDataFromServer.booking, null, 2));
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
        console.error(`[handleAcceptOffer] Accept offer for ${rideId} - Server error:`, errorDetailsText);
        toast({ title: "Acceptance Failed on Server", description: errorDetailsText, variant: "destructive", duration: 7000 });
        setActionLoading(prev => ({ ...prev, [rideId]: true }));
        console.log(`[handleAcceptOffer] Reset actionLoading for ${rideId} to false after server error.`);
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
      console.log(`[handleAcceptOffer] Accept offer for ${rideId}: Setting activeRide:`, JSON.stringify(newActiveRideFromServer, null, 2));
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
      console.error(`[handleAcceptOffer] Error in handleAcceptOffer process for ${rideId} (outer catch):`, error);

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
      console.log(`[handleAcceptOffer] Resetting actionLoading for ${rideId} to false in finally block.`);
      setActionLoading(prev => ({ ...prev, [rideId]: false }));
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
        setAccumulatedStopWaitingCharges((prev) => {
          const updated = { ...prev, [currentStopArrayIndexForChargeCalc]: chargeForPreviousStop };
          return Object.values(updated).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        });
    }


    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    console.log(`actionLoading for ${rideId} SET TO TRUE`);

    let toastMessage = ""; let toastTitle = "";
    const payload: any = { action: actionType };

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
            payload.pickupWaitingCharge = currentWaitingCharge || 0;
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
    const journeyLegCount = journeyPoints.length;

    if (activeRide.status === 'driver_assigned') return "Notify Arrival";
    if (activeRide.status === 'arrived_at_pickup') return "Start Ride";

    if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return')) {
        if (currentLegIdx < journeyLegCount - 1) {
            const currentStopArrayIndex = currentLegIdx -1;
            if (currentStopArrayIndex >= 0 && activeRide.stops && currentStopArrayIndex < activeRide.stops.length) {
                 if (activeStopDetails && activeStopDetails.stopDataIndex === currentStopArrayIndex) {
                    const nextLegIsDropoff = currentLegIdx + 1 === journeyLegCount - 1;
                    return `Depart Stop ${currentStopArrayIndex + 1} / Proceed to ${nextLegIsDropoff ? "Dropoff" : `Stop ${currentStopArrayIndex + 2}`}`;
                } else {
                    return `Arrived at Stop ${currentStopArrayIndex + 1} / Start Timer`;
                }
            } else if (currentLegIdx === 0 && journeyLegCount > 1) {
                 const nextLegIsDropoff = currentLegIdx + 1 === journeyLegCount - 1;
                 const nextStopIndexIfAny = currentLegIdx;
                 return `Proceed to ${nextLegIsDropoff ? "Dropoff" : `Stop ${nextStopIndexIfAny + 1}`}`;
            }
        } else if (currentLegIdx === journeyLegCount - 1) {
            return "Complete Ride";
        }
    }
    return "Status Action";
  };

  const mainActionBtnAction = () => {
    if (!activeRide) return;
    const currentLegIdx = localCurrentLegIndex;
    const journeyLegCount = journeyPoints.length;

    if (activeRide.status === 'driver_assigned') {
        handleRideAction(activeRide.id, 'notify_arrival');
    } else if (activeRide.status === 'arrived_at_pickup') {
        handleRideAction(activeRide.id, 'start_ride');
    } else if ((activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return')) {
        if (currentLegIdx < journeyLegCount - 1) {
            const currentStopArrayIndex = currentLegIdx - 1; // This is the index in the stops array

            if (currentStopArrayIndex >= 0 && activeRide.stops && currentStopArrayIndex < activeRide.stops.length) {
                 // We are at an intermediate stop
                if (activeStopDetails && activeStopDetails.stopDataIndex === currentStopArrayIndex) {
                    // Timer was active for this stop, now departing
                    handleRideAction(activeRide.id, 'proceed_to_next_leg');
                } else {
                    // Arriving at this stop, start timer
                    setActiveStopDetails({ stopDataIndex: currentStopArrayIndex, arrivalTime: new Date() });
                }
            } else if (currentLegIdx === 0 && journeyLegCount > 1) { // Just started from pickup, proceeding to first stop or dropoff
                 handleRideAction(activeRide.id, 'proceed_to_next_leg');
            }

        } else if (currentLegIdx === journeyLegCount - 1) { // At the final dropoff
            handleRideAction(activeRide.id, 'complete_ride');
        }
    }
  };


  const isMainButtonDisabled = () => {
    if (!activeRide || (actionLoading[activeRide.id] ?? false)) return true;
    if (activeRide.status === 'pending_driver_wait_and_return_approval') return true;
    return false;
  };
  const mainButtonIsDisabledValue = isMainButtonDisabled();
  const isSosButtonVisible =
    !!activeRide &&
    !!activeRide.status &&
    ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase());

  const CurrentNavigationLegBar = () => {
    if (
      !activeRide ||
      !activeRide.status ||
      !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase())
    ) {
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
              {/* Contact Options Row */}
              <div className="flex items-center gap-1.5 mt-0.5">
                {passengerPhone && (
                  <>
                    <Button asChild variant="ghost" size="icon" className={cn("h-5 w-5 p-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-700/50 rounded")}>
                      <a href={`tel:${passengerPhone}`} aria-label={`Call ${activeRide.passengerName}`}>
                        <PhoneCall className="w-3 h-3" />
                      </a>
                    </Button>
                    <span className="font-bold text-xs text-muted-foreground">{passengerPhone}</span>
                  </>
                )}
                {(!isChatDisabled && passengerPhone) && <Separator orientation="vertical" className="h-3 bg-muted-foreground/50 mx-0.5" />}
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
            {/* Pause Ride Offers Toggle */}
            {activeRide && !isRideTerminated(activeRide.status) && (
  <div className={`flex items-center justify-between w-full mt-1 rounded-xl px-3 py-1 transition-colors duration-200 ${pauseOffers ? 'bg-red-200 border border-red-400' : 'bg-green-50'}`}>
    <Label htmlFor="pause-offers-switch" className="text-xs font-medium">Pause Ride Offers</Label>
    <Switch
      id="pause-offers-switch"
      checked={pauseOffers}
      onCheckedChange={handlePauseOffersToggle}
      className="ml-2"
    />
  </div>
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
    

  useEffect(() => {
    if (!driverLocation) return;
  }, [driverLocation]);
  
  const memoizedMarkers = useMemo(() => mapDisplayElements.markers, [JSON.stringify(mapDisplayElements.markers)]);
  const memoizedLabels = useMemo(() => mapDisplayElements.labels, [JSON.stringify(mapDisplayElements.labels)]);
  return (
    <>
      {/* Main content - hidden when offer modal is open */}
      {isOfferModalOpen && currentOfferDetails ? (
        <div className="flex flex-col h-full p-2 md:p-4 relative overflow-hidden">
          {/* Mock Location Toggle */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 1000,
              background: 'white',
              borderRadius: 8,
              padding: '6px 12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <label style={{ fontWeight: 500, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={useMockLocation}
                onChange={e => setUseMockLocation(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Mock Location (Huddersfield)
            </label>
          </div>
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
              {pauseOffers && (
                <div className="absolute z-50 top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-extrabold text-2xl px-8 py-4 rounded-xl shadow-lg border-4 border-red-900 animate-pulse pointer-events-none select-none text-center">
                  PAUSED: Turn OFF 'Pause Ride Offers' to receive new rides
                </div>
              )}

              <GoogleMapDisplay
                  center={memoizedMapCenter}
                  zoom={mapZoomToUse}
                  mapHeading={driverMarkerHeading ?? 0}
                  mapRotateControl={false}
                  fitBoundsToMarkers={shouldFitMapBounds}
                  markers={mapAndRideDetails.markers}
                  customMapLabels={mapAndRideDetails.labels}
                  className="w-full h-full"
                  disableDefaultUI={true}
                  onSdkLoaded={(loaded) => { setIsMapSdkLoaded(loaded); if (loaded && typeof window !== 'undefined' && window.google?.maps) { CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(window.google.maps); if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder(); if (!directionsServiceRef.current) directionsServiceRef.current = new window.google.maps.DirectionsService(); } }}
                  polylines={currentRoutePolyline ? [{ path: currentRoutePolyline.path, color: currentRoutePolyline.color, weight: 4, opacity: 0.7 }] : []}
                  driverIconRotation={driverMarkerHeading ?? undefined}
                  gestureHandling="greedy"
                />
                {hazardConfirmationDialog.open && hazardConfirmationDialog.hazard && (
                  <Dialog open={hazardConfirmationDialog.open} onOpenChange={open => setHazardConfirmationDialog(d => ({ ...d, open }))}>
                    <DialogContent>
                      <>
                        <DialogHeader>
                          <DialogTitle>Confirm Hazard</DialogTitle>
                          <ShadDialogDescriptionDialog>Are you near a reported hazard ({hazardConfirmationDialog.hazard.title})? Is it still present?</ShadDialogDescriptionDialog>
                        </DialogHeader>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={() => handleHazardFeedback(hazardConfirmationDialog.hazard.id, true)} className="bg-green-500 text-white">Yes, still there</Button>
                          <Button onClick={() => handleHazardFeedback(hazardConfirmationDialog.hazard.id, false)} className="bg-red-500 text-white">No, it's gone</Button>
                        </div>
                      </>
                    </DialogContent>
                  </Dialog>
                )}
                {isSosButtonVisible && (
                  <AlertDialog open={isSosDialogOpen} onOpenChange={setIsSosDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 z-[1001] h-8 w-8 md:h-9 md:w-9 rounded-full shadow-lg slow-pulse"
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
                          className="font-bold bg-destructive hover:bg-destructive/90"
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
                 <Alert variant="default" className={cn("my-2 p-1.5 text-xs", extraWaitingSeconds && extraWaitingSeconds > 0 ? "bg-red-100 dark:bg-red-800/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300" : "bg-yellow-100 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300")}>
                    <Timer className="h-4 w-4 text-current" />
                    <div className="flex justify-between items-center w-full">
                        <span className="font-semibold text-current">
                            {extraWaitingSeconds && extraWaitingSeconds > 0 ? 'Extra Waiting Period' : 'Free Waiting Period'}
                        </span>
                        <span className="font-bold text-white bg-accent px-1.5 py-0.5 rounded-sm inline-block font-mono tracking-wider">
                            {(freeWaitingSecondsLeft !== null && freeWaitingSecondsLeft > 0) ? formatTimer(freeWaitingSecondsLeft) : formatTimer(extraWaitingSeconds || 0)}
                        </span>
                    </div>
                    <ShadAlertDescription className="text-xs text-current/80 pl-[calc(1rem+0.375rem)] -mt-1">
                        {(extraWaitingSeconds && extraWaitingSeconds > 0)
                            ? `Charges accumulating: £${currentWaitingCharge.toFixed(2)}`
                            : 'Ack. window expired. Waiting charges apply after this free period.'}
                    </ShadAlertDescription>
                </Alert>
            )}
            {activeRide?.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && freeWaitingSecondsLeft !== null && (
                <Alert variant="default" className={cn("my-2 p-1.5 text-xs",
                    (extraWaitingSeconds !== null && extraWaitingSeconds > 0) ? "bg-red-100 dark:bg-red-700/40 border-red-400 dark:border-red-600 text-red-700 dark:text-red-200"
                                         : "bg-green-100 dark:bg-green-700/40 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300"
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

            {currentStopTimerDisplay &&
                activeRide &&
                activeRide.driverCurrentLegIndex !== undefined &&
                activeRide.driverCurrentLegIndex > 0 &&
                activeRide.driverCurrentLegIndex < journeyPoints.length -1 &&
                currentStopTimerDisplay.stopDataIndex === (activeRide.driverCurrentLegIndex -1) &&
                (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
              (
                <Alert variant="default" className={cn("my-1 p-1.5",
                    currentStopTimerDisplay.extraSeconds && currentStopTimerDisplay.extraSeconds > 0 ? "bg-red-100 dark:bg-red-700/80 border-red-500 dark:border-red-600 text-red-900 dark:text-red-100" : "bg-sky-100 dark:bg-sky-800/70 border-sky-300 dark:border-sky-600 text-sky-800 dark:text-sky-200"
                )}>
                  <Timer className="h-4 w-4 text-current" />
                  <ShadAlertTitle className="font-bold text-current text-xs">
                    <span>
                      {currentStopTimerDisplay.extraSeconds && currentStopTimerDisplay.extraSeconds > 0
                        ? `Extra Waiting at Stop ${currentStopTimerDisplay.stopDataIndex + 1}`
                        : `Free Waiting at Stop ${currentStopTimerDisplay.stopDataIndex + 1}`}
                    </span>
                  </ShadAlertTitle>
                  <ShadAlertDescription className="font-bold text-current text-[10px] flex justify-between items-center">
                    <span>
                      {currentStopTimerDisplay.freeSecondsLeft !== null && currentStopTimerDisplay.freeSecondsLeft > 0 && (
                      <>
                        <span>Time Remaining:</span>
                        <span className="font-mono tracking-wider bg-sky-600 text-white px-1.5 py-0.5 rounded-sm">
                            {formatTimer(currentStopTimerDisplay.freeSecondsLeft)}
                        </span>
                      </>
                      )}
                      {currentStopTimerDisplay.freeSecondsLeft === 0 && currentStopTimerDisplay.extraSeconds !== null && currentStopTimerDisplay.extraSeconds > 0 && (
                      <>
                        <span>Time Over:</span>
                        <span className="font-mono tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded-sm">
                            {formatTimer(currentStopTimerDisplay.extraSeconds)}
                        </span>
                      </>
                      )}
                    </span>
                  </ShadAlertDescription>
                  {currentStopTimerDisplay.extraSeconds !== null && currentStopTimerDisplay.extraSeconds > 0 && (
                      <div className="text-current text-xs pl-[calc(1rem+0.375rem)] -mt-1 font-medium">
                          Charge: £{currentStopTimerDisplay.charge.toFixed(2)}
                      </div>
                  )}
                </Alert>
              )}

             {activeRide && (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
                localCurrentLegIndex === journeyPoints.length - 1 && showEndOfRideReminder && (
                <Alert variant="default" className="my-2 bg-purple-100 dark:bg-purple-700/40 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-200 p-1.5 text-xs">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                            <Info className="h-3.5 w-3.5 text-current" />
                            <span className="font-semibold text-current">Reminder:</span>
                        </div>
                        <span className="font-bold text-current">
                           Consider collecting payment now if cash job, or reminding passenger of payment if card.
                        </span>
                    </div>
                </Alert>
            )}

            <div className={cn(
              "p-2 md:p-4 rounded-xl shadow-lg border bg-card text-card-foreground",
              activeRide && !isRideTerminated(activeRide.status) ? "fixed bottom-0 left-0 right-0 z-40 bg-background pt-2 pb-[env(safe-area-inset-bottom)] md:relative md:rounded-b-none md:shadow-md md:border-b md:border-x-0 md:border-t-0 md:border-primary/20" : "flex-1"
            )}>
            {/* Header with Driver Status Toggle */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold">Ride Offers</h2>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="driver-status-mode"
                        checked={isDriverOnline}
                        onCheckedChange={handleToggleOnlineStatus}
                        disabled={isLoading || (isDriverOnline && isOnARide)}
                        aria-label={isDriverOnline ? "Go Offline" : "Go Online"}
                    />
                    <Label htmlFor="driver-status-mode" className="text-base">
                        {isLoading ? "Loading..." : isDriverOnline ? "Online" : "Offline"}
                    </Label>
                </div>
            </div>

            {geolocationError && isDriverOnline && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <ShadAlertTitle>Location Error</ShadAlertTitle>
                    <ShadAlertDescription>{geolocationError}</ShadAlertDescription>
                </Alert>
            )}

            {isDriverOnline && !activeRide && (
                <div className="flex items-center space-x-2 mb-4">
                    <Switch
                        id="pause-offers"
                        checked={pauseOffers}
                        onCheckedChange={setPauseOffers}
                        disabled={isLoading}
                        aria-label={pauseOffers ? "Unpause Ride Offers" : "Pause Ride Offers"}
                    />
                    <Label htmlFor="pause-offers" className="text-base">Pause Ride Offers</Label>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <ShadAlertTitle>Error</ShadAlertTitle>
                    <ShadAlertDescription>{error}</ShadAlertDescription>
                </Alert>
            ) : !isDriverOnline ? (
                <Alert>
                    <Info className="h-4 w-4" />
                    <ShadAlertTitle>You are offline</ShadAlertTitle>
                    <ShadAlertDescription>Go online to start receiving ride offers.</ShadAlertDescription>
                </Alert>
            ) : activeRide ? (
                // Active Ride Display
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Car className="h-6 w-6 text-primary" />
                                Active Ride ({activeRide.displayBookingId || activeRide.id})
                            </span>
                            <div className="flex items-center gap-2">
                                {activeRide.status === 'pending_driver_wait_and_return_approval' && (
                                    <Badge variant="secondary" className="bg-purple-500 text-white animate-pulse">W&R Approval Needed</Badge>
                                )}
                                {activeRide.isPriorityPickup && (
                                    <Badge className="bg-yellow-500 text-black">Priority</Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setIsRideDetailsPanelMinimized(prev => !prev)}
                                  aria-label={isRideDetailsPanelMinimized ? "Expand ride details" : "Minimize ride details"}
                                >
                                  {isRideDetailsPanelMinimized ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </Button>
                            </div>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 text-base">
                            <UserCircle className="h-5 w-5" />
                            {activeRide.passengerName}
                            {activeRide.passengerRating ? (
                                <div className="flex items-center text-sm ml-2">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-0.5" />
                                    <span>{activeRide.passengerRating.toFixed(1)}</span>
                                </div>
                            ) : null}
                        </CardDescription>
                    </CardHeader>
                    {!isRideDetailsPanelMinimized && (
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm md:text-base">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">From:</span>
                            <span className="text-gray-600 dark:text-gray-400">{formatAddressForDisplay(activeRide.pickupLocation.address)}</span>
                        </div>
                        {activeRide.stops && activeRide.stops.length > 0 && (
                            activeRide.stops.map((stop, index) => (
                                <div key={`stop-${index}`} className="flex items-center gap-2 text-sm md:text-base">
                                    <Flag className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Stop {index + 1}:</span>
                                    <span className="text-gray-600 dark:text-gray-400">{formatAddressForDisplay(stop.address)}</span>
                                </div>
                            ))
                        )}
                        <div className="flex items-center gap-2 text-sm md:text-base">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">To:</span>
                            <span className="text-gray-600 dark:text-gray-400">{formatAddressForDisplay(activeRide.dropoffLocation.address)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-sm md:text-base">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Fare:</span>
                            </div>
                            <span className="font-bold text-lg md:text-xl text-primary">{mapAndRideDetails.displayedFare}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm md:text-base">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Payment:</span>
                            <span>{mapAndRideDetails.paymentMethodDisplay}</span>
                        </div>
                        {activeRide.paymentMethod === 'account' && activeRide.accountJobPin && (
                            <div className="flex items-center gap-2 text-sm md:text-base">
                                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Account Job PIN:</span>
                                <span>{activeRide.accountJobPin}</span>
                            </div>
                        )}
                        {activeRide.isPriorityPickup && mapAndRideDetails.hasPriority && (
                            <div className="flex items-center gap-2 text-sm md:text-base">
                                <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Priority Fee:</span>
                                <span>+£{mapAndRideDetails.currentPriorityAmount.toFixed(2)}</span>
                            </div>
                        )}
                         {activeRide.waitAndReturn && (
                            <div className="flex items-center gap-2 text-sm md:text-base">
                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Wait & Return:</span>
                                <Badge variant="secondary" className="bg-green-500 text-white">Active</Badge>
                                {activeRide.estimatedAdditionalWaitTimeMinutes && (
                                    <span className="text-gray-600 dark:text-gray-400">
                                        ({activeRide.estimatedAdditionalWaitTimeMinutes} min estimated at dropoff)
                                    </span>
                                )}
                            </div>
                        )}
                        {activeRide.distanceMiles && (
                            <div className="flex items-center gap-2 text-sm md:text-base">
                                <Route className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Est. Distance:</span>
                                <span>{activeRide.distanceMiles.toFixed(1)} miles</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm md:text-base">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Passengers:</span>
                            <span>{activeRide.passengerCount}</span>
                        </div>
                        {activeRide.passengerPhone && (
                          <div className="flex items-center gap-2 text-sm md:text-base">
                            <PhoneCall className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Passenger Phone:</span>
                            <a href={`tel:${activeRide.passengerPhone}`} className="text-blue-500 hover:underline">
                              {activeRide.passengerPhone}
                            </a>
                          </div>
                        )}
                        {activeRide.requiredOperatorId && activeRide.requiredOperatorId !== PLATFORM_OPERATOR_CODE && (
                             <div className="flex items-center gap-2 text-sm md:text-base">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Assigned To:</span>
                                <span>{activeRide.requiredOperatorId}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm md:text-base">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>
                            <Badge variant="outline" className="capitalize">
                                {activeRide.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                         {activeRide.scheduledPickupAt && (
                            <div className="flex items-center gap-2 text-sm md:text-base">
                                <CalendarIconLucide className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Scheduled:</span>
                                <span>{new Date(activeRide.scheduledPickupAt).toLocaleString()}</span>
                            </div>
                        )}
                        {activeRide.notifiedPassengerArrivalTimestamp && (
                             <div className="flex items-center gap-2 text-sm md:text-base">
                                <BellRing className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Arrived Notified:</span>
                                <span>{parseTimestampToDate(activeRide.notifiedPassengerArrivalTimestamp)?.toLocaleString()}</span>
                            </div>
                        )}
                        {activeRide.passengerAcknowledgedArrivalTimestamp && (
                             <div className="flex items-center gap-2 text-sm md:text-base">
                                <CheckCheck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Passenger Acknowledged:</span>
                                <span>{parseTimestampToDate(activeRide.passengerAcknowledgedArrivalTimestamp)?.toLocaleString()}</span>
                            </div>
                        )}
                        {activeRide.rideStartedAt && (
                             <div className="flex items-center gap-2 text-sm md:text-base">
                                <Play className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Ride Started:</span>
                                <span>{parseTimestampToDate(activeRide.rideStartedAt)?.toLocaleString()}</span>
                            </div>
                        )}
                        {activeRide.completedAt && (
                             <div className="flex items-center gap-2 text-sm md:text-base">
                                <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Completed:</span>
                                <span>{parseTimestampToDate(activeRide.completedAt)?.toLocaleString()}</span>
                            </div>
                        )}
                         {activeRide.cancellationFeeApplicable && (
                            <Alert variant="default" className="my-2 bg-red-100 dark:bg-red-800/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 p-1.5 text-xs">
                                <ShieldX className="h-4 w-4 text-current" />
                                <div className="flex justify-between items-center w-full">
                                    <span className="font-semibold text-current">Cancellation Fee Applicable</span>
                                </div>
                            </Alert>
                        )}
                         {activeRide.noShowFeeApplicable && (
                            <Alert variant="default" className="my-2 bg-red-100 dark:bg-red-800/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 p-1.5 text-xs">
                                <UserXIcon className="h-4 w-4 text-current" />
                                <div className="flex justify-between items-center w-full">
                                    <span className="font-semibold text-current">No-Show Fee Applicable</span>
                                </div>
                            </Alert>
                        )}
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsJourneyDetailsModalOpen(true)}
                        >
                            View Full Journey Details
                        </Button>
                    </CardContent>
                    )}
                    <CardFooter className="flex flex-col gap-2 pt-4">
                        <Button
                            onClick={mainActionBtnAction}
                            disabled={mainButtonIsDisabledValue}
                            className={cn("w-full text-white font-bold py-3", primaryButtonBgClass, mainButtonIsDisabledValue && "opacity-50 cursor-not-allowed")}
                        >
                            {(actionLoading[activeRide.id] ?? false) ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {mainButtonText()}
                        </Button>
                        <div className="grid grid-cols-2 gap-2 w-full">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => router.push(`/dashboard/chat?rideId=${activeRide.id}&passengerId=${activeRide.passengerId}`)}
                                disabled={isChatDisabled}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />Chat
                            </Button>
                             {passengerPhone && activeRide.status !== 'completed' && activeRide.status !== 'cancelled' && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => window.open(`tel:${passengerPhone}`, '_self')}
                                >
                                    <PhoneCall className="mr-2 h-4 w-4" />Call Passenger
                                </Button>
                            )}

                        </div>
                        {activeRide.status === 'arrived_at_pickup' && currentWaitingCharge > 0 && (
                            <Button
                                variant="outline"
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={() => setIsNoShowConfirmDialogOpen(true)}
                            >
                                Report Passenger No-Show
                            </Button>
                        )}
                        {activeRide.status !== 'completed' && activeRide.status !== 'cancelled' && (
                          <>
                            <div className="flex items-center justify-between w-full mt-2">
                                <Label htmlFor="cancel-ride-switch">Cancel Ride</Label>
                                <RadixSwitch.Root
                                    className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-destructive data-[state=unchecked]:bg-input"
                                    id="cancel-ride-switch"
                                    checked={isCancelSwitchOn}
                                    onCheckedChange={handleCancelSwitchChange}
                                >
                                    <RadixSwitch.Thumb
                                        className={cn(
                                            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                                        )}
                                    />
                                </RadixSwitch.Root>
                            </div>
                            <AlertDialog open={showCancelConfirmationDialog} onOpenChange={setShowCancelConfirmationDialog}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will cancel the active ride for {activeRide.passengerName}. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setIsCancelSwitchOn(false)}>Go Back</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleRideAction(activeRide.id, 'cancel_active')}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            Confirm Cancellation
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={isNoShowConfirmDialogOpen} onOpenChange={setIsNoShowConfirmDialogOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm No-Show Report</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to report {activeRide.passengerName} as a no-show? This will cancel the ride and may apply a no-show fee.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleRideAction(activeRide.id, 'report_no_show')}
                                            className="bg-red-500 hover:bg-red-600"
                                        >
                                            Confirm No-Show
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {activeRide.status === 'in_progress' && !activeRide.waitAndReturn && (
                             <Button
                                onClick={() => setIsWRRequestDialogOpen(true)}
                                variant="outline"
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white mt-2"
                                disabled={isRequestingWR}
                              >
                                {isRequestingWR ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Request Wait & Return
                             </Button>
                        )}
                        <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Request Wait & Return</DialogTitle>
                                    <DialogDescription>
                                        Enter the estimated additional wait time in minutes for this wait & return.
                                    </DialogDescription>
                                </DialogHeader>
                                <Input
                                    type="number"
                                    placeholder="Estimated additional minutes"
                                    value={wrRequestDialogMinutes}
                                    onChange={(e) => setWrRequestDialogMinutes(e.target.value)}
                                    min="0"
                                    className="my-4"
                                />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button onClick={handleRequestWaitAndReturnAction} disabled={isRequestingWR}>
                                        {isRequestingWR ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Send Request
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                         <Dialog open={isAccountJobPinDialogOpen} onOpenChange={setIsAccountJobPinDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Enter Account Job PIN</DialogTitle>
                                    <DialogDescription>
                                        Please enter the 4-digit PIN provided by the passenger to start this account job.
                                    </DialogDescription>
                                </DialogHeader>
                                <Input
                                    type="number"
                                    placeholder="4-digit PIN"
                                    value={enteredAccountJobPin}
                                    onChange={(e) => setEnteredAccountJobPin(e.target.value)}
                                    maxLength={4}
                                    className="my-4 text-center text-lg"
                                />
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={handleStartRideWithManualPinOverride}
                                        disabled={isVerifyingAccountJobPin}
                                    >
                                        Override (No PIN)
                                    </Button>
                                    <Button onClick={verifyAndStartAccountJobRide} disabled={isVerifyingAccountJobPin || enteredAccountJobPin.length !== 4}>
                                        {isVerifyingAccountJobPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Verify & Start Ride
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                         <Dialog open={isJourneyDetailsModalOpen} onOpenChange={setIsJourneyDetailsModalOpen}>
                            <DialogContent className="max-w-[calc(100vw-20px)] md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Full Journey Details</DialogTitle>
                                    <DialogDescription>
                                        Comprehensive details for the active ride ({activeRide.displayBookingId || activeRide.id}).
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[calc(80vh-120px)] pr-4">
                                    <div className="space-y-4 text-sm">
                                        <h3 className="font-bold text-lg">Passenger & Ride Summary</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <p><span className="font-semibold">Passenger:</span> {activeRide.passengerName}</p>
                                            <p><span className="font-semibold">Phone:</span> {activeRide.passengerPhone}</p>
                                            <p><span className="font-semibold">Fare Estimate:</span> £{activeRide.fareEstimate.toFixed(2)}</p>
                                            <p><span className="font-semibold">Payment Method:</span> {activeRide.paymentMethod}</p>
                                            <p><span className="font-semibold">Passengers:</span> {activeRide.passengerCount}</p>
                                            <p><span className="font-semibold">Vehicle Type:</span> {activeRide.vehicleType}</p>
                                            <p><span className="font-semibold">Status:</span> {activeRide.status.replace(/_/g, ' ')}</p>
                                            {activeRide.isPriorityPickup && <p><span className="font-semibold">Priority Pickup:</span> Yes (+£{activeRide.priorityFeeAmount?.toFixed(2)})</p>}
                                            {activeRide.waitAndReturn && <p><span className="font-semibold">Wait & Return:</span> Yes</p>}
                                            {activeRide.accountJobPin && <p><span className="font-semibold">Account PIN:</span> {activeRide.accountJobPin}</p>}
                                            {activeRide.notes && <p className="md:col-span-2"><span className="font-semibold">Notes:</span> {activeRide.notes}</p>}
                                        </div>

                                        <Separator className="my-4" />

                                        <h3 className="font-bold text-lg">Locations</h3>
                                        <div className="space-y-2">
                                            <p><span className="font-semibold">Pickup:</span> {activeRide.pickupLocation.address}</p>
                                            {activeRide.pickupLocation.doorOrFlat && <p className="ml-4 text-xs text-muted-foreground">Door/Flat: {activeRide.pickupLocation.doorOrFlat}</p>}
                                            {activeRide.stops?.map((stop, index) => (
                                                <div key={`modal-stop-${index}`}>
                                                    <p><span className="font-semibold">Stop {index + 1}:</span> {stop.address}</p>
                                                    {stop.doorOrFlat && <p className="ml-4 text-xs text-muted-foreground">Door/Flat: {stop.doorOrFlat}</p>}
                                                </div>
                                            ))}
                                            <p><span className="font-semibold">Dropoff:</span> {activeRide.dropoffLocation.address}</p>
                                            {activeRide.dropoffLocation.doorOrFlat && <p className="ml-4 text-xs text-muted-foreground">Door/Flat: {activeRide.dropoffLocation.doorOrFlat}</p>}
                                        </div>

                                        <Separator className="my-4" />

                                        <h3 className="font-bold text-lg">Timestamps</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {activeRide.bookingTimestamp && <p><span className="font-semibold">Booked At:</span> {parseTimestampToDate(activeRide.bookingTimestamp)?.toLocaleString()}</p>}
                                            {activeRide.scheduledPickupAt && <p><span className="font-semibold">Scheduled Pickup:</span> {new Date(activeRide.scheduledPickupAt).toLocaleString()}</p>}
                                            {activeRide.notifiedPassengerArrivalTimestamp && <p><span className="font-semibold">Notified Arrival:</span> {parseTimestampToDate(activeRide.notifiedPassengerArrivalTimestamp)?.toLocaleString()}</p>}
                                            {activeRide.passengerAcknowledgedArrivalTimestamp && <p><span className="font-semibold">Passenger Ack:</span> {parseTimestampToDate(activeRide.passengerAcknowledgedArrivalTimestamp)?.toLocaleString()}</p>}
                                            {activeRide.rideStartedAt && <p><span className="font-semibold">Ride Started:</span> {parseTimestampToDate(activeRide.rideStartedAt)?.toLocaleString()}</p>}
                                            {activeRide.completedAt && <p><span className="font-semibold">Completed At:</span> {parseTimestampToDate(activeRide.completedAt)?.toLocaleString()}</p>}
                                            {activeRide.currentLegEntryTimestamp && <p><span className="font-semibold">Current Leg Entry:</span> {parseTimestampToDate(activeRide.currentLegEntryTimestamp)?.toLocaleString()}</p>}
                                        </div>
                                         <Separator className="my-4" />
                                         <h3 className="font-bold text-lg">Charges & Penalties</h3>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <p><span className="font-semibold">Base Fare + WR:</span> £{mapAndRideDetails.basePlusWRFare.toFixed(2)}</p>
                                            {activeRide.isPriorityPickup && activeRide.priorityFeeAmount && <p><span className="font-semibold">Priority Fee:</span> £{activeRide.priorityFeeAmount.toFixed(2)}</p>}
                                            {currentWaitingCharge > 0 && <p><span className="font-semibold">Pickup Waiting Charge:</span> £{currentWaitingCharge.toFixed(2)}</p>}
                                            {accumulatedStopWaitingCharges > 0 && <p><span className="font-semibold">Accumulated Stop Waiting:</span> £{accumulatedStopWaitingCharges.toFixed(2)}</p>}
                                            {activeRide.completedStopWaitCharges && Object.keys(activeRide.completedStopWaitCharges).length > 0 && (
                                                <div className="col-span-1 md:col-span-2">
                                                    <p className="font-semibold mb-1">Individual Stop Waiting Charges:</p>
                                                    <ul className="list-disc list-inside ml-2">
                                                        {Object.entries(activeRide.completedStopWaitCharges).map(([idx, charge]) => (
                                                            <li key={idx}>Stop {parseInt(idx) + 1}: £{charge.toFixed(2)}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {activeRide.cancellationFeeApplicable && <p className="font-semibold text-red-600 md:col-span-2">Cancellation Fee Applicable</p>}
                                            {activeRide.noShowFeeApplicable && <p className="font-semibold text-red-600 md:col-span-2">No-Show Fee Applicable</p>}
                                            <p className="font-bold text-lg md:col-span-2"><span className="font-semibold">Grand Total:</span> {mapAndRideDetails.displayedFare}</p>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>
            ) : rideRequests.length > 0 ? (
                // Render Ride Offers
                <div className="space-y-4">
                    {rideRequests.map((offer) => (
                        <Card key={offer.id} className="shadow-md">
                            <CardHeader>
                                <CardTitle className="text-primary text-xl">{offer.displayBookingId || "New Ride Offer"}</CardTitle>
                                <CardDescription>
                                    <p className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />From: {formatAddressForDisplay(offer.pickupLocation)}
                                    </p>
                                    {offer.stops && offer.stops.length > 0 && (
                                        offer.stops.map((stop, index) => (
                                            <p key={`offer-stop-${index}`} className="flex items-center gap-2 ml-6">
                                                <Flag className="h-4 w-4" />Stop {index + 1}: {formatAddressForDisplay(stop.address)}
                                            </p>
                                        ))
                                    )}
                                    <p className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />To: {formatAddressForDisplay(offer.dropoffLocation)}
                                    </p>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="font-bold text-2xl text-green-600">£{offer.fareEstimate.toFixed(2)}</p>
                                {offer.isPriorityPickup && (
                                    <Badge className="bg-yellow-500 text-black">Priority Pickup (+£{offer.priorityFeeAmount?.toFixed(2)})</Badge>
                                )}
                                {offer.waitAndReturn && (
                                    <Badge variant="secondary">Wait & Return</Badge>
                                )}
                                <p className="flex items-center gap-2"><Users className="h-4 w-4" /> {offer.passengerCount} Passengers</p>
                                <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> ETA: {offer.driverEtaMinutes} mins</p>
                                <p className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment: {offer.paymentMethod}</p>
                                {offer.accountJobPin && (
                                    <p className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Account PIN: {offer.accountJobPin}</p>
                                )}
                                <p className="text-sm text-muted-foreground">{offer.distanceMiles?.toFixed(1)} miles estimated</p>
                                {offer.notes && <p className="text-sm italic">Notes: {offer.notes}</p>}
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                <Button
                                    onClick={() => handleAcceptOffer(offer.id)}
                                    disabled={actionLoading[offer.id] ?? false}
                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                >
                                    {(actionLoading[offer.id] ?? false) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Accept
                                </Button>
                                <Button
                                    onClick={() => handleDeclineOffer(offer.id)}
                                    disabled={actionLoading[offer.id] ?? false}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Decline
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center p-8">
                    <p className="text-lg text-muted-foreground">No active rides or pending offers.</p>
                    <p className="text-sm text-muted-foreground mt-2">Ensure you are online to receive new offers.</p>
                </div>
            )}
            {driverUser?.role === UserRole.Admin && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                <h3 className="font-bold text-lg mb-2">Admin / Dev Tools</h3>
                <Button onClick={handleSimulateOffer} className="w-full">Simulate New Offer</Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
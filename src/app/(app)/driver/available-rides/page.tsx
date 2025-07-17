"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, MessageSquare, Info, ChevronUp, Gauge, ShieldCheck as ShieldCheckIcon, MinusCircle, Construction, Users as UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, PLATFORM_OPERATOR_CODE } from "@/contexts/auth-context";
import { RideOfferModal, type RideOffer } from "@/components/driver/ride-offer-modal";
import { cn } from "@/lib/utils";

import { CustomMapLabelOverlayConstructor, getCustomMapLabelOverlayClass, LabelType } from '@/components/ui/custom-map-label-overlay';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import { formatAddressForMapLabel } from '@/lib/utils';
import { PauseCircle, PlayCircle } from 'lucide-react';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const driverCarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
  <!-- Pin Needle (Black) -->
  <path d="M20 50 L15 35 H25 Z" fill="black"/>
  <!-- Yellow Taxi Circle with Black Border -->
  <circle cx="20" cy="18" r="15" fill="#FFD700" stroke="black" stroke-width="2"/>
  <!-- Taxi Sign on Top -->
  <rect x="18" y="8" width="4" height="3" fill="black" rx="1"/>
  <!-- White Taxi Body -->
  <rect x="14" y="12" width="12" height="6" fill="white" stroke="black" stroke-width="1" rx="2"/>
  <!-- Taxi Windows -->
  <rect x="15" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
  <rect x="22" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
  <!-- Taxi Wheels -->
  <circle cx="16" cy="20" r="2" fill="black"/>
  <circle cx="24" cy="20" r="2" fill="black"/>
  <!-- Taxi Light -->
  <rect x="19" y="10" width="2" height="1" fill="#FF6B35"/>
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

// Add this type above the component
interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number | null;
}

// Add before handleRideAction:
type RideActionPayload = Record<string, unknown> & {
  updatedLegDetails?: {
    newLegIndex: number;
    currentLegEntryTimestamp: boolean;
    previousStopIndex?: number;
    waitingChargeForPreviousStop?: number;
  };
};

export default function AvailableRidesPage() {
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);

  const [isDriverOnline, setIsDriverOnline] = useState(true);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isCancelSwitchOn, setIsCancelSwitchOn] = useState(false);

  const [currentWaitingCharge, setCurrentWaitingCharge] = useState<number>(0);
  const waitingTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const rideRefreshIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const driverLocationAtAcceptanceRef = useRef<google.maps.LatLngLiteral | null>(null);
  const stationaryReminderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);
  const [localCurrentLegIndex, setLocalCurrentLegIndex] = useState(0);
  const [activeStopDetails, setActiveStopDetails] = useState<ActiveStopDetails | null>(null);
  const stopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentStopTimerDisplay, setCurrentStopTimerDisplay] = useState<CurrentStopTimerDisplay | null>(null);
  const [completedStopWaitCharges, setCompletedStopWaitCharges] = useState<Record<number, number>>({});
  const [accumulatedStopWaitingCharges, setAccumulatedStopWaitingCharges] = useState<number>(0);
  const [isRideDetailsPanelMinimized, setIsRideDetailsPanelMinimized] = useState(true);
  const [shouldFitMapBounds, setShouldFitMapBounds] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState(false);
  const [driverCurrentStreetName, setDriverCurrentStreetName] = useState<string | null>(null);
  const [currentRoutePolyline, setCurrentRoutePolyline] = useState<{ path: google.maps.LatLngLiteral[]; color: string } | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const endOfRideReminderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const { user: driverUser } = useAuth();
  const router = useRouter();
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [currentOfferDetails, setCurrentOfferDetails] = useState<RideOffer | null>(null);
  const [stagedOfferDetails, setStagedOfferDetails] = useState<RideOffer | null>(null);

  const [driverMarkerHeading, setDriverMarkerHeading] = useState<number | null>(null);

  const [isSpeedLimitFeatureEnabled, setIsSpeedLimitFeatureEnabled] = useState(false);
  const [currentMockSpeed, setCurrentMockSpeed] = useState(0);
  const [currentMockLimit, setCurrentMockLimit] = useState(30);

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

    const currentStatusLower = activeRide.status?.toLowerCase() || '';
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
                        content: formatAddressForMapLabel(stop.address, `Stop ${index + 1}`),
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
    if (isDriverOnline && navigator.geolocation) {
      setGeolocationError(null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: typeof position.coords.heading === 'number' ? position.coords.heading : null,
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

      setActiveRide(data);


      if (data?.driverCurrentLegIndex !== undefined && data.driverCurrentLegIndex !== localCurrentLegIndex) {
        setLocalCurrentLegIndex(data.driverCurrentLegIndex);
      }
      if (data?.completedStopWaitCharges) {
        setCompletedStopWaitCharges(data.completedStopWaitCharges);
        setAccumulatedStopWaitingCharges(Object.values(data.completedStopWaitCharges).reduce((sum, charge) => sum + charge, 0));
      }


    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error fetching active ride.";
      console.error("Error in fetchActiveRide:", message);
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
  }, [activeRide?.driverCurrentLocation, isMapSdkLoaded, activeRide]);

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
  }, [isSpeedLimitFeatureEnabled, setCurrentMockSpeed, setCurrentMockLimit]);

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
  }, [activeRide?.status, activeRide?.driverCurrentLegIndex, journeyPoints, activeStopDetails, setCurrentStopTimerDisplay]);


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
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (driverUser && isPollingEnabled && !isPaused) {
      const poll = async () => {
        await fetchActiveRide();
        const nextInterval = Math.floor(Math.random() * 2000) + 5000; // 5-7 seconds
        pollingTimeoutRef.current = setTimeout(poll, nextInterval);
      };
      poll();
    }
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [driverUser, isPollingEnabled, isPaused]);


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

    const offerToAccept = currentOfferDetails;

    if (!offerToAccept || !driverUser) {
      toast({title: "Error Accepting Ride", description: "Offer details or driver session missing.", variant: "destructive"});
      return;
    }

    const currentActionRideId = offerToAccept.id;
    console.log(`[handleAcceptOffer] Setting actionLoading for ${currentActionRideId} to true`);
    setActionLoading(prev => ({ ...prev, [currentActionRideId]: true }));

    const updatePayload: Record<string, unknown> = {
        driverId: driverUser.id,
        driverName: driverUser.name || "Driver",
        status: 'driver_assigned',
        vehicleType: driverUser.vehicleCategory || 'Car',
        driverVehicleDetails: `${driverUser.vehicleCategory || 'Car'} - ${driverUser.customId || 'MOCKREG'}`,
        offerDetails: { ...offerToAccept },
        isPriorityPickup: offerToAccept.isPriorityPickup,
        priorityFeeAmount: offerToAccept.priorityFeeAmount,
        dispatchMethod: offerToAccept.dispatchMethod,
        driverCurrentLocation: driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng, ...(driverLocation.heading !== undefined ? { heading: driverLocation.heading } : {}) } : null,
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
        } catch {
            try {
                const rawResponseText = await clonedResponse.text();
                console.error("handleAcceptOffer - Server returned non-JSON or unparsable JSON. Raw text:", rawResponseText);
                errorDetailsText += ` Non-JSON response. Server said: ${rawResponseText.substring(0, 200)}${rawResponseText.length > 200 ? '...' : ''}`;
            } catch {
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

    } catch(error: unknown) {
      console.error(`[handleAcceptOffer] Error in handleAcceptOffer process for ${currentActionRideId} (outer catch):`, error);

      let detailedMessage = "An unknown error occurred during ride acceptance.";
      if (error instanceof Error) {
          detailedMessage = error.message;
      } else if (typeof error === 'object' && error !== null && (error as Record<string, unknown>).message) {
          detailedMessage = (error as Record<string, unknown>).message as string;
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


  const handleDeclineOffer = () => {
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
        setAccumulatedStopWaitingCharges(prev => {
            const updatedCharges = {...completedStopWaitCharges, [currentStopArrayIndexForChargeCalc]: chargeForPreviousStop};
            return Object.values(updatedCharges).reduce((sum, val) => sum + (val || 0), 0);
        });
    }


    setActionLoading(prev => ({ ...prev, [rideId]: true }));
    console.log(`actionLoading for ${rideId} SET TO TRUE`);

    let toastMessage = ""; let toastTitle = "";
    const payload: RideActionPayload = { action: actionType };

    if (['notify_arrival', 'start_ride', 'proceed_to_next_leg'].includes(actionType) && driverLocation) {
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

            if (payload.driverCurrentLocation) {
              payload.driverCurrentLocation = payload.driverCurrentLocation;
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

      if ((actionType as string) === 'complete_ride') {
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
        fareEstimate: ((actionType as string) === 'complete_ride' && payload.finalFare !== undefined) ? payload.finalFare : (serverData.fareEstimate ?? activeRide.fareEstimate),
        waitAndReturn: serverData.waitAndReturn ?? activeRide.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: serverData.estimatedAdditionalWaitTimeMinutes ?? activeRide.estimatedAdditionalWaitTimeMinutes,
        driverCurrentLocation: serverData.driverCurrentLocation || activeRide.driverCurrentLocation || driverLocation,
        driverCurrentLegIndex: serverData.driverCurrentLegIndex !== undefined ? serverData.driverCurrentLegIndex : activeRide.driverCurrentLegIndex,
        currentLegEntryTimestamp: serverData.currentLegEntryTimestamp || activeRide.currentLegEntryTimestamp,
        completedStopWaitCharges: serverData.completedStopWaitCharges || activeRide.completedStopWaitCharges || {},
        };
        console.log(`handleRideAction (${actionType}): Setting new activeRide state for ${rideId}:`, newClientState);
        if ((actionType as string) === 'start_ride' || (actionType as string) === 'proceed_to_next_leg') {
        setLocalCurrentLegIndex(newClientState.driverCurrentLegIndex || 0);
        }
        setActiveRide(newClientState);
      }


      if (actionType === 'cancel_active' || actionType === 'report_no_show') {
        console.log(`handleRideAction (${actionType}): Action is terminal for ride ${rideId}. Polling might resume if driver is online.`);
      }


    } catch(err: unknown) {
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
  const isSosButtonVisible = activeRide && activeRide.status && ['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase());

  const CurrentNavigationLegBar = () => {
    if (!activeRide || !activeRide.status || !['driver_assigned', 'arrived_at_pickup', 'in_progress', 'in_progress_wait_and_return'].includes(activeRide.status.toLowerCase())) {
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
                <div className="flex items-center gap-2 w-full mt-1">
                    <Switch
                        id="pause-ride-offers-switch"
                        checked={isPaused}
                        onCheckedChange={handlePauseToggle}
                        className="data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-muted shrink-0 h-5 w-9"
                    />
                    <span className="text-xs font-medium text-muted-foreground select-none">
                        {isPaused ? (
                            <span className="flex items-center gap-1 text-yellow-700"><PauseCircle className="w-3.5 h-3.5" />Paused</span>
                        ) : (
                            <span className="flex items-center gap-1 text-green-700"><PlayCircle className="w-3.5 h-3.5" />Active</span>
                        )}
                    </span>
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

  const handleToggleOnlineStatus = (newOnlineStatus: boolean) => {
    setIsDriverOnline(newOnlineStatus);
    if (newOnlineStatus) {
        setConsecutiveMissedOffers(0);
        if (geolocationError) {
            setGeolocationError(null);
        }
        setIsPollingEnabled(true);
    } else {
        setIsPollingEnabled(false);
        setIsPaused(false); // Automatically unpause when going offline
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

  const handlePauseToggle = async (checked: boolean) => {
    setIsPaused(checked);
    try {
      const res = await fetch('/api/driver/pause-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: checked }),
      });
      if (!res.ok) throw new Error('Failed to update pause state');
      toast({ title: checked ? 'Ride Offers Paused' : 'Ride Offers Active', description: checked ? 'You will not receive new ride offers.' : 'You will now receive ride offers.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Could not update pause state', variant: 'destructive' });
      setIsPaused(!checked); // revert
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (activeRide && isDriverOnline && driverLocation && driverUser?.id) {
      // Immediately send location once
      fetch('/api/driver/active-ride/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driverUser.id, latitude: driverLocation.lat, longitude: driverLocation.lng, heading: driverLocation.heading }),
      });
      // Then send every 10 seconds
      intervalId = setInterval(() => {
        fetch('/api/driver/active-ride/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId: driverUser.id, latitude: driverLocation.lat, longitude: driverLocation.lng, heading: driverLocation.heading }),
        });
      }, 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeRide, isDriverOnline, driverLocation, driverUser?.id]);

  // Restore derived variables before the return statement:
  const displayedFare = "£0.00";
  const passengerPhone = activeRide?.passengerPhone;
  const showCompletedStatus = activeRide?.status === 'completed';
  const [isJourneyDetailsModalOpen, setIsJourneyDetailsModalOpen] = useState(false);
  const showCancelledByDriverStatus = activeRide?.status === 'cancelled_by_driver';
  const showCancelledNoShowStatus = activeRide?.status === 'cancelled_no_show';
  const showPendingWRApprovalStatus = activeRide?.status === 'pending_driver_wait_and_return_approval';
  const paymentMethodDisplay =
    activeRide?.paymentMethod === 'card' ? 'Card'
    : activeRide?.paymentMethod === 'cash' ? 'Cash'
    : activeRide?.paymentMethod === 'account' ? 'Account'
    : 'Payment N/A';

  const showDriverAssignedStatus = activeRide?.status === 'driver_assigned';
  const showArrivedAtPickupStatus = activeRide?.status === 'arrived_at_pickup';
  const showInProgressStatus = activeRide?.status === 'in_progress';
  const [rideToReportNoShow, setRideToReportNoShow] = useState<ActiveRide | null>(null);
  const [isNoShowConfirmDialogOpen, setIsNoShowConfirmDialogOpen] = useState(false);
  const showInProgressWRStatus = activeRide?.status === 'in_progress_wait_and_return';

  // 1. Add a new BottomControlsBar component after all useState declarations:
  const BottomControlsBar = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-primary shadow-2xl flex items-center justify-between px-6 py-4" style={{minHeight: '56px'}}>
      <div className="flex items-center gap-4">
        <Switch
          id="driver-online-toggle-bottom"
          checked={isDriverOnline}
          onCheckedChange={handleToggleOnlineStatus}
          aria-label="Toggle driver online status"
          className={cn(!isDriverOnline && "data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted-foreground")}
        />
        <Label htmlFor="driver-online-toggle-bottom" className={cn("font-bold text-base", isDriverOnline ? 'text-green-600' : 'text-red-600')}>
          <span>{isDriverOnline ? "Online" : "Offline"}</span>
        </Label>
        <Switch
          id="pause-ride-offers-switch-bottom"
          checked={isPaused}
          onCheckedChange={handlePauseToggle}
          className="data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-muted shrink-0 h-6 w-12"
        />
        <span className="text-base font-medium text-muted-foreground select-none">
          {isPaused ? (
            <span className="flex items-center gap-1 text-yellow-700"><PauseCircle className="w-4 h-4" />Paused</span>
          ) : (
            <span className="flex items-center gap-1 text-green-700"><PlayCircle className="w-4 h-4" />Active</span>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full p-2 md:p-4 relative overflow-hidden pb-24">
      {isOfferModalOpen ? (
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
      ) : (
        <>
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
          </div>
          {isPaused && (
            <div className="w-full max-w-xl mx-auto -mt-10 z-50 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 px-4 py-2 rounded shadow-lg flex items-center gap-2 relative">
              <PauseCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold">Ride offers are currently paused. You will not receive new ride offers until you unpause.</span>
            </div>
          )}
          <Card className="w-full max-w-xl mx-auto mt-4 mb-2 shadow-lg rounded-2xl border border-gray-200">
            <CardContent className="flex flex-col items-center p-4">
              <div className="flex items-center gap-3 mb-2 w-full justify-center">
                <Switch
                  id="driver-online-toggle-panel"
                  checked={isDriverOnline}
                  onCheckedChange={handleToggleOnlineStatus}
                  aria-label="Toggle driver online status"
                  className={cn(!isDriverOnline && "data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted-foreground")}
                />
                <Label htmlFor="driver-online-toggle-panel" className={cn("font-bold text-base", isDriverOnline ? 'text-green-600' : 'text-red-600')}>
                  <span>{isDriverOnline ? "Online" : "Offline"}</span>
                </Label>
              </div>
              <div className="w-full text-center mt-2">
                <span className={cn("font-bold text-lg", isDriverOnline ? 'text-green-600' : 'text-red-600')}>
                  {isDriverOnline ? "Online - Awaiting Offers" : "Offline"}
                </span>
                <div className="mt-2 flex flex-col items-center">
                  {isDriverOnline ? (
                    <>
                      <Loader2 className="w-6 h-6 text-primary animate-spin mb-1" />
                      <span className="font-medium text-sm text-muted-foreground">Waiting for ride offers...</span>
                    </>
                  ) : (
                    <span className="font-medium text-sm text-muted-foreground">You are currently offline.</span>
                  )}
                </div>
              </div>
              <div className="w-full flex items-center justify-between mt-4">
                <Label htmlFor="pause-ride-offers-switch-panel" className="text-sm font-medium text-muted-foreground">Pause Ride Offers</Label>
                <Switch
                  id="pause-ride-offers-switch-panel"
                  checked={isPaused}
                  onCheckedChange={handlePauseToggle}
                  className="data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-muted shrink-0 h-6 w-12"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {/* ...the rest of the page, e.g. Card for bottom controls, etc... */}
    </div>
  );
}


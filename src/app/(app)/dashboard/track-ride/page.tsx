
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Car, Clock, Loader2, AlertTriangle, Edit, XCircle, DollarSign, Calendar as CalendarIconLucide, Users, MessageSquare, UserCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, PlusCircle, Timer, Info, Check, Navigation, Play, PhoneCall, RefreshCw, Briefcase, Route } from "lucide-react";
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, UserRole } from '@/contexts/auth-context';
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
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BookingUpdatePayload } from '@/app/api/operator/bookings/[bookingId]/route';
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import type { ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor, LabelType } from '@/components/ui/custom-map-label-overlay';
import { getCustomMapLabelOverlayClass } from '@/components/ui/custom-map-label-overlay';


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
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  driver?: string;
  driverId?: string;
  driverAvatar?: string;
  driverVehicleDetails?: string; 
  vehicleType: string;
  passengers: number; // Added from BookingFormValues
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash" | "account";
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  waitAndReturn?: boolean; 
  estimatedAdditionalWaitTimeMinutes?: number; 
}

const formatDate = (timestamp?: SerializedTimestamp | string | null, isoString?: string | null): string => {
  if (isoString) {
    try {
      const date = parseISO(isoString);
      if (!isValid(date)) return 'Scheduled N/A';
      return format(date, "MMM do, yyyy 'at' p");
    } catch (e) { return 'Scheduled N/A'; }
  }
   if (!timestamp) return 'N/A';
  if (typeof timestamp === 'string') {
    try {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? 'N/A (Invalid ISO str)' : format(date, "MMM do, yyyy 'at' p");
    } catch (e) { return 'N/A (ISO Parse Err)';}
  }
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
     try {
      const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
      if (!isValid(date)) return 'Invalid Date Obj';
      return format(date, "MMM do, yyyy 'at' p");
    } catch (e) { return 'Date Conversion Err'; }
  }
  return 'N/A (Unknown format)';
};

const editDetailsFormSchema = z.object({
  pickupDoorOrFlat: z.string().max(50).optional(),
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffDoorOrFlat: z.string().max(50).optional(),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array(z.object({
      doorOrFlat: z.string().max(50).optional(),
      location: z.string().min(3, { message: "Stop location must be at least 3 characters." })
  })).optional(),
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(),
}).refine(data => !((data.desiredPickupDate && !data.desiredPickupTime) || (!data.desiredPickupDate && data.desiredPickupTime)), {
  message: "If scheduling, both date and time must be provided. For ASAP, leave both empty.", path: ["desiredPickupTime"],
});

type EditDetailsFormValues = z.infer<typeof editDetailsFormSchema>;
type DialogAutocompleteData = { fieldId: string; inputValue: string; suggestions: google.maps.places.AutocompletePrediction[]; showSuggestions: boolean; isFetchingSuggestions: boolean; isFetchingDetails: boolean; coords: google.maps.LatLngLiteral | null; };

const FREE_WAITING_TIME_SECONDS_PASSENGER = 3 * 60;
const WAITING_CHARGE_PER_MINUTE_PASSENGER = 0.20;
const ACKNOWLEDGMENT_WINDOW_SECONDS = 30;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR = 10; 


const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const blueDotSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.3"/>
  </svg>
`;
const blueDotSvgDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(blueDotSvg)}` : '';


const parseTimestampToDatePassenger = (timestamp: SerializedTimestamp | string | null | undefined): Date | null => {
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

const formatTimerPassenger = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function formatAddressForMapLabel(fullAddress: string, type: 'Pickup' | 'Dropoff'): string {
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
    let street = parts[0] || "Location Details"; // Fallback if no parts
    let area = parts[1] || ""; 

    if (parts.length > 2 && area.length <=3) { // If area is very short (like 'S' or 'N') and there are more parts, use next part for area
        area = parts[2];
    } else if (parts.length === 1 && outwardPostcode && street === outwardPostcode) { // e.g. "HD1" "HD1"
        street = "Area"; // Set street to something generic if only postcode was the "street" part
    }

    let locationLine = area;
    if (outwardPostcode) {
        locationLine = area ? `${area} ${outwardPostcode}` : outwardPostcode;
    }
    
    // Avoid "Location Details" if we have a better location line
    if (street === "Location Details" && locationLine.trim()) street = "";

    let finalLabel = `${type}:`;
    if (street) finalLabel += `\n${street}`;
    if (locationLine.trim()) finalLabel += `\n${locationLine.trim()}`;
    
    return finalLabel;
}

// Fare calculation constants (from book-ride page)
const BASE_FARE = 0.00;
const PER_MILE_RATE = 1.00;
const FIRST_MILE_SURCHARGE = 1.99;
const PER_MINUTE_RATE = 0.10;
const AVERAGE_SPEED_MPH = 15;
const BOOKING_FEE = 0.75;
const MINIMUM_FARE = 4.00;
const PER_STOP_SURCHARGE = 0.50;
const PET_FRIENDLY_SURCHARGE = 2.00;

function deg2rad(deg: number): number { return deg * (Math.PI / 180); }
function getDistanceInMiles(coords1: google.maps.LatLngLiteral | null, coords2: google.maps.LatLngLiteral | null): number {
  if (!coords1 || !coords2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coords2.lat - coords1.lat);
  const dLon = deg2rad(coords2.lng - coords1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(coords1.lat)) * Math.cos(deg2rad(coords2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 0.621371; // Convert km to miles
}


export default function MyActiveRidePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelSwitchOn, setIsCancelSwitchOn] = useState(false);
  const [showCancelConfirmationDialog, setShowCancelConfirmationDialog] = useState(false);


  const [rideToEditDetails, setRideToEditDetails] = useState<ActiveRide | null>(null);
  const [isEditDetailsDialogOpen, setIsEditDetailsDialogOpen] = useState(false);
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [dialogPickupInputValue, setDialogPickupInputValue] = useState("");
  const [dialogPickupSuggestions, setDialogPickupSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDialogPickupSuggestions, setShowDialogPickupSuggestions] = useState(false);
  const [isFetchingDialogPickupSuggestions, setIsFetchingDialogPickupSuggestions] = useState(false);
  const [isFetchingDialogPickupDetails, setIsFetchingDialogPickupDetails] = useState(false);
  const [dialogPickupCoords, setDialogPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const [dialogDropoffInputValue, setDialogDropoffInputValue] = useState("");
  const [dialogDropoffSuggestions, setDialogDropoffSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDialogDropoffSuggestions, setShowDialogDropoffSuggestions] = useState(false);
  const [isFetchingDialogDropoffSuggestions, setIsFetchingDialogDropoffSuggestions] = useState(false);
  const [isFetchingDialogDropoffDetails, setIsFetchingDialogDropoffDetails] = useState(false);
  const [dialogDropoffCoords, setDialogDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const [dialogStopAutocompleteData, setDialogStopAutocompleteData] = useState<DialogAutocompleteData[]>([]);
  const [dialogFareEstimate, setDialogFareEstimate] = useState<number | null>(null);


  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const driverLocation = useMemo(() => activeRide?.driverCurrentLocation || huddersfieldCenterGoogle, [activeRide?.driverCurrentLocation]);

  const [ackWindowSecondsLeft, setAckWindowSecondsLeft] = useState<number | null>(null);
  const [freeWaitingSecondsLeft, setFreeWaitingSecondsLeft] = useState<number | null>(null);
  const [isBeyondFreeWaiting, setIsBeyondFreeWaiting] = useState<boolean>(false);
  const [extraWaitingSeconds, setExtraWaitingSeconds] = useState<number | null>(null);
  const [currentWaitingCharge, setCurrentWaitingCharge] = useState<number>(0);
  const passengerWaitingTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [driverRatingForPassenger, setDriverRatingForPassenger] = useState<number>(0);
  
  const [isRequestingWR, setIsRequestingWR] = useState(false);
  const [wrRequestDialogMinutes, setWrRequestDialogMinutes] = useState<string>("10");
  const [isWRRequestDialogOpen, setIsWRRequestDialogOpen] = useState(false);

  const [driverCurrentStreetName, setDriverCurrentStreetName] = useState<string | null>(null);
  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);


  const editDetailsForm = useForm<EditDetailsFormValues>({
    resolver: zodResolver(editDetailsFormSchema),
    defaultValues: { pickupDoorOrFlat: "", pickupLocation: "", dropoffDoorOrFlat: "", dropoffLocation: "", stops: [], desiredPickupDate: undefined, desiredPickupTime: "" },
  });

  const { fields: editStopsFields, append: appendEditStop, remove: removeEditStop, replace: replaceEditStops } = useFieldArray({ control: editDetailsForm.control, name: "stops" });
  const previousEditStopsLengthRef = useRef(editStopsFields.length);

  useEffect(() => {
    if (isMapSdkLoaded && typeof window.google !== 'undefined' && window.google.maps) {
      if (!autocompleteServiceRef.current && window.google.maps.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
      if (!placesServiceRef.current && window.google.maps.places) {
        const dummyDiv = document.createElement('div'); 
        placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
      }
      if (!autocompleteSessionTokenRef.current && window.google.maps.places) {
        autocompleteSessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      if (!geocoderRef.current && window.google.maps.Geocoder) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
    }
  }, [isMapSdkLoaded]);


  useEffect(() => {
    if (isEditDetailsDialogOpen) {
        if (editStopsFields.length === 0) { // Only focus pickup if no stops exist initially
             editDetailsForm.setFocus('pickupLocation');
        }
    }
  }, [isEditDetailsDialogOpen, editDetailsForm, editStopsFields.length]);

  useEffect(() => {
    if (editStopsFields.length > previousEditStopsLengthRef.current) {
      const newStopIndex = editStopsFields.length - 1;
      setTimeout(() => {
        editDetailsForm.setFocus(`stops.${newStopIndex}.location`);
      }, 100);
    }
    previousEditStopsLengthRef.current = editStopsFields.length;
  }, [editStopsFields, editDetailsForm]);


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
    if (!user) return;
    setError(null);
    try {
      const response = await fetch(`/api/bookings/my-active-ride?passengerId=${user.id}`);
      if (!response.ok) { const errorData = await response.json().catch(() => ({ message: `Failed to fetch active ride: ${response.status}`})); throw new Error(errorData.details || errorData.message); }
      const data: ActiveRide | null = await response.json();
      setActiveRide(data);
    } catch (err) { const message = err instanceof Error ? err.message : "Unknown error fetching active ride."; setError(message); toast({ title: "Error Fetching Active Ride", description: message, variant: "destructive" });
    } finally { setIsLoading(false); }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchActiveRide();
      const rideRefreshInterval = setInterval(fetchActiveRide, 30000);
      return () => clearInterval(rideRefreshInterval);
    } else {
      setIsLoading(false);
    }
  }, [user, fetchActiveRide]);

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
    if (passengerWaitingTimerIntervalRef.current) {
      clearInterval(passengerWaitingTimerIntervalRef.current);
      passengerWaitingTimerIntervalRef.current = null;
    }

    const notifiedTime = parseTimestampToDatePassenger(activeRide?.notifiedPassengerArrivalTimestamp);
    const ackTime = parseTimestampToDatePassenger(activeRide?.passengerAcknowledgedArrivalTimestamp);

    if (activeRide?.status === 'arrived_at_pickup' && notifiedTime) {
      const updateTimers = () => {
        const now = new Date();
        const secondsSinceNotified = Math.floor((now.getTime() - notifiedTime.getTime()) / 1000);

        if (!ackTime) {
          if (secondsSinceNotified < ACKNOWLEDGMENT_WINDOW_SECONDS) {
            setAckWindowSecondsLeft(ACKNOWLEDGMENT_WINDOW_SECONDS - secondsSinceNotified);
            setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_PASSENGER);
            setIsBeyondFreeWaiting(false);
            setExtraWaitingSeconds(null);
            setCurrentWaitingCharge(0);
          } else {
            setAckWindowSecondsLeft(0);
            const effectiveFreeWaitStartTime = addMinutes(notifiedTime, ACKNOWLEDGMENT_WINDOW_SECONDS / 60);
            const secondsSinceEffectiveFreeWaitStart = Math.floor((now.getTime() - effectiveFreeWaitStartTime.getTime()) / 1000);

            if (secondsSinceEffectiveFreeWaitStart < FREE_WAITING_TIME_SECONDS_PASSENGER) {
              setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_PASSENGER - secondsSinceEffectiveFreeWaitStart);
              setIsBeyondFreeWaiting(false);
              setExtraWaitingSeconds(null);
              setCurrentWaitingCharge(0);
            } else {
              setFreeWaitingSecondsLeft(0);
              setIsBeyondFreeWaiting(true);
              const currentExtra = secondsSinceEffectiveFreeWaitStart - FREE_WAITING_TIME_SECONDS_PASSENGER;
              setExtraWaitingSeconds(currentExtra);
              setCurrentWaitingCharge(Math.floor(currentExtra / 60) * WAITING_CHARGE_PER_MINUTE_PASSENGER);
            }
          }
        } else {
          setAckWindowSecondsLeft(null);
          const secondsSinceAck = Math.floor((now.getTime() - ackTime.getTime()) / 1000);
          if (secondsSinceAck < FREE_WAITING_TIME_SECONDS_PASSENGER) {
            setFreeWaitingSecondsLeft(FREE_WAITING_TIME_SECONDS_PASSENGER - secondsSinceAck);
            setIsBeyondFreeWaiting(false);
            setExtraWaitingSeconds(null);
            setCurrentWaitingCharge(0);
          } else {
            setFreeWaitingSecondsLeft(0);
            setIsBeyondFreeWaiting(true);
            const currentExtra = secondsSinceAck - FREE_WAITING_TIME_SECONDS_PASSENGER;
            setExtraWaitingSeconds(currentExtra);
            setCurrentWaitingCharge(Math.floor(currentExtra / 60) * WAITING_CHARGE_PER_MINUTE_PASSENGER);
          }
        }
      };
      updateTimers();
      passengerWaitingTimerIntervalRef.current = setInterval(updateTimers, 1000);
    } else {
      setAckWindowSecondsLeft(null);
      setFreeWaitingSecondsLeft(null);
      setIsBeyondFreeWaiting(false);
      setExtraWaitingSeconds(null);
      setCurrentWaitingCharge(0);
    }
    return () => {
      if (passengerWaitingTimerIntervalRef.current) {
        clearInterval(passengerWaitingTimerIntervalRef.current);
      }
    };
  }, [activeRide?.status, activeRide?.notifiedPassengerArrivalTimestamp, activeRide?.passengerAcknowledgedArrivalTimestamp]);


  const handleInitiateCancelRide = async () => {
    if (!activeRide || !user) return;
    setActionLoading(prev => ({ ...prev, [activeRide.id]: true }));
    try {
      const response = await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: activeRide.id, passengerId: user.id })});
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Failed to cancel ride.'); }
      toast({ title: "Ride Cancelled", description: `Your ride ${activeRide.id} has been cancelled.` });
      setActiveRide(null);
      setShowCancelConfirmationDialog(false); 
      setIsCancelSwitchOn(false);
    } catch (err) { const message = err instanceof Error ? err.message : "Unknown error cancelling ride."; toast({ title: "Cancellation Failed", description: message, variant: "destructive" });
    } finally {
        if (activeRide) setActionLoading(prev => ({ ...prev, [activeRide.id]: false }));
    }
  };

  const handleCancelSwitchChange = (checked: boolean) => { setIsCancelSwitchOn(checked); if (checked && activeRide) { setShowCancelConfirmationDialog(true); } else if (!checked) { setShowCancelConfirmationDialog(false); }};

  const handleOpenEditDetailsDialog = (ride: ActiveRide) => {
    setRideToEditDetails(ride);
    editDetailsForm.reset({
        pickupDoorOrFlat: ride.pickupLocation?.doorOrFlat || "", pickupLocation: ride.pickupLocation?.address || "",
        dropoffDoorOrFlat: ride.dropoffLocation?.doorOrFlat || "", dropoffLocation: ride.dropoffLocation?.address || "",
        stops: ride.stops?.map(s => ({ location: s.address, doorOrFlat: s.doorOrFlat || ""})) || [],
        desiredPickupDate: ride.scheduledPickupAt ? parseISO(ride.scheduledPickupAt) : undefined,
        desiredPickupTime: ride.scheduledPickupAt ? format(parseISO(ride.scheduledPickupAt), "HH:mm") : "",
    });
    setDialogPickupInputValue(ride.pickupLocation?.address || ""); setDialogPickupCoords(ride.pickupLocation ? { lat: ride.pickupLocation.latitude, lng: ride.pickupLocation.longitude } : null);
    setDialogDropoffInputValue(ride.dropoffLocation?.address || ""); setDialogDropoffCoords(ride.dropoffLocation ? { lat: ride.dropoffLocation.latitude, lng: ride.dropoffLocation.longitude } : null);
    const initialStopData: DialogAutocompleteData[] = (ride.stops || []).map((stop, index) => ({ fieldId: `dialog-stop-${index}-${Date.now()}`, inputValue: stop.address, coords: { lat: stop.latitude, lng: stop.longitude }, suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, }));
    setDialogStopAutocompleteData(initialStopData); setIsEditDetailsDialogOpen(true);
  };

  const fetchAddressSuggestions = useCallback(
    (
      inputValue: string,
      setSuggestionsFunc: (suggestions: google.maps.places.AutocompletePrediction[]) => void,
      setIsFetchingFunc: (isFetching: boolean) => void
    ) => {
      if (!isMapSdkLoaded || !autocompleteServiceRef.current || inputValue.length < 2) {
        setSuggestionsFunc([]);
        setIsFetchingFunc(false);
        return;
      }
      setIsFetchingFunc(true);
      console.log(`[EditDialog] Fetching predictions for (from fetchAddressSuggestions): "${inputValue}"`);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: inputValue,
          sessionToken: autocompleteSessionTokenRef.current,
          componentRestrictions: { country: 'gb' },
        },
        (predictions, status) => {
          setIsFetchingFunc(false);
          console.log(`[EditDialog] getPlacePredictions for "${inputValue}": Status - ${status}`, predictions);
          setSuggestionsFunc(status === google.maps.places.PlacesServiceStatus.OK && predictions ? predictions : []);
        }
      );
    },
    [isMapSdkLoaded] 
  );

  const handleEditAddressInputChangeFactory = useCallback((
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number
  ) => (
    inputValue: string,
    formOnChange: (value: string) => void,
  ) => {
    formOnChange(inputValue); 
    setDialogFareEstimate(null);
    
    let setSuggestionsFunc: (s: google.maps.places.AutocompletePrediction[]) => void;
    let setIsFetchingSuggFunc: (f: boolean) => void;
    let setShowSuggFunc: (s: boolean) => void;
    let setCoordsFunc: (c: google.maps.LatLngLiteral | null) => void;
    let setInputValFunc: (v: string) => void;

    if (typeof formFieldNameOrStopIndex === 'number') {
        setInputValFunc = (val) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === formFieldNameOrStopIndex ? {...item, inputValue: val } : item));
        setCoordsFunc = (coords) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === formFieldNameOrStopIndex ? {...item, coords: coords } : item));
        setShowSuggFunc = (show) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === formFieldNameOrStopIndex ? {...item, showSuggestions: show } : item));
        setIsFetchingSuggFunc = (fetch) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === formFieldNameOrStopIndex ? {...item, isFetchingSuggestions: fetch } : item));
        setSuggestionsFunc = (sugg) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === formFieldNameOrStopIndex ? {...item, suggestions: sugg } : item));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setInputValFunc = setDialogPickupInputValue; setCoordsFunc = setDialogPickupCoords; setShowSuggFunc = setShowDialogPickupSuggestions; setIsFetchingSuggFunc = setIsFetchingDialogPickupSuggestions; setSuggestionsFunc = setDialogPickupSuggestions;
    } else {
        setInputValFunc = setDialogDropoffInputValue; setCoordsFunc = setDialogDropoffCoords; setShowSuggFunc = setShowDialogDropoffSuggestions; setIsFetchingSuggFunc = setIsFetchingDialogDropoffSuggestions; setSuggestionsFunc = setDialogDropoffSuggestions;
    }
    
    setInputValFunc(inputValue);
    setCoordsFunc(null);
    setShowSuggFunc(inputValue.length >=2);

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (inputValue.length < 2) { setIsFetchingSuggFunc(false); setSuggestionsFunc([]); return; }
    
    setIsFetchingSuggFunc(true); 
    setSuggestionsFunc([]);
    console.log(`[EditDialog] Debounced: Fetching predictions for: "${inputValue}"`);
    debounceTimeoutRef.current = setTimeout(() => {
      fetchAddressSuggestions(inputValue, setSuggestionsFunc, setIsFetchingSuggFunc);
    }, 300);
  }, [isMapSdkLoaded, fetchAddressSuggestions]);


 const handleEditSuggestionClickFactory = useCallback((formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => (suggestion: google.maps.places.AutocompletePrediction, formOnChange: (value: string) => void) => {
    const addressText = suggestion?.description; 
    if (!isMapSdkLoaded || !placesServiceRef.current || !autocompleteSessionTokenRef.current || !addressText || !suggestion.place_id) {
        console.warn(`[EditDialog] Places service, token, address, or place_id NOT READY for suggestion click. isMapSdkLoaded: ${isMapSdkLoaded}`);
        if (addressText) formOnChange(addressText); 
        return;
    }
    
    const setIsFetchingDetailsFunc = (isFetching: boolean) => {
        if (typeof formFieldNameOrStopIndex === 'number') setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingDetails: isFetching } : item));
        else if (formFieldNameOrStopIndex === 'pickupLocation') setIsFetchingDialogPickupDetails(isFetching);
        else setIsFetchingDialogDropoffDetails(isFetching);
    };
    const setCoordsFunc = (coords: google.maps.LatLngLiteral | null, finalAddress: string) => {
        if (typeof formFieldNameOrStopIndex === 'number') setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, coords, inputValue: finalAddress, showSuggestions: false } : item));
        else if (formFieldNameOrStopIndex === 'pickupLocation') { setDialogPickupCoords(coords); setDialogPickupInputValue(finalAddress); setShowDialogPickupSuggestions(false); }
        else { setDialogDropoffCoords(coords); setDialogDropoffInputValue(finalAddress); setShowDialogDropoffSuggestions(false); }
    };

    setIsFetchingDetailsFunc(true);
    placesServiceRef.current.getDetails(
        { placeId: suggestion.place_id, fields: ['geometry.location', 'formatted_address', 'address_components'], sessionToken: autocompleteSessionTokenRef.current }, 
        (place, status) => {
            setIsFetchingDetailsFunc(false);
            const finalAddressToSet = place?.formatted_address || addressText;
            formOnChange(finalAddressToSet); 

            if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                setCoordsFunc({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }, finalAddressToSet);
                toast({ title: "Location Updated", description: `${finalAddressToSet} selected.`});
            } else { 
                setCoordsFunc(null, finalAddressToSet); 
                toast({title: "Geocoding Error", description: "Could not get coordinates for selection.", variant: "destructive"});
            }
            if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
                 autocompleteSessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken(); 
            } else {
                console.warn("[EditDialog] Google Places API not fully available to refresh session token.");
            }
        }
    );
  }, [isMapSdkLoaded, toast]);


  const handleEditFocusFactory = (fieldNameOrIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    if (typeof fieldNameOrIndex === 'number') {
      const stop = dialogStopAutocompleteData[fieldNameOrIndex];
      if (stop?.inputValue.length >= 2) { // No need to check suggestions length here, just trigger fetch
        setDialogStopAutocompleteData(p => p.map((item, i) => i === fieldNameOrIndex ? {...item, showSuggestions: true} : item));
        if (!stop.suggestions?.length && !stop.isFetchingSuggestions) { // Fetch if no suggestions and not already fetching
            fetchAddressSuggestions(stop.inputValue, 
                (sugg) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === fieldNameOrIndex ? {...item, suggestions: sugg} : item)),
                (fetch) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === fieldNameOrIndex ? {...item, isFetchingSuggestions: fetch} : item))
            );
        }
      }
    } else if (fieldNameOrIndex === 'pickupLocation') {
      if (dialogPickupInputValue.length >= 2) {
        setShowDialogPickupSuggestions(true);
        if (!dialogPickupSuggestions?.length && !isFetchingDialogPickupSuggestions) {
            fetchAddressSuggestions(dialogPickupInputValue, setDialogPickupSuggestions, setIsFetchingDialogPickupSuggestions);
        }
      }
    } else if (fieldNameOrIndex === 'dropoffLocation') {
      if (dialogDropoffInputValue.length >= 2) {
        setShowDialogDropoffSuggestions(true);
        if (!dialogDropoffSuggestions?.length && !isFetchingDialogDropoffSuggestions) {
            fetchAddressSuggestions(dialogDropoffInputValue, setDialogDropoffSuggestions, setIsFetchingDialogDropoffSuggestions);
        }
      }
    }
  };
  const handleEditBlurFactory = (fieldNameOrIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    setTimeout(() => { 
        if (typeof fieldNameOrIndex === 'number') setDialogStopAutocompleteData(p => p.map((item, i) => i === fieldNameOrIndex ? {...item, showSuggestions: false} : item)); 
        else if (fieldNameOrIndex === 'pickupLocation') setShowDialogPickupSuggestions(false); 
        else setShowDialogDropoffSuggestions(false); 
    }, 500); 
  };

  const onEditDetailsSubmit = async (values: EditDetailsFormValues) => {
    if (!rideToEditDetails || !user || !dialogPickupCoords || !dialogDropoffCoords) { toast({ title: "Error", description: "Missing ride data or user session.", variant: "destructive" }); return; }
    const validStopsData = [];
    for (let i = 0; i < (values.stops?.length || 0); i++) { const stopValue = values.stops?.[i]; const stopCoordsData = dialogStopAutocompleteData[i]; if (stopValue?.location && stopValue.location.trim() !== "" && !stopCoordsData?.coords) { toast({ title: `Stop ${i + 1} Incomplete`, description: `Please ensure Stop ${i + 1} has coordinates by selecting from suggestions.`, variant: "destructive" }); return; } if (stopValue?.location && stopValue.location.trim() !== "" && stopCoordsData?.coords) { validStopsData.push({ address: stopValue.location, latitude: stopCoordsData.coords.lat, longitude: stopCoordsData.coords.lng, doorOrFlat: stopValue.doorOrFlat }); } }
    setIsUpdatingDetails(true); let scheduledAtISO: string | null = null;
    if (values.desiredPickupDate && values.desiredPickupTime) { const [hours, minutes] = values.desiredPickupTime.split(':').map(Number); const combinedDateTime = new Date(values.desiredPickupDate); combinedDateTime.setHours(hours, minutes, 0, 0); scheduledAtISO = combinedDateTime.toISOString(); }
    
    const payload: any = {  
        bookingId: rideToEditDetails.id, 
        passengerId: user.id, 
        pickupLocation: { address: values.pickupLocation, latitude: dialogPickupCoords.lat, longitude: dialogPickupCoords.lng, doorOrFlat: values.pickupDoorOrFlat }, 
        dropoffLocation: { address: values.dropoffLocation, latitude: dialogDropoffCoords.lat, longitude: dialogDropoffCoords.lng, doorOrFlat: values.dropoffDoorOrFlat }, 
        stops: validStopsData, 
        scheduledPickupAt: scheduledAtISO, 
    };
    if (dialogFareEstimate !== null) {
        payload.fareEstimate = dialogFareEstimate;
    }


    try {
        const response = await fetch(`/api/bookings/update-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)});
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Failed to update booking.'); }
        const updatedRideDataFromServer = await response.json();
        
        setActiveRide(prev => prev ? { 
            ...prev,  
            pickupLocation: updatedRideDataFromServer.pickupLocation, 
            dropoffLocation: updatedRideDataFromServer.dropoffLocation, 
            stops: updatedRideDataFromServer.stops, 
            scheduledPickupAt: updatedRideDataFromServer.scheduledPickupAt,
            fareEstimate: updatedRideDataFromServer.fareEstimate !== undefined ? updatedRideDataFromServer.fareEstimate : prev.fareEstimate,
        } : null );

        toast({ title: "Booking Updated", description: "Your ride details have been successfully changed." }); setIsEditDetailsDialogOpen(false);
    } catch (err) { const message = err instanceof Error ? err.message : "Unknown error."; toast({ title: "Update Failed", description: message, variant: "destructive" });
    } finally { setIsUpdatingDetails(false); }
  };

  const handleAcknowledgeArrival = async (rideId: string) => {
    if (!user || !activeRide) return;
    try {
      const response = await fetch(`/api/operator/bookings/${rideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge_arrival' }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to acknowledge arrival.");
      }
      const updatedBooking = await response.json();
      setActiveRide(prev => prev ? { ...prev, passengerAcknowledgedArrivalTimestamp: updatedBooking.booking.passengerAcknowledgedArrivalTimestamp, status: 'arrived_at_pickup' } : null);
      toast({title: "Arrival Acknowledged!", description: "Your driver has been notified you are aware they have arrived."});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Acknowledgement Failed", description: message, variant: "destructive" });
    }
  };

  const handleRequestWaitAndReturn = async () => {
    if (!activeRide || !user) return;
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
      toast({ title: "Wait & Return Requested", description: "Your request has been sent to the driver for confirmation." });
      setIsWRRequestDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Request Failed", description: message, variant: "destructive" });
    } finally {
      setIsRequestingWR(false);
    }
  };

  const getStatusMessage = (ride: ActiveRide | null) => {
    if (!ride || !ride.status) return "Loading status...";
    switch (ride.status.toLowerCase()) {
        case 'pending_assignment': return "Finding you a driver...";
        case 'driver_assigned': return `Driver ${ride.driver || 'N/A'} is en route. ETA: ${ride.driverEtaMinutes ?? 'calculating...'} min.`;
        case 'arrived_at_pickup': return `Driver ${ride.driver || 'N/A'} has arrived at your pickup location.`;
        case 'in_progress': return "Your ride is in progress. Enjoy!";
        case 'pending_driver_wait_and_return_approval': return `Wait & Return requested for an additional ${ride.estimatedAdditionalWaitTimeMinutes || 0} mins. Awaiting driver confirmation.`;
        case 'in_progress_wait_and_return': return `Ride in progress (Wait & Return). Driver will wait ~${ride.estimatedAdditionalWaitTimeMinutes || 0} mins at dropoff.`;
        default: return `Status: ${ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    }
  };

  const getStatusBadgeVariant = (status: string | undefined) => {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
        case 'pending_assignment': return 'secondary';
        case 'driver_assigned': return 'default';
        case 'arrived_at_pickup': return 'outline';
        case 'in_progress': return 'default';
        case 'pending_driver_wait_and_return_approval': return 'secondary';
        case 'in_progress_wait_and_return': return 'default';
        default: return 'secondary';
    }
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    if (!status) return '';
    switch (status.toLowerCase()) {
        case 'pending_assignment': return 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70';
        case 'driver_assigned': return 'bg-blue-500 text-white hover:bg-blue-600';
        case 'arrived_at_pickup': return 'border-blue-500 text-blue-600 hover:bg-blue-500/10';
        case 'in_progress': return 'bg-green-600 text-white hover:bg-green-700';
        case 'pending_driver_wait_and_return_approval': return 'bg-purple-400/80 text-purple-900 hover:bg-purple-400/70';
        case 'in_progress_wait_and_return': return 'bg-teal-500 text-white hover:bg-teal-600';
        default: return '';
    }
  };

  const mapElements = useMemo(() => {
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType }> = [];
    const markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];

    if (!activeRide) return { markers, labels };

    if (activeRide.driverCurrentLocation) {
        markers.push({ 
            position: activeRide.driverCurrentLocation, 
            title: "Driver's Current Location", 
            iconUrl: blueDotSvgDataUrl, 
            iconScaledSize: {width: 24, height: 24} 
        });
        if (driverCurrentStreetName) {
            let labelContent = driverCurrentStreetName;
            if (activeRide.driverEtaMinutes !== undefined && activeRide.driverEtaMinutes !== null && activeRide.status === 'driver_assigned') {
                labelContent += `\nETA: ${activeRide.driverEtaMinutes} min${activeRide.driverEtaMinutes !== 1 ? 's' : ''}`;
            }
            labels.push({
                position: activeRide.driverCurrentLocation,
                content: labelContent,
                type: 'driver'
            });
        }
    }

    if (activeRide.pickupLocation) {
      markers.push({
        position: {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude},
        title: `Pickup: ${activeRide.pickupLocation.address}`,
        label: { text: "P", color: "white", fontWeight: "bold"}
      });
      labels.push({
        position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
        content: formatAddressForMapLabel(activeRide.pickupLocation.address, 'Pickup'),
        type: 'pickup'
      });
    }
    if (activeRide.status.toLowerCase().includes('in_progress') && activeRide.dropoffLocation) {
      markers.push({
        position: {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude},
        title: `Dropoff: ${activeRide.dropoffLocation.address}`,
        label: { text: "D", color: "white", fontWeight: "bold" }
      });
       labels.push({
        position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
        content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
        type: 'dropoff'
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
    return { markers, labels };
  }, [activeRide, driverCurrentStreetName]);

  const mapCenter = useMemo(() => {
    if (activeRide?.driverCurrentLocation) return activeRide.driverCurrentLocation;
    if (activeRide?.status === 'driver_assigned' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status === 'arrived_at_pickup' && activeRide.pickupLocation) return {lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude};
    if (activeRide?.status.toLowerCase().includes('in_progress') && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    if (activeRide?.status === 'completed' && activeRide.dropoffLocation) return {lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude};
    return driverLocation || huddersfieldCenterGoogle;
  }, [activeRide, driverLocation]);

  // Effect for dialog fare calculation
  useEffect(() => {
    if (!isEditDetailsDialogOpen || !rideToEditDetails) {
      setDialogFareEstimate(null);
      return;
    }

    if (dialogPickupCoords && dialogDropoffCoords) {
      let oneWayDistanceMiles = 0;
      let currentPoint = dialogPickupCoords;

      const validStopsForFare = dialogStopAutocompleteData.filter((stopData, index) => {
        const formStopValue = editDetailsForm.getValues(`stops.${index}.location`);
        return stopData.coords && formStopValue && formStopValue.trim() !== "";
      });

      for (const stopData of validStopsForFare) {
        if (stopData.coords) {
          oneWayDistanceMiles += getDistanceInMiles(currentPoint, stopData.coords);
          currentPoint = stopData.coords;
        }
      }
      oneWayDistanceMiles += getDistanceInMiles(currentPoint, dialogDropoffCoords);
      
      const oneWayDurationMinutes = (oneWayDistanceMiles / AVERAGE_SPEED_MPH) * 60;
      
      let calculatedFare = 0;
      if (oneWayDistanceMiles > 0) {
        const timeFareOneWay = oneWayDurationMinutes * PER_MINUTE_RATE;
        const distanceBasedFareOneWay = (oneWayDistanceMiles * PER_MILE_RATE) + FIRST_MILE_SURCHARGE;
        const stopSurchargeAmount = validStopsForFare.length * PER_STOP_SURCHARGE;
        calculatedFare = BASE_FARE + timeFareOneWay + distanceBasedFareOneWay + stopSurchargeAmount + BOOKING_FEE;

        // Use original ride's vehicle type and passenger count for dialog estimate
        let vehicleMultiplier = 1.0;
        if (rideToEditDetails.vehicleType === "estate") vehicleMultiplier = 1.2;
        else if (rideToEditDetails.vehicleType === "minibus_6" || rideToEditDetails.vehicleType === "minibus_6_pet_friendly") vehicleMultiplier = 1.5;
        else if (rideToEditDetails.vehicleType === "minibus_8" || rideToEditDetails.vehicleType === "minibus_8_pet_friendly") vehicleMultiplier = 1.6;
        else if (rideToEditDetails.vehicleType === "disable_wheelchair_access") vehicleMultiplier = 2.0;
        
        const passengerCount = Number(rideToEditDetails.passengers) || 1;
        const passengerAdjustment = 1 + (Math.max(0, passengerCount - 1)) * 0.1;
        
        calculatedFare = calculatedFare * vehicleMultiplier * passengerAdjustment;
        
        if (rideToEditDetails.vehicleType === "pet_friendly_car" || rideToEditDetails.vehicleType === "minibus_6_pet_friendly" || rideToEditDetails.vehicleType === "minibus_8_pet_friendly") {
            calculatedFare += PET_FRIENDLY_SURCHARGE;
        }
        calculatedFare = Math.max(calculatedFare, MINIMUM_FARE);
      }
      const newFareEstimate = calculatedFare;
      console.log("[EditDialog FareCalc] Recalculated dialog fare:", newFareEstimate);
      setDialogFareEstimate(newFareEstimate > 0 ? parseFloat(newFareEstimate.toFixed(2)) : null);
    } else {
      setDialogFareEstimate(null);
    }
  }, [isEditDetailsDialogOpen, dialogPickupCoords, dialogDropoffCoords, dialogStopAutocompleteData, rideToEditDetails, editDetailsForm]);


  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (error && !activeRide) return <div className="text-center py-10 text-destructive"><AlertTriangle className="mx-auto h-12 w-12 mb-2" /><p className="font-semibold">Error loading active ride:</p><p>{error}</p><Button onClick={fetchActiveRide} variant="outline" className="mt-4">Try Again</Button></div>;

  const renderAutocompleteSuggestions = ( suggestions: google.maps.places.AutocompletePrediction[], isFetchingSugg: boolean, isFetchingDet: boolean, inputValue: string, onSuggClick: (suggestion: google.maps.places.AutocompletePrediction) => void, fieldKey: string ) => ( <ScrollArea className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60"> <div className="space-y-1 p-1"> {isFetchingSugg && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>} {isFetchingDet && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</div>} {!isFetchingSugg && !isFetchingDet && suggestions.length === 0 && inputValue.length >= 2 && <div className="p-2 text-sm text-muted-foreground">No suggestions.</div>} {!isFetchingSugg && !isFetchingDet && suggestions.map((s) => { console.log(`[RenderSuggestions DEBUG for ${fieldKey}] Rendering suggestion: ${s.description}`); return( <div key={`${fieldKey}-${s.place_id}`} className="p-2 text-sm hover:bg-muted cursor-pointer rounded-sm" onMouseDown={() => onSuggClick(s)}>{s.description}</div> );})} </div> </ScrollArea> );
  const vehicleTypeDisplay = activeRide?.vehicleType ? activeRide.vehicleType.charAt(0).toUpperCase() + activeRide.vehicleType.slice(1).replace(/_/g, ' ')  : 'Vehicle N/A';
  const statusDisplay = activeRide?.status ? activeRide.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Status N/A';
  const pickupAddressDisplay = activeRide?.pickupLocation?.address || 'Pickup N/A';
  const dropoffAddressDisplay = activeRide?.dropoffLocation?.address || 'Dropoff N/A';
  
  let fareDisplay = `£${(activeRide?.fareEstimate ?? 0).toFixed(2)}`;
  if (activeRide?.status === 'in_progress_wait_and_return' || activeRide?.waitAndReturn) {
    const additionalWaitCharge = Math.max(0, (activeRide.estimatedAdditionalWaitTimeMinutes || 0) - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR) * WAITING_CHARGE_PER_MINUTE_PASSENGER;
    const waitAndReturnBaseFare = (activeRide.fareEstimate || 0) * 1.70; 
    fareDisplay = `£${(waitAndReturnBaseFare + additionalWaitCharge).toFixed(2)} (W&R)`;
  }

  const paymentMethodDisplay = 
    activeRide?.paymentMethod === 'card' ? 'Card (pay driver directly with your card)' 
    : activeRide?.paymentMethod === 'cash' ? 'Cash to Driver' 
    : activeRide?.paymentMethod === 'account' ? 'Account (Operator will bill)'
    : 'Payment N/A';

  const isEditingDisabled = activeRide?.status !== 'pending_assignment';

  const renderCancelAlertDialogActionContent = () => {
    return (
      <span className="flex items-center justify-center">
        {(activeRide && (actionLoading[activeRide.id] || false)) ? (
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
    );
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg"> <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"><MapPin className="w-8 h-8 text-primary" /> My Active Ride</CardTitle> <CardDescription>Track your current ride details and status live.</CardDescription> </CardHeader> </Card>
      {!activeRide && !isLoading && ( <Card> <CardContent className="pt-6 text-center text-muted-foreground"> <p className="text-lg mb-4">You have no active rides at the moment.</p> <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground"> <Link href="/dashboard/book-ride">Book a New Ride</Link> </Button> </CardContent> </Card> )}
      {activeRide && (
        <>
          <div className="relative w-full h-72 md:h-96 rounded-lg overflow-hidden shadow-md border">
            <GoogleMapDisplay 
              center={mapCenter} 
              zoom={14} 
              markers={mapElements.markers} 
              customMapLabels={mapElements.labels}
              className="h-full w-full" 
              disableDefaultUI={true} 
              fitBoundsToMarkers={true}
              onSdkLoaded={setIsMapSdkLoaded} 
            />
          </div>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row justify-between items-start gap-2">
                <div> <CardTitle className="text-xl flex items-center gap-2"> <Car className="w-5 h-5 text-primary" /> {vehicleTypeDisplay} </CardTitle> <CardDescription className="text-xs">{activeRide.scheduledPickupAt ? `Scheduled: ${formatDate(null, activeRide.scheduledPickupAt)}` : `Booked: ${formatDate(activeRide.bookingTimestamp)}`}</CardDescription> </div>
                <Badge variant={getStatusBadgeVariant(activeRide.status)} className={cn("text-xs sm:text-sm", getStatusBadgeClass(activeRide.status))}> {statusDisplay} </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-base text-muted-foreground">{getStatusMessage(activeRide)}</p>

                {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ackWindowSecondsLeft !== null && ackWindowSecondsLeft > 0 && (
                  <Alert variant="default" className="bg-orange-100 dark:bg-orange-800/30 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300">
                    <Info className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Driver Has Arrived!</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">
                      Please acknowledge within <span className="font-bold">{formatTimerPassenger(ackWindowSecondsLeft)}</span> to start your 3 minutes free waiting.
                    </ShadAlertDescription>
                  </Alert>
                )}

                {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ackWindowSecondsLeft === 0 && (
                  <Alert variant="default" className="bg-yellow-100 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                    <Timer className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Acknowledgment Window Expired</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">
                     Your 3 mins free waiting time ({freeWaitingSecondsLeft !== null ? formatTimerPassenger(freeWaitingSecondsLeft) : 'N/A'}) has started.
                      Waiting charges (£{WAITING_CHARGE_PER_MINUTE_PASSENGER.toFixed(2)}/min) apply after.
                    </ShadAlertDescription>
                  </Alert>
                )}

                {activeRide.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && (
                  <Alert variant="default" className="bg-green-100 dark:bg-green-700/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300">
                    <CheckCheck className="h-5 w-5 text-current" />
                    <ShadAlertTitle className="font-semibold text-current">Arrival Acknowledged - Free Waiting</ShadAlertTitle>
                    <ShadAlertDescription className="text-current">
                      {freeWaitingSecondsLeft !== null && freeWaitingSecondsLeft > 0 && (
                        <span>Free waiting time: {formatTimerPassenger(freeWaitingSecondsLeft)}. Charges (£{WAITING_CHARGE_PER_MINUTE_PASSENGER.toFixed(2)}/min) apply after.</span>
                      )}
                      {isBeyondFreeWaiting && extraWaitingSeconds !== null && (
                        <span>Extra waiting: {formatTimerPassenger(extraWaitingSeconds)}. Current Charge: £{currentWaitingCharge.toFixed(2)}</span>
                      )}
                      {!isBeyondFreeWaiting && freeWaitingSecondsLeft === 0 && <span>Free waiting time expired. Charges (£0.20/min) may apply.</span>}
                    </ShadAlertDescription>
                  </Alert>
                )}

                {activeRide.driver && ( <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border"> <Image src={activeRide.driverAvatar || `https://placehold.co/48x48.png?text=${activeRide.driver.charAt(0)}`} alt={activeRide.driver} width={48} height={48} className="rounded-full" data-ai-hint="driver avatar" /> <div> <p className="font-semibold">{activeRide.driver}</p> <p className="text-xs text-muted-foreground">{activeRide.driverVehicleDetails || "Vehicle details N/A"}</p> </div> <Button asChild variant="outline" size="sm" className="ml-auto"> <Link href="/dashboard/chat"><MessageSquare className="w-4 h-4 mr-1.5" /> Chat</Link> </Button> </div> )}
                <Separator />
                <div className="text-sm space-y-1"> <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> <strong>From:</strong> {pickupAddressDisplay}</p> {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop, index) => ( <p key={index} className="flex items-start gap-1.5 pl-5"><MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> <strong>Stop {index + 1}:</strong> {stop.address} </p> ))} <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> <strong>To:</strong> {dropoffAddressDisplay}</p> <div className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> {fareDisplay}{activeRide.isSurgeApplied && <Badge variant="outline" className="ml-1.5 border-orange-500 text-orange-500">Surge</Badge>}</div> <div className="flex items-center gap-1.5"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : activeRide.paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-muted-foreground" /> : <Briefcase className="w-4 h-4 text-muted-foreground" />} <strong>Payment:</strong> {paymentMethodDisplay} </div> </div>
                 {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ( <Button className="w-full bg-green-600 hover:bg-green-700 text-white mt-2" onClick={() => handleAcknowledgeArrival(activeRide.id)}> <CheckCheck className="mr-2 h-5 w-5" /> Acknowledge Driver Arrival </Button> )}
                 {activeRide.status === 'in_progress' && !activeRide.waitAndReturn && (
                   <Button
                     variant="outline"
                     className="w-full mt-2 border-accent text-accent hover:bg-accent/10"
                     onClick={() => setIsWRRequestDialogOpen(true)}
                     disabled={isRequestingWR || activeRide.status.startsWith('pending_driver_wait_and_return')}
                   >
                     <RefreshCw className="mr-2 h-4 w-4" /> Request Wait & Return
                   </Button>
                 )}
                 {activeRide.status === 'pending_driver_wait_and_return_approval' && (
                    <Alert variant="default" className="bg-purple-50 border-purple-300 text-purple-700 mt-2">
                        <Timer className="h-5 w-5" />
                        <ShadAlertTitle className="font-semibold">Wait & Return Requested</ShadAlertTitle>
                        <ShadAlertDescription>
                          Your request for wait & return (approx. {activeRide.estimatedAdditionalWaitTimeMinutes} mins wait) is awaiting driver confirmation.
                        </ShadAlertDescription>
                    </Alert>
                 )}
                 {activeRide.status === 'in_progress_wait_and_return' && (
                     <Alert variant="default" className="bg-teal-50 border-teal-300 text-teal-700 mt-2">
                        <CheckCheck className="h-5 w-5" />
                        <ShadAlertTitle className="font-semibold">Wait & Return Active!</ShadAlertTitle>
                        <ShadAlertDescription>
                          Driver will wait approx. {activeRide.estimatedAdditionalWaitTimeMinutes} mins. New fare: {fareDisplay}.
                        </ShadAlertDescription>
                    </Alert>
                 )}
            </CardContent>
             {activeRide.status === 'pending_assignment' && (
                <CardFooter className="border-t pt-4 flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => handleOpenEditDetailsDialog(activeRide)} className="w-full sm:w-auto" disabled={isUpdatingDetails || isEditingDisabled}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                  </Button>
                  {isEditingDisabled && (
                    <Alert variant="default" className="w-full text-xs p-2 bg-yellow-50 border-yellow-400 dark:bg-yellow-800/30 dark:border-yellow-700">
                      <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                      <ShadAlertTitle className="text-yellow-700 dark:text-yellow-300 font-semibold">Editing Disabled</ShadAlertTitle>
                      <ShadAlertDescription className="text-yellow-600 dark:text-yellow-400">
                        Ride details cannot be changed once a driver is assigned or the ride is in progress. Please cancel and rebook if major changes are needed.
                      </ShadAlertDescription>
                    </Alert>
                  )}
                   <div className="flex items-center justify-between space-x-2 bg-destructive/10 p-3 rounded-md mt-3 w-full sm:w-auto">
                        <Label htmlFor={`cancel-ride-switch-${activeRide.id}`} className="text-destructive font-medium text-sm">
                            Initiate Cancellation
                        </Label>
                        <Switch id={`cancel-ride-switch-${activeRide.id}`} checked={isCancelSwitchOn} onCheckedChange={handleCancelSwitchChange} disabled={actionLoading[activeRide.id]} className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-muted shrink-0" />
                    </div>
                </CardFooter>
            )}
          </Card>
        </>
      )}
      <AlertDialog
        open={showCancelConfirmationDialog}
        onOpenChange={(isOpen) => {
            setShowCancelConfirmationDialog(isOpen);
            if (!isOpen) {
                if (isCancelSwitchOn) setIsCancelSwitchOn(false);
            }
        }}
      >
        <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This will cancel your ride request. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel
                    onClick={() => { setIsCancelSwitchOn(false); setShowCancelConfirmationDialog(false);}}
                    disabled={activeRide ? actionLoading[activeRide.id] : false}
                >
                 <span>Keep Ride</span>
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { 
                    if (activeRide) { handleInitiateCancelRide(); }
                  }}
                  disabled={!activeRide || (actionLoading[activeRide?.id || ''] || false)}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                 {renderCancelAlertDialogActionContent()}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isEditDetailsDialogOpen} onOpenChange={(open) => { if(!open) {setRideToEditDetails(null); setIsEditDetailsDialogOpen(false); editDetailsForm.reset(); setDialogFareEstimate(null);}}}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] grid grid-rows-[auto_minmax(0,1fr)_auto] p-0">
          <DialogHeader className="p-6 pb-0"> <ShadDialogTitle>Edit Booking Details</ShadDialogTitle> <ShadDialogDescription>Modify your ride details. Changes only apply if driver not yet assigned.</ShadDialogDescription> </DialogHeader>
          <ScrollArea className="overflow-y-auto"> <div className="px-6 py-4"> <Form {...editDetailsForm}> <form id="edit-details-form-actual" onSubmit={editDetailsForm.handleSubmit(onEditDetailsSubmit)} className="space-y-4">
          <FormField control={editDetailsForm.control} name="pickupDoorOrFlat" render={({ field }) => (<FormItem><FormLabel>Pickup Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={editDetailsForm.control} name="pickupLocation" render={({ field }) => ( <FormItem><FormLabel>Pickup Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search pickup" {...field} value={dialogPickupInputValue} onChange={(e) => handleEditAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory('pickupLocation')} onBlur={() => handleEditBlurFactory('pickupLocation')} autoComplete="off" className="pr-8 h-9" /></FormControl> {showDialogPickupSuggestions && renderAutocompleteSuggestions(dialogPickupSuggestions, isFetchingDialogPickupSuggestions, isFetchingDialogPickupDetails, dialogPickupInputValue, (sugg) => handleEditSuggestionClickFactory('pickupLocation')(sugg, field.onChange), "dialog-pickup")}</div><FormMessage /></FormItem> )} />
                  {editStopsFields.map((stopField, index) => ( <div key={stopField.id} className="space-y-1 p-2 border rounded-md bg-muted/50"> <div className="flex justify-between items-center"> <FormLabel className="text-sm">Stop {index + 1}</FormLabel> <Button type="button" variant="ghost" size="sm" onClick={() => removeEditStop(index)} className="text-destructive hover:text-destructive-foreground h-7 px-1.5 text-xs"><XCircle className="mr-1 h-3.5 w-3.5" /> Remove</Button> </div> <FormField control={editDetailsForm.control} name={`stops.${index}.doorOrFlat`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Stop Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} /> <FormField control={editDetailsForm.control} name={`stops.${index}.location`} render={({ field }) => { const currentStopData = dialogStopAutocompleteData[index] || { fieldId: `default-stop-${index}`, inputValue: field.value || "", suggestions: [], showSuggestions: false, coords: null, isFetchingDetails: false, isFetchingSuggestions: false };
                        console.log(`[EditDialog Stop ${index}] Rendering. showSuggestions: ${currentStopData.showSuggestions}, inputValue: "${currentStopData.inputValue}", suggestions count: ${currentStopData.suggestions.length}`);
                        return (<FormItem><FormLabel className="text-xs">Stop Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search stop address" {...field} value={currentStopData.inputValue} onChange={(e) => handleEditAddressInputChangeFactory(index)(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory(index)} onBlur={() => handleEditBlurFactory(index)} autoComplete="off" className="pr-8 h-9"/></FormControl> {currentStopData.showSuggestions && renderAutocompleteSuggestions(currentStopData.suggestions, currentStopData.isFetchingSuggestions, currentStopData.isFetchingDetails, currentStopData.inputValue, (sugg) => handleEditSuggestionClickFactory(index)(sugg, field.onChange), `dialog-stop-${index}`)}</div><FormMessage /></FormItem>); }} /> </div> ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => {appendEditStop({location: "", doorOrFlat: ""}); setDialogStopAutocompleteData(prev => [...prev, {fieldId: `new-stop-${Date.now()}`, inputValue: "", suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null}])}} className="w-full text-accent border-accent hover:bg-accent/10"><PlusCircle className="mr-2 h-4 w-4"/>Add Stop</Button>
                  <FormField control={editDetailsForm.control} name="dropoffDoorOrFlat" render={({ field }) => (<FormItem><FormLabel className="text-xs">Dropoff Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} />
                  <FormField control={editDetailsForm.control} name="dropoffLocation" render={({ field }) => ( <FormItem><FormLabel>Dropoff Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search dropoff" {...field} value={dialogDropoffInputValue} onChange={(e) => handleEditAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory('dropoffLocation')} onBlur={() => handleEditBlurFactory('dropoffLocation')} autoComplete="off" className="pr-8 h-9" /></FormControl> {showDialogDropoffSuggestions && renderAutocompleteSuggestions(dialogDropoffSuggestions, isFetchingDialogDropoffSuggestions, isFetchingDialogDropoffDetails, dialogDropoffInputValue, (sugg) => handleEditSuggestionClickFactory('dropoffLocation')(sugg, field.onChange), "dialog-dropoff")}</div><FormMessage /></FormItem> )} />
                  <div className="grid grid-cols-2 gap-4"> <FormField control={editDetailsForm.control} name="desiredPickupDate" render={({ field }) => ( <FormItem><FormLabel>Pickup Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal h-9", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>ASAP (Pick Date)</span>}<CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} /> <FormField control={editDetailsForm.control} name="desiredPickupTime" render={({ field }) => ( <FormItem><FormLabel>Pickup Time</FormLabel><FormControl><Input type="time" {...field} className="h-9" disabled={!editDetailsForm.watch('desiredPickupDate')} /></FormControl><FormMessage /></FormItem> )} /> </div>
                  {!editDetailsForm.watch('desiredPickupDate') && <p className="text-xs text-muted-foreground text-center">Leave date/time blank for ASAP booking.</p>}
                  
                  {dialogFareEstimate !== null && (
                    <div className="mt-2 p-2 border rounded-md bg-muted/20 text-center">
                      <p className="text-sm text-muted-foreground">New Est. Fare (Route Only): <span className="font-semibold text-primary">£{dialogFareEstimate.toFixed(2)}</span></p>
                      <p className="text-xs text-muted-foreground">(Other factors like priority/surge from original booking may still apply)</p>
                    </div>
                  )}

                </form> </Form> </div> </ScrollArea>
          <DialogFooter className="p-6 pt-4 border-t"> <DialogClose asChild><Button type="button" variant="outline" disabled={isUpdatingDetails}>Cancel</Button></DialogClose>
            <Button type="submit" form="edit-details-form-actual" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isUpdatingDetails || !dialogPickupCoords || !dialogDropoffCoords}>
              {isUpdatingDetails ? (
                <React.Fragment>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Edit className="mr-2 h-4 w-4" />
                  Save Changes
                </React.Fragment>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={isWRRequestDialogOpen} onOpenChange={setIsWRRequestDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <ShadDialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</ShadDialogTitle>
          <ShadDialogDescription>
            Estimate additional waiting time at current drop-off. 10 mins free, then £{WAITING_CHARGE_PER_MINUTE_PASSENGER.toFixed(2)}/min. Driver must approve.
          </ShadDialogDescription>
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
    </div>
  );
}


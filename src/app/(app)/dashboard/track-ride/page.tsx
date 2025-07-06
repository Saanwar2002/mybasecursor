"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MapPin, Car, Clock, Loader2, AlertTriangle, Edit, XCircle, DollarSign, Calendar as CalendarIconLucide, Users, MessageSquare, UserCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, PlusCircle, TimerIcon, Info, Check, Navigation, Play, PhoneCall, RefreshCw, Briefcase, UserX as UserXIcon, TrafficCone, Gauge, ShieldCheck as ShieldCheckIcon, MinusCircle, Construction, Users as UsersIcon, Power, AlertOctagon, LockKeyhole, CheckCircle as CheckCircleIcon, Route, Crown, Star } from "lucide-react";
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
import { formatAddressForMapLabel } from '@/lib/utils';
import { usePassengerBookings } from '@/hooks/usePassengerBookings';
import { useRouter } from 'next/navigation';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const carIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#2563EB" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(carIconSvg)}` : '';


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
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number;
  driverId?: string;
  fareEstimate: number;
  status: string;
  driver?: string;
  driverAvatar?: string;
  driverVehicleDetails?: string;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied?: boolean;
  paymentMethod?: "card" | "cash" | "account";
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  notifiedPassengerArrivalTimestamp?: SerializedTimestamp | string | null;
  passengerAcknowledgedArrivalTimestamp?: SerializedTimestamp | string | null;
  rideStartedAt?: SerializedTimestamp | string | null;
  driverCurrentLocation?: { lat: number; lng: number };
  driverEtaMinutes?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  accountJobPin?: string;
  driverCurrentLegIndex?: number; 
  currentLegEntryTimestamp?: SerializedTimestamp | string | null; 
  completedStopWaitCharges?: Record<number, number>;
  // New fields for enhanced booking tracking
  assignmentMethod?: string;
  dispatchMode?: string;
  timeoutAt?: SerializedTimestamp | null;
  queuedAt?: SerializedTimestamp | null;
  cancelledAt?: SerializedTimestamp | null;
  cancellationReason?: string;
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

const PASSENGER_PICKUP_FREE_WAITING_SECONDS = 3 * 60; 
const PASSENGER_ACKNOWLEDGMENT_WINDOW_SECONDS = 30; 
const PASSENGER_WAITING_CHARGE_PER_MINUTE = 0.20; 
const PASSENGER_STOP_FREE_WAITING_SECONDS = 1 * 60; 
const PASSENGER_STOP_WAITING_CHARGE_PER_MINUTE = 0.25; 

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
  const R = 6371;
  const dLat = deg2rad(coords2.lat - coords1.lat);
  const dLon = deg2rad(coords2.lng - coords1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(coords1.lat)) * Math.cos(deg2rad(coords2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d * 0.621371;
}


export default function MyActiveRidePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeStatuses = useMemo(() => [
    'pending_assignment',
    'pending_offer',
    'driver_assigned',
    'arrived_at_pickup',
    'in_progress',
    'pending_driver_wait_and_return_approval',
    'in_progress_wait_and_return',
  ], []);
  const { bookings, loading, error } = usePassengerBookings(user?.id, activeStatuses);

  // Map booking to ActiveRide shape for rendering, supporting both snake_case and camelCase
  const mappedActiveRide = bookings.length > 0 ? {
    id: bookings[0].id,
    displayBookingId: bookings[0].displayBookingId || bookings[0].display_booking_id || bookings[0].id,
    originatingOperatorId: bookings[0].originatingOperatorId || bookings[0].originating_operator_id || '',
    passengerName: bookings[0].passengerName || bookings[0].passenger_name || 'N/A',
    pickupLocation: bookings[0].pickupLocation || bookings[0].pickup_location || { address: 'N/A', latitude: 0, longitude: 0 },
    dropoffLocation: bookings[0].dropoffLocation || bookings[0].dropoff_location || { address: 'N/A', latitude: 0, longitude: 0 },
    stops: bookings[0].stops || bookings[0].stops_list || [],
    vehicleType: bookings[0].vehicleType || bookings[0].vehicle_type || 'N/A',
    passengers: bookings[0].passengers || bookings[0].num_passengers || 1,
    driverId: bookings[0].driverId || bookings[0].driver_id || '',
    fareEstimate: bookings[0].fareEstimate || bookings[0].fare_estimate || 0,
    status: bookings[0].status || 'N/A',
    driver: bookings[0].driverName || bookings[0].driver_name || '',
    driverAvatar: bookings[0].driverAvatar || bookings[0].driver_avatar || '',
    driverVehicleDetails: bookings[0].driverVehicleDetails || bookings[0].driver_vehicle_details || '',
    isPriorityPickup: bookings[0].isPriorityPickup || bookings[0].is_priority_pickup || false,
    priorityFeeAmount: bookings[0].priorityFeeAmount || bookings[0].priority_fee_amount || 0,
    isSurgeApplied: bookings[0].isSurgeApplied || bookings[0].is_surge_applied || false,
    paymentMethod: bookings[0].paymentMethod || bookings[0].payment_method || 'N/A',
    bookingTimestamp: bookings[0].bookingTimestamp || bookings[0].booking_timestamp || null,
    scheduledPickupAt: bookings[0].scheduledPickupAt || bookings[0].scheduled_pickup_at || null,
    notifiedPassengerArrivalTimestamp: bookings[0].notifiedPassengerArrivalTimestamp || bookings[0].notified_passenger_arrival_timestamp || null,
    passengerAcknowledgedArrivalTimestamp: bookings[0].passengerAcknowledgedArrivalTimestamp || bookings[0].passenger_acknowledged_arrival_timestamp || null,
    rideStartedAt: bookings[0].rideStartedAt || bookings[0].ride_started_at || null,
    driverCurrentLocation: bookings[0].driverCurrentLocation || bookings[0].driver_current_location || null,
    driverEtaMinutes: bookings[0].driverEtaMinutes || bookings[0].driver_eta_minutes || null,
    waitAndReturn: bookings[0].waitAndReturn || bookings[0].wait_and_return || false,
    estimatedAdditionalWaitTimeMinutes: bookings[0].estimatedAdditionalWaitTimeMinutes || bookings[0].estimated_additional_wait_time_minutes || null,
    accountJobPin: bookings[0].accountJobPin || bookings[0].account_job_pin || '',
    driverCurrentLegIndex: bookings[0].driverCurrentLegIndex || bookings[0].driver_current_leg_index || 0,
    currentLegEntryTimestamp: bookings[0].currentLegEntryTimestamp || bookings[0].current_leg_entry_timestamp || null,
    completedStopWaitCharges: bookings[0].completedStopWaitCharges || bookings[0].completed_stop_wait_charges || {},
    // New fields mapping
    assignmentMethod: bookings[0].assignmentMethod || bookings[0].assignment_method || '',
    dispatchMode: bookings[0].dispatchMode || bookings[0].dispatch_mode || '',
    timeoutAt: bookings[0].timeoutAt || bookings[0].timeout_at || null,
    queuedAt: bookings[0].queuedAt || bookings[0].queued_at || null,
    cancelledAt: bookings[0].cancelledAt || bookings[0].cancelled_at || null,
    cancellationReason: bookings[0].cancellationReason || bookings[0].cancellation_reason || '',
  } : null;

  const activeRide = mappedActiveRide;

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

  const driverLocation = useMemo(() => activeRide?.driverCurrentLocation || huddersfieldCenterGoogle, [activeRide?.driverCurrentLocation]);

  const [passengerAckWindowSecondsLeft, setPassengerAckWindowSecondsLeft] = useState<number | null>(null);
  const [passengerFreeWaitingSecondsLeft, setPassengerFreeWaitingSecondsLeft] = useState<number | null>(null);
  const [isPassengerBeyondFreeWaitingPickup, setIsPassengerBeyondFreeWaitingPickup] = useState<boolean>(false);
  const [passengerExtraWaitingSecondsPickup, setPassengerExtraWaitingSecondsPickup] = useState<number | null>(null);
  const [currentPassengerWaitingChargePickup, setCurrentPassengerWaitingChargePickup] = useState<number>(0);
  const passengerWaitingTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [currentPassengerStopTimerDisplay, setCurrentPassengerStopTimerDisplay] = useState<{ stopDataIndex: number; freeSecondsLeft: number | null; extraSeconds: number | null; charge: number; } | null>(null);
  const passengerStopTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isRequestingWR, setIsRequestingWR] = useState(false);
  const [wrRequestDialogMinutes, setWrRequestDialogMinutes] = useState<string>("10");
  const [isWRRequestDialogOpen, setIsWRRequestDialogOpen] = useState(false);

  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);

  const [showEndOfRideReminder, setShowEndOfRideReminder] = useState(false);
  const endOfRideReminderTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [rideIdToCancel, setRideIdToCancel] = useState<string | null>(null);
  const [showCancelConfirmationDialog, setShowCancelConfirmationDialog] = useState(false);
  const [cancellationSuccess, setCancellationSuccess] = useState(false);

  // Timeout countdown state
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);
  const [timeoutCountdownInterval, setTimeoutCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  const router = useRouter();


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
    }
  }, [isMapSdkLoaded]);

  // Timeout countdown effect for queued bookings
  useEffect(() => {
    if (timeoutCountdownInterval) {
      clearInterval(timeoutCountdownInterval);
      setTimeoutCountdownInterval(null);
    }

    if (activeRide?.status === 'pending_assignment' && activeRide?.timeoutAt) {
      const timeoutDate = new Date(activeRide.timeoutAt._seconds * 1000);
      
      const updateCountdown = () => {
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((timeoutDate.getTime() - now.getTime()) / (1000 * 60)));
        setTimeoutCountdown(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(timeoutCountdownInterval!);
          setTimeoutCountdownInterval(null);
          // Show notification when timeout is reached
          toast({
            title: "Booking Timeout",
            description: "No driver was found within 30 minutes. You can continue waiting or cancel and try again.",
            variant: "destructive",
            duration: 10000
          });
        }
      };

      updateCountdown(); // Initial call
      const interval = setInterval(updateCountdown, 60000); // Update every minute
      setTimeoutCountdownInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      setTimeoutCountdown(null);
    }
  }, [activeRide?.status, activeRide?.timeoutAt, toast]);


  useEffect(() => {
    if (isEditDetailsDialogOpen) {
        editDetailsForm.setFocus('pickupLocation');
    }
  }, [isEditDetailsDialogOpen, editDetailsForm]);

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
          if (secondsSinceNotified < PASSENGER_ACKNOWLEDGMENT_WINDOW_SECONDS) {
            setPassengerAckWindowSecondsLeft(PASSENGER_ACKNOWLEDGMENT_WINDOW_SECONDS - secondsSinceNotified);
            setPassengerFreeWaitingSecondsLeft(PASSENGER_PICKUP_FREE_WAITING_SECONDS);
            setIsPassengerBeyondFreeWaitingPickup(false);
            setPassengerExtraWaitingSecondsPickup(null);
            setCurrentPassengerWaitingChargePickup(0);
          } else {
            setPassengerAckWindowSecondsLeft(0);
            const effectiveFreeWaitStartTime = addMinutes(notifiedTime, PASSENGER_ACKNOWLEDGMENT_WINDOW_SECONDS / 60);
            const secondsSinceEffectiveFreeWaitStart = Math.floor((now.getTime() - effectiveFreeWaitStartTime.getTime()) / 1000);

            if (secondsSinceEffectiveFreeWaitStart < PASSENGER_PICKUP_FREE_WAITING_SECONDS) {
              setPassengerFreeWaitingSecondsLeft(PASSENGER_PICKUP_FREE_WAITING_SECONDS - secondsSinceEffectiveFreeWaitStart);
              setIsPassengerBeyondFreeWaitingPickup(false);
              setPassengerExtraWaitingSecondsPickup(null);
              setCurrentPassengerWaitingChargePickup(0);
            } else {
              setPassengerFreeWaitingSecondsLeft(0);
              setIsPassengerBeyondFreeWaitingPickup(true);
              const currentExtra = secondsSinceEffectiveFreeWaitStart - PASSENGER_PICKUP_FREE_WAITING_SECONDS;
              setPassengerExtraWaitingSecondsPickup(currentExtra);
              setCurrentPassengerWaitingChargePickup(Math.floor(currentExtra / 60) * PASSENGER_WAITING_CHARGE_PER_MINUTE);
            }
          }
        } else { 
          setPassengerAckWindowSecondsLeft(null);
          const secondsSinceAck = Math.floor((now.getTime() - ackTime.getTime()) / 1000);
          if (secondsSinceAck < PASSENGER_PICKUP_FREE_WAITING_SECONDS) {
            setPassengerFreeWaitingSecondsLeft(PASSENGER_PICKUP_FREE_WAITING_SECONDS - secondsSinceAck);
            setIsPassengerBeyondFreeWaitingPickup(false);
            setPassengerExtraWaitingSecondsPickup(null);
            setCurrentPassengerWaitingChargePickup(0);
          } else {
            setPassengerFreeWaitingSecondsLeft(0);
            setIsPassengerBeyondFreeWaitingPickup(true);
            const currentExtra = secondsSinceAck - PASSENGER_PICKUP_FREE_WAITING_SECONDS;
            setPassengerExtraWaitingSecondsPickup(currentExtra);
            setCurrentPassengerWaitingChargePickup(Math.floor(currentExtra / 60) * PASSENGER_WAITING_CHARGE_PER_MINUTE);
          }
        }
      };
      updateTimers();
      passengerWaitingTimerIntervalRef.current = setInterval(updateTimers, 1000);
    } else {
      setPassengerAckWindowSecondsLeft(null);
      setPassengerFreeWaitingSecondsLeft(null);
      setIsPassengerBeyondFreeWaitingPickup(false);
      setPassengerExtraWaitingSecondsPickup(null);
      setCurrentPassengerWaitingChargePickup(0);
    }
    return () => {
      if (passengerWaitingTimerIntervalRef.current) {
        clearInterval(passengerWaitingTimerIntervalRef.current);
      }
    };
  }, [activeRide?.status, activeRide?.notifiedPassengerArrivalTimestamp, activeRide?.passengerAcknowledgedArrivalTimestamp]);


  useEffect(() => {
    if (passengerStopTimerIntervalRef.current) {
        clearInterval(passengerStopTimerIntervalRef.current);
        passengerStopTimerIntervalRef.current = null;
    }
    const currentLegIndex = activeRide?.driverCurrentLegIndex;
    const legEntryTime = parseTimestampToDatePassenger(activeRide?.currentLegEntryTimestamp);
    const isAtIntermediateStop = activeRide &&
                                 (activeRide.status === 'in_progress' || activeRide.status === 'in_progress_wait_and_return') &&
                                 currentLegIndex !== undefined &&
                                 legEntryTime &&
                                 currentLegIndex > 0 && 
                                 currentLegIndex < ((activeRide.stops?.length || 0) + 1); 

    if (isAtIntermediateStop) {
        const stopDataIndex = currentLegIndex! -1; 
        const updateStopTimer = () => {
            const now = new Date();
            const secondsSinceStopArrival = Math.floor((now.getTime() - legEntryTime!.getTime()) / 1000);
            let freeSeconds = PASSENGER_STOP_FREE_WAITING_SECONDS - secondsSinceStopArrival;
            let extraSeconds = 0;
            let charge = 0;
            if (freeSeconds < 0) {
                extraSeconds = -freeSeconds;
                freeSeconds = 0;
                charge = Math.floor(extraSeconds / 60) * PASSENGER_STOP_WAITING_CHARGE_PER_MINUTE;
            }
            setCurrentPassengerStopTimerDisplay({ stopDataIndex, freeSecondsLeft: freeSeconds, extraSeconds, charge });
        };
        updateStopTimer();
        passengerStopTimerIntervalRef.current = setInterval(updateStopTimer, 1000);
    } else {
        setCurrentPassengerStopTimerDisplay(null);
    }
    return () => { if (passengerStopTimerIntervalRef.current) clearInterval(passengerStopTimerIntervalRef.current); };
  }, [activeRide?.status, activeRide?.driverCurrentLegIndex, activeRide?.currentLegEntryTimestamp, activeRide?.stops]);


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
    if (activeRide && activeRide.status === 'completed') {
      router.replace(`/dashboard/ride-summary/${activeRide.id}`);
    }
  }, [activeRide, router]);


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
      if (stop?.inputValue.length >= 2) { 
        setDialogStopAutocompleteData(p => p.map((item, i) => i === fieldNameOrIndex ? {...item, showSuggestions: true} : item));
        if (!stop.suggestions?.length && !stop.isFetchingSuggestions && isMapSdkLoaded) { 
            fetchAddressSuggestions(stop.inputValue, 
                (sugg) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === fieldNameOrIndex ? {...item, suggestions: sugg} : item)),
                (fetch) => setDialogStopAutocompleteData(prev => prev.map((item,idx) => idx === fieldNameOrStopIndex ? {...item, isFetchingSuggestions: fetch} : item))
            );
        }
      }
    } else if (fieldNameOrIndex === 'pickupLocation') {
      if (dialogPickupInputValue.length >= 2 && isMapSdkLoaded) {
        setShowDialogPickupSuggestions(true);
        if (!dialogPickupSuggestions?.length && !isFetchingDialogPickupSuggestions) {
            fetchAddressSuggestions(dialogPickupInputValue, setDialogPickupSuggestions, setIsFetchingDialogPickupSuggestions);
        }
      }
    } else if (fieldNameOrIndex === 'dropoffLocation') {
      if (dialogDropoffInputValue.length >= 2 && isMapSdkLoaded) {
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
        fareEstimate: dialogFareEstimate !== null ? dialogFareEstimate : undefined,
    };


    try {
        const response = await fetch(`/api/bookings/update-details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)});
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Failed to update booking.'); }
        const updatedRideDataFromServer = await response.json();
        
        setRideToEditDetails(prev => prev ? { 
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
    if (!user || !rideToEditDetails) return;
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
      setRideToEditDetails(prev => prev ? { ...prev, passengerAcknowledgedArrivalTimestamp: updatedBooking.booking.passengerAcknowledgedArrivalTimestamp, status: 'arrived_at_pickup' } : null);
      toast({title: "Arrival Acknowledged!", description: "Your driver has been notified you are aware they have arrived."});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Acknowledgement Failed", description: message, variant: "destructive" });
    }
  };

  const handleRequestWaitAndReturn = async () => {
    if (!rideToEditDetails || !user) return;
    const waitTimeMinutes = parseInt(wrRequestDialogMinutes, 10);
    if (isNaN(waitTimeMinutes) || waitTimeMinutes < 0) {
      toast({ title: "Invalid Wait Time", description: "Please enter a valid number of minutes (0 or more).", variant: "destructive" });
      return;
    }
    setIsRequestingWR(true);
    try {
      const response = await fetch(`/api/operator/bookings/${rideToEditDetails.id}`, {
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
      setRideToEditDetails(updatedBooking.booking); 
      toast({ title: "Wait & Return Requested", description: "Your request has been sent to the driver for confirmation." });
      setIsWRRequestDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      toast({ title: "Request Failed", description: message, variant: "destructive" });
    } finally {
      setIsRequestingWR(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!rideIdToCancel || !user) return;
    const currentRideId = rideIdToCancel;
    setActionLoading(prev => ({ ...prev, [currentRideId]: true }));
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: currentRideId, passengerId: user.id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel ride.');
      }
      toast({ title: "Ride Cancelled", description: `Your ride ${rideToEditDetails?.displayBookingId || currentRideId} has been cancelled.` });
      setCancellationSuccess(true); 
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error cancelling ride.";
      toast({ title: "Cancellation Failed", description: message, variant: "destructive" });
      setCancellationSuccess(false);
    } finally {
       setActionLoading(prev => ({ ...prev, [currentRideId]: false }));
       setShowCancelConfirmationDialog(false);
    }
  };

  const getStatusMessage = (ride: ActiveRide | null) => {
    if (!ride || !ride.status) return "Loading status...";
    switch (ride.status.toLowerCase()) {
        case 'pending_assignment': 
          // Enhanced messaging for queued bookings
          if (ride.assignmentMethod === 'manual_queued') {
            return "Your booking is queued for manual assignment by the operator. You'll be notified when a driver is assigned.";
          } else if (ride.timeoutAt) {
            const timeoutDate = new Date(ride.timeoutAt._seconds * 1000);
            const now = new Date();
            const timeLeft = Math.max(0, Math.floor((timeoutDate.getTime() - now.getTime()) / (1000 * 60)));
            if (timeLeft > 0) {
              return `Finding you a driver... If no driver is found within ${timeLeft} minutes, you'll be notified.`;
            } else {
              return "Finding you a driver... You can continue waiting or cancel and try again.";
            }
          } else {
            return "Finding you a driver...";
          }
        case 'driver_assigned': return `Driver ${ride.driver || 'N/A'} is en route. ETA: ${ride.driverEtaMinutes ?? 'calculating...'} min.`;
        case 'arrived_at_pickup': return `Driver ${ride.driver || 'N/A'} has arrived at your pickup location.`;
        case 'in_progress': return "Your ride is in progress. Enjoy!";
        case 'pending_driver_wait_and_return_approval': return `Wait & Return requested for an additional ${ride.estimatedAdditionalWaitTimeMinutes || 0} mins. Awaiting driver confirmation.`;
        case 'in_progress_wait_and_return': return `Ride in progress (Wait & Return). Driver will wait ~${ride.estimatedAdditionalWaitTimeMinutes || 0} mins at dropoff.`;
        case 'cancelled_no_driver': return "Your booking was cancelled as no driver was available within 30 minutes. Please try booking again.";
        case 'cancelled_by_operator': return "Your booking was cancelled by the operator. Please contact support if you have questions.";
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
        case 'cancelled_no_driver': return 'destructive';
        case 'cancelled_by_operator': return 'destructive';
        default: return 'secondary';
    }
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    if (!status) return '';
    switch (status.toLowerCase()) {
        case 'pending_assignment': return 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70';
        case 'driver_assigned': return 'bg-blue-500 text-white hover:bg-blue-600';
        case 'arrived_at_pickup': return 'border-blue-500 text-blue-500 hover:bg-blue-500/10';
        case 'in_progress': return 'bg-green-600 text-white hover:bg-green-700';
        case 'pending_driver_wait_and_return_approval': return 'bg-purple-400/80 text-purple-900 hover:bg-purple-400/70';
        case 'in_progress_wait_and_return': return 'bg-teal-500 text-white hover:bg-teal-600';
        case 'cancelled_no_driver': return 'bg-red-500 text-white hover:bg-red-600';
        case 'cancelled_by_operator': return 'bg-red-500 text-white hover:bg-red-600';
        default: return '';
    }
  };

  const mapElements = useMemo<{
    markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }>;
    labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType }>;
  }>(() => {
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType }> = [];
    const markers: Array<{ position: google.maps.LatLngLiteral; title: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    if (!activeRide) return { markers, labels };
    const isActiveRideState = activeRide.status && !['completed', 'cancelled', 'cancelled_by_driver', 'cancelled_no_show'].includes(activeRide.status.toLowerCase());

    if (activeRide.driverCurrentLocation) {
      markers.push({
        position: activeRide.driverCurrentLocation,
        title: "Your Driver",
        iconUrl: driverCarIconDataUrl,
        iconScaledSize: { width: 32, height: 32 }
      });
    }

    if (activeRide.pickupLocation) {
      markers.push({
        position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
        title: `Pickup: ${activeRide.pickupLocation.address}`,
        label: { text: "P", color: "white", fontWeight: "bold" }
      });
      labels.push({
        position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude },
        content: formatAddressForMapLabel(activeRide.pickupLocation.address, 'Pickup'),
        type: 'pickup'
      });
    }

    // Add stops
    (activeRide.stops as LocationPoint[] | undefined)?.forEach((stop: LocationPoint, index: number) => {
      if (stop.latitude && stop.longitude && isActiveRideState) {
        markers.push({
          position: { lat: stop.latitude, lng: stop.longitude },
          title: `Stop ${index + 1}: ${stop.address}`,
          label: { text: `S${index + 1}`, color: "white", fontWeight: "bold" }
        });
        labels.push({
          position: { lat: stop.latitude, lng: stop.longitude },
          content: formatAddressForMapLabel(stop.address, `Stop ${index + 1}`),
          type: 'stop'
        });
      }
    });

    // Optionally, add dropoff marker/label here if you want it always visible
    if (activeRide.dropoffLocation) {
      markers.push({
        position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
        title: `Dropoff: ${activeRide.dropoffLocation.address}`,
        label: { text: "D", color: "white", fontWeight: "bold" }
      });
      labels.push({
        position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude },
        content: formatAddressForMapLabel(activeRide.dropoffLocation.address, 'Dropoff'),
        type: 'dropoff'
      });
    }

    return { markers, labels };
  }, [activeRide]);

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


  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (error && !rideToEditDetails) return <div className="text-center py-10 text-destructive"><AlertTriangle className="mx-auto h-12 w-12 mb-2" /><p className="font-semibold">Error loading active ride:</p><p>{error}</p><Button onClick={() => {}} variant="outline" className="mt-4">Try Again</Button></div>;

  const renderAutocompleteSuggestions = ( suggestions: google.maps.places.AutocompletePrediction[], isFetchingSugg: boolean, isFetchingDet: boolean, inputValue: string, onSuggClick: (suggestion: google.maps.places.AutocompletePrediction) => void, fieldKey: string ) => ( <ScrollArea className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60"> <div className="space-y-1 p-1"> {isFetchingSugg && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>} {isFetchingDet && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</div>} {!isFetchingSugg && !isFetchingDet && suggestions.length === 0 && inputValue.length >= 2 && <div className="p-2 text-sm text-muted-foreground">No suggestions.</div>} {!isFetchingSugg && !isFetchingDet && suggestions.map((s) => { console.log(`[RenderSuggestions DEBUG for ${fieldKey}] Rendering suggestion: ${s.description}`); return( <div key={`${fieldKey}-${s.place_id}`} className="p-2 text-sm hover:bg-muted cursor-pointer rounded-sm" onMouseDown={() => onSuggClick(s)}>{s.description}</div> );})} </div> </ScrollArea> );
  const vehicleTypeDisplay = activeRide?.vehicleType || 'Vehicle N/A';
  const statusDisplay = activeRide?.status ? activeRide.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Status N/A';
  const pickupAddressDisplay = activeRide?.pickupLocation?.address || 'Pickup N/A';
  const dropoffAddressDisplay = activeRide?.dropoffLocation?.address || 'Dropoff N/A';
  
  let baseFareWithWRSurcharge = rideToEditDetails?.fareEstimate || 0;
  let finalFareDisplay = "";
  let finalFareSuffix = "";

  if (rideToEditDetails) {
    if (rideToEditDetails.waitAndReturn) {
      const wrBaseFare = (rideToEditDetails.fareEstimate || 0) * 1.70;
      const additionalWaitCharge = Math.max(0, (rideToEditDetails.estimatedAdditionalWaitTimeMinutes || 0) - FREE_WAITING_TIME_MINUTES_AT_DESTINATION_WR) * PASSENGER_STOP_WAITING_CHARGE_PER_MINUTE;
      baseFareWithWRSurcharge = wrBaseFare + additionalWaitCharge;
      finalFareSuffix = " (Base + W&R)";
    }

    const totalIncludingPriority = baseFareWithWRSurcharge + (rideToEditDetails.isPriorityPickup && rideToEditDetails.priorityFeeAmount ? rideToEditDetails.priorityFeeAmount : 0) + currentPassengerWaitingChargePickup + (currentPassengerStopTimerDisplay?.charge || 0);
    finalFareDisplay = `£${totalIncludingPriority.toFixed(2)}`;
  } else {
    finalFareDisplay = "£0.00";
  }


  const paymentMethodDisplay = 
    rideToEditDetails?.paymentMethod === 'card' ? 'Card (pay driver directly with your card)' 
    : rideToEditDetails?.paymentMethod === 'cash' ? 'Cash to Driver' 
    : rideToEditDetails?.paymentMethod === 'account' ? 'Account (Operator will bill)'
    : 'Payment N/A';

  const isEditingDisabled = activeRide?.status !== 'pending_assignment';
  
  const journeyLegCount = (rideToEditDetails?.stops?.length || 0) + 2; 

  console.log('DEBUG activeRide:', activeRide);

  const bookedTimeDisplay = activeRide?.bookingTimestamp
    ? new Date(activeRide.bookingTimestamp.seconds * 1000).toLocaleString()
    : 'N/A';
  const fareDisplay = activeRide?.fareEstimate != null
    ? `£${Number(activeRide.fareEstimate).toFixed(2)}`
    : 'Fare N/A';
  const paymentDisplay = activeRide?.paymentMethod
    ? activeRide.paymentMethod.charAt(0).toUpperCase() + activeRide.paymentMethod.slice(1)
    : 'Payment N/A';

  return (
    <div className="space-y-6">
      <Card className="shadow-lg"> <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"><MapPin className="w-8 h-8 text-primary" /> My Active Ride</CardTitle> <CardDescription>Track your current ride details and status live. Ride ID: {activeRide?.displayBookingId || activeRide?.id || "N/A"}</CardDescription> </CardHeader> </Card>
      {!activeRide && !loading && ( <Card> <CardContent className="pt-6 text-center text-muted-foreground"> <p className="text-lg mb-4">You have no active rides at the moment.</p> <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground"><Link href="/dashboard/book-ride"><span>Book a New Ride</span></Link></Button> </CardContent> </Card> )}
      {activeRide && (
        <>
          <div className="relative w-full h-72 md:h-96 rounded-lg overflow-hidden shadow-md border">
            <GoogleMapDisplay 
              center={driverLocation} 
              zoom={14} 
              markers={mapElements.markers} 
              customMapLabels={mapElements.labels}
              className="h-full w-full" 
              disableDefaultUI={true} 
              fitBoundsToMarkers={true}
              onSdkLoaded={setIsMapSdkLoaded} 
            />
          </div>

          {showEndOfRideReminder && activeRide.status === 'in_progress' && (
            <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700">
              <CheckCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <ShadAlertTitle className="font-semibold text-green-700 dark:text-green-300">Enjoying Your Ride?</ShadAlertTitle>
              <ShadAlertDescriptionForAlert className="text-sm text-green-600 dark:text-green-400">
                Ride nearing destination! Please remember to rate your experience and appreciate your driver after completion. Have a great day!
              </ShadAlertDescriptionForAlert>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEndOfRideReminder(false)}
                className="absolute top-2 right-2 p-1 h-auto text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                <XCircle className="w-4 h-4"/>
              </Button>
            </Alert>
          )}

          <Card className="shadow-md">
            <CardHeader className="flex flex-row justify-between items-start gap-2">
                <div> <CardTitle className="text-xl flex items-center gap-2"> <Car className="w-5 h-5 text-primary" /> {vehicleTypeDisplay} </CardTitle> <CardDescription className="text-xs">{activeRide.scheduledPickupAt ? `Scheduled: ${formatDate(null, activeRide.scheduledPickupAt)}` : `Booked: ${bookedTimeDisplay}`}</CardDescription> </div>
                <Badge variant={getStatusBadgeVariant(activeRide.status)} className={cn("text-xs sm:text-sm", getStatusBadgeClass(activeRide.status))}> {statusDisplay} </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-base text-muted-foreground">{getStatusMessage(activeRide)}</p>
                
                {/* Timeout countdown for queued bookings */}
                {activeRide.status === 'pending_assignment' && timeoutCountdown !== null && timeoutCountdown > 0 && (
                  <Alert variant="default" className="bg-orange-100 dark:bg-orange-800/30 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300">
                    <Timer className="h-4 w-4 text-current" />
                    <ShadAlertTitle className="font-semibold text-current text-sm">
                      Driver Search Timeout
                    </ShadAlertTitle>
                    <ShadAlertDescriptionForAlert className="text-sm text-current/80">
                      If no driver is found within <strong>{timeoutCountdown} minutes</strong>, you'll be notified and can choose to keep waiting or cancel.
                    </ShadAlertDescriptionForAlert>
                  </Alert>
                )}

                {/* Timeout reached notification */}
                {activeRide.status === 'pending_assignment' && timeoutCountdown !== null && timeoutCountdown <= 0 && (
                  <Alert variant="destructive" className="bg-red-100 dark:bg-red-800/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4 text-current" />
                    <ShadAlertTitle className="font-semibold text-current text-sm">
                      No Driver Found
                    </ShadAlertTitle>
                    <ShadAlertDescriptionForAlert className="text-sm text-current/80">
                      No driver was found within 30 minutes. You can continue waiting or cancel and try again.
                    </ShadAlertDescriptionForAlert>
                  </Alert>
                )}
                
                {activeRide.paymentMethod === 'account' && activeRide.accountJobPin && (
                  <div className="my-2 p-2.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md text-center shadow-sm">
                    <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                      Your One Time PIN for Driver: <strong className="text-lg font-bold tracking-wider text-purple-800 dark:text-purple-200">{activeRide.accountJobPin}</strong>
                    </span>
                  </div>
                )}

                {activeRide.status === 'driver_assigned' && activeRide.driverEtaMinutes && activeRide.driverEtaMinutes > 0 && (
                  <Alert variant="default" className="bg-blue-100 dark:bg-blue-700/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-200 p-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-current" />
                            <span className="font-semibold text-current">Driver En Route</span>
                        </div>
                        <span className="font-bold text-white bg-blue-600 dark:bg-blue-700 px-2 py-1 rounded text-sm font-mono tracking-wider">
                            ETA: {activeRide.driverEtaMinutes} min{activeRide.driverEtaMinutes !== 1 ? 's' : ''}
                        </span>
                    </div>
                  </Alert>
                )}

                {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && passengerAckWindowSecondsLeft !== null && passengerAckWindowSecondsLeft > 0 && (
                  <Alert variant="default" className="bg-orange-100 dark:bg-orange-700/40 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-200 p-1.5 text-xs">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                            <Info className="h-3.5 w-3.5 text-current" />
                            <span className="font-semibold text-current">Driver Has Arrived! Ack. within:</span>
                        </div>
                        <span className="font-bold text-white bg-pink-600 dark:bg-pink-700 px-1.5 py-0.5 rounded text-xs font-mono tracking-wider">
                            {formatTimerPassenger(passengerAckWindowSecondsLeft)}
                        </span>
                    </div>
                  </Alert>
                )}

                {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && passengerAckWindowSecondsLeft === 0 && passengerFreeWaitingSecondsLeft !== null && (
                    <Alert variant="default" className={cn("my-2 p-1.5 text-xs", isPassengerBeyondFreeWaitingPickup ? "bg-red-100 dark:bg-red-800/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300" : "bg-yellow-100 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300")}>
                      <TimerIcon className="h-4 w-4 text-current" />
                      <div className="flex justify-between items-center w-full">
                        <span className="font-semibold text-current">
                          {isPassengerBeyondFreeWaitingPickup ? 'Extra Waiting Period' : 'Free Waiting Period'}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded-sm inline-block font-mono tracking-wider", isPassengerBeyondFreeWaitingPickup ? "bg-accent text-white" : "bg-accent text-white")}>
                          {passengerFreeWaitingSecondsLeft > 0 ? formatTimerPassenger(passengerFreeWaitingSecondsLeft) : formatTimerPassenger(passengerExtraWaitingSecondsPickup || 0)}
                        </span>
                      </div>
                      <ShadAlertDescriptionForAlert className={cn("text-xs pl-[calc(1rem+0.375rem)] -mt-1", isPassengerBeyondFreeWaitingPickup ? "text-red-700/80 dark:text-red-300/80" : "text-yellow-700/80 dark:text-yellow-300/80")}>
                        {isPassengerBeyondFreeWaitingPickup
                          ? `Charges accumulating: £${currentPassengerWaitingChargePickup.toFixed(2)}`
                          : 'Ack. window expired. Waiting charges apply after this free period.'}
                      </ShadAlertDescriptionForAlert>
                    </Alert>
                )}

                {activeRide.status === 'arrived_at_pickup' && activeRide.passengerAcknowledgedArrivalTimestamp && passengerFreeWaitingSecondsLeft !== null && (
                  <Alert variant="default" className={cn("my-2 p-1.5 text-xs",
                    isPassengerBeyondFreeWaitingPickup ? "bg-red-100 dark:bg-red-700/40 border-red-400 dark:border-red-600 text-red-700 dark:text-red-200"
                                         : "bg-green-100 dark:bg-green-700/40 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300"
                  )}>
                    <TimerIcon className="h-4 w-4 text-current" />
                    <div className="flex justify-between items-center w-full">
                      <span className="font-semibold text-current">
                        {isPassengerBeyondFreeWaitingPickup ? "Extra Waiting" : "Free Waiting"}
                      </span>
                      <span className={cn("font-bold px-1.5 py-0.5 rounded-sm inline-block font-mono tracking-wider", isPassengerBeyondFreeWaitingPickup ? "bg-accent text-white" : "bg-green-600 text-white")}>
                        {isPassengerBeyondFreeWaitingPickup
                          ? `${formatTimerPassenger(passengerExtraWaitingSecondsPickup || 0)} (+£${currentPassengerWaitingChargePickup.toFixed(2)})`
                          : formatTimerPassenger(passengerFreeWaitingSecondsLeft)}
                      </span>
                    </div>
                     {passengerFreeWaitingSecondsLeft > 0 && !isPassengerBeyondFreeWaitingPickup && (
                        <ShadAlertDescriptionForAlert className="text-xs text-current/80 pl-[calc(1rem+0.375rem)] -mt-1">Arrival Acknowledged.</ShadAlertDescriptionForAlert>
                    )}
                    {passengerFreeWaitingSecondsLeft === 0 && !isPassengerBeyondFreeWaitingPickup && <ShadAlertDescriptionForAlert className="text-xs text-current/80 pl-[calc(1rem+0.375rem)] -mt-1">Free time expired. Charges apply.</ShadAlertDescriptionForAlert>}
                  </Alert>
                )}

                {currentPassengerStopTimerDisplay && activeRide.driverCurrentLegIndex !== undefined && activeRide.driverCurrentLegIndex > 0 && activeRide.driverCurrentLegIndex < journeyLegCount -1 && (
                  <Alert variant="default" className={cn("my-1 p-1.5", 
                    currentPassengerStopTimerDisplay.extraSeconds && currentPassengerStopTimerDisplay.extraSeconds > 0 ? "bg-red-100 dark:bg-red-700/80 border-red-500 dark:border-red-600 text-red-900 dark:text-red-100" : "bg-sky-100 dark:bg-sky-800/70 border-sky-300 dark:border-sky-600 text-sky-800 dark:text-sky-200"
                  )}>
                    <TimerIcon className="h-4 w-4 text-current" />
                    <ShadAlertTitle className="font-bold text-current text-xs">
                        <span>
                          {currentPassengerStopTimerDisplay.extraSeconds && currentPassengerStopTimerDisplay.extraSeconds > 0
                            ? `Extra Waiting at Stop ${currentPassengerStopTimerDisplay.stopDataIndex + 1}`
                            : `Free Waiting at Stop ${currentPassengerStopTimerDisplay.stopDataIndex + 1}`}
                        </span>
                    </ShadAlertTitle>
                    <ShadAlertDescriptionForAlert className="font-bold text-current text-[10px] flex justify-between items-center">
                      <span>
                        {currentPassengerStopTimerDisplay.freeSecondsLeft !== null && currentPassengerStopTimerDisplay.freeSecondsLeft > 0 && "Free time remaining:"}
                        {currentPassengerStopTimerDisplay.extraSeconds !== null && currentPassengerStopTimerDisplay.extraSeconds > 0 && currentPassengerStopTimerDisplay.freeSecondsLeft === 0 && "Extra waiting time:"}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded-sm inline-block font-mono tracking-wider", currentPassengerStopTimerDisplay.extraSeconds && currentPassengerStopTimerDisplay.extraSeconds > 0 ? "bg-accent text-white" : "bg-accent text-white")}>
                          {currentPassengerStopTimerDisplay.freeSecondsLeft !== null && currentPassengerStopTimerDisplay.freeSecondsLeft > 0 ? formatTimerPassenger(currentPassengerStopTimerDisplay.freeSecondsLeft) : formatTimerPassenger(currentPassengerStopTimerDisplay.extraSeconds || 0)}
                      </span>
                      {currentPassengerStopTimerDisplay.extraSeconds !== null && currentPassengerStopTimerDisplay.extraSeconds > 0 && currentPassengerStopTimerDisplay.freeSecondsLeft === 0 && (
                         <span className="ml-1">Current Charge: £{currentPassengerStopTimerDisplay.charge.toFixed(2)}</span>
                      )}
                    </ShadAlertDescriptionForAlert>
                  </Alert>
                )}
                
                {activeRide.driver && ( <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border"> <Image src={activeRide.driverAvatar || `https://placehold.co/48x48.png?text=${activeRide.driver.charAt(0)}`} alt={activeRide.driver} width={48} height={48} className="rounded-full" data-ai-hint="driver avatar" /> <div className="flex-1"> <p className="font-semibold">{activeRide.driver}</p> <p className="text-xs text-muted-foreground">{activeRide.driverVehicleDetails || "Vehicle details N/A"}</p> {activeRide.status === 'driver_assigned' && activeRide.driverEtaMinutes && activeRide.driverEtaMinutes > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">
                      ETA: {activeRide.driverEtaMinutes} min{activeRide.driverEtaMinutes !== 1 ? 's' : ''}
                    </span>
                  </div>
                )} </div> <Button asChild variant="outline" size="sm" className="ml-auto"><Link href="/dashboard/chat" className="flex items-center"><MessageSquare className="w-4 h-4 mr-1.5" /> Chat</Link></Button> </div> )}
                <Separator />
                <div className="text-sm space-y-1"> <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> <strong>From:</strong> {pickupAddressDisplay}</p> {activeRide.stops && activeRide.stops.length > 0 && activeRide.stops.map((stop: LocationPoint, index: number): JSX.Element => (
  <p key={index} className="flex items-start gap-1.5 pl-5"><MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> <strong>Stop {index + 1}:</strong> {stop.address}</p>
))} <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> <strong>To:</strong> {dropoffAddressDisplay}</p> 
                  
                  <div className="flex items-center gap-1.5 bg-green-600 text-white font-bold text-lg rounded-md px-3 py-1.5">
                    <DollarSign className="w-5 h-5 text-white" />
                    <span>Fare: {fareDisplay}</span>
                    {activeRide.isSurgeApplied && (
                      <Badge variant="outline" className="ml-1.5 border-orange-300 text-orange-100 bg-orange-500/50">Surge</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">Booking ID: {activeRide.displayBookingId || activeRide.id}</p>

                <div className="bg-primary/10 p-2 rounded-md border border-black/70 flex items-center gap-1.5"> {activeRide.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : activeRide.paymentMethod === 'cash' ? <Coins className="w-4 h-4 text-muted-foreground" /> : <Briefcase className="w-4 h-4 text-muted-foreground" />} <strong>Payment:</strong> {paymentDisplay} </div> </div>
                 {activeRide.status === 'arrived_at_pickup' && !activeRide.passengerAcknowledgedArrivalTimestamp && ( <Button className="w-full bg-green-600 hover:bg-green-700 text-white mt-2" onClick={() => handleAcknowledgeArrival(activeRide.id)}> <CheckCheck className="mr-2 h-5 w-5" /> Acknowledge Driver Arrival </Button> )}
            </CardContent>
             {activeRide.status === 'pending_assignment' && (
                <CardFooter className="border-t pt-4 flex flex-col sm:flex-row gap-2 bg-primary/10 p-3 rounded-md border-black/70 mt-3">
                  <Button variant="outline" onClick={() => handleOpenEditDetailsDialog(activeRide)} className="w-full sm:w-auto" disabled={isUpdatingDetails || isEditingDisabled}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                  </Button>
                  {isEditingDisabled && (
                    <Alert variant="default" className="w-full text-xs p-2 bg-yellow-50 border-yellow-400 dark:bg-yellow-800/30 dark:border-yellow-700">
                      <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                      <ShadAlertTitle className="text-yellow-700 dark:text-yellow-300 font-semibold">Editing Disabled</ShadAlertTitle>
                      <ShadAlertDescriptionForAlert className="text-yellow-600 dark:text-yellow-400">
                        Ride details cannot be changed once a driver is assigned or the ride is in progress. Please cancel and rebook if major changes are needed.
                      </ShadAlertDescriptionForAlert>
                    </Alert>
                  )}
                </CardFooter>
            )}
          </Card>
        </>
      )}
      <AlertDialog open={showCancelConfirmationDialog} onOpenChange={(isOpen) => { setShowCancelConfirmationDialog(isOpen); if (!isOpen) { setRideIdToCancel(null); if (cancellationSuccess) { setCancellationSuccess(false); } } }}>
        {activeRide && activeRide.status === 'pending_assignment' && (
           <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full sm:w-auto mt-2"
              onClick={() => {
                if (activeRide) {
                    setRideIdToCancel(activeRide.id);
                    setCancellationSuccess(false); 
                    setShowCancelConfirmationDialog(true);
                }
              }}
              disabled={!!actionLoading[activeRide?.id || '']}
            >
              <div className="flex items-center">
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Ride
              </div>
            </Button>
          </AlertDialogTrigger>
        )}
        <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel your ride request (ID: {activeRide?.displayBookingId || rideIdToCancel || 'N/A'}). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={actionLoading[rideIdToCancel || '']}
                >
                  Keep Ride
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmCancel}
                  disabled={!rideIdToCancel || (actionLoading[rideIdToCancel || ''] || false)}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                    {actionLoading[rideIdToCancel || ''] ? (
                        <><Loader2 key="loader-cancel" className="animate-spin mr-2 h-4 w-4" />Cancelling...</>
                    ) : (
                        <><ShieldX key="icon-cancel" className="mr-2 h-4 w-4" />Confirm Cancel</>
                    )}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isEditDetailsDialogOpen} onOpenChange={(open) => { if(!open) {setRideToEditDetails(null); setIsEditDetailsDialogOpen(false); editDetailsForm.reset(); setDialogFareEstimate(null);}}}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] grid grid-rows-[auto_minmax(0,1fr)_auto] p-0">
          <DialogHeader className="p-6 pb-0"> <ShadDialogTitle>Edit Booking Details (ID: {activeRide?.displayBookingId || activeRide?.id || "N/A"})</ShadDialogTitle> <ShadDialogDescriptionDialog>Modify your ride details. Changes only apply if driver not yet assigned.</ShadDialogDescriptionDialog> </DialogHeader>
          <ScrollArea className="overflow-y-auto"> <div className="px-6 py-4"> <Form {...editDetailsForm}> <form id="edit-details-form-actual" onSubmit={editDetailsForm.handleSubmit(onEditDetailsSubmit)} className="space-y-4">
          <FormField control={editDetailsForm.control} name="pickupDoorOrFlat" render={({ field }) => (<FormItem><FormLabel>Pickup Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={editDetailsForm.control} name="pickupLocation" render={({ field }) => ( <FormItem><FormLabel>Pickup Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search pickup" {...field} value={dialogPickupInputValue} onChange={(e) => handleEditAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory('pickupLocation')} onBlur={() => handleEditBlurFactory('pickupLocation')} autoComplete="off" className="pr-8 h-9" /></FormControl> {showDialogPickupSuggestions && renderAutocompleteSuggestions(dialogPickupSuggestions, isFetchingDialogPickupSuggestions, isFetchingDialogPickupDetails, dialogPickupInputValue, (sugg) => handleEditSuggestionClickFactory('pickupLocation')(sugg, field.onChange), "dialog-pickup")}</div><FormMessage /></FormItem> )} />
                  {editStopsFields.map((stopField, index) => ( <div key={stopField.id} className="space-y-1 p-2 border rounded-md bg-muted/50"> <div className="flex justify-between items-center"> <FormLabel className="text-sm">Stop {index + 1}</FormLabel> <Button type="button" variant="ghost" size="sm" onClick={() => removeEditStop(index)} className="text-destructive hover:text-destructive-foreground h-7 px-1.5 text-xs"><XCircle className="mr-1 h-3.5 w-3.5" /> Remove</Button> </div> <FormField control={editDetailsForm.control} name={`stops.${index}.doorOrFlat`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Stop Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} /> <FormField control={editDetailsForm.control} name={`stops.${index}.location`} render={({ field }) => { const currentStopData = dialogStopAutocompleteData[index] || { fieldId: `default-stop-${index}`, inputValue: field.value || "", suggestions: [], showSuggestions: false, coords: null, isFetchingDetails: false, isFetchingSuggestions: false };
                        console.log(`[EditDialog Stop ${index}] Rendering. showSuggestions: ${currentStopData.showSuggestions}, inputValue: "${currentStopData.inputValue}", suggestions count: ${currentStopData.suggestions.length}`);
                        return (<FormItem><FormLabel className="text-xs">Stop Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search stop address" {...field} value={currentStopData.inputValue} onChange={(e) => handleEditAddressInputChangeFactory(index)(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory(index)} onBlur={() => handleEditBlurFactory(index)} autoComplete="off" className="pr-8 h-9"/></FormControl> {currentStopData.showSuggestions && renderAutocompleteSuggestions(currentStopData.suggestions, currentStopData.isFetchingSuggestions, currentStopData.isFetchingDetails, currentStopData.inputValue, (sugg) => handleEditSuggestionClickFactory(index)(sugg, field.onChange), `dialog-stop-${index}`)}</div><FormMessage /></FormItem>); }} /> </div> ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => {appendEditStop({location: "", doorOrFlat: ""}); setDialogStopAutocompleteData(prev => [...prev, {fieldId: `new-stop-${Date.now()}`, inputValue: "", suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null}])}} className="w-full text-accent border-accent hover:bg-accent/10"><PlusCircle className="mr-2 h-4 w-4"/>Add Stop</Button>
                  <FormField control={editDetailsForm.control} name="dropoffDoorOrFlat" render={({ field }) => (<FormItem><FormLabel className="text-xs">Dropoff Door/Flat</FormLabel><FormControl><Input placeholder="Optional" {...field} className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>)} />
                  <FormField control={editDetailsForm.control} name="dropoffLocation" render={({ field }) => ( <FormItem><FormLabel>Dropoff Address</FormLabel><div className="relative"><FormControl><Input placeholder="Search dropoff" {...field} value={dialogDropoffInputValue} onChange={(e) => handleEditAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)} onFocus={() => handleEditFocusFactory('dropoffLocation')} onBlur={() => handleEditBlurFactory('dropoffLocation')} autoComplete="off" className="pr-8 h-9" /></FormControl> {showDialogDropoffSuggestions && renderAutocompleteSuggestions(dialogDropoffSuggestions, isFetchingDialogDropoffSuggestions, isFetchingDialogDropoffDetails, dialogDropoffInputValue, (sugg) => handleEditSuggestionClickFactory('dropoffLocation')(sugg, field.onChange), "dialog-dropoff")}</div><FormMessage /></FormItem> )} />
                  <div className="grid grid-cols-2 gap-4"> <FormField control={editDetailsForm.control} name="desiredPickupDate" render={({ field }) => ( <FormItem><FormLabel>Pickup Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal h-9", !field.value && "text-muted-foreground")}><span className="flex items-center justify-between w-full">{field.value ? format(field.value, "PPP") : <span>ASAP (Pick Date)</span>}<CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" /></span></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} /> <FormField control={editDetailsForm.control} name="desiredPickupTime" render={({ field }) => ( <FormItem><FormLabel>Pickup Time</FormLabel><FormControl><Input type="time" {...field} className="h-9" disabled={!editDetailsForm.watch('desiredPickupDate')} /></FormControl><FormMessage /></FormItem> )} /> </div>
                  {!editDetailsForm.watch('desiredPickupDate') && <p className="text-xs text-muted-foreground text-center">Leave date/time blank for ASAP booking.</p>}
                  
                  {dialogFareEstimate !== null && (
                    <div className="mt-2 p-2 border rounded-md bg-muted/20 text-center">
                      <p className="text-sm text-muted-foreground">New Est. Fare (Route Only): <span className="font-semibold text-primary">£{dialogFareEstimate.toFixed(2)}</span></p>
                      <p className="text-xs text-muted-foreground">(Other factors like priority/surge from original booking may still apply)</p>
                    </div>
                  )}

                </form> </Form> </div> </ScrollArea>
          <DialogFooter className="p-6 pt-4 border-t"> 
            <DialogClose asChild><Button type="button" variant="outline" disabled={isUpdatingDetails}>Cancel</Button></DialogClose>
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
          <DialogHeader>
            <ShadDialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary"/> Request Wait & Return</ShadDialogTitle>
            <ShadDialogDescriptionDialog>
              Estimate additional waiting time at current drop-off. 10 mins free, then £0.25/min. Passenger must approve.
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
    </div>
  );
}
    




"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Car, Users, Loader2, Zap, PlusCircle, XCircle, Calendar as CalendarIcon, Clock, Star, Save, List, Trash2, User as UserIcon, Home as HomeIcon, MapPin as StopMarkerIcon, Building, AlertTriangle, Info, CheckCircle2, Wifi, BadgeCheck, ShieldAlert, LocateFixed, Mic, CalendarClock, StickyNote, RefreshCwIcon, Crown, Ticket, CreditCard, Coins, Briefcase, Send, DollarSign, Timer, LockKeyhole } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader as GoogleApiLoader } from '@googlemaps/js-api-loader'; // Renamed to avoid conflict
import { useAuth } from '@/contexts/auth-context';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { parseBookingRequest } from '@/ai/flows/parse-booking-request-flow';
import { useSearchParams, useRouter } from 'next/navigation';
import { Switch } from "@/components/ui/switch";
import { useOperators } from '@/hooks/useOperators';
import { useNearbyDrivers } from '@/hooks/useNearbyDrivers';
import Link from 'next/link';
import * as React from 'react';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

interface FavoriteLocation {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface SavedRouteLocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}
interface SavedRoute {
  id: string;
  label: string;
  pickupLocation: SavedRouteLocationPoint;
  dropoffLocation: SavedRouteLocationPoint;
  stops?: SavedRouteLocationPoint[];
}

interface MapMarker {
  position: google.maps.LatLngLiteral;
  title?: string;
  label?: string | google.maps.MarkerLabel;
  iconUrl?: string;
  iconScaledSize?: { width: number; height: number };
}

type GeolocationFetchStatus =
  | "idle"
  | "fetching"
  | "success"
  | "error_permission"
  | "error_accuracy_moderate"
  | "error_accuracy_poor"
  | "error_geocoding"
  | "error_unavailable";

const bookingFormSchema = z.object({
  pickupDoorOrFlat: z.string().max(50, {message: "Door/Flat info too long."}).optional(),
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffDoorOrFlat: z.string().max(50, {message: "Door/Flat info too long."}).optional(),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array(
    z.object({
      doorOrFlat: z.string().max(50, {message: "Door/Flat info too long."}).optional(),
      location: z.string().min(3, { message: "Stop location must be at least 3 characters." })
    })
  ).optional(),
  bookingType: z.enum(["asap", "scheduled"], { required_error: "Please select a booking type."}),
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(),
  vehicleType: z.enum([
    "car", "estate", "minibus_6", "minibus_8",
    "pet_friendly_car", "disable_wheelchair_access",
    "minibus_6_pet_friendly", "minibus_8_pet_friendly"
  ], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
  driverNotes: z.string().max(200, { message: "Notes cannot exceed 200 characters."}).optional(),
  waitAndReturn: z.boolean().default(false),
  estimatedWaitTimeMinutes: z.number().int().min(0).optional(),
  isPriorityPickup: z.boolean().optional().default(false),
  priorityFeeAmount: z.number().min(0, "Priority fee cannot be negative.").optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["card", "cash", "account"], { required_error: "Please select a payment method." }), 
}).superRefine((data, ctx) => {
  if (data.bookingType === "scheduled") {
    if (!data.desiredPickupDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup date is required for scheduled bookings.",
        path: ["desiredPickupDate"],
      });
    }
    if (!data.desiredPickupTime || data.desiredPickupTime.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup time is required for scheduled bookings.",
        path: ["desiredPickupTime"],
      });
    }
  }
  if (data.waitAndReturn && (data.estimatedWaitTimeMinutes === undefined || data.estimatedWaitTimeMinutes < 0)) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated wait time is required for Wait & Return journeys.",
        path: ["estimatedWaitTimeMinutes"],
    });
  }
  if (data.isPriorityPickup && (data.priorityFeeAmount === undefined || data.priorityFeeAmount <= 0)) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A positive Priority Fee amount is required if Priority Pickup is selected.",
        path: ["priorityFeeAmount"],
    });
  }
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

type AutocompleteData = {
  fieldId: string;
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
};

const huddersfieldCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const BASE_FARE = 0.00;
const PER_MILE_RATE = 1.00;
const FIRST_MILE_SURCHARGE = 1.99;
const PER_MINUTE_RATE = 0.10;
const AVERAGE_SPEED_MPH = 15;
const BOOKING_FEE = 0.75;
const MINIMUM_FARE = 4.00;
const SURGE_MULTIPLIER_VALUE = 1.5;
const PER_STOP_SURCHARGE = 0.50;
const WAIT_AND_RETURN_SURCHARGE_PERCENTAGE = 0.70;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION = 10;
const WAITING_CHARGE_PER_MINUTE_AT_DESTINATION = 0.20;
const PET_FRIENDLY_SURCHARGE = 2.00;


function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function getDistanceInMiles(
  coords1: google.maps.LatLngLiteral | null,
  coords2: google.maps.LatLngLiteral | null
): number {
  if (!coords1 || !coords2) return 0;
  const R = 6371;
  const dLat = deg2rad(coords2.lat - coords1.lat);
  const dLon = deg2rad(coords2.lng - coords1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coords1.lat)) * Math.cos(deg2rad(coords2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d * 0.621371;
}

type AvailabilityStatusLevel = 'available' | 'high_demand' | 'unavailable' | 'loading' | 'fallback' | 'error';

const passengerLocationIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 34">
  <circle cx="12" cy="12" r="11" fill="#2D3748"/>
  <circle cx="12" cy="9.5" r="3" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>
  <path d="M8,15 Q12,12.5 16,15" stroke="#FFFFFF" stroke-width="1.5" fill="none" transform="translate(0, -0.5)"/>
  <line x1="12" y1="23" x2="12" y2="30" stroke="#2D3748" stroke-width="3"/>
  <circle cx="12" cy="31.5" r="2.5" fill="#2D3748"/>
</svg>
`;


// Fix for linter: declare window for TypeScript
declare const window: any;

// Fix for linter: declare window for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function BookRidePage() {
  const [baseFareEstimate, setBaseFareEstimate] = useState<number | null>(null);
  const [totalFareEstimate, setTotalFareEstimate] = useState<number | null>(null);


  const { toast } = useToast();
  const { user, phoneVerificationRequired } = useAuth();
  const router = useRouter();
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const [isSurgeActive, setIsSurgeActive] = useState(false);
  const [currentSurgeMultiplier, setCurrentSurgeMultiplier] = useState(1);
  const [isOperatorSurgeEnabled, setIsOperatorSurgeEnabled] = useState<boolean>(false);
  const [isLoadingSurgeSetting, setIsLoadingSurgeSetting] = useState<boolean>(true);


  const [stopAutocompleteData, setStopAutocompleteData] = useState<AutocompleteData[]>([]);
  const [isBooking, setIsBooking] = useState(false);


  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isLoadingSavedRoutes, setIsLoadingSavedRoutes] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isDeletingRouteId, setIsDeletingRouteId] = useState<string | null>(null);
  const [saveRouteDialogOpen, setSaveRouteDialogOpen] = useState(false);
  const [newRouteLabel, setNewRouteLabel] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const recognitionRef = useRef<Window['SpeechRecognition'] | Window['webkitSpeechRecognition'] | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);



  const [suggestedGpsPickup, setSuggestedGpsPickup] = useState<{ address: string, coords: google.maps.LatLngLiteral, accuracy: number } | null>(null);
  const [geolocationFetchStatus, setGeolocationFetchStatus] = useState<GeolocationFetchStatus>("idle");
  const [showGpsSuggestionAlert, setShowGpsSuggestionAlert] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [availabilityStatusLevel, setAvailabilityStatusLevel] = useState<AvailabilityStatusLevel>('loading');
  const [mapBusynessLevel, setMapBusynessLevel] = useState<'idle' | 'moderate' | 'high'>('idle');
  

  const searchParams = useSearchParams();
  const operatorPreference = searchParams.get('operator_preference');

  const [isWaitTimeDialogOpen, setIsWaitTimeDialogOpen] = useState(false);
  const [estimatedWaitMinutesInput, setEstimatedWaitMinutesInput] = useState<string>("10");
  const [calculatedChargedWaitMinutes, setCalculatedChargedWaitMinutes] = useState<number>(0);
  const waitTimeInputRef = useRef<HTMLInputElement>(null);

  const [isPriorityFeeDialogOpen, setIsPriorityFeeDialogOpen] = useState(false);
  const [priorityFeeInput, setPriorityFeeInput] = useState<string>("2.00");
  const priorityFeeInputRef = useRef<HTMLInputElement>(null);

  const [isMapSdkLoaded, setIsMapSdkLoaded] = useState(false);

  // State for Account Job PIN
  const [isAccountJobAuthPinDialogOpen, setIsAccountJobAuthPinDialogOpen] = useState(false);
  const [accountJobAuthPinInput, setAccountJobAuthPinInput] = useState("");
  const [isAccountJobAuthPinVerified, setIsAccountJobAuthPinVerified] = useState(false);
  const [previousPaymentMethod, setPreviousPaymentMethod] = useState<BookingFormValues["paymentMethod"]>("card");
  const [accountJobAuthPinInputType, setAccountJobAuthPinInputType] = useState<'password' | 'text'>('password');
  const pinPeekTimeoutRef = useRef<NodeJS.Timeout | null>(null);



  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupDoorOrFlat: "",
      pickupLocation: "",
      dropoffDoorOrFlat: "",
      dropoffLocation: "",
      stops: [],
      bookingType: "asap",
      desiredPickupDate: undefined,
      desiredPickupTime: "",
      vehicleType: "car",
      passengers: 1,
      driverNotes: "",
      waitAndReturn: false,
      estimatedWaitTimeMinutes: undefined,
      isPriorityPickup: false,
      priorityFeeAmount: undefined,
      promoCode: "",
      paymentMethod: "card",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "stops",
  });
  
  const previousFieldsLengthRef = useRef(fields.length);

  useEffect(() => {
    if (fields.length > previousFieldsLengthRef.current) {
      const newStopIndex = fields.length - 1;
      setTimeout(() => {
        form.setFocus(`stops.${newStopIndex}.location`);
      }, 100);
    }
    previousFieldsLengthRef.current = fields.length;
  }, [fields, form]);


  const watchedPaymentMethod = form.watch("paymentMethod");
  const watchedWaitAndReturn = form.watch("waitAndReturn");
  const watchedEstimatedWaitTimeMinutes = form.watch("estimatedWaitTimeMinutes");
  const watchedIsPriorityPickup = form.watch("isPriorityPickup");
  const watchedPriorityFeeAmount = form.watch("priorityFeeAmount");


  const [pickupInputValue, setPickupInputValue] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [isFetchingPickupSuggestions, setIsFetchingPickupSuggestions] = useState(false);
  const [isFetchingPickupDetails, setIsFetchingPickupDetails] = useState(false);

  const [dropoffInputValue, setDropoffInputValue] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [isFetchingDropoffSuggestions, setIsFetchingDropoffSuggestions] = useState(false);
  const [isFetchingDropoffDetails, setIsFetchingDropoffDetails] = useState(false);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);


  useEffect(() => {
    if (isWaitTimeDialogOpen && waitTimeInputRef.current) {
      waitTimeInputRef.current.focus();
      waitTimeInputRef.current.select();
    }
  }, [isWaitTimeDialogOpen]);

  useEffect(() => {
    if (isPriorityFeeDialogOpen && priorityFeeInputRef.current) {
      priorityFeeInputRef.current.focus();
      priorityFeeInputRef.current.select();
    }
  }, [isPriorityFeeDialogOpen]);

  // Move this block to the top of the component, before any useEffect that uses drivers, loadingDrivers, or errorDrivers
  const operatorCode = operatorPreference || 'OP001';
  const isMyBaseApp = !operatorPreference || operatorPreference === 'OP001';
  const { drivers, loading: loadingDrivers, error: errorDrivers, usedFallback } = useNearbyDrivers(
    pickupCoords ?? undefined,
    operatorCode,
    isMyBaseApp
  );

 useEffect(() => {
    if (loadingDrivers) {
      setAvailabilityStatusLevel('loading');
      setAvailabilityStatusMessage('Checking availability in your area...');
    } else if (errorDrivers) {
      setAvailabilityStatusLevel('unavailable');
      setAvailabilityStatusMessage('Error loading driver availability.');
    } else if (drivers.length === 0) {
      setAvailabilityStatusLevel('unavailable');
      setAvailabilityStatusMessage('No drivers are currently available in your area. Please try again later.');
    } else {
      setAvailabilityStatusLevel('available');
      setAvailabilityStatusMessage(`${drivers.length} driver${drivers.length > 1 ? 's' : ''} available in your area.`);
    }
  }, [drivers, loadingDrivers, errorDrivers]);


  useEffect(() => {
    const busynessLevels: Array<'idle' | 'moderate' | 'high'> = ['idle', 'moderate', 'high'];
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % busynessLevels.length;
      setMapBusynessLevel(busynessLevels[currentIndex]);
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);


  useEffect(() => {
    setIsLoadingSurgeSetting(true);
    fetch('/api/operator/settings/pricing') 
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch surge settings");
            return res.json();
        })
        .then(data => setIsOperatorSurgeEnabled(data.enableSurgePricing || false))
        .catch(err => {
            console.warn("Could not load surge pricing settings from operator, defaulting to false:", err.message);
            setIsOperatorSurgeEnabled(false);
        })
        .finally(() => setIsLoadingSurgeSetting(false));
  }, []);


  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        console.warn("Google Maps API Key missing. Address autocomplete and geolocation will not work.");
        toast({ title: "Configuration Error", description: "Maps API key missing. Address search disabled.", variant: "destructive" });
        setIsMapSdkLoaded(false);
        return;
    }
    const loader = new GoogleApiLoader({ 
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["geocoding", "maps", "marker", "places", "geometry", "routes"], // Standardized libraries
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const mapDivForPlaces = document.createElement('div'); 
      placesServiceRef.current = new google.maps.places.PlacesService(mapDivForPlaces);
      geocoderRef.current = new google.maps.Geocoder();
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      setIsMapSdkLoaded(true);

      if (navigator.geolocation) {
        setGeolocationFetchStatus("fetching");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
            setGeolocationFetchStatus("success");
            if (geocoderRef.current) {
                geocoderRef.current.geocode({ location: currentCoords }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        setSuggestedGpsPickup({ address: results[0].formatted_address, coords: currentCoords, accuracy: position.coords.accuracy });
                        setShowGpsSuggestionAlert(true);
                    } else {
                        console.warn("Geocoding failed for current location:", status);
                        setShowGpsSuggestionAlert(false);
                        setGeolocationFetchStatus("error_geocoding");
                    }
                });
            }
          },
          (error) => {
            console.warn("Geolocation error:", error);
            let fetchErrorStatus: GeolocationFetchStatus = "error_unavailable";
            if (error.code === error.PERMISSION_DENIED) fetchErrorStatus = "error_permission";
            else if (error.code === error.POSITION_UNAVAILABLE) fetchErrorStatus = "error_unavailable";
            else if (error.code === error.TIMEOUT) fetchErrorStatus = "error_unavailable"; 
            setGeolocationFetchStatus(fetchErrorStatus);
            setShowGpsSuggestionAlert(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        setGeolocationFetchStatus("error_unavailable");
        setShowGpsSuggestionAlert(false);
      }
    }).catch(e => {
        console.error("Failed to load Google Maps API for address search:", e);
        toast({ title: "Error", description: "Could not load address search functionality.", variant: "destructive"});
        setIsMapSdkLoaded(false);
    });
  }, [toast]);

  // 1. Place all useMemo hooks for icons here
  const driverCarIconDataUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
      <path d="M20 50 L15 35 H25 Z" fill="black"/>
      <circle cx="20" cy="18" r="15" fill="#FFD700" stroke="black" stroke-width="2"/>
      <rect x="18" y="8" width="4" height="3" fill="black" rx="1"/>
      <rect x="14" y="12" width="12" height="6" fill="white" stroke="black" stroke-width="1" rx="2"/>
      <rect x="15" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
      <rect x="22" y="13" width="3" height="3" fill="#87CEEB" rx="1"/>
      <circle cx="16" cy="20" r="2" fill="black"/>
      <circle cx="24" cy="20" r="2" fill="black"/>
      <rect x="19" y="10" width="2" height="1" fill="#FF6B35"/>
    </svg>`;
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }, []);

  const passengerLocationIconDataUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 34">
      <circle cx="12" cy="12" r="11" fill="#2D3748"/>
      <circle cx="12" cy="9.5" r="3" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>
      <path d="M8,15 Q12,12.5 16,15" stroke="#FFFFFF" stroke-width="1.5" fill="none" transform="translate(0, -0.5)"/>
      <line x1="12" y1="23" x2="12" y2="30" stroke="#2D3748" stroke-width="3"/>
      <circle cx="12" cy="31.5" r="2.5" fill="#2D3748"/>
    </svg>`;
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }, []);

  const dropoffIconDataUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='40' viewBox='0 0 24 34'>
      <circle cx='12' cy='12' r='11' fill='#B91C1C'/>
      <text x='12' y='18' text-anchor='middle' font-size='16' fill='white' font-family='Arial' font-weight='bold'>D</text>
      <line x1='12' y1='23' x2='12' y2='30' stroke='#B91C1C' stroke-width='3'/>
      <circle cx='12' cy='31.5' r='2.5' fill='#B91C1C'/>
    </svg>`;
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }, []);

  const stopIconDataUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    // S will be replaced with S1, S2, etc. dynamically
    return (label: string) => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='40' viewBox='0 0 24 34'>
        <circle cx='12' cy='12' r='11' fill='#F59E42'/>
        <text x='12' y='18' text-anchor='middle' font-size='16' fill='white' font-family='Arial' font-weight='bold'>${label}</text>
        <line x1='12' y1='23' x2='12' y2='30' stroke='#F59E42' stroke-width='3'/>
        <circle cx='12' cy='31.5' r='2.5' fill='#F59E42'/>
      </svg>`;
      return `data:image/svg+xml;base64,${window.btoa(svg)}`;
    };
  }, []);

  // 2. Now place the useEffect for mapMarkers here, after the useMemo hooks
  useEffect(() => {
    const markers: MapMarker[] = [];
    if (pickupCoords && passengerLocationIconDataUrl) {
      markers.push({
        position: pickupCoords,
        title: 'Pickup Location',
        label: 'P',
        iconUrl: passengerLocationIconDataUrl,
        iconScaledSize: { width: 28, height: 40 },
      });
    }
    if (dropoffCoords && dropoffIconDataUrl) {
      markers.push({
        position: dropoffCoords,
        title: 'Drop-off Location',
        label: 'D',
        iconUrl: dropoffIconDataUrl,
        iconScaledSize: { width: 28, height: 40 },
      });
    }
    if (stopAutocompleteData && stopAutocompleteData.length > 0 && stopIconDataUrl) {
      stopAutocompleteData.forEach((stop, idx) => {
        if (stop.coords) {
          markers.push({
            position: stop.coords,
            title: `Stop ${idx + 1}`,
            label: `S${idx + 1}`,
            iconUrl: stopIconDataUrl(`S${idx + 1}`),
            iconScaledSize: { width: 28, height: 40 },
          });
        }
      });
    }
    if (drivers && drivers.length > 0 && driverCarIconDataUrl) {
      markers.push(
        ...drivers.map(driver => ({
          position: driver.location,
          title: driver.name ? `Driver: ${driver.name}` : 'Available Driver',
          iconUrl: driverCarIconDataUrl,
          iconScaledSize: { width: 40, height: 50 },
        }))
      );
    }
    setMapMarkers(markers);
  }, [drivers, pickupCoords, dropoffCoords, stopAutocompleteData, driverCarIconDataUrl, passengerLocationIconDataUrl, dropoffIconDataUrl, stopIconDataUrl]);


  const handleManualGpsRequest = async () => {
    if (!isMapSdkLoaded || !navigator.geolocation || !geocoderRef.current) {
      toast({ title: "Geolocation Not Ready", description: "Location services are not available or still initializing.", variant: "default" });
      setGeolocationFetchStatus("error_unavailable");
      return;
    }
    setGeolocationFetchStatus("fetching");
    setShowGpsSuggestionAlert(false); // Hide previous suggestion if any
    setSuggestedGpsPickup(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: currentCoords }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              setSuggestedGpsPickup({ address: results[0].formatted_address, coords: currentCoords, accuracy: position.coords.accuracy });
              setShowGpsSuggestionAlert(true);
              setGeolocationFetchStatus("success"); // Set success after geocoding
              toast({ title: "Location Found!", description: `GPS suggests: ${results[0].formatted_address}. Accuracy: ${position.coords.accuracy.toFixed(0)}m.` });
            } else {
              setGeolocationFetchStatus("error_geocoding");
              toast({ title: "Geocoding Failed", description: `Could not determine address for your location. Status: ${status}`, variant: "destructive" });
            }
          });
        } else {
            setGeolocationFetchStatus("error_geocoding");
            toast({ title: "Geocoder Not Ready", description: "Address lookup service is not available.", variant: "destructive" });
        }
      },
      (error) => {
        console.warn("Manual Geolocation error:", error);
        let fetchErrorStatus: GeolocationFetchStatus = "error_unavailable";
        let toastMessage = "Could not get your location.";
        if (error.code === error.PERMISSION_DENIED) { fetchErrorStatus = "error_permission"; toastMessage = "Location permission denied."; }
        else if (error.code === error.POSITION_UNAVAILABLE) { fetchErrorStatus = "error_unavailable"; toastMessage = "Location information unavailable."; }
        else if (error.code === error.TIMEOUT) { fetchErrorStatus = "error_unavailable"; toastMessage = "Getting location timed out."; }
        setGeolocationFetchStatus(fetchErrorStatus);
        toast({ title: "Location Error", description: toastMessage, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // force fresh location
    );
  };


  const handleApplyGpsSuggestion = () => {
    if (suggestedGpsPickup && suggestedGpsPickup.accuracy <= 75) { 
      form.setValue('pickupLocation', suggestedGpsPickup.address);
      setPickupInputValue(suggestedGpsPickup.address);
      setPickupCoords(suggestedGpsPickup.coords);
      setShowPickupSuggestions(false);
      setShowGpsSuggestionAlert(false);
      setGeolocationFetchStatus('success');
      let toastDescription = `Pickup set to: ${suggestedGpsPickup.address}.`;
      if (suggestedGpsPickup.accuracy > 20 && suggestedGpsPickup.accuracy <= 75) {
        toastDescription += ` (Moderate accuracy: ${suggestedGpsPickup.accuracy.toFixed(0)}m. Please double check.)`;
      }
      toast({ title: "GPS Location Applied", description: toastDescription});
    }
  };

  const fetchUserFavoriteLocations = useCallback(async () => {
    if (!user) return;
    setIsLoadingFavorites(true);
    try {
      const response = await fetch(`/api/users/favorite-locations/list?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch favorites');
      const data = await response.json();
      setFavoriteLocations(data.favoriteLocations || []);
    } catch (error) {
      toast({ title: "Error", description: "Could not load favorite locations.", variant: "destructive" });
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [user, toast]);

  const fetchUserSavedRoutes = useCallback(async () => {
    if (!user) return;
    setIsLoadingSavedRoutes(true);
    try {
      const response = await fetch(`/api/users/saved-routes/list?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch saved routes');
      const data = await response.json();
      setSavedRoutes(data.savedRoutes || []);
    } catch (error) {
      toast({ title: "Error", description: "Could not load saved routes.", variant: "destructive" });
    } finally {
      setIsLoadingSavedRoutes(false);
    }
  }, [user, toast]);


  useEffect(() => {
    fetchUserFavoriteLocations();
    fetchUserSavedRoutes();
  }, [fetchUserFavoriteLocations, fetchUserSavedRoutes]);


  const fetchAddressSuggestions = useCallback((
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
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: inputValue,
        sessionToken: autocompleteSessionTokenRef.current,
        componentRestrictions: { country: 'gb' }
      },
      (predictions, status) => {
        setIsFetchingFunc(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestionsFunc(predictions);
        } else {
          setSuggestionsFunc([]);
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
             console.warn("Autocomplete prediction error:", status);
          }
        }
      }
    );
  }, [isMapSdkLoaded]);

  const handleAddressInputChangeFactory = useCallback((
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number
  ) => (
    inputValue: string,
    formOnChange: (value: string) => void,
  ) => {
    formOnChange(inputValue);
    setBaseFareEstimate(null);
    setTotalFareEstimate(null);
    setEstimatedDistance(null);
    setEstimatedDurationMinutes(null);
    if (formFieldNameOrStopIndex === 'pickupLocation') {
      setShowGpsSuggestionAlert(false);
      setGeolocationFetchStatus('idle');
    }

    if (typeof formFieldNameOrStopIndex === 'number') {
      setStopAutocompleteData(prev => prev.map((item, idx) =>
        idx === formFieldNameOrStopIndex
        ? { ...item, inputValue, coords: null, suggestions: inputValue.length >= 2 ? item.suggestions : [], showSuggestions: inputValue.length >=2, isFetchingSuggestions: inputValue.length >=2 }
        : item
      ));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
      setPickupInputValue(inputValue);
      setPickupCoords(null);
      setShowPickupSuggestions(inputValue.length >=2);
      if(inputValue.length >=2) {
        setIsFetchingPickupSuggestions(true);
        setPickupSuggestions([]);
      } else {
        setIsFetchingPickupSuggestions(false);
        setPickupSuggestions([]);
      }
    } else {
      setDropoffInputValue(inputValue);
      setDropoffCoords(null);
      setShowDropoffSuggestions(inputValue.length >=2);
       if(inputValue.length >=2) {
        setIsFetchingDropoffSuggestions(true);
        setDropoffSuggestions([]);
      } else {
        setIsFetchingDropoffSuggestions(false);
        setDropoffSuggestions([]);
      }
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (inputValue.length < 2) return;

    debounceTimeoutRef.current = setTimeout(() => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        fetchAddressSuggestions(inputValue,
          (sugg) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg } : item)),
          (fetch) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingSuggestions: fetch } : item))
        );
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        fetchAddressSuggestions(inputValue, setPickupSuggestions, setIsFetchingPickupSuggestions);
      } else {
        fetchAddressSuggestions(inputValue, setDropoffSuggestions, setIsFetchingDropoffSuggestions);
      }
    }, 300);
  }, [fetchAddressSuggestions]);


  const handleSuggestionClickFactory = useCallback((
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number
  ) => (
    suggestion: google.maps.places.AutocompletePrediction,
    formOnChange: (value: string) => void,
  ) => {
    const addressText = suggestion?.description;
     if (!addressText) {
      console.error("Suggestion or description is missing for field/index:", formFieldNameOrStopIndex, "Suggestion:", suggestion);
      toast({
        title: "Selection Error",
        description: "Could not process the selected address details. Please try again.",
        variant: "destructive",
      });
      if (typeof formFieldNameOrStopIndex === 'string') {
        if (formFieldNameOrStopIndex === 'pickupLocation') {
          setPickupInputValue(prev => form.getValues('pickupLocation') || prev);
          setPickupCoords(null); setShowPickupSuggestions(false);
          setShowGpsSuggestionAlert(false); setGeolocationFetchStatus('idle');
        } else {
          setDropoffInputValue(prev => form.getValues('dropoffLocation') || prev);
          setDropoffCoords(null); setShowDropoffSuggestions(false);
        }
      } else {
        const stopIndex = formFieldNameOrStopIndex;
        setStopAutocompleteData(prev => prev.map((item, idx) =>
          idx === stopIndex
          ? { ...item, inputValue: form.getValues(`stops.${stopIndex}.location`) || item.inputValue, coords: null, showSuggestions: false }
          : item
        ));
      }
      return;
    }

    const setIsFetchingDetailsFunc = (isFetching: boolean) => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingDetails: isFetching } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setIsFetchingPickupDetails(isFetching);
      } else {
        setIsFetchingDropoffDetails(isFetching);
      }
    };

    const setCoordsFunc = (coords: google.maps.LatLngLiteral | null) => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, coords, inputValue: addressText, showSuggestions: false } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setPickupCoords(coords);
        setPickupInputValue(addressText);
        setShowPickupSuggestions(false);
        setShowGpsSuggestionAlert(false);
        setGeolocationFetchStatus('idle');
      } else {
        setDropoffCoords(coords);
        setDropoffInputValue(addressText);
        setShowDropoffSuggestions(false);
      }
    };

    setIsFetchingDetailsFunc(true);
    if (isMapSdkLoaded && placesServiceRef.current && suggestion.place_id) {
      placesServiceRef.current.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['geometry.location', 'formatted_address', 'address_components'],
          sessionToken: autocompleteSessionTokenRef.current
        },
        (place, status) => {
          setIsFetchingDetailsFunc(false);
          const finalAddressToSet = addressText; 
          formOnChange(finalAddressToSet);

          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setCoordsFunc({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            
             if (typeof formFieldNameOrStopIndex === 'number') {
                setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, inputValue: finalAddressToSet, showSuggestions: false } : item));
            } else if (formFieldNameOrStopIndex === 'pickupLocation') {
                setPickupInputValue(finalAddressToSet); setShowPickupSuggestions(false);
            } else {
                setDropoffInputValue(finalAddressToSet); setShowDropoffSuggestions(false);
            }

            toast({ title: "Location Selected", description: `${finalAddressToSet} coordinates captured.`});
          } else {
            toast({ title: "Error", description: "Could not get location details. Please try again.", variant: "destructive"});
            setCoordsFunc(null);
             if (typeof formFieldNameOrStopIndex === 'number') {
                setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, inputValue: finalAddressToSet, showSuggestions: false } : item));
            } else if (formFieldNameOrStopIndex === 'pickupLocation') {
                setPickupInputValue(finalAddressToSet); setShowPickupSuggestions(false);
            } else {
                setDropoffInputValue(finalAddressToSet); setShowDropoffSuggestions(false);
            }
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else {
      setIsFetchingDetailsFunc(false);
      formOnChange(addressText); 
      setCoordsFunc(null);
       if (typeof formFieldNameOrStopIndex === 'number') {
          setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, inputValue: addressText, showSuggestions: false } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
          setPickupInputValue(addressText); setShowPickupSuggestions(false);
      } else {
          setDropoffInputValue(addressText); setShowDropoffSuggestions(false);
      }
      toast({ title: "Warning", description: "Could not fetch location details (missing place ID or service).", variant: "default" });
    }
  }, [toast, placesServiceRef, autocompleteSessionTokenRef, form, isMapSdkLoaded]);


  const handleFocusFactory = (formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    let currentInputValue: string;
    let currentSuggestions: google.maps.places.AutocompletePrediction[];

    if (typeof formFieldNameOrStopIndex === 'number') {
        const stopData = stopAutocompleteData[formFieldNameOrStopIndex];
        if (!stopData) return;
        currentInputValue = stopData.inputValue;
        currentSuggestions = stopData.suggestions;
        if (currentInputValue.length >= 2 && currentSuggestions.length > 0) {
             setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: true } : item));
        } else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteServiceRef.current) {
            fetchAddressSuggestions(currentInputValue,
                (sugg) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg, showSuggestions: true } : item)),
                (fetch) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingSuggestions: fetch } : item))
            );
        } else {
             setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: false } : item));
        }
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        currentInputValue = pickupInputValue;
        currentSuggestions = pickupSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowPickupSuggestions(true);
        else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteServiceRef.current) {
            fetchAddressSuggestions(currentInputValue, setPickupSuggestions, setIsFetchingPickupSuggestions);
            setShowPickupSuggestions(true);
        } else setShowPickupSuggestions(false);
    } else {
        currentInputValue = dropoffInputValue;
        currentSuggestions = dropoffSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowDropoffSuggestions(true);
        else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteServiceRef.current) {
            fetchAddressSuggestions(currentInputValue, setDropoffSuggestions, setIsFetchingDropoffSuggestions);
            setShowDropoffSuggestions(true);
        } else setShowDropoffSuggestions(false);
    }
  };

  const handleBlurFactory = (formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    setTimeout(() => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: false } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setShowPickupSuggestions(false);
      } else {
        setShowDropoffSuggestions(false);
      }
    }, 150);
  };

  const handleFavoriteSelectFactory = (
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number,
    formOnChange: (value: string) => void,
    doorOrFlatFormFieldName?: `pickupDoorOrFlat` | `dropoffDoorOrFlat` | `stops.${number}.doorOrFlat`
  ) => (fav: FavoriteLocation) => {
    formOnChange(fav.address);
    const newCoords = { lat: fav.latitude, lng: fav.longitude };
    if (doorOrFlatFormFieldName) {
        form.setValue(doorOrFlatFormFieldName, "");
    }


    if (typeof formFieldNameOrStopIndex === 'number') {
      const stopIndex = formFieldNameOrStopIndex;
      setStopAutocompleteData(prev => prev.map((item, idx) =>
        idx === stopIndex
          ? { ...item, inputValue: fav.address, coords: newCoords, suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false }
          : item
      ));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
      setPickupInputValue(fav.address);
      setPickupCoords(newCoords);
      setShowPickupSuggestions(false);
      setShowGpsSuggestionAlert(false);
      setGeolocationFetchStatus('idle');
    } else {
      setDropoffInputValue(fav.address);
      setDropoffCoords(newCoords);
      setShowDropoffSuggestions(false);
    }
    toast({ title: "Favorite Applied", description: `${fav.label}: ${fav.address} selected.` });
  };

  const watchedVehicleType = form.watch("vehicleType");
  const watchedPassengers = form.watch("passengers");
  const watchedStops = form.watch("stops");
  const watchedBookingType = form.watch("bookingType");


  const handleAddStop = () => {
    append({ location: "", doorOrFlat: ""});
    setStopAutocompleteData(prev => [...prev, {
      fieldId: `stop-${Date.now()}`, 
      inputValue: "",
      suggestions: [],
      showSuggestions: false,
      isFetchingSuggestions: false,
      isFetchingDetails: false,
      coords: null
    }]);
  };


  const handleRemoveStop = (index: number) => {
    remove(index);
    setStopAutocompleteData(prev => prev.filter((_, i) => i !== index));
  };

  const anyFetchingDetails = isFetchingPickupDetails || isFetchingDropoffDetails || stopAutocompleteData.some(s => s.isFetchingDetails);
  const validStopsForFare = stopAutocompleteData.filter((stopData, index) => {
    const formStopValue = form.getValues(`stops.${index}.location`);
    return stopData.coords && formStopValue && formStopValue.trim() !== "";
  });


  useEffect(() => {
    let oneWayDistanceMiles = 0;

    if (pickupCoords && dropoffCoords && !isLoadingSurgeSetting) {
      let currentPoint = pickupCoords;
      for (const stopData of validStopsForFare) {
        if (stopData.coords) {
          oneWayDistanceMiles += getDistanceInMiles(currentPoint, stopData.coords);
          currentPoint = stopData.coords;
        }
      }
      oneWayDistanceMiles += getDistanceInMiles(currentPoint, dropoffCoords);

      let totalDistanceForDisplay = oneWayDistanceMiles;
      if (watchedWaitAndReturn) {
        totalDistanceForDisplay *= 2;
      }
      setEstimatedDistance(parseFloat(totalDistanceForDisplay.toFixed(2)));

      const oneWayDurationMinutes = (oneWayDistanceMiles / AVERAGE_SPEED_MPH) * 60;
      let totalDurationForDisplay = oneWayDurationMinutes;
       if (watchedWaitAndReturn) {
        totalDurationForDisplay = (oneWayDistanceMiles * 2 / AVERAGE_SPEED_MPH) * 60;
      }
      setEstimatedDurationMinutes(totalDistanceForDisplay > 0 ? parseFloat(totalDurationForDisplay.toFixed(0)) : null);


      const potentialSurgeConditionsMet = Math.random() < 0.3;
      const actualSurgeIsActive = isOperatorSurgeEnabled && potentialSurgeConditionsMet;
      setIsSurgeActive(actualSurgeIsActive);

      const surgeMultiplierToApply = actualSurgeIsActive ? SURGE_MULTIPLIER_VALUE : 1;
      setCurrentSurgeMultiplier(surgeMultiplierToApply);

      let calculatedFareBeforeMultipliers = 0;

      if (oneWayDistanceMiles <= 0) {
        calculatedFareBeforeMultipliers = 0;
      } else {
        const timeFareOneWay = oneWayDurationMinutes * PER_MINUTE_RATE;
        const distanceBasedFareOneWay = (oneWayDistanceMiles * PER_MILE_RATE) + (oneWayDistanceMiles > 0 ? FIRST_MILE_SURCHARGE : 0);
        const stopSurchargeAmount = validStopsForFare.length * PER_STOP_SURCHARGE;
        calculatedFareBeforeMultipliers = BASE_FARE + timeFareOneWay + distanceBasedFareOneWay + stopSurchargeAmount + BOOKING_FEE;
      }

      let vehicleMultiplier = 1.0;
      if (watchedVehicleType === "estate") vehicleMultiplier = 1.2;
      else if (watchedVehicleType === "minibus_6" || watchedVehicleType === "minibus_6_pet_friendly") vehicleMultiplier = 1.5;
      else if (watchedVehicleType === "minibus_8" || watchedVehicleType === "minibus_8_pet_friendly") vehicleMultiplier = 1.6;
      else if (watchedVehicleType === "disable_wheelchair_access") vehicleMultiplier = 2.0;

      const passengerCount = Number(watchedPassengers) || 1;
      const passengerAdjustment = 1 + (Math.max(0, passengerCount - 1)) * 0.1;

      let baseAdjustedFare = calculatedFareBeforeMultipliers * vehicleMultiplier * passengerAdjustment;

      if (watchedVehicleType === "pet_friendly_car" || watchedVehicleType === "minibus_6_pet_friendly" || watchedVehicleType === "minibus_8_pet_friendly") {
        baseAdjustedFare += PET_FRIENDLY_SURCHARGE;
      }

      baseAdjustedFare = Math.max(baseAdjustedFare, MINIMUM_FARE);
      baseAdjustedFare = parseFloat(baseAdjustedFare.toFixed(2));
      setBaseFareEstimate(baseAdjustedFare > 0 ? baseAdjustedFare : null);

      let finalCalculatedFare = baseAdjustedFare;

      if (watchedWaitAndReturn) {
        const returnSurcharge = baseAdjustedFare * WAIT_AND_RETURN_SURCHARGE_PERCENTAGE;
        finalCalculatedFare += returnSurcharge;

        const prePaidWaitMinutes = form.getValues('estimatedWaitTimeMinutes') || 0;
        const chargeableWaitTimeForEstimate = Math.max(0, prePaidWaitMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION);
        const waitingChargeForEstimate = chargeableWaitTimeForEstimate * WAITING_CHARGE_PER_MINUTE_AT_DESTINATION;
        finalCalculatedFare += waitingChargeForEstimate;
      }

      const currentPriorityFee = watchedIsPriorityPickup && watchedPriorityFeeAmount ? watchedPriorityFeeAmount : 0;
      finalCalculatedFare += currentPriorityFee;

      const fareWithSurge = finalCalculatedFare * surgeMultiplierToApply;
      setTotalFareEstimate(parseFloat(fareWithSurge.toFixed(2)));

    } else {
      setBaseFareEstimate(null);
      setTotalFareEstimate(null);
      setEstimatedDistance(null);
      setEstimatedDurationMinutes(null);
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
    }
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, watchedStops, watchedVehicleType, watchedPassengers, form, isOperatorSurgeEnabled, isLoadingSurgeSetting, validStopsForFare, watchedWaitAndReturn, watchedEstimatedWaitTimeMinutes, calculatedChargedWaitMinutes, watchedIsPriorityPickup, watchedPriorityFeeAmount]);


 useEffect(() => {
    const newMarkers: MapMarker[] = []; // Start with empty markers
    if (showGpsSuggestionAlert && suggestedGpsPickup?.coords) {
      newMarkers.push({
        position: suggestedGpsPickup.coords,
        title: `Your current location (Accuracy: ${suggestedGpsPickup.accuracy.toFixed(0)}m)`,
        iconUrl: passengerLocationIconDataUrl,
        iconScaledSize: { width: 28, height: 40 } 
      });
    } else {
      if (pickupCoords) {
        newMarkers.push({
          position: pickupCoords,
          title: `Pickup: ${form.getValues('pickupLocation')}`,
          label: 'P'
        });
      }
      const currentFormStops = form.getValues('stops');
      currentFormStops?.forEach((formStop, index) => {
          const stopData = stopAutocompleteData[index];
          if (stopData && stopData.coords && formStop.location && formStop.location.trim() !== "") {
               newMarkers.push({
                  position: stopData.coords,
                  title: `Stop ${index + 1}: ${formStop.location}`,
                  label: { text: `S${index + 1}`, color: "white", fontWeight: "bold" }
              });
          }
      });
      if (dropoffCoords) {
        newMarkers.push({
          position: dropoffCoords,
          title: `Dropoff: ${form.getValues('dropoffLocation')}`,
          label: 'D'
      });
      }
    }
    setMapMarkers(newMarkers);
  }, [showGpsSuggestionAlert, suggestedGpsPickup, pickupCoords, dropoffCoords, stopAutocompleteData, form, watchedStops]);


  async function handleBookRide(values: BookingFormValues) {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to book a ride.", variant: "destructive" });
        return;
    }
    if (!pickupCoords || !dropoffCoords) {
        toast({ title: "Missing Location Details", description: "Please select valid pickup and drop-off locations.", variant: "destructive" });
        return;
    }

    const validStopsData = [];
    for (let i = 0; i < (values.stops?.length || 0); i++) {
        const stopLocationInput = values.stops?.[i]?.location;
        const stopDoorOrFlatInput = values.stops?.[i]?.doorOrFlat;
        const stopData = stopAutocompleteData[i];
        if (stopLocationInput && stopLocationInput.trim() !== "" && !stopData?.coords) {
            toast({ title: `Missing Stop ${i + 1} Details`, description: `Select a valid location for stop ${i+1} or remove it.`, variant: "destructive" });
            return;
        }
        if (stopData?.coords && stopLocationInput && stopLocationInput.trim() !== "") {
            validStopsData.push({
                address: stopLocationInput,
                latitude: stopData.coords.lat,
                longitude: stopData.coords.lng,
                doorOrFlat: stopDoorOrFlatInput
            });
        }
    }

    if (baseFareEstimate === null) {
        toast({ title: "Fare Not Calculated", description: "Could not calculate base fare. Ensure addresses are valid.", variant: "destructive" });
        return;
    }

    if (values.paymentMethod === "account" && !isAccountJobAuthPinVerified) { // Check authorization PIN
        toast({ title: "Account Payment Not Verified", description: "Please verify your 6-digit Account Authorization PIN via the payment method selection.", variant: "destructive" });
        setIsAccountJobAuthPinDialogOpen(true); // Re-open 6-digit auth PIN dialog
        return;
    }


    let scheduledPickupAt: string | undefined = undefined;
    if (values.bookingType === 'scheduled' && values.desiredPickupDate && values.desiredPickupTime) {
      const [hours, minutes] = values.desiredPickupTime.split(':').map(Number);
      const combinedDateTime = new Date(values.desiredPickupDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      scheduledPickupAt = combinedDateTime.toISOString();
    }

    setIsBooking(true);

    const PLATFORM_OPERATOR_CODE = "OP001";
    const bookingPayload: any = {
      passengerId: user.id,
      passengerName: user.name || "Passenger",
      pickupLocation: { address: values.pickupLocation, latitude: pickupCoords.lat, longitude: pickupCoords.lng, doorOrFlat: values.pickupDoorOrFlat },
      dropoffLocation: { address: values.dropoffLocation, latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, doorOrFlat: values.dropoffDoorOrFlat },
      stops: validStopsData,
      vehicleType: values.vehicleType,
      passengers: values.passengers,
      fareEstimate: baseFareEstimate,
      isPriorityPickup: values.isPriorityPickup,
      priorityFeeAmount: values.isPriorityPickup ? (values.priorityFeeAmount || 0) : 0,
      isSurgeApplied: isSurgeActive,
      surgeMultiplier: currentSurgeMultiplier,
      stopSurchargeTotal: validStopsForFare.length * PER_STOP_SURCHARGE,
      scheduledPickupAt,
      driverNotes: values.driverNotes,
      waitAndReturn: values.waitAndReturn,
      estimatedWaitTimeMinutes: values.estimatedWaitTimeMinutes,
      promoCode: values.promoCode,
      paymentMethod: values.paymentMethod,
      preferredOperatorId: operatorPreference || PLATFORM_OPERATOR_CODE, // Always set
    };

    if (operatorPreference) {
        bookingPayload.preferredOperatorId = operatorPreference;
    }

    try {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Booking failed with status ${response.status}`);
      }

      const result = await response.json();

      // Check if booking was queued (no driver assigned immediately)
      if (!result.assignedDriver) {
        setBookingQueued(true);
      }

      let toastDescription = `Ride ID: ${result.displayBookingId || result.bookingId}. `;
      
      // Enhanced messaging based on assignment method and dispatch mode
      if (result.assignedDriver) {
      if (values.bookingType === 'asap' && !scheduledPickupAt) {
          toastDescription += `We'll notify you when your driver is on the way. `;
      } else {
          toastDescription += `Your driver will be assigned shortly for the scheduled time. `;
        }
      } else {
        if (result.dispatchMode === 'manual') {
          toastDescription += `Your booking has been queued for manual assignment by the operator. `;
        } else {
          toastDescription += `Your booking has been queued and will be assigned as soon as a driver becomes available. `;
          if (result.timeoutAt) {
            const timeoutDate = new Date(result.timeoutAt._seconds * 1000);
            const timeoutTime = timeoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            toastDescription += `If no driver is found by ${timeoutTime}, you'll be notified and can choose to keep waiting or cancel. `;
          }
        }
      }

      if (values.paymentMethod === 'cash') toastDescription += `Payment: Cash to driver.`;
      else if (values.paymentMethod === 'card') toastDescription += `Payment: Card (Pay driver directly).`;
      else if (values.paymentMethod === 'account') {
          toastDescription += `Payment: Via Account (Operator will bill). `;
          if (result.data.accountJobPin) { // The 4-digit one-time PIN
            toastDescription += `Your One Time Job PIN is: ${result.data.accountJobPin}. Give this to your driver.`;
          }
      }
      
      if (values.waitAndReturn) {
        toastDescription += ` Wait & Return with ~${values.estimatedWaitTimeMinutes} min wait.`;
      }
      if (values.isPriorityPickup) {
          toastDescription += ` Priority Fee: £${(values.priorityFeeAmount || 0).toFixed(2)}.`;
      }
      if (watchedVehicleType === "pet_friendly_car" || watchedVehicleType === "minibus_6_pet_friendly" || watchedVehicleType === "minibus_8_pet_friendly") {
        toastDescription += ` Pet Friendly Surcharge: +£${PET_FRIENDLY_SURCHARGE.toFixed(2)}.`;
      }
      if (watchedVehicleType === "disable_wheelchair_access") {
        toastDescription += ` Wheelchair Access surcharge applied.`;
      }


      toast({
        title: "Booking Confirmed!",
        description: toastDescription,
        variant: "default",
        duration: 10000 // Increased duration to show PIN
      });

      setShowConfirmationDialog(false);
      form.reset();
      setPickupInputValue("");
      setDropoffInputValue("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setStopAutocompleteData([]);
      setBaseFareEstimate(null);
      setTotalFareEstimate(null);
      setEstimatedDistance(null);
      setEstimatedDurationMinutes(null);
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
      // setMapMarkers([]); // Keep mock driver markers
      setPickupSuggestions([]);
      setDropoffSuggestions([]);
      setGeolocationFetchStatus('idle');
      setShowGpsSuggestionAlert(false);
      setSuggestedGpsPickup(null);
      setCalculatedChargedWaitMinutes(0);
      setEstimatedWaitMinutesInput("10");
      setPriorityFeeInput("2.00");
      setIsAccountJobAuthPinVerified(false); // Reset 6-digit auth PIN
      setAccountJobAuthPinInput("");
      
      router.push('/dashboard/track-ride');


    } catch (error) {
        console.error("Booking error:", error);
        toast({ title: "Booking Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
    } finally {
        setIsBooking(false);
    }
  }

  const handleSaveCurrentRoute = () => {
    const pickup = form.getValues("pickupLocation");
    const dropoff = form.getValues("dropoffLocation");
    if (!pickup || !dropoff || !pickupCoords || !dropoffCoords) {
      toast({ title: "Cannot Save Route", description: "Please ensure valid pickup and drop-off locations with coordinates are selected.", variant: "default"});
      return;
    }
    const stopsFromForm = form.getValues("stops") || [];
    const validStopsForSave = stopsFromForm.map((stop, index) => {
      const stopData = stopAutocompleteData[index];
      if (stop.location && stopData?.coords) {
        return {
          address: stop.location,
          latitude: stopData.coords.lat,
          longitude: stopData.coords.lng,
          doorOrFlat: stop.doorOrFlat
        };
      }
      return null;
    }).filter(s => s !== null) as SavedRouteLocationPoint[];

    if (stopsFromForm.length > 0 && validStopsForSave.length !== stopsFromForm.length) {
      toast({ title: "Incomplete Stop Data", description: "One or more stops are missing valid coordinates. Please select from suggestions.", variant: "default"});
      return;
    }
    
    const defaultLabel = `${pickup.split(',')[0]} to ${dropoff.split(',')[0]}`;
    setNewRouteLabel(defaultLabel);
    setSaveRouteDialogOpen(true);
  };

  const submitSaveRoute = async () => {
    if (!user || !pickupCoords || !dropoffCoords || !newRouteLabel.trim()) {
      toast({ title: "Error", description: "User, coordinates, or label missing.", variant: "destructive"});
      return;
    }
    setIsSavingRoute(true);
    const pickupDoorOrFlat = form.getValues("pickupDoorOrFlat");
    const dropoffDoorOrFlat = form.getValues("dropoffDoorOrFlat");

    const stopsToSave = (form.getValues("stops") || []).map((stop, index) => {
        const stopData = stopAutocompleteData[index];
        if (stop.location && stopData?.coords) {
            return {
                address: stop.location,
                latitude: stopData.coords.lat,
                longitude: stopData.coords.lng,
                doorOrFlat: stop.doorOrFlat
            };
        }
        return null;
    }).filter(s => s !== null) as SavedRouteLocationPoint[];

    try {
      const response = await fetch('/api/users/saved-routes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          label: newRouteLabel.trim(),
          pickupLocation: { address: pickupInputValue, latitude: pickupCoords.lat, longitude: pickupCoords.lng, doorOrFlat: pickupDoorOrFlat },
          dropoffLocation: { address: dropoffInputValue, latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, doorOrFlat: dropoffDoorOrFlat },
          stops: stopsToSave,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const newRoute = await response.json();
      setSavedRoutes(prev => [newRoute.route, ...prev]);
      toast({ title: "Route Saved!", description: `"${newRouteLabel.trim()}" added to your saved routes.`});
      setSaveRouteDialogOpen(false);
      setNewRouteLabel("");
    } catch (err) {
      toast({ title: "Save Route Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive"});
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleApplySavedRoute = (route: SavedRoute) => {
    form.setValue("pickupLocation", route.pickupLocation.address);
    setPickupInputValue(route.pickupLocation.address);
    setPickupCoords({lat: route.pickupLocation.latitude, lng: route.pickupLocation.longitude});
    form.setValue("pickupDoorOrFlat", route.pickupLocation.doorOrFlat || "");

    form.setValue("dropoffLocation", route.dropoffLocation.address);
    setDropoffInputValue(route.dropoffLocation.address);
    setDropoffCoords({lat: route.dropoffLocation.latitude, lng: route.dropoffLocation.longitude});
    form.setValue("dropoffDoorOrFlat", route.dropoffLocation.doorOrFlat || "");

    const newStopsData = route.stops?.map((stop, index) => ({
      location: stop.address,
      doorOrFlat: stop.doorOrFlat || ""
    })) || [];
    replace(newStopsData); 

    const newStopAutocomplete = (route.stops || []).map((stop, index) => ({
        fieldId: `stop-applied-${index}-${Date.now()}`,
        inputValue: stop.address,
        coords: {lat: stop.latitude, lng: stop.longitude},
        suggestions: [],
        showSuggestions: false,
        isFetchingSuggestions: false,
        isFetchingDetails: false,
    }));
    setStopAutocompleteData(newStopAutocomplete);

    toast({ title: "Route Applied", description: `"${route.label}" loaded into the form.` });
  };

  const handleDeleteSavedRoute = async (routeId: string) => {
    if (!user) return;
    setIsDeletingRouteId(routeId);
    try {
      const response = await fetch(`/api/users/saved-routes/remove?id=${routeId}&userId=${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
      toast({ title: "Route Deleted", description: "The saved route has been removed."});
    } catch (err) {
      toast({ title: "Delete Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive"});
    } finally {
      setIsDeletingRouteId(null);
    }
  };

  const geocodeAiAddress = useCallback(async (
    addressString: string,
    setCoordsFunc: (coords: google.maps.LatLngLiteral | null) => void,
    setInputValueFunc: (value: string) => void,
    formField: "pickupLocation" | "dropoffLocation",
    locationType: "pickup" | "dropoff"
  ): Promise<void> => {
    if (!isMapSdkLoaded || !autocompleteServiceRef.current || !placesServiceRef.current || !addressString) {
      setCoordsFunc(null);
      form.setValue(formField, addressString);
      setInputValueFunc(addressString);
      toast({ title: `AI Geocoding Failed for ${locationType}`, description: `Address services not ready or no address provided for "${addressString}". Original text kept.`, variant: "default" });
      return;
    }

    return new Promise((resolve) => {
      autocompleteServiceRef.current!.getPlacePredictions(
        { input: addressString, sessionToken: autocompleteSessionTokenRef.current, componentRestrictions: { country: 'gb' } },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions && predictions[0]) {
            const firstPrediction = predictions[0];
            placesServiceRef.current!.getDetails(
              { placeId: firstPrediction.place_id!, fields: ['geometry.location', 'formatted_address', 'address_components'], sessionToken: autocompleteSessionTokenRef.current },
              (place, detailStatus) => {
                if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                  const coords = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                  const finalAddress = place.formatted_address || firstPrediction.description;
                  setCoordsFunc(coords);
                  form.setValue(formField, finalAddress);
                  setInputValueFunc(finalAddress);
                  if (formField === 'pickupLocation') {
                    setShowGpsSuggestionAlert(false);
                    setGeolocationFetchStatus('idle');
                  }
                  toast({ title: `AI ${locationType} applied`, description: `Set to: ${finalAddress}` });
                } else {
                  setCoordsFunc(null);
                  form.setValue(formField, addressString);
                  setInputValueFunc(addressString);
                  toast({ title: `AI Geocoding Failed`, description: `Could not get details for ${locationType}: "${addressString}". Original text kept.`, variant: "default" });
                }
                autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
                resolve();
              }
            );
          } else {
            setCoordsFunc(null);
            form.setValue(formField, addressString);
            setInputValueFunc(addressString);
            toast({ title: `AI Geocoding Failed`, description: `Could not find ${locationType}: "${addressString}". Original text kept.`, variant: "default" });
            resolve();
          }
        }
      );
    });
  }, [form, toast, isMapSdkLoaded]);

  const playSound = useCallback(async (type: 'start' | 'stop') => {
    if (!audioCtxRef.current) {
        if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } else {
            toast({ title: "Audio Error", description: "Web Audio API not supported by your browser.", variant: "destructive"});
            return;
        }
    }
    if (!audioCtxRef.current) return;

    const oscillator = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    oscillator.type = 'sine';
    if (type === 'start') {
        oscillator.frequency.setValueAtTime(440, audioCtxRef.current.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.2);
    } else {
        oscillator.frequency.setValueAtTime(330, audioCtxRef.current.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.2);
    }
    oscillator.start();
    oscillator.stop(audioCtxRef.current.currentTime + 0.2);
  }, [toast]);


  useEffect(() => {
    if (typeof window !== 'undefined' && !('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn("Speech recognition not supported by this browser.");
        return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-GB';

    recognitionRef.current.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      toast({ title: "Voice Input Received", description: `Processing: "${transcript}"`});
      setIsProcessingAi(true);
      try {
        const parsedData = await parseBookingRequest({ userRequestText: transcript });
        
        if (parsedData.pickupAddress) {
           await geocodeAiAddress(parsedData.pickupAddress, setPickupCoords, setPickupInputValue, "pickupLocation", "pickup");
        }
        if (parsedData.dropoffAddress) {
           await geocodeAiAddress(parsedData.dropoffAddress, setDropoffCoords, setDropoffInputValue, "dropoffLocation", "dropoff");
        }
        if (parsedData.numberOfPassengers) form.setValue("passengers", parsedData.numberOfPassengers);
        if (parsedData.requestedTime) {
            form.setValue("driverNotes", `${form.getValues("driverNotes") || ""} (AI Time: ${parsedData.requestedTime})`.trim());
        }
        if (parsedData.additionalNotes) {
             form.setValue("driverNotes", `${form.getValues("driverNotes") || ""} ${parsedData.additionalNotes}`.trim());
        }
        toast({ title: "AI Parsed Data Applied!", description: "Booking details updated from your voice input.", duration: 5000 });

      } catch (error) {
        toast({ title: "AI Parsing Error", description: error instanceof Error ? error.message : "Could not process voice input.", variant: "destructive"});
      } finally {
        setIsProcessingAi(false);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      let errorMsg = "Speech recognition error.";
      if (event.error === 'no-speech') errorMsg = "No speech detected. Please try again.";
      else if (event.error === 'audio-capture') errorMsg = "Audio capture error. Check microphone permissions.";
      else if (event.error === 'not-allowed') errorMsg = "Microphone access denied.";
      toast({ title: "Voice Input Error", description: errorMsg, variant: "destructive" });
      setIsListening(false);
      setIsProcessingAi(false);
    };

    recognitionRef.current.onend = () => {
      if (isListening) { 
        playSound('stop');
      }
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [toast, form, geocodeAiAddress, playSound, isListening]);

  const handleMicMouseDown = async (
    event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement> | any
  ) => {
    if (!recognitionRef.current) {
        toast({ title: "Voice Input Unavailable", description: "Speech recognition is not supported or initialized.", variant: "destructive" });
        return;
    }
    if (isListening || isProcessingAi) return;

    try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
            toast({ title: "Microphone Access Denied", description: "Please allow microphone access in your browser settings to use voice input.", variant: "destructive", duration: 7000});
            return;
        }
        if (permissionStatus.state === 'prompt') {
            toast({ title: "Microphone Permission", description: "Your browser will ask for microphone permission. Please allow it."});
        }
    } catch (err) {
        console.warn("Permissions API not supported or errored:", err);
    }

    setIsListening(true);
    recognitionRef.current.start();
    playSound('start');
  };

  const handleMicMouseUpOrLeave = (
    event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement> | any
  ) => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const renderSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetchingSuggestions: boolean,
    isFetchingDetails: boolean,
    inputValue: string,
    onSuggestionClick: (suggestion: google.maps.places.AutocompletePrediction) => void,
    fieldKey: string
  ) => (
    <ScrollArea className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60">
      <div className="space-y-1 p-1">
        {isFetchingSuggestions && (
          <div className="p-2 text-sm text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading suggestions...
          </div>
        )}
        {isFetchingDetails && (
          <div className="p-2 text-sm text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching location details...
          </div>
        )}
        {!isFetchingSuggestions && !isFetchingDetails && suggestions.length === 0 && inputValue.length >= 2 && (
          <div className="p-2 text-sm text-muted-foreground">No suggestions found.</div>
        )}
        {!isFetchingSuggestions && !isFetchingDetails && suggestions.map((suggestionItem) => (
          <div
            key={`${fieldKey}-${suggestionItem.place_id}`}
            className="p-2 text-sm hover:bg-muted cursor-pointer rounded-sm"
            onMouseDown={() => onSuggestionClick(suggestionItem)}
          >
            {suggestionItem.description}
          </div>
        ))}
      </div>
    </ScrollArea>
  );

  const renderFavoriteLocationsPopover = (
    onSelectFavorite: (fav: FavoriteLocation) => void,
    triggerKey: string
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-accent" aria-label="Select from favorites">
          <Star className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <ScrollArea className="h-auto max-h-60">
          <div className="p-2">
            <p className="text-sm font-medium p-2">Your Favorites</p>
            {isLoadingFavorites && <div className="p-2 text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</div>}
            {!isLoadingFavorites && favoriteLocations.length === 0 && <p className="p-2 text-sm text-muted-foreground">No favorites saved yet.</p>}
            {!isLoadingFavorites && favoriteLocations.map(fav => (
              <div
                key={`${triggerKey}-fav-${fav.id}`}
                className="p-2 text-sm hover:bg-muted cursor-pointer rounded-md"
                onClick={() => { onSelectFavorite(fav); (document.activeElement as HTMLElement)?.blur(); }}
              >
                <p className="font-semibold">{fav.label}</p>
                <p className="text-xs text-muted-foreground">{fav.address}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  const { mapCenterForDisplay, mapZoomForDisplay } = useMemo(() => {
    if (showGpsSuggestionAlert && suggestedGpsPickup?.coords) {
        return { mapCenterForDisplay: suggestedGpsPickup.coords, mapZoomForDisplay: 18 };
    }
    if (pickupCoords) {
        return { mapCenterForDisplay: pickupCoords, mapZoomForDisplay: 14 };
    }
    if (dropoffCoords) { 
        return { mapCenterForDisplay: dropoffCoords, mapZoomForDisplay: 14 };
    }
    return { mapCenterForDisplay: huddersfieldCenter, mapZoomForDisplay: 12 };
  }, [showGpsSuggestionAlert, suggestedGpsPickup, pickupCoords, dropoffCoords]);


  const GeolocationFeedback = () => {
    let message = ""; let icon = <Wifi className="w-3 h-3"/>; let color = "text-muted-foreground";
    switch(geolocationFetchStatus) {
        case "fetching": message = "Getting location..."; icon = <Loader2 className="w-3 h-3 animate-spin"/>; color = "text-blue-500"; break;
        case "success": message = "Location found."; icon = <CheckCircle2 className="w-3 h-3"/>; color = "text-green-500"; break;
        case "error_permission": message = "Permission denied."; icon = <ShieldAlert className="w-3 h-3"/>; color = "text-red-500"; break;
        case "error_accuracy_moderate": message = "Accuracy moderate."; icon = <AlertTriangle className="w-3 h-3"/>; color = "text-orange-500"; break;
        case "error_accuracy_poor": message = "Accuracy poor."; icon = <AlertTriangle className="w-3 h-3"/>; color = "text-red-500"; break;
        case "error_geocoding": message = "Cannot ID address."; icon = <AlertTriangle className="w-3 h-3"/>; color = "text-orange-500"; break;
        case "error_unavailable": message = "GPS unavailable."; icon = <AlertTriangle className="w-3 h-3"/>; color = "text-red-500"; break;
        case "idle": return null;
        default: return null;
    }
    return (
      <p className={`text-xs mt-1 flex items-center gap-1 ${color}`}>
        {icon} {message}
      </p>
    );
  };

const handleProceedToConfirmation = async () => {
    const pickupValid = await form.trigger("pickupLocation");
    const dropoffValid = await form.trigger("dropoffLocation");
    const stops = form.getValues("stops");
    if (stops && stops.length > 0) {
      await form.trigger("stops");
    }

    if (!pickupValid || !dropoffValid) {
      toast({
        title: "Missing Journey Details",
        description: "Please ensure pickup and drop-off locations are filled correctly.",
        variant: "destructive",
      });
      return;
    }

    if (!pickupCoords || !dropoffCoords) {
      toast({
        title: "Location Coordinates Missing",
        description: "Please select pickup and drop-off locations from the suggestions to get coordinates.",
        variant: "default",
      });
      return;
    }

    const stopFields = form.getValues("stops");
    if (stopFields && stopFields.length > 0) {
        for (let i = 0; i < stopFields.length; i++) {
            if (stopFields[i].location && stopFields[i].location.trim() !== "" && !stopAutocompleteData[i]?.coords) {
                 toast({
                    title: `Incomplete Stop ${i + 1}`,
                    description: `Please select stop ${i+1} from suggestions or remove it.`,
                    variant: "destructive",
                 });
                 return;
            }
        }
    }

    if (form.getValues("paymentMethod") === "account" && !isAccountJobAuthPinVerified) {
      toast({
        title: "Account Payment Not Verified",
        description: "Please enter and verify your 6-digit Account PIN to use Account payment.",
        variant: "destructive",
      });
      setIsAccountJobAuthPinDialogOpen(true); 
      return;
    }
    setShowConfirmationDialog(true);
  };

  const mapContainerClasses = cn(
    "relative w-full h-[35vh] rounded-lg overflow-hidden shadow-md bg-muted/30 mb-3 border-2",
    {
      'border-border': mapBusynessLevel === 'idle',
      'border-yellow-500': mapBusynessLevel === 'moderate',
      'border-red-500': mapBusynessLevel === 'high',
    }
  );

  const handleWaitAndReturnDialogConfirm = () => {
    const minutes = parseInt(estimatedWaitMinutesInput, 10);
    if (isNaN(minutes) || minutes < 0) {
      toast({ title: "Invalid Wait Time", description: "Please enter a valid number of minutes (0 or more).", variant: "destructive"});
      return;
    }
    form.setValue('waitAndReturn', true);
    form.setValue('estimatedWaitTimeMinutes', minutes);
    setCalculatedChargedWaitMinutes(Math.max(0, minutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION));
    setIsWaitTimeDialogOpen(false);
  };

  const handleWaitAndReturnDialogCancel = () => {
    form.setValue('waitAndReturn', false);
    form.setValue('estimatedWaitTimeMinutes', undefined);
    setCalculatedChargedWaitMinutes(0);
    setIsWaitTimeDialogOpen(false);
  };

  const handlePriorityFeeDialogConfirm = () => {
    const fee = parseFloat(priorityFeeInput);
    if (isNaN(fee) || fee <= 0) {
      toast({ title: "Invalid Priority Fee", description: "Please enter a valid positive amount for the priority fee (min £0.50).", variant: "destructive"});
      return;
    }
    if (fee < 0.50) {
       toast({ title: "Priority Fee Too Low", description: "Minimum priority fee is £0.50.", variant: "destructive"});
      return;
    }
    form.setValue('isPriorityPickup', true);
    form.setValue('priorityFeeAmount', parseFloat(fee.toFixed(2)));
    setIsPriorityFeeDialogOpen(false);
  };

  const handlePriorityFeeDialogCancel = () => {
    form.setValue('isPriorityPickup', false);
    form.setValue('priorityFeeAmount', undefined);
    setIsPriorityFeeDialogOpen(false);
  };

  const getGpsAlertStyles = (accuracy: number | undefined) => {
    if (accuracy === undefined) { 
      return {
        alertClass: "bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700",
        iconClass: "text-blue-600 dark:text-blue-400",
        titleClass: "text-blue-700 dark:text-blue-300 font-semibold",
        descriptionClass: "text-blue-600 dark:text-blue-400",
        buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
        buttonDisabled: true, 
        message: "Confirm GPS Pickup Location"
      };
    }
    if (accuracy <= 20) { 
      return {
        alertClass: "bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700",
        iconClass: "text-green-600 dark:text-green-400",
        titleClass: "text-green-700 dark:text-green-300 font-semibold",
        descriptionClass: "text-green-600 dark:text-green-400",
        buttonClass: "bg-green-600 hover:bg-green-700 text-white",
        buttonDisabled: false,
        message: "GPS Location Accurate"
      };
    } else if (accuracy <= 75) { 
      return {
        alertClass: "bg-yellow-50 border-yellow-400 dark:bg-yellow-800/30 dark:border-yellow-700",
        iconClass: "text-yellow-600 dark:text-yellow-400",
        titleClass: "text-yellow-700 dark:text-yellow-300 font-semibold",
        descriptionClass: "text-yellow-600 dark:text-yellow-400",
        buttonClass: "bg-yellow-500 hover:bg-yellow-600 text-white",
        buttonDisabled: false,
        message: "GPS Location - Moderate Accuracy"
      };
    } else { 
      return {
        alertClass: "bg-red-50 border-red-400 dark:bg-red-800/30 dark:border-red-700",
        iconClass: "text-red-600 dark:text-red-400",
        titleClass: "text-red-700 dark:text-red-300 font-semibold",
        descriptionClass: "text-red-600 dark:text-red-400",
        buttonClass: "bg-red-600 hover:bg-red-700 text-white",
        buttonDisabled: true,
        message: "GPS Location - Low Accuracy"
      };
    }
  };
  const gpsStyles = getGpsAlertStyles(suggestedGpsPickup?.accuracy);

  const handleAccountJobAuthPinConfirm = () => { 
    if (accountJobAuthPinInput === "123456") { 
      setIsAccountJobAuthPinVerified(true);
      form.setValue("paymentMethod", "account"); 
      toast({ title: "Account PIN Verified!", description: "You can now proceed with the account booking." });
      setIsAccountJobAuthPinDialogOpen(false);
    } else {
      toast({ title: "Invalid PIN", description: "The 6-digit Authorization PIN entered is incorrect. Please try again.", variant: "destructive" });
      setIsAccountJobAuthPinVerified(false);
      setAccountJobAuthPinInput(""); 
      setAccountJobAuthPinInputType('password');
    }
  };

  const handleAccountAuthPinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setAccountJobAuthPinInput(newValue);

    setAccountJobAuthPinInputType('text');
    if (pinPeekTimeoutRef.current) {
      clearTimeout(pinPeekTimeoutRef.current);
    }
    pinPeekTimeoutRef.current = setTimeout(() => {
      setAccountJobAuthPinInputType('password');
    }, 500);
  };

  // Set availability status based on real driver data
  // Note: availabilityStatusLevel and availabilityStatusMessage are managed by React state
  // and updated via useEffect based on drivers, loadingDrivers, and errorDrivers

  const PLATFORM_OPERATOR_CODE = 'OP001';
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showBookAnyway, setShowBookAnyway] = useState(false);
  const [fallbackSuggestion, setFallbackSuggestion] = useState(false);

  // Watch for pickupCoords and driver availability
  useEffect(() => {
    if (!pickupCoords) {
      setShowBookingForm(false);
      setShowBookAnyway(false);
      setFallbackSuggestion(false);
      return;
    }
    if (loadingDrivers) {
      setShowBookingForm(false);
      setShowBookAnyway(false);
      setFallbackSuggestion(false);
      return;
    }
    if (errorDrivers) {
      setShowBookingForm(false);
      setShowBookAnyway(false);
      setFallbackSuggestion(false);
      return;
    }
    if (drivers.length > 0 && !usedFallback) {
      setShowBookingForm(true);
      setShowBookAnyway(false);
      setFallbackSuggestion(false);
    } else if (drivers.length > 0 && usedFallback) {
      setShowBookingForm(true);
      setShowBookAnyway(false);
      setFallbackSuggestion(true);
    } else {
      setShowBookingForm(false);
      setShowBookAnyway(true);
      setFallbackSuggestion(false);
    }
  }, [pickupCoords, drivers, loadingDrivers, errorDrivers, usedFallback]);

  // 1. Add a new state for booking queued confirmation
  const [bookingQueued, setBookingQueued] = useState(false);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [isQueuedBookingDialogOpen, setIsQueuedBookingDialogOpen] = useState(false);

  // Enhanced handler for Book Anyway button
  const handleBookAnyway = () => {
    setIsQueuedBookingDialogOpen(true);
  };

  // Handler for confirming queued booking
  const handleConfirmQueuedBooking = () => {
    setShowBookingForm(true);
    setShowBookAnyway(false);
    setIsQueuedBookingDialogOpen(false);
    toast({ 
      title: "Booking Mode Enabled", 
      description: "You can now proceed with your booking. It will be queued and assigned as soon as a driver becomes available.",
      duration: 5000
    });
  };

  // Calculate estimated wait time based on real driver locations and average speed
  useEffect(() => {
    if (drivers.length > 0 && pickupCoords) {
      const averageSpeedKmh = 20; // You can adjust this value as needed
      const averageSpeedKmMin = averageSpeedKmh / 60;
      // Haversine formula in km
      function getDistanceInKm(coord1: {lat: number, lng: number}, coord2: {lat: number, lng: number}): number {
        const R = 6371;
        const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
        const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }
      const etas = drivers.map(driver => {
        const distance = getDistanceInKm(pickupCoords, driver.location);
        return distance / averageSpeedKmMin; // in minutes
      });
      const minEta = Math.round(Math.min(...etas));
      setEstimatedWaitTime(minEta);
    } else if (drivers.length === 0 && pickupCoords) {
      // Fallback: time-of-day logic
      const now = new Date();
      const hour = now.getHours();
      let estimatedMinutes = 15; // Default 15 minutes
      if (hour >= 7 && hour <= 9) {
        estimatedMinutes = 25;
      } else if (hour >= 16 && hour <= 18) {
        estimatedMinutes = 30;
      } else if (hour >= 22 || hour <= 6) {
        estimatedMinutes = 35;
      }
      setEstimatedWaitTime(estimatedMinutes);
    } else {
      setEstimatedWaitTime(null);
    }
  }, [drivers, pickupCoords]);

  // Enhanced availability status messages
  const getAvailabilityMessage = () => {
    if (loadingDrivers) {
      return {
        message: "Checking driver availability in your area...",
        type: "loading" as const,
        icon: <Loader2 className="w-4 h-4 animate-spin" />
      };
    }
    
    if (errorDrivers) {
      return {
        message: "Unable to check driver availability. Please try again.",
        type: "error" as const,
        icon: <AlertTriangle className="w-4 h-4" />
      };
    }
    
    if (drivers.length > 0 && !usedFallback) {
      return {
        message: `${drivers.length} driver${drivers.length > 1 ? 's' : ''} available in your area`,
        type: "available" as const,
        icon: <BadgeCheck className="w-4 h-4" />
      };
    }
    
    if (drivers.length > 0 && usedFallback) {
      return {
        message: `No drivers for ${operatorPreference || 'your selected operator'}, but ${drivers.length} other driver${drivers.length > 1 ? 's are' : ' is'} available nearby`,
        type: "fallback" as const,
        icon: <Info className="w-4 h-4" />
      };
    }
    
    return {
      message: `No drivers currently available${operatorPreference ? ` for ${operatorPreference}` : ''} in your area`,
      type: "unavailable" as const,
      icon: <AlertTriangle className="w-4 h-4" />
    };
  };

  const availabilityInfo = getAvailabilityMessage();

  return (
    <div>
      {phoneVerificationRequired && (
        <Alert variant="destructive" className="mb-4 flex items-center justify-between">
          <div>
            <strong>Phone Verification Required:</strong> You must verify your phone number to book a ride. Please verify your phone in your profile settings.
          </div>
          <Link href="/profile">
            <Button variant="outline" className="ml-4">Verify Now</Button>
          </Link>
        </Alert>
      )}
      {!phoneVerificationRequired ? (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
              <CardDescription>Enter details, load a saved route, or use voice input (Beta). Add stops and schedule.</CardDescription>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
                 <Button
                    type="button"
                    onClick={handleSaveCurrentRoute}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    disabled={!pickupCoords || !dropoffCoords}
                    >
                    <Save className="w-3.5 h-3.5" /> Save Route
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1" disabled={isLoadingSavedRoutes || savedRoutes.length === 0}>
                            <div className="flex items-center gap-1">
                                <List className="w-3.5 h-3.5" />
                                Load Route
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                        <ScrollArea className="h-auto max-h-72">
                            <div className="p-2">
                                <p className="text-sm font-medium p-2">Your Saved Routes</p>
                                {isLoadingSavedRoutes && <div className="p-2 text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading...</div>}
                                {!isLoadingSavedRoutes && savedRoutes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No routes saved yet.</p>}
                                {!isLoadingSavedRoutes && savedRoutes.map(route => (
                                <div key={route.id} className="p-2 hover:bg-muted rounded-md group">
                                    <div className="flex justify-between items-start">
                                        <div className="cursor-pointer" onClick={() => handleApplySavedRoute(route)}>
                                            <p className="font-semibold text-sm">{route.label}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{route.pickupLocation.address} to {route.dropoffLocation.address}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive group-hover:opacity-100 opacity-0 transition-opacity" onClick={() => handleDeleteSavedRoute(route.id)} disabled={isDeletingRouteId === route.id}>
                                            {isDeletingRouteId === route.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                        </Button>
                                    </div>
                                </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>
            </div>
          </div>
          {operatorPreference && (
            <Alert variant="default" className="mt-3 bg-primary/10 border-primary/30">
              <Building className="h-5 w-5 text-primary" />
              <ShadAlertTitle className="text-primary font-semibold">Booking with: {operatorPreference}</ShadAlertTitle>
              <AlertDescription className="text-primary/90">
                Your ride will be preferentially offered to drivers from {operatorPreference}.
                <Button variant="link" size="sm" className="p-0 h-auto ml-2 text-primary/80 hover:text-primary" onClick={() => router.push('/dashboard')}>
                  (Change Preference)
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            <div className={mapContainerClasses}>
                <GoogleMapDisplay
                    key="book-ride-map"
                    center={mapCenterForDisplay}
                    zoom={mapZoomForDisplay}
                    markers={mapMarkers}
                    className="w-full h-full"
                    disableDefaultUI={true}
                    fitBoundsToMarkers={true} 
                 />
              </div>

                {/* Enhanced Driver Availability Status */}
            {(!pickupCoords || !form.getValues('pickupLocation')) && (
              <div className="mb-4 rounded-md flex items-center justify-center py-3 px-4 shadow-sm bg-gray-400">
                <span className="text-white font-bold text-sm text-center">
                  CHOOSE YOUR LOCATION/PICKUP ADDRESS TO SEE AVAILABLE DRIVERS
                </span>
              </div>
            )}
            {pickupCoords && form.getValues('pickupLocation') && availabilityInfo.type !== 'fallback' && (
              <Card className={cn(
                "mb-4 shadow-sm",
                availabilityInfo.type === 'unavailable' && "bg-red-500",
                availabilityInfo.type === 'available' && "bg-green-500",
                availabilityInfo.type === 'loading' && "bg-primary/5 border-primary/20",
                availabilityInfo.type === 'error' && "bg-red-500"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    {availabilityInfo.icon}
                    <p className={cn(
                      "text-sm font-bold text-white",
                    )}>
                      {availabilityInfo.message}
                    </p>
                  </div>
                  {/* Show estimated wait time when no drivers available */}
                  {availabilityInfo.type === 'unavailable' && estimatedWaitTime && (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-white/90">
                        Estimated wait time: ~{estimatedWaitTime} minutes
                      </p>
                    </div>
                  )}
                  {/* Show Book Anyway option when no drivers available */}
                  {availabilityInfo.type === 'unavailable' && showBookAnyway && (
                    <div className="mt-3 text-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleBookAnyway}
                        className="bg-white text-red-600 font-bold border-white hover:bg-white hover:text-red-700"
                      >
                        Book and wait for next available driver
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleBookRide)} className="space-y-6">
                {showGpsSuggestionAlert && suggestedGpsPickup && (
                    <Alert variant="default" className={gpsStyles.alertClass}>
                        <LocateFixed className={`h-5 w-5 ${gpsStyles.iconClass}`} />
                        <ShadAlertTitle className={gpsStyles.titleClass}>{gpsStyles.message}</ShadAlertTitle>
                        <AlertDescription className={gpsStyles.descriptionClass}>
                        Address: {suggestedGpsPickup.address} (Accuracy: {suggestedGpsPickup.accuracy.toFixed(0)}m).
                        <br />
                        Please **carefully verify** if this is your exact pickup spot.
                        {gpsStyles.buttonDisabled && " Accuracy is too low to use this suggestion directly. Please enter manually."}
                        {!gpsStyles.buttonDisabled && " If not your exact spot, dismiss and enter manually."}
                        <div className="mt-2 space-x-2">
                            <Button type="button" size="sm" onClick={handleApplyGpsSuggestion} className={gpsStyles.buttonClass} disabled={gpsStyles.buttonDisabled}>Use this</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => {setShowGpsSuggestionAlert(false); setGeolocationFetchStatus('idle');}}>Dismiss</Button>
                        </div>
                        </AlertDescription>
                    </Alert>
                )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-1"><UserIcon className="w-4 h-4 text-muted-foreground" /> Pickup Location</FormLabel>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-accent"
                            onClick={handleManualGpsRequest}
                            disabled={geolocationFetchStatus === 'fetching' || !isMapSdkLoaded}
                            aria-label="Detect my current location for pickup"
                          >
                            {geolocationFetchStatus === 'fetching' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                          </Button>
                          <Button type="button" variant={isListening ? "destructive" : "outline"} size="icon" 
                              className={cn("h-7 w-7", isListening && "animate-pulse ring-2 ring-destructive ring-offset-2", isProcessingAi && "opacity-50 cursor-not-allowed")}
                              onMouseDown={handleMicMouseDown} onMouseUp={handleMicMouseUpOrLeave} onMouseLeave={handleMicMouseUpOrLeave} onTouchStart={handleMicMouseDown} onTouchEnd={handleMicMouseUpOrLeave}
                              disabled={isProcessingAi}
                              aria-label="Use voice input for booking"
                              >
                              {isProcessingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                          </Button>
                        </div>
                    </div>
                    <FormField
                        control={form.control}
                        name="pickupDoorOrFlat"
                        render={({ field }) => (
                        <FormItem className="mb-1">
                            <FormControl>
                            <Input placeholder="Door/Flat/Unit (Optional)" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="pickupLocation"
                        render={({ field }) => (
                        <FormItem>
                            <div className="relative flex items-center">
                            <FormControl>
                                <Input
                                placeholder="Type or speak pickup address"
                                {...field}
                                value={pickupInputValue}
                                onChange={(e) => handleAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)}
                                onFocus={handleFocusFactory('pickupLocation')}
                                onBlur={handleBlurFactory('pickupLocation')}
                                autoComplete="off"
                                className="pr-10 border-2 border-primary shadow-none"
                                />
                            </FormControl>
                            {renderFavoriteLocationsPopover(handleFavoriteSelectFactory('pickupLocation', field.onChange, 'pickupDoorOrFlat'), "pickup")}
                            {showPickupSuggestions && renderSuggestions(
                                pickupSuggestions,
                                isFetchingPickupSuggestions,
                                isFetchingPickupDetails,
                                pickupInputValue,
                                (sugg) => handleSuggestionClickFactory('pickupLocation')(sugg, field.onChange),
                                "pickup"
                            )}
                            </div>
                            <FormMessage />
                            <GeolocationFeedback />
                        </FormItem>
                        )}
                    />
                  </div>

                   {fields.map((item, index) => (
                    <div key={item.id} className="space-y-2 p-3 border rounded-md bg-muted/50 relative">
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel className="flex items-center gap-1"><StopMarkerIcon className="w-4 h-4 text-muted-foreground" /> Stop {index + 1}</FormLabel>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveStop(index)} className="text-destructive hover:text-destructive-foreground h-7 w-7 absolute top-1 right-1">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                       <FormField control={form.control} name={`stops.${index}.doorOrFlat`} render={({ field }) => (
                          <FormItem><FormControl><Input placeholder="Door/Flat/Unit (Optional)" {...field} className="bg-background"/></FormControl><FormMessage /></FormItem>
                        )}/>
                      <FormField
                        control={form.control}
                        name={`stops.${index}.location`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="relative flex items-center">
                              <FormControl>
                                <Input
                                  placeholder={`Type stop ${index + 1} address`}
                                  {...field}
                                  value={stopAutocompleteData[index]?.inputValue || ""}
                                  onChange={(e) => handleAddressInputChangeFactory(index)(e.target.value, field.onChange)}
                                  onFocus={handleFocusFactory(index)}
                                  onBlur={handleBlurFactory(index)}
                                  autoComplete="off"
                                  className="pr-10 bg-background"
                                />
                              </FormControl>
                              {renderFavoriteLocationsPopover(handleFavoriteSelectFactory(index, field.onChange, `stops.${index}.doorOrFlat`), `stop-${index}`)}
                               {stopAutocompleteData[index]?.showSuggestions && renderSuggestions(
                                stopAutocompleteData[index].suggestions,
                                stopAutocompleteData[index].isFetchingSuggestions,
                                stopAutocompleteData[index].isFetchingDetails,
                                stopAutocompleteData[index].inputValue,
                                (sugg) => handleSuggestionClickFactory(index)(sugg, field.onChange),
                                `stop-${index}`
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={handleAddStop} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent flex items-center gap-1">
                    <PlusCircle className="w-4 h-4"/> Add Stop
                  </Button>

                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-1"><HomeIcon className="w-4 h-4 text-muted-foreground" /> Drop-off Location</FormLabel>
                    <FormField
                        control={form.control}
                        name="dropoffDoorOrFlat"
                        render={({ field }) => (
                        <FormItem className="mb-1">
                            <FormControl>
                            <Input placeholder="Door/Flat/Unit (Optional)" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dropoffLocation"
                        render={({ field }) => (
                        <FormItem>
                            <div className="relative flex items-center">
                            <FormControl>
                                <Input
                                placeholder="Type drop-off address"
                                {...field}
                                value={dropoffInputValue}
                                onChange={(e) => handleAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)}
                                onFocus={handleFocusFactory('dropoffLocation')}
                                onBlur={handleBlurFactory('dropoffLocation')}
                                autoComplete="off"
                                className="pr-10 border-2 border-destructive text-destructive shadow-none"
                                />
                            </FormControl>
                            {renderFavoriteLocationsPopover(handleFavoriteSelectFactory('dropoffLocation', field.onChange, 'dropoffDoorOrFlat'), "dropoff")}
                            {showDropoffSuggestions && renderSuggestions(
                                dropoffSuggestions,
                                isFetchingDropoffSuggestions,
                                isFetchingDropoffDetails,
                                dropoffInputValue,
                                (sugg) => handleSuggestionClickFactory('dropoffLocation')(sugg, field.onChange),
                                "dropoff"
                            )}
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="bookingType"
                    render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel className="flex items-center gap-1"><CalendarClock className="w-4 h-4 text-muted-foreground" /> Booking Time</FormLabel>
                        <FormControl>
                        <RadioGroup 
                            onValueChange={field.onChange} 
                            value={field.value} // Ensure value is controlled
                            className="flex space-x-1"
                        >
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="asap" /></FormControl><FormLabel className="font-normal">ASAP</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="scheduled" /></FormControl><FormLabel className="font-normal">Schedule Later</FormLabel></FormItem>
                        </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                  />
                  {watchedBookingType === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-4 p-3 border rounded-md bg-muted/30">
                    <FormField
                        control={form.control}
                        name="desiredPickupDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Pickup Date</FormLabel>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}> 
                                  <span className="flex items-center justify-between w-full">
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </span>
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsDatePickerOpen(false); }} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="desiredPickupTime"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Pickup Time</FormLabel>
                            <FormControl>
                                <Input type="time" {...field} className="w-full"/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Car className="w-4 h-4 text-muted-foreground" /> Vehicle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="car">Car (Standard)</SelectItem>
                            <SelectItem value="estate">Estate Car</SelectItem>
                            <SelectItem value="minibus_6">Minibus (6 people)</SelectItem>
                            <SelectItem value="minibus_8">Minibus (8 people)</SelectItem>
                            <SelectItem value="pet_friendly_car" className="text-green-600 dark:text-green-400 font-medium">Pet Friendly Car</SelectItem>
                            <SelectItem value="minibus_6_pet_friendly" className="text-green-600 dark:text-green-400 font-medium">Pet Friendly Minibus (6 ppl)</SelectItem>
                            <SelectItem value="minibus_8_pet_friendly" className="text-green-600 dark:text-green-400 font-medium">Pet Friendly Minibus (8 ppl)</SelectItem>
                            <SelectItem value="disable_wheelchair_access" className="text-blue-600 dark:text-blue-400 font-medium">Wheelchair Accessible</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passengers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /> Number of Passengers</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="10" placeholder="1" {...field}
                           onChange={e => field.onChange(parseInt(e.target.value,10) || 1)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="driverNotes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center gap-1"><StickyNote className="w-4 h-4 text-muted-foreground" /> Notes for Driver (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Ring bell twice, wait at side entrance." {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                 <FormField
                    control={form.control}
                    name="waitAndReturn"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-primary/5">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <RefreshCwIcon className="w-5 h-5 text-primary" />
                            Wait & Return Journey?
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Adds {WAIT_AND_RETURN_SURCHARGE_PERCENTAGE * 100}% of one-way fare + waiting time.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) setIsWaitTimeDialogOpen(true);
                              else form.setValue('estimatedWaitTimeMinutes', undefined);
                            }}
                            aria-label="Toggle Wait and Return"
                            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/30"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchedWaitAndReturn && (
                         <Alert variant="default" className="bg-primary/10 border-primary/30">
                            <Info className="h-5 w-5 text-primary"/>
                            <ShadAlertTitle className="text-primary font-semibold">Wait & Return Details</ShadAlertTitle>
                            <AlertDescription className="text-primary/90 text-sm">
                                Estimated wait at destination: {watchedEstimatedWaitTimeMinutes || 0} mins.
                                (First {FREE_WAITING_TIME_MINUTES_AT_DESTINATION} mins free, then £{WAITING_CHARGE_PER_MINUTE_AT_DESTINATION.toFixed(2)}/min).
                                <Button type="button" variant="link" size="sm" onClick={() => setIsWaitTimeDialogOpen(true)} className="p-0 h-auto ml-1 text-primary/80 hover:text-primary">
                                    (Edit Wait Time)
                                </Button>
                            </AlertDescription>
                        </Alert>
                  )}
                   <FormField
                    control={form.control}
                    name="isPriorityPickup"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-orange-500/10">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-300">
                            <Crown className="w-5 h-5" />
                            Priority Pickup?
                            </FormLabel>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                            Offer an extra fee to prioritize your booking during busy times.
                            </p>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) setIsPriorityFeeDialogOpen(true);
                                else form.setValue('priorityFeeAmount', undefined);
                            }}
                            aria-label="Toggle Priority Pickup"
                            className="data-[state=checked]:bg-orange-600 data-[state=unchecked]:bg-orange-500/30"
                            />
                        </FormControl>
                        </FormItem>
                    )}
                    />
                  {watchedIsPriorityPickup && (
                         <Alert variant="default" className="bg-orange-500/10 border-orange-500/30">
                            <Info className="h-5 w-5 text-orange-600"/>
                            <ShadAlertTitle className="text-orange-700 dark:text-orange-300 font-semibold">Priority Fee Details</ShadAlertTitle>
                            <AlertDescription className="text-orange-600 dark:text-orange-400 text-sm">
                                Priority Fee: £{(watchedPriorityFeeAmount || 0).toFixed(2)}. This will be added to your total fare.
                                <Button type="button" variant="link" size="sm" onClick={() => setIsPriorityFeeDialogOpen(true)} className="p-0 h-auto ml-1 text-orange-700/80 dark:text-orange-300/80 hover:text-orange-700 dark:hover:text-orange-300">
                                    (Edit Fee)
                                </Button>
                            </AlertDescription>
                        </Alert>
                  )}
                  <FormField
                    control={form.control}
                    name="promoCode"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center gap-1"><Ticket className="w-4 h-4 text-muted-foreground" /> Promo Code (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g., FIRST RIDE" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                        <FormLabel className="text-base">Payment Method</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={(value) => {
                                  const currentVal = form.getValues("paymentMethod");
                                  setPreviousPaymentMethod(currentVal); 
                                  field.onChange(value); 

                                  if (value === "account") {
                                    setIsAccountJobAuthPinVerified(false); 
                                    setAccountJobAuthPinInput(""); 
                                    setIsAccountJobAuthPinDialogOpen(true);
                                  } else {
                                    setIsAccountJobAuthPinVerified(false); 
                                  }
                                }}
                                value={field.value}
                                className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="card" id="card" /></FormControl>
                                    <FormLabel htmlFor="card" className="font-normal flex items-center gap-1">
                                    <CreditCard className="w-4 h-4 text-blue-500" /> Card (Pay Driver)
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="cash" id="cash" /></FormControl>
                                    <FormLabel htmlFor="cash" className="font-normal flex items-center gap-1">
                                    <Coins className="w-4 h-4 text-green-500" /> Cash
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="account" id="account" /></FormControl>
                                    <FormLabel htmlFor="account" className="font-normal flex items-center gap-1">
                                      <Briefcase className="w-4 h-4 text-purple-500" /> Account
                                      {field.value === "account" && (
                                        isAccountJobAuthPinVerified 
                                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" />
                                          : <AlertTriangle className="w-3.5 h-3.5 text-orange-500 ml-1" />
                                      )}
                                    </FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />


                  <Button
                    type="button"
                    onClick={handleProceedToConfirmation}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-3 mt-8"
                    disabled={anyFetchingDetails || isBooking || !pickupCoords || !dropoffCoords || isLoadingSurgeSetting || availabilityStatusLevel === 'unavailable' || availabilityStatusLevel === 'loading'}
                  >
                     {isLoadingSurgeSetting || availabilityStatusLevel === 'loading' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" /> }
                     {isLoadingSurgeSetting || availabilityStatusLevel === 'loading' ? 'Loading Settings...' : 'Review & Confirm Ride'}
                  </Button>

                  <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
                    <DialogContent className="book-ride-confirmation-dialog sm:max-w-md grid grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh] p-0">
                      <>
                        <DialogHeader className="p-6 pb-4 border-b">
                          <ShadDialogTitle className="text-xl font-headline">Confirm Your Booking</ShadDialogTitle>
                          <ShadDialogDescription>
                            Please review your ride details and confirm payment.
                          </ShadDialogDescription>
                        </DialogHeader>
                        <ScrollArea className="overflow-y-auto">
                          <div className="px-6 pt-6 pb-2 space-y-3">
                            <Card className="w-full text-center shadow-md bg-primary/10 border-primary/30">
                              <CardHeader className="p-3">
                                <CardTitle className="text-lg font-bold font-headline flex items-center justify-center gap-2">
                                  <DollarSign className="w-5 h-5 text-primary" /> Fare Details
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3 pt-0 space-y-1">
                                {anyFetchingDetails && pickupCoords ? (
                                  <div className="flex flex-col items-center justify-center space-y-1">
                                      <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                                      <p className="text-lg font-bold text-muted-foreground">Calculating...</p>
                                  </div>
                                ) : baseFareEstimate !== null && totalFareEstimate !== null ? (
                                  <>
                                    <p className="text-sm text-muted-foreground font-bold">Base Fare: £{baseFareEstimate.toFixed(2)}</p>
                                    {(watchedVehicleType === "pet_friendly_car" || watchedVehicleType === "minibus_6_pet_friendly" || watchedVehicleType === "minibus_8_pet_friendly") && <p className="text-sm text-green-600 dark:text-green-400 font-bold">Pet Fee: + £{PET_FRIENDLY_SURCHARGE.toFixed(2)}</p>}
                                    {watchedVehicleType === "disable_wheelchair_access" && <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">Wheelchair Access surcharge applied</p>}
                                    {watchedIsPriorityPickup && watchedPriorityFeeAmount ? (
                                      <p className="text-sm text-orange-600 dark:text-orange-400 font-bold">Priority Fee: + £{watchedPriorityFeeAmount.toFixed(2)}</p>
                                    ) : null}
                                    <div className="text-2xl font-bold text-white bg-green-600 px-3 py-1.5 rounded-md inline-block my-1">Total: £{totalFareEstimate.toFixed(2)}</div>
                                    {isSurgeActive && (
                                      <p className="text-xs font-semibold text-orange-500 flex items-center justify-center gap-1">
                                        <Zap className="w-3 h-3" /> Surge Pricing Applied ({currentSurgeMultiplier}x)
                                      </p>
                                    )}
                                     {watchedWaitAndReturn && <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 font-bold">(Includes Wait & Return Surcharges)</p>}
                                     <p className="text-xs text-muted-foreground mt-1 font-bold">
                                        Estimates may vary based on real-time conditions.
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-lg text-muted-foreground font-bold">Enter pickup & drop-off to see fare.</p>
                                )}
                              </CardContent>
                            </Card>

                            <Card className="shadow-md bg-accent/5 border-accent/20">
                              <CardHeader className="p-3">
                                <CardTitle className="text-lg font-bold font-headline flex items-center gap-2">
                                  <CreditCard className="w-5 h-5 text-primary" /> Payment Method
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-2 pt-0"> 
                                <FormField
                                  control={form.control}
                                  name="paymentMethod"
                                  render={({ field }) => (
                                    <FormItem className="space-y-2"> 
                                      <FormControl>
                                        <RadioGroup
                                          onValueChange={(value) => {
                                            const currentVal = form.getValues("paymentMethod");
                                            setPreviousPaymentMethod(currentVal);
                                            field.onChange(value);
                                            if (value === "account") {
                                              setIsAccountJobAuthPinVerified(false);
                                              setIsAccountJobAuthPinDialogOpen(true);
                                            } else {
                                              setIsAccountJobAuthPinVerified(false);
                                            }
                                          }}
                                          value={field.value}
                                          className="grid grid-cols-1 gap-1.5" 
                                        >
                                          <FormItem className="flex-1">
                                            <FormControl>
                                              <RadioGroupItem value="card" id="dialog-card" className="sr-only peer" />
                                            </FormControl>
                                            <Label
                                              htmlFor="dialog-card"
                                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover px-2 py-1.5 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                              <CreditCard className="mb-0.5 h-5 w-5 text-primary peer-data-[state=checked]:text-primary" />
                                              Pay by Card
                                              <span className="text-xs text-muted-foreground"> (pay driver directly)</span>
                                            </Label>
                                          </FormItem>
                                          <FormItem className="flex-1">
                                            <FormControl>
                                              <RadioGroupItem value="cash" id="dialog-cash" className="sr-only peer" />
                                            </FormControl>
                                            <Label
                                              htmlFor="dialog-cash"
                                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover px-2 py-1.5 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                              <Coins className="mb-0.5 h-5 w-5 text-green-600 peer-data-[state=checked]:text-green-600" />
                                              Pay with Cash
                                              <span className="text-xs text-muted-foreground"> (pay cash to driver)</span>
                                            </Label>
                                          </FormItem>
                                           <FormItem className="flex-1">
                                            <FormControl>
                                              <RadioGroupItem value="account" id="dialog-account" className="sr-only peer" />
                                            </FormControl>
                                            <Label
                                              htmlFor="dialog-account"
                                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover px-2 py-1.5 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                              <Briefcase className="mb-0.5 h-5 w-5 text-purple-600 peer-data-[state=checked]:text-purple-600" />
                                                Account
                                                {field.value === "account" && isAccountJobAuthPinVerified 
                                                  ? <span className="text-xs text-green-500">(PIN Verified)</span>
                                                  : <span className="text-xs text-orange-500">(PIN Required)</span>
                                                }
                                              <span className="text-xs text-muted-foreground">(Operator will bill)</span>
                                            </Label>
                                          </FormItem>
                                        </RadioGroup>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </CardContent>
                            </Card>
                          </div> 
                        </ScrollArea>
                        <DialogFooter className="p-6 pt-4 border-t">
                          <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isBooking}>Back to Edit</Button>
                          </DialogClose>
                          <Button
                            type="button"
                            onClick={() => form.handleSubmit(handleBookRide)()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            disabled={!totalFareEstimate || form.formState.isSubmitting || anyFetchingDetails || isBooking || (form.getValues("paymentMethod") === "account" && !isAccountJobAuthPinVerified)}
                          >
                            {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {isBooking ? 'Processing Booking...' : 'Confirm & Book Ride'}
                          </Button>
                        </DialogFooter>
                      </>
                    </DialogContent>
                  </Dialog>

                </form>
              </Form>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={saveRouteDialogOpen} onOpenChange={setSaveRouteDialogOpen}>
        <DialogContent>
          <ShadDialogTitle><span>Save Current Route</span></ShadDialogTitle>
          <ShadDialogDescription><span>Enter a label for this route (e.g., Home to Work, Airport Trip).</span></ShadDialogDescription>
          <div className="py-4">
            <Label htmlFor="routeLabel" className="sr-only">Route Label</Label>
            <Input
              id="routeLabel"
              value={newRouteLabel}
              onChange={(e) => setNewRouteLabel(e.target.value)}
              placeholder="e.g., My Daily Commute"
              disabled={isSavingRoute}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSavingRoute}>Cancel</Button>
            </DialogClose>
            <Button onClick={submitSaveRoute} disabled={isSavingRoute || !newRouteLabel.trim()}>
              {isSavingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWaitTimeDialogOpen} onOpenChange={setIsWaitTimeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <ShadDialogTitle className="flex items-center gap-2"><Timer className="w-5 h-5 text-primary"/> Estimated Waiting Time</ShadDialogTitle>
          <ShadDialogDescription>
            How long do you estimate you&apos;ll need the driver to wait at the destination before starting the return journey?
            (10 minutes free, then £{WAITING_CHARGE_PER_MINUTE_AT_DESTINATION.toFixed(2)}/min)
          </ShadDialogDescription>
          <div className="py-4 space-y-2">
            <Label htmlFor="wait-time-input">Wait Time (minutes)</Label>
            <Input
              id="wait-time-input"
              ref={waitTimeInputRef}
              type="number"
              min="0"
              value={estimatedWaitMinutesInput}
              onChange={(e) => setEstimatedWaitMinutesInput(e.target.value)}
              placeholder="e.g., 15"
            />
            <p className="text-xs text-muted-foreground">
              If actual wait exceeds this, extra charges may apply.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleWaitAndReturnDialogCancel}>Cancel W&R</Button>
            <Button type="button" onClick={handleWaitAndReturnDialogConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">Confirm Wait Time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriorityFeeDialogOpen} onOpenChange={setIsPriorityFeeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <ShadDialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-300"><Crown className="w-5 h-5"/> Set Priority Fee</ShadDialogTitle>
          <ShadDialogDescription>
            Offer an extra amount to prioritize your booking. This will be added to your total fare. Minimum £0.50.
          </ShadDialogDescription>
          <div className="py-4 space-y-2">
            <Label htmlFor="priority-fee-input">Extra Amount (£)</Label>
            <Input
              id="priority-fee-input"
              ref={priorityFeeInputRef}
              type="number"
              min="0.50"
              step="0.50"
              value={priorityFeeInput}
              onChange={(e) => setPriorityFeeInput(e.target.value)}
              placeholder="e.g., 2.00"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePriorityFeeDialogCancel}>Cancel Priority</Button>
            <Button type="button" onClick={handlePriorityFeeDialogConfirm} className="bg-orange-500 hover:bg-orange-600 text-white">Set Priority Fee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Account Job Authorization PIN Dialog (6-digit) */}
      <Dialog open={isAccountJobAuthPinDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen && form.getValues("paymentMethod") === "account" && !isAccountJobAuthPinVerified) {
          form.setValue("paymentMethod", previousPaymentMethod);
          toast({ title: "PIN Entry Cancelled", description: `Payment method reverted to ${previousPaymentMethod}.`, variant: "default" });
        }
        setIsAccountJobAuthPinDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <ShadDialogTitle className="flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-primary"/> Account Job Authorization</ShadDialogTitle>
            <ShadDialogDescription>
              Please enter your 6-digit authorization PIN for account bookings. (Hint: 123456)
            </ShadDialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="account-job-auth-pin">Enter 6-Digit PIN</Label>
            <Input
              id="account-job-auth-pin"
              type={accountJobAuthPinInputType}
              inputMode="numeric"
              value={accountJobAuthPinInput}
              onChange={handleAccountAuthPinInputChange}
              maxLength={6}
              placeholder="••••••"
              className="text-center text-xl tracking-[0.3em]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              form.setValue("paymentMethod", previousPaymentMethod);
              setIsAccountJobAuthPinVerified(false);
              setAccountJobAuthPinInput("");
              setAccountJobAuthPinInputType('password');
              setIsAccountJobAuthPinDialogOpen(false);
              toast({ title: "PIN Entry Cancelled", description: `Payment method reverted to ${previousPaymentMethod}.`, variant: "default" });
            }}>Cancel & Change Payment</Button>
            <Button type="button" onClick={handleAccountJobAuthPinConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">Confirm PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          {/* Enhanced Queued Booking Dialog */}
          <Dialog open={isQueuedBookingDialogOpen} onOpenChange={setIsQueuedBookingDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <>
                <DialogHeader>
                  <ShadDialogTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Book and Wait for Driver
                  </ShadDialogTitle>
                  <ShadDialogDescription>
                    No drivers are currently available in your area. You can proceed with your booking and it will be assigned as soon as a driver becomes available.
                    {operatorPreference && ` Your booking will be prioritized for ${operatorPreference} drivers.`}
                  </ShadDialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-semibold text-orange-800">What happens next?</h4>
                        <ul className="text-sm text-orange-700 space-y-1">
                          <li>• Your booking will be queued in our system</li>
                          <li>• We&apos;ll notify you as soon as a driver is assigned</li>
                          <li>• Estimated wait time: ~{estimatedWaitTime || 15} minutes</li>
                          <li>• If no driver is found within 30 minutes, you&apos;ll be notified</li>
                          <li>• You can cancel anytime before driver assignment</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {operatorPreference && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-800">
                          Booking with <strong>{operatorPreference}</strong> - will be assigned to their drivers when available
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsQueuedBookingDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmQueuedBooking} className="bg-orange-500 hover:bg-orange-600">
                    Proceed with Booking
                  </Button>
                </DialogFooter>
              </>
            </DialogContent>
          </Dialog>

          {/* Booking Queued Confirmation */}
          {bookingQueued && (
            <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200">
              <Clock className="h-5 w-5 text-blue-600" />
              <ShadAlertTitle className="text-blue-800 font-semibold">Booking Queued Successfully!</ShadAlertTitle>
              <AlertDescription className="text-blue-700">
                Your ride has been queued and will be assigned as soon as a driver becomes available. 
                We'll notify you when your driver is on the way.
                {estimatedWaitTime && (
                  <span className="block mt-1 font-medium">
                    Estimated wait time: ~{estimatedWaitTime} minutes
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {showBookingForm && (
            <div>
              {/* The booking form is already rendered above, so we don't need to duplicate it here */}
              <p className="text-sm text-muted-foreground text-center py-4">
                Booking form is ready. Please fill in your journey details above.
              </p>
            </div>
          )}

          {bookingQueued && (
            <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded">
              <p>
                Your booking has been received and is waiting for the next available driver.<br />
                We'll notify you as soon as your ride is assigned.
              </p>
            </div>
          )}



        </div>
      ) : null}
    </div>
  );
}
    

    











    







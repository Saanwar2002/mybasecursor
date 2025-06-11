
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Car, DollarSign, Users, Loader2, Zap, Route, PlusCircle, XCircle, Calendar as CalendarIcon, Clock, Star, StickyNote, Save, List, Trash2, User as UserIcon, Home as HomeIcon, MapPin as StopMarkerIcon, Mic, Ticket, CalendarClock, Building, AlertTriangle, Info, LocateFixed, CheckCircle2, CreditCard, Coins, Send, Wifi, BadgeCheck, ShieldAlert, Edit, RefreshCwIcon, Timer, AlertCircle, Crown, Dog, Wheelchair, Briefcase } from 'lucide-react'; // Added Briefcase
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader } from '@googlemaps/js-api-loader';
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
import { parseBookingRequest, ParseBookingRequestInput, ParseBookingRequestOutput } from '@/ai/flows/parse-booking-request-flow';
import { useSearchParams, useRouter } from 'next/navigation';
import { Switch } from "@/components/ui/switch";


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

export default function BookRidePage() {
  const [baseFareEstimate, setBaseFareEstimate] = useState<number | null>(null);
  const [totalFareEstimate, setTotalFareEstimate] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [driverArrivalInfo, setDriverArrivalInfo] = useState<{ pickupLocation: string } | null>(null);

  const [suggestedGpsPickup, setSuggestedGpsPickup] = useState<{ address: string, coords: google.maps.LatLngLiteral, accuracy: number } | null>(null);
  const [geolocationFetchStatus, setGeolocationFetchStatus] = useState<GeolocationFetchStatus>("idle");
  const [showGpsSuggestionAlert, setShowGpsSuggestionAlert] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [availabilityStatusMessage, setAvailabilityStatusMessage] = useState("Checking availability in your area...");
  const [mapBusynessLevel, setMapBusynessLevel] = useState<'idle' | 'moderate' | 'high'>('idle');
  const [isNoDriversAvailableMock, setIsNoDriversAvailableMock] = useState(false);

  const searchParams = useSearchParams();
  const operatorPreference = searchParams.get('operator_preference');

  const [isWaitTimeDialogOpen, setIsWaitTimeDialogOpen] = useState(false);
  const [estimatedWaitMinutesInput, setEstimatedWaitMinutesInput] = useState<string>("10");
  const [calculatedChargedWaitMinutes, setCalculatedChargedWaitMinutes] = useState<number>(0);
  const waitTimeInputRef = useRef<HTMLInputElement>(null);

  const [isPriorityFeeDialogOpen, setIsPriorityFeeDialogOpen] = useState(false);
  const [priorityFeeInput, setPriorityFeeInput] = useState<string>("2.00");
  const priorityFeeInputRef = useRef<HTMLInputElement>(null);


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
      // A new stop was added
      const newStopIndex = fields.length - 1;
      // Delay slightly to ensure the input is rendered and focusable
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

 useEffect(() => {
    setIsCheckingAvailability(true);
    setIsNoDriversAvailableMock(false);
    let message = "Checking availability...";
    setAvailabilityStatusMessage(message);

    const mockOperators = [
        { id: "OP001", name: "MyBase Direct"},
        { id: "OP002", name: "City Cabs"},
        { id: "OP003", name: "Speedy Cars"},
        { id: "OP004", name: "Alpha Taxis"}
    ];
    const randomWaitTimes = ["2-4 mins", "4-7 mins", "6-10 mins", "8-12 mins", "10-15 mins"];

    const timer = setTimeout(() => {
        const noDriversOverall = Math.random() < 0.2; // 20% chance no drivers AT ALL

        if (noDriversOverall) {
            message = "Currently, no drivers are available in your area. Please try again shortly. (Mock)";
            setIsNoDriversAvailableMock(true);
        } else {
            const randomWait = randomWaitTimes[Math.floor(Math.random() * randomWaitTimes.length)];
            if (operatorPreference) {
                const preferredOpDetails = mockOperators.find(op => op.id === operatorPreference || op.name === operatorPreference);
                const preferredOpDisplayName = preferredOpDetails ? preferredOpDetails.name : operatorPreference;
                const preferredOpAvailable = Math.random() < 0.7;

                if (preferredOpAvailable) {
                    message = `${preferredOpDisplayName} driver available. Est. wait: ~${randomWait}. (Mock)`;
                } else {
                    const fallbackOpCandidates = mockOperators.filter(op => (op.id !== operatorPreference && op.name !== operatorPreference));
                    const fallbackOp = fallbackOpCandidates.length > 0 ? fallbackOpCandidates[Math.floor(Math.random() * fallbackOpCandidates.length)] : {name: "Another operator"};
                    const fallbackWait = randomWaitTimes[Math.floor(Math.random() * randomWaitTimes.length)];
                    message = `${preferredOpDisplayName} is busy. ${fallbackOp.name} driver available in ~${fallbackWait}. (Mock)`;
                }
            } else { // Passenger lets app decide
                const specificOpFound = Math.random() < 0.6;
                if (specificOpFound) {
                    const bestOp = mockOperators[Math.floor(Math.random() * mockOperators.length)];
                    message = `${bestOp.name} driver available. Est. wait: ~${randomWait}. (Mock)`;
                } else {
                     message = `MyBase driver available. Est. wait: ~${randomWait}. (Mock)`;
                }
            }
        }
        setAvailabilityStatusMessage(message);
        setIsCheckingAvailability(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [operatorPreference, pickupCoords]); // Re-run if operatorPreference or pickupCoords changes


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
        return;
    }
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["geocoding", "maps", "marker", "places"],
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const mapDivForPlaces = document.createElement('div'); 
      placesServiceRef.current = new google.maps.places.PlacesService(mapDivForPlaces);
      geocoderRef.current = new google.maps.Geocoder();
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

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
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        setGeolocationFetchStatus("error_unavailable");
        setShowGpsSuggestionAlert(false);
      }
    }).catch(e => {
        console.error("Failed to load Google Maps API for address search:", e);
        toast({ title: "Error", description: "Could not load address search functionality.", variant: "destructive"});
    });
  }, [toast]);

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
      setFavoriteLocations(data);
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
      setSavedRoutes(data);
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
    if (!autocompleteServiceRef.current || inputValue.length < 2) {
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
  }, []);

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
    if (placesServiceRef.current && suggestion.place_id) {
      placesServiceRef.current.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['geometry.location', 'formatted_address', 'address_components'], // Updated fields
          sessionToken: autocompleteSessionTokenRef.current
        },
        (place, status) => {
          setIsFetchingDetailsFunc(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const finalAddressToSet = place.formatted_address || addressText;
            setCoordsFunc({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            formOnChange(finalAddressToSet); // Update the form field with the full address
            
            // Update the local input value state
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
            formOnChange(addressText); // Fallback to original suggestion text
            setCoordsFunc(null);
             if (typeof formFieldNameOrStopIndex === 'number') {
                setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, inputValue: addressText, showSuggestions: false } : item));
            } else if (formFieldNameOrStopIndex === 'pickupLocation') {
                setPickupInputValue(addressText); setShowPickupSuggestions(false);
            } else {
                setDropoffInputValue(addressText); setShowDropoffSuggestions(false);
            }
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else {
      setIsFetchingDetailsFunc(false);
      formOnChange(addressText); // Fallback to original suggestion text
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
  }, [toast, placesServiceRef, autocompleteSessionTokenRef, form]);


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
        } else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
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
        else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
            fetchAddressSuggestions(currentInputValue, setPickupSuggestions, setIsFetchingPickupSuggestions);
            setShowPickupSuggestions(true);
        } else setShowPickupSuggestions(false);
    } else {
        currentInputValue = dropoffInputValue;
        currentSuggestions = dropoffSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowDropoffSuggestions(true);
        else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
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
    // Focus will be handled by the useEffect hook watching `fields`
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
    const newMarkers: MapMarker[] = [];
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
    setMapMarkers(newMarkers);
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, form, watchedStops]);


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

    let scheduledPickupAt: string | undefined = undefined;
    if (values.bookingType === 'scheduled' && values.desiredPickupDate && values.desiredPickupTime) {
      const [hours, minutes] = values.desiredPickupTime.split(':').map(Number);
      const combinedDateTime = new Date(values.desiredPickupDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      scheduledPickupAt = combinedDateTime.toISOString();
    }

    setIsBooking(true);

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

      let toastDescription = `Ride ID: ${result.bookingId}. `;
      if (values.bookingType === 'asap' && !scheduledPickupAt) {
          toastDescription += `We'll notify you when your driver is on the way. `;
      } else {
          toastDescription += `Your driver will be assigned shortly for the scheduled time. `;
      }

      if (values.paymentMethod === 'cash') toastDescription += `Payment: Cash to driver.`;
      else if (values.paymentMethod === 'card') toastDescription += `Payment: Card (Pay driver directly).`;
      else if (values.paymentMethod === 'account') toastDescription += `Payment: Via Account (Operator will bill).`;
      
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
        duration: 7000
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
      setMapMarkers([]);
      setPickupSuggestions([]);
      setDropoffSuggestions([]);
      setGeolocationFetchStatus('idle');
      setShowGpsSuggestionAlert(false);
      setSuggestedGpsPickup(null);
      setCalculatedChargedWaitMinutes(0);
      setEstimatedWaitMinutesInput("10");
      setPriorityFeeInput("2.00");
      
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
    if (!autocompleteServiceRef.current || !placesServiceRef.current || !addressString) {
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
  }, [form, toast]);

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

    recognitionRef.current.onresult = async (event) => {
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

    recognitionRef.current.onerror = (event) => {
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

 const handleMicMouseDown = async () => {
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

  const handleMicMouseUpOrLeave = () => {
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

  const currentMapCenter = pickupCoords || huddersfieldCenter;

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
    if (form.getValues("stops") && form.getValues("stops").length > 0) {
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


  return (
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
                            <List className="w-3.5 h-3.5" /> Load Route
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
                    center={currentMapCenter}
                    zoom={(pickupCoords || dropoffCoords || stopAutocompleteData.some(s=>s.coords)) ? 13 : 12}
                    markers={mapMarkers}
                    className="w-full h-full"
                    disableDefaultUI={true}
                 />
              </div>

            <Card className={cn(
                "mb-4 shadow-sm",
                isNoDriversAvailableMock ? "bg-red-500/10 border-red-500/30" : "bg-primary/5 border-primary/20"
                )}>
                <CardContent className="p-3 text-center">
                    {isCheckingAvailability ? (
                        <div className="flex items-center justify-center text-sm text-primary">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {availabilityStatusMessage}
                        </div>
                    ) : (
                        <p className={cn(
                            "text-sm font-medium flex items-center justify-center gap-1.5",
                            isNoDriversAvailableMock ? "text-red-600" : "text-primary"
                            )}>
                           {isNoDriversAvailableMock ? <AlertTriangle className="w-4 h-4" /> : <BadgeCheck className="w-4 h-4 text-green-500" />}
                           {availabilityStatusMessage}
                        </p>
                    )}
                </CardContent>
            </Card>

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
                         <Button type="button" variant={isListening ? "destructive" : "outline"} size="icon" 
                            className={cn("h-7 w-7", isListening && "animate-pulse ring-2 ring-destructive ring-offset-2", isProcessingAi && "opacity-50 cursor-not-allowed")}
                            onMouseDown={handleMicMouseDown} onMouseUp={handleMicMouseUpOrLeave} onMouseLeave={handleMicMouseUpOrLeave} onTouchStart={handleMicMouseDown} onTouchEnd={handleMicMouseUpOrLeave}
                            disabled={isProcessingAi}
                            aria-label="Use voice input for booking"
                            >
                            {isProcessingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                        </Button>
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
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-1">
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
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        {/* No FormMessage here as it's handled by the main form's superRefine */}
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
                                onValueChange={field.onChange}
                                defaultValue={field.value}
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
                                    <Briefcase className="w-4 h-4 text-purple-500" /> Account (If eligible)
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
                    disabled={anyFetchingDetails || isBooking || !pickupCoords || !dropoffCoords || isLoadingSurgeSetting || isNoDriversAvailableMock}
                  >
                     {isLoadingSurgeSetting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" /> }
                     {isLoadingSurgeSetting ? 'Loading Settings...' : 'Review & Confirm Ride'}
                  </Button>

                  <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
                    <DialogContent className="book-ride-confirmation-dialog sm:max-w-md grid grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh] p-0">
                      <DialogHeader className="p-6 pb-4 border-b">
                        <ShadDialogTitle className="text-xl font-headline">Confirm Your Booking</ShadDialogTitle>
                        <ShadDialogDescription>
                          Please review your ride details and confirm payment.
                        </ShadDialogDescription>
                      </DialogHeader>
                      <ScrollArea className="overflow-y-auto">
                        <div className="p-6 space-y-4">
                          <Card className="w-full text-center shadow-md">
                            <CardHeader className="p-3">
                              <CardTitle className="text-lg font-headline flex items-center justify-center gap-2">
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
                                  <p className="text-sm text-muted-foreground">Base Fare: £{baseFareEstimate.toFixed(2)}</p>
                                  {(watchedVehicleType === "pet_friendly_car" || watchedVehicleType === "minibus_6_pet_friendly" || watchedVehicleType === "minibus_8_pet_friendly") && <p className="text-sm text-green-600 dark:text-green-400">Pet Fee: + £{PET_FRIENDLY_SURCHARGE.toFixed(2)}</p>}
                                  {watchedVehicleType === "disable_wheelchair_access" && <p className="text-sm text-blue-600 dark:text-blue-400">Wheelchair Access Surcharge Applied</p>}
                                  {watchedIsPriorityPickup && watchedPriorityFeeAmount ? (
                                    <p className="text-sm text-orange-600 dark:text-orange-400">Priority Fee: + £{watchedPriorityFeeAmount.toFixed(2)}</p>
                                  ) : null}
                                  <p className="text-2xl font-bold text-primary">Total: £{totalFareEstimate.toFixed(2)}</p>
                                  {isSurgeActive && (
                                    <p className="text-xs font-semibold text-orange-500 flex items-center justify-center gap-1">
                                      <Zap className="w-3 h-3" /> Surge Pricing Applied ({currentSurgeMultiplier}x)
                                    </p>
                                  )}
                                   {watchedWaitAndReturn && <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">(Includes Wait & Return Surcharges)</p>}
                                   <p className="text-xs text-muted-foreground mt-1">
                                      Estimates may vary based on real-time conditions.
                                  </p>
                                </>
                              ) : (
                                <p className="text-lg text-muted-foreground">Enter pickup & drop-off to see fare.</p>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="shadow-md bg-gradient-to-r from-accent/5 via-transparent to-primary/5">
                            <CardHeader className="p-3">
                              <CardTitle className="text-lg font-headline flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" /> Payment Method
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                              <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                  <FormItem className="space-y-3">
                                    <FormControl>
                                      <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="grid grid-cols-1 gap-3"
                                      >
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <RadioGroupItem value="card" id="dialog-card" className="sr-only peer" />
                                          </FormControl>
                                          <Label
                                            htmlFor="dialog-card"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                          >
                                            <CreditCard className="mb-2 h-6 w-6 text-primary peer-data-[state=checked]:text-primary" />
                                            Pay by Card
                                            <span className="text-xs text-muted-foreground mt-0.5">(pay driver directly)</span>
                                          </Label>
                                        </FormItem>
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <RadioGroupItem value="cash" id="dialog-cash" className="sr-only peer" />
                                          </FormControl>
                                          <Label
                                            htmlFor="dialog-cash"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                          >
                                            <Coins className="mb-2 h-6 w-6 text-green-600 peer-data-[state=checked]:text-green-600" />
                                            Pay with Cash
                                            <span className="text-xs text-muted-foreground mt-0.5">(pay cash to driver)</span>
                                          </Label>
                                        </FormItem>
                                         <FormItem className="flex-1">
                                          <FormControl>
                                            <RadioGroupItem value="account" id="dialog-account" className="sr-only peer" />
                                          </FormControl>
                                          <Label
                                            htmlFor="dialog-account"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                          >
                                            <Briefcase className="mb-2 h-6 w-6 text-purple-600 peer-data-[state=checked]:text-purple-600" />
                                            Pay via Account
                                            <span className="text-xs text-muted-foreground mt-0.5">(If eligible, operator will bill)</span>
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
                          disabled={!totalFareEstimate || form.formState.isSubmitting || anyFetchingDetails || isBooking}
                        >
                          {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                          {isBooking ? 'Processing Booking...' : 'Confirm & Book Ride'}
                        </Button>
                      </DialogFooter>
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
          <ShadDialogTitle>Save Current Route</ShadDialogTitle>
          <ShadDialogDescription>
            Enter a label for this route (e.g., Home to Work, Airport Trip).
          </ShadDialogDescription>
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
            <Button type="button" variant="outline" onClick={handleWaitAndReturnDialogCancel}>
              Cancel W&R
            </Button>
            <Button type="button" onClick={handleWaitAndReturnDialogConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Confirm Wait Time
            </Button>
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
            {/* Removed FormMessage as it caused context error */}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePriorityFeeDialogCancel}>
              Cancel Priority
            </Button>
            <Button type="button" onClick={handlePriorityFeeDialogConfirm} className="bg-orange-500 hover:bg-orange-600 text-white">
              Set Priority Fee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    

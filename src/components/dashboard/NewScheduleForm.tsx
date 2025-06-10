
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
import { MapPin, Car, DollarSign, Users, Loader2, Route, PlusCircle, XCircle, Calendar as CalendarIcon, Clock, Star, StickyNote, Save, List, Trash2, User as UserIcon, Home as HomeIcon, MapPin as StopMarkerIcon, Mic, Ticket, CalendarClock, Building, AlertTriangle, Info, LocateFixed, CheckCircle2, CreditCard, Coins, Send, Wifi, BadgeCheck, ShieldAlert, Edit, RefreshCwIcon, Timer, AlertCircle, Crown, Dog, Wheelchair, Play, Briefcase } from 'lucide-react'; // Added Briefcase
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader as GoogleApiLoader } from '@googlemaps/js-api-loader';
import { useAuth } from '@/contexts/auth-context';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, set, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { ScheduledBooking } from '@/app/(app)/dashboard/scheduled-rides/page';
import { Separator } from '@/components/ui/separator';


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

interface AutocompleteData {
  fieldId: string;
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
}

const huddersfieldCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

const daysOfWeekEnum = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const scheduledRideFormSchema = z.object({
  label: z.string().min(3, { message: "Schedule label must be at least 3 characters." }).max(50, { message: "Label too long."}),
  pickupDoorOrFlat: z.string().max(50).optional(),
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffDoorOrFlat: z.string().max(50).optional(),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array(
    z.object({
      doorOrFlat: z.string().max(50).optional(),
      location: z.string().min(3, { message: "Stop location must be at least 3 characters." })
    })
  ).optional(),
  vehicleType: z.enum([
    "car", "estate", "minibus_6", "minibus_8",
    "pet_friendly_car", "disable_wheelchair_access",
    "minibus_6_pet_friendly", "minibus_8_pet_friendly"
  ], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
  daysOfWeek: z.array(daysOfWeekEnum).min(1, { message: "Select at least one day for the schedule."}),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)."}),
  isReturnJourneyScheduled: z.boolean().default(false),
  returnPickupTime: z.string().optional().nullable(),
  isWaitAndReturnOutbound: z.boolean().default(false),
  estimatedWaitTimeMinutesOutbound: z.number().int().min(0).optional().nullable(),
  driverNotes: z.string().max(200, { message: "Notes cannot exceed 200 characters."}).optional().nullable(),
  paymentMethod: z.enum(["card", "cash", "account"], { required_error: "Please select a payment method." }), // Added "account"
  estimatedFareOneWay: z.number().optional().nullable(),
  estimatedFareReturn: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.isReturnJourneyScheduled && (!data.returnPickupTime || !data.returnPickupTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Return pickup time is required and must be in HH:MM format if return journey is scheduled.",
      path: ["returnPickupTime"],
    });
  }
  if (data.isWaitAndReturnOutbound && (data.estimatedWaitTimeMinutesOutbound === undefined || data.estimatedWaitTimeMinutesOutbound === null || data.estimatedWaitTimeMinutesOutbound < 0)) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated wait time (outbound) is required for Wait & Return.",
        path: ["estimatedWaitTimeMinutesOutbound"],
    });
  }
});

type ScheduledRideFormValues = z.infer<typeof scheduledRideFormSchema>;

interface NewScheduleFormProps {
  initialData?: ScheduledBooking | null;
  isEditMode?: boolean;
}

// Fare calculation constants and helpers (copied from book-ride/page.tsx)
const BASE_FARE = 0.00;
const PER_MILE_RATE = 1.00;
const FIRST_MILE_SURCHARGE = 1.99;
const PER_MINUTE_RATE = 0.10;
const AVERAGE_SPEED_MPH = 15;
const BOOKING_FEE = 0.75;
const MINIMUM_FARE = 4.00;
const PER_STOP_SURCHARGE = 0.50;
const WAIT_AND_RETURN_SURCHARGE_PERCENTAGE = 0.70;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION = 10;
const WAITING_CHARGE_PER_MINUTE_AT_DESTINATION = 0.20;
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


export function NewScheduleForm({ initialData, isEditMode = false }: NewScheduleFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [stopAutocompleteData, setStopAutocompleteData] = useState<AutocompleteData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

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

  const form = useForm<ScheduledRideFormValues>({
    resolver: zodResolver(scheduledRideFormSchema),
    defaultValues: initialData ? {
        label: initialData.label,
        pickupDoorOrFlat: initialData.pickupLocation.doorOrFlat || "",
        pickupLocation: initialData.pickupLocation.address,
        dropoffDoorOrFlat: initialData.dropoffLocation.doorOrFlat || "",
        dropoffLocation: initialData.dropoffLocation.address,
        stops: initialData.stops?.map(s => ({ location: s.address, doorOrFlat: s.doorOrFlat || "" })) || [],
        vehicleType: initialData.vehicleType as any, 
        passengers: initialData.passengers,
        daysOfWeek: initialData.daysOfWeek as any[], 
        pickupTime: initialData.pickupTime,
        isReturnJourneyScheduled: initialData.isReturnJourneyScheduled,
        returnPickupTime: initialData.returnPickupTime || "",
        isWaitAndReturnOutbound: initialData.isWaitAndReturnOutbound,
        estimatedWaitTimeMinutesOutbound: initialData.estimatedWaitTimeMinutesOutbound === null ? undefined : initialData.estimatedWaitTimeMinutesOutbound,
        driverNotes: initialData.driverNotes || "",
        paymentMethod: initialData.paymentMethod,
        isActive: initialData.isActive,
        estimatedFareOneWay: initialData.estimatedFareOneWay,
        estimatedFareReturn: initialData.estimatedFareReturn,
    } : {
      label: "",
      pickupDoorOrFlat: "", pickupLocation: "",
      dropoffDoorOrFlat: "", dropoffLocation: "",
      stops: [], vehicleType: "car", passengers: 1, daysOfWeek: [], pickupTime: "09:00",
      isReturnJourneyScheduled: false, returnPickupTime: "",
      isWaitAndReturnOutbound: false, estimatedWaitTimeMinutesOutbound: 10,
      driverNotes: "", paymentMethod: "card", isActive: true,
      estimatedFareOneWay: null,
      estimatedFareReturn: null,
    },
  });
  
  useEffect(() => {
    if (isEditMode && initialData) {
        form.reset({
            label: initialData.label,
            pickupDoorOrFlat: initialData.pickupLocation.doorOrFlat || "",
            pickupLocation: initialData.pickupLocation.address,
            dropoffDoorOrFlat: initialData.dropoffLocation.doorOrFlat || "",
            dropoffLocation: initialData.dropoffLocation.address,
            stops: initialData.stops?.map(s => ({ location: s.address, doorOrFlat: s.doorOrFlat || "" })) || [],
            vehicleType: initialData.vehicleType as any,
            passengers: initialData.passengers,
            daysOfWeek: initialData.daysOfWeek as any[],
            pickupTime: initialData.pickupTime,
            isReturnJourneyScheduled: initialData.isReturnJourneyScheduled,
            returnPickupTime: initialData.returnPickupTime || "",
            isWaitAndReturnOutbound: initialData.isWaitAndReturnOutbound,
            estimatedWaitTimeMinutesOutbound: initialData.estimatedWaitTimeMinutesOutbound === null ? undefined : initialData.estimatedWaitTimeMinutesOutbound,
            driverNotes: initialData.driverNotes || "",
            paymentMethod: initialData.paymentMethod,
            isActive: initialData.isActive,
            estimatedFareOneWay: initialData.estimatedFareOneWay,
            estimatedFareReturn: initialData.estimatedFareReturn,
        });
        setPickupInputValue(initialData.pickupLocation.address);
        setPickupCoords({ lat: initialData.pickupLocation.latitude, lng: initialData.pickupLocation.longitude });
        setDropoffInputValue(initialData.dropoffLocation.address);
        setDropoffCoords({ lat: initialData.dropoffLocation.latitude, lng: initialData.dropoffLocation.longitude });
        
        const initialStopsData: AutocompleteData[] = (initialData.stops || []).map((stop, index) => ({
            fieldId: `stop-${index}-${Date.now()}`, 
            inputValue: stop.address,
            coords: { lat: stop.latitude, lng: stop.longitude },
            suggestions: [],
            showSuggestions: false,
            isFetchingSuggestions: false,
            isFetchingDetails: false,
        }));
        setStopAutocompleteData(initialStopsData);
    }
  }, [initialData, isEditMode, form]); 


  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  const watchedVehicleType = form.watch("vehicleType");
  const watchedPassengers = form.watch("passengers");
  const watchedIsReturnJourneyScheduled = form.watch("isReturnJourneyScheduled");
  const watchedIsWaitAndReturnOutbound = form.watch("isWaitAndReturnOutbound");
  const watchedEstimatedWaitTimeMinutesOutbound = form.watch("estimatedWaitTimeMinutesOutbound");
  const watchedStops = form.watch("stops");


  useEffect(() => {
    // Fare calculation logic
    if (pickupCoords && dropoffCoords) {
      let oneWayDistanceMiles = 0;
      let currentPoint = pickupCoords;

      const validStopsForFare = stopAutocompleteData.filter((stopData, index) => {
        const formStopValue = form.getValues(`stops.${index}.location`);
        return stopData.coords && formStopValue && formStopValue.trim() !== "";
      });

      for (const stopData of validStopsForFare) {
        if (stopData.coords) {
          oneWayDistanceMiles += getDistanceInMiles(currentPoint, stopData.coords);
          currentPoint = stopData.coords;
        }
      }
      oneWayDistanceMiles += getDistanceInMiles(currentPoint, dropoffCoords);

      const oneWayDurationMinutes = (oneWayDistanceMiles / AVERAGE_SPEED_MPH) * 60;
      
      let oneWayJourneyFare = 0;
      if (oneWayDistanceMiles > 0) {
        const timeFareOneWay = oneWayDurationMinutes * PER_MINUTE_RATE;
        const distanceBasedFareOneWay = (oneWayDistanceMiles * PER_MILE_RATE) + FIRST_MILE_SURCHARGE;
        const stopSurchargeAmount = validStopsForFare.length * PER_STOP_SURCHARGE;
        oneWayJourneyFare = BASE_FARE + timeFareOneWay + distanceBasedFareOneWay + stopSurchargeAmount + BOOKING_FEE;

        let vehicleMultiplier = 1.0;
        if (watchedVehicleType === "estate") vehicleMultiplier = 1.2;
        else if (watchedVehicleType === "minibus_6" || watchedVehicleType === "minibus_6_pet_friendly") vehicleMultiplier = 1.5;
        else if (watchedVehicleType === "minibus_8" || watchedVehicleType === "minibus_8_pet_friendly") vehicleMultiplier = 1.6;
        else if (watchedVehicleType === "disable_wheelchair_access") vehicleMultiplier = 2.0;
        
        const passengerCount = Number(watchedPassengers) || 1;
        const passengerAdjustment = 1 + (Math.max(0, passengerCount - 1)) * 0.1;
        
        oneWayJourneyFare = oneWayJourneyFare * vehicleMultiplier * passengerAdjustment;

        if (watchedVehicleType === "pet_friendly_car" || watchedVehicleType === "minibus_6_pet_friendly" || watchedVehicleType === "minibus_8_pet_friendly") {
            oneWayJourneyFare += PET_FRIENDLY_SURCHARGE;
        }
        oneWayJourneyFare = Math.max(oneWayJourneyFare, MINIMUM_FARE);
      }

      let finalEstimatedFareOneWay = oneWayJourneyFare;
      if (watchedIsWaitAndReturnOutbound) {
        const waitAndReturnSurcharge = oneWayJourneyFare * WAIT_AND_RETURN_SURCHARGE_PERCENTAGE;
        const prePaidWaitMinutes = watchedEstimatedWaitTimeMinutesOutbound || 0;
        const chargeableWaitTime = Math.max(0, prePaidWaitMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION);
        const waitingCharge = chargeableWaitTime * WAITING_CHARGE_PER_MINUTE_AT_DESTINATION;
        finalEstimatedFareOneWay += waitAndReturnSurcharge + waitingCharge;
      }
      form.setValue('estimatedFareOneWay', parseFloat(finalEstimatedFareOneWay.toFixed(2)));

      if (watchedIsReturnJourneyScheduled) {
        form.setValue('estimatedFareReturn', parseFloat(oneWayJourneyFare.toFixed(2)));
      } else {
        form.setValue('estimatedFareReturn', null);
      }

    } else {
      form.setValue('estimatedFareOneWay', null);
      form.setValue('estimatedFareReturn', null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, watchedStops, watchedVehicleType, watchedPassengers, watchedIsWaitAndReturnOutbound, watchedEstimatedWaitTimeMinutesOutbound, watchedIsReturnJourneyScheduled, form.setValue]);


  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key missing.");
      toast({ title: "Configuration Error", description: "Maps API key missing. Address search disabled.", variant: "destructive" });
      return;
    }
    const loader = new GoogleApiLoader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["geocoding", "maps", "marker", "places"],
    });
    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => console.error("Failed to load Google Maps API for scheduled ride form:", e));
  }, [toast]);

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

  useEffect(() => {
    fetchUserFavoriteLocations();
  }, [fetchUserFavoriteLocations]);


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
      { input: inputValue, sessionToken: autocompleteSessionTokenRef.current, componentRestrictions: { country: 'gb' } },
      (predictions, status) => {
        setIsFetchingFunc(false);
        setSuggestionsFunc(status === google.maps.places.PlacesServiceStatus.OK && predictions ? predictions : []);
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
    if (typeof formFieldNameOrStopIndex === 'number') {
      setStopAutocompleteData(prev => prev.map((item, idx) =>
        idx === formFieldNameOrStopIndex ? { ...item, inputValue, coords: null, suggestions: inputValue.length >= 2 ? item.suggestions : [], showSuggestions: inputValue.length >= 2 } : item
      ));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
      setPickupInputValue(inputValue); setPickupCoords(null); setShowPickupSuggestions(inputValue.length >= 2);
      if(inputValue.length >=2) setIsFetchingPickupSuggestions(true); else setIsFetchingPickupSuggestions(false);
    } else {
      setDropoffInputValue(inputValue); setDropoffCoords(null); setShowDropoffSuggestions(inputValue.length >= 2);
      if(inputValue.length >=2) setIsFetchingDropoffSuggestions(true); else setIsFetchingDropoffSuggestions(false);
    }
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (inputValue.length < 2) return;
    debounceTimeoutRef.current = setTimeout(() => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        fetchAddressSuggestions(inputValue, (sugg) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg } : item)), (fetch) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingSuggestions: fetch } : item)));
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
    if (!addressText) return;
    formOnChange(addressText);
    const setIsFetchingDetailsFunc = (isFetching: boolean) => {
      if (typeof formFieldNameOrStopIndex === 'number') setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingDetails: isFetching } : item));
      else if (formFieldNameOrStopIndex === 'pickupLocation') setIsFetchingPickupDetails(isFetching); else setIsFetchingDropoffDetails(isFetching);
    };
    const setCoordsFunc = (coords: google.maps.LatLngLiteral | null) => {
      if (typeof formFieldNameOrStopIndex === 'number') setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, coords, inputValue: addressText, showSuggestions: false } : item));
      else if (formFieldNameOrStopIndex === 'pickupLocation') { setPickupCoords(coords); setPickupInputValue(addressText); setShowPickupSuggestions(false); }
      else { setDropoffCoords(coords); setDropoffInputValue(addressText); setShowDropoffSuggestions(false); }
    };
    setIsFetchingDetailsFunc(true);
    if (placesServiceRef.current && suggestion.place_id) {
      placesServiceRef.current.getDetails(
        { placeId: suggestion.place_id, fields: ['geometry.location'], sessionToken: autocompleteSessionTokenRef.current },
        (place, status) => {
          setIsFetchingDetailsFunc(false);
          setCoordsFunc(status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() } : null);
          if (status !== google.maps.places.PlacesServiceStatus.OK) toast({ title: "Error", description: "Could not get location details.", variant: "destructive"}); else toast({ title: "Location Selected", description: `${addressText} coordinates captured.`});
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else { setIsFetchingDetailsFunc(false); setCoordsFunc(null); toast({ title: "Warning", description: "Could not fetch location details."}); }
  }, [toast]);

  const handleFocusFactory = (fieldNameOrIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
     if (typeof fieldNameOrIndex === 'number') {
        const stop = stopAutocompleteData[fieldNameOrIndex];
        if (stop?.inputValue.length >= 2 && stop.suggestions.length > 0) setStopAutocompleteData(p => p.map((item, i) => i === fieldNameOrIndex ? {...item, showSuggestions: true} : item));
    } else if (fieldNameOrIndex === 'pickupLocation' && pickupInputValue.length >= 2 && pickupSuggestions.length > 0) setShowPickupSuggestions(true);
    else if (fieldNameOrIndex === 'dropoffLocation' && dropoffInputValue.length >= 2 && dropoffSuggestions.length > 0) setShowDropoffSuggestions(true);
  };
  const handleBlurFactory = (fieldNameOrIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    setTimeout(() => {
      if (typeof fieldNameOrIndex === 'number') setStopAutocompleteData(p => p.map((item, i) => i === fieldNameOrIndex ? {...item, showSuggestions: false} : item));
      else if (fieldNameOrIndex === 'pickupLocation') setShowPickupSuggestions(false);
      else setShowDropoffSuggestions(false);
    }, 150);
  };
  
  const handleFavoriteSelectFactory = (
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number,
    formOnChange: (value: string) => void,
    doorOrFlatFormFieldName?: `pickupDoorOrFlat` | `dropoffDoorOrFlat` | `stops.${number}.doorOrFlat`
  ) => (fav: FavoriteLocation) => {
    formOnChange(fav.address);
    const newCoords = { lat: fav.latitude, lng: fav.longitude };
    if (doorOrFlatFormFieldName) form.setValue(doorOrFlatFormFieldName, "");
    if (typeof formFieldNameOrStopIndex === 'number') setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, inputValue: fav.address, coords: newCoords, suggestions: [], showSuggestions: false } : item));
    else if (formFieldNameOrStopIndex === 'pickupLocation') { setPickupInputValue(fav.address); setPickupCoords(newCoords); setShowPickupSuggestions(false); }
    else { setDropoffInputValue(fav.address); setDropoffCoords(newCoords); setShowDropoffSuggestions(false); }
    toast({ title: "Favorite Applied", description: `${fav.label}: ${fav.address} selected.` });
  };
  
  const handleAddStop = () => { append({ location: "", doorOrFlat: "" }); setStopAutocompleteData(prev => [...prev, { fieldId: `stop-${Date.now()}`, inputValue: "", suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null }]); };
  const handleRemoveStop = (index: number) => { remove(index); setStopAutocompleteData(prev => prev.filter((_, i) => i !== index)); };

  interface MapMarker { position: google.maps.LatLngLiteral; title?: string; label?: string | google.maps.MarkerLabel; }
  useEffect(() => {
    const newMarkers: MapMarker[] = [];
    if (pickupCoords) newMarkers.push({ position: pickupCoords, title: `Pickup: ${form.getValues('pickupLocation')}`, label: 'P'});
    const currentFormStops = form.getValues('stops');
    currentFormStops?.forEach((formStop, index) => {
        const stopData = stopAutocompleteData[index];
        if (stopData?.coords && formStop.location?.trim()) newMarkers.push({ position: stopData.coords, title: `Stop ${index + 1}: ${formStop.location}`, label: { text: `S${index + 1}`, color: "white", fontWeight: "bold" }});
    });
    if (dropoffCoords) newMarkers.push({ position: dropoffCoords, title: `Dropoff: ${form.getValues('dropoffLocation')}`, label: 'D'});
    setMapMarkers(newMarkers);
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, form, watchedStops]);
  
  const currentMapCenter = pickupCoords || huddersfieldCenter;

  const renderSuggestions = ( suggestions: google.maps.places.AutocompletePrediction[], isFetchingSuggestions: boolean, isFetchingDetails: boolean, inputValue: string, onSuggestionClick: (suggestion: google.maps.places.AutocompletePrediction) => void, fieldKey: string ) => ( <ScrollArea className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60"> <div className="space-y-1 p-1"> {isFetchingSuggestions && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>} {isFetchingDetails && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</div>} {!isFetchingSuggestions && !isFetchingDetails && suggestions.length === 0 && inputValue.length >= 2 && <div className="p-2 text-sm text-muted-foreground">No suggestions.</div>} {!isFetchingSuggestions && !isFetchingDetails && suggestions.map((s) => ( <div key={`${fieldKey}-${s.place_id}`} className="p-2 text-sm hover:bg-muted cursor-pointer rounded-sm" onMouseDown={() => onSuggestionClick(s)}>{s.description}</div> ))} </div> </ScrollArea> );
  const renderFavoriteLocationsPopover = ( onSelectFavorite: (fav: FavoriteLocation) => void, triggerKey: string ) => ( <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-accent" aria-label="Select from favorites"><Star className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-80 p-0"><ScrollArea className="h-auto max-h-60"><div className="p-2"><p className="text-sm font-medium p-2">Your Favorites</p>{isLoadingFavorites && <div className="p-2 text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading...</div>}{!isLoadingFavorites && favoriteLocations.length === 0 && <p className="p-2 text-sm text-muted-foreground">No favorites.</p>}{!isLoadingFavorites && favoriteLocations.map(fav => ( <div key={`${triggerKey}-fav-${fav.id}`} className="p-2 text-sm hover:bg-muted cursor-pointer rounded-md" onClick={() => { onSelectFavorite(fav); (document.activeElement as HTMLElement)?.blur(); }}><p className="font-semibold">{fav.label}</p><p className="text-xs text-muted-foreground">{fav.address}</p></div>))}</div></ScrollArea></PopoverContent></Popover> );

  async function onSubmit(values: ScheduledRideFormValues) {
    console.log("NewScheduleForm.tsx: onSubmit triggered. isEditMode:", isEditMode, "initialData ID:", initialData?.id);
    
    const formValuesForPayload = {
        ...values,
        estimatedFareOneWay: form.getValues("estimatedFareOneWay") === undefined ? null : form.getValues("estimatedFareOneWay"),
        estimatedFareReturn: form.getValues("estimatedFareReturn") === undefined ? null : form.getValues("estimatedFareReturn"),
    };
    console.log("NewScheduleForm.tsx: Form values submitted:", JSON.stringify(formValuesForPayload, null, 2));

    if (!user) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }
    if (!pickupCoords || !dropoffCoords) { toast({ title: "Missing Location Details", description: "Ensure pickup/dropoff are selected from suggestions.", variant: "destructive" }); return; }
    
    const validStopsData = [];
    for (let i = 0; i < (values.stops?.length || 0); i++) {
      const stopValue = values.stops?.[i];
      const stopAutocomplete = stopAutocompleteData[i];
        if (stopValue?.location?.trim() && !stopAutocomplete?.coords) { 
            toast({ title: `Stop ${i+1} Error`, description: `Select stop ${i+1} from suggestions.`, variant: "destructive" }); 
            return; 
        }
        if (stopAutocomplete?.coords && stopValue?.location?.trim()) {
            validStopsData.push({ 
                address: stopValue.location, 
                latitude: stopAutocomplete.coords.lat, 
                longitude: stopAutocomplete.coords.lng, 
                doorOrFlat: stopValue.doorOrFlat 
            });
        }
    }
    
    setIsSubmitting(true);
    
    const submissionPayload: any = {
      ...formValuesForPayload, 
      passengerId: user.id, 
      passengerName: user.name, 
      pickupLocation: { address: values.pickupLocation, latitude: pickupCoords.lat, longitude: pickupCoords.lng, doorOrFlat: values.pickupDoorOrFlat },
      dropoffLocation: { address: values.dropoffLocation, latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, doorOrFlat: values.dropoffDoorOrFlat },
      stops: validStopsData,
      isActive: isEditMode && initialData ? form.getValues("isActive") : true, 
    };
     if (values.returnPickupTime === "") submissionPayload.returnPickupTime = null;
     if (values.driverNotes === "") submissionPayload.driverNotes = null;
     if (values.estimatedWaitTimeMinutesOutbound === undefined) submissionPayload.estimatedWaitTimeMinutesOutbound = null;

    const apiPath = isEditMode && initialData?.id 
      ? `/api/scheduled-bookings/${initialData.id}` 
      : '/api/scheduled-bookings/create';
    const method = isEditMode ? 'PUT' : 'POST';

    console.log(`NewScheduleForm.tsx: ${method} to ${apiPath}. Payload:`, JSON.stringify(submissionPayload, null, 2));

    try {
      const response = await fetch(apiPath, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionPayload),
      });
      console.log(`NewScheduleForm.tsx: ${method} response status:`, response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
        console.error(`NewScheduleForm.tsx: API error response data (${method}):`, errorData);
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} schedule: ${response.status}`);
      }
      const result = await response.json();
      console.log(`NewScheduleForm.tsx: API success (${method}). Result:`, result);
      toast({
        title: `Schedule ${isEditMode ? 'Updated' : 'Created'}!`,
        description: `Schedule "${result.data.label}" (ID: ${result.data.id}) ${isEditMode ? 'updated' : 'submitted'}.`,
        duration: 7000,
      });
      router.push('/dashboard/scheduled-rides');
    } catch (error) {
      console.error(`NewScheduleForm.tsx: Schedule ${isEditMode ? 'update' : 'creation'} error in try-catch:`, error);
      toast({
        title: `Schedule ${isEditMode ? 'Update' : 'Creation'} Failed`,
        description: error instanceof Error ? error.message : `An unknown error occurred. Method: ${method}, Path: ${apiPath}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const dayItems: {id: z.infer<typeof daysOfWeekEnum>; label: string}[] = [
    { id: 'monday', label: 'Mon' }, { id: 'tuesday', label: 'Tue' }, { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' }, { id: 'friday', label: 'Fri' }, { id: 'saturday', label: 'Sat' }, { id: 'sunday', label: 'Sun' }
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="w-full h-64 md:h-80 rounded-lg overflow-hidden shadow-md border bg-muted/30">
            <GoogleMapDisplay key="scheduled-ride-map" center={currentMapCenter} zoom={13} markers={mapMarkers} className="w-full h-full" disableDefaultUI={true} fitBoundsToMarkers={true}/>
        </div>

        <FormField control={form.control} name="label" render={({ field }) => (
            <FormItem><FormLabel>Schedule Label</FormLabel><FormControl><Input placeholder="e.g., Work Commute, Weekly Shopping" {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="space-y-2">
            <FormLabel className="flex items-center gap-1"><UserIcon className="w-4 h-4 text-muted-foreground" /> Pickup</FormLabel>
            <FormField control={form.control} name="pickupDoorOrFlat" render={({ field }) => (<FormItem><FormControl><Input placeholder="Door/Flat (Optional)" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="pickupLocation" render={({ field }) => (<FormItem><div className="relative"><FormControl><Input placeholder="Pickup address" {...field} value={pickupInputValue} onChange={(e) => handleAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)} onFocus={handleFocusFactory('pickupLocation')} onBlur={handleBlurFactory('pickupLocation')} autoComplete="off" className="pr-10" /></FormControl>{renderFavoriteLocationsPopover(handleFavoriteSelectFactory('pickupLocation', field.onChange, 'pickupDoorOrFlat'), "pickup")}{showPickupSuggestions && renderSuggestions(pickupSuggestions, isFetchingPickupSuggestions, isFetchingPickupDetails, pickupInputValue, (sugg) => handleSuggestionClickFactory('pickupLocation')(sugg, field.onChange), "pickup")}</div><FormMessage /></FormItem>)} />
        </div>

        {fields.map((item, index) => (
            <div key={item.id} className="space-y-2 p-3 border rounded-md bg-muted/50 relative">
                <div className="flex justify-between items-center mb-1"><FormLabel className="flex items-center gap-1"><StopMarkerIcon className="w-4 h-4" /> Stop {index + 1}</FormLabel><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveStop(index)} className="text-destructive hover:text-destructive-foreground h-7 w-7 absolute top-1 right-1"><XCircle className="h-4 w-4" /></Button></div>
                <FormField control={form.control} name={`stops.${index}.doorOrFlat`} render={({ field }) => (<FormItem><FormControl><Input placeholder="Door/Flat (Optional)" {...field} className="bg-background"/></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name={`stops.${index}.location`} render={({ field }) => (<FormItem><div className="relative"><FormControl><Input placeholder={`Stop ${index+1} address`} {...field} value={stopAutocompleteData[index]?.inputValue || ""} onChange={(e) => handleAddressInputChangeFactory(index)(e.target.value, field.onChange)} onFocus={handleFocusFactory(index)} onBlur={handleBlurFactory(index)} autoComplete="off" className="pr-10 bg-background"/></FormControl>{renderFavoriteLocationsPopover(handleFavoriteSelectFactory(index, field.onChange, `stops.${index}.doorOrFlat`), `stop-${index}`)}{stopAutocompleteData[index]?.showSuggestions && renderSuggestions( stopAutocompleteData[index].suggestions, stopAutocompleteData[index].isFetchingSuggestions, stopAutocompleteData[index].isFetchingDetails, stopAutocompleteData[index].inputValue, (sugg) => handleSuggestionClickFactory(index)(sugg, field.onChange), `stop-${index}`)}</div><FormMessage /></FormItem>)}/>
            </div>
        ))}
        <Button type="button" variant="outline" onClick={handleAddStop} className="w-full text-accent border-accent hover:bg-accent/10"><PlusCircle className="w-4 h-4 mr-1"/>Add Stop</Button>

         <div className="space-y-2">
            <FormLabel className="flex items-center gap-1"><HomeIcon className="w-4 h-4 text-muted-foreground" /> Drop-off</FormLabel>
            <FormField control={form.control} name="dropoffDoorOrFlat" render={({ field }) => (<FormItem><FormControl><Input placeholder="Door/Flat (Optional)" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="dropoffLocation" render={({ field }) => (<FormItem><div className="relative"><FormControl><Input placeholder="Dropoff address" {...field} value={dropoffInputValue} onChange={(e) => handleAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)} onFocus={handleFocusFactory('dropoffLocation')} onBlur={handleBlurFactory('dropoffLocation')} autoComplete="off" className="pr-10" /></FormControl>{renderFavoriteLocationsPopover(handleFavoriteSelectFactory('dropoffLocation', field.onChange, 'dropoffDoorOrFlat'), "dropoff")}{showDropoffSuggestions && renderSuggestions(dropoffSuggestions, isFetchingDropoffSuggestions, isFetchingDropoffDetails, dropoffInputValue, (sugg) => handleSuggestionClickFactory('dropoffLocation')(sugg, field.onChange), "dropoff")}</div><FormMessage /></FormItem>)} />
        </div>

        <FormField control={form.control} name="vehicleType" render={({ field }) => (
            <FormItem><FormLabel className="flex items-center gap-1"><Car className="w-4 h-4" /> Vehicle Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl><SelectContent>
                <SelectItem value="car">Car (Standard)</SelectItem><SelectItem value="estate">Estate Car</SelectItem><SelectItem value="minibus_6">Minibus (6)</SelectItem><SelectItem value="minibus_8">Minibus (8)</SelectItem>
                <SelectItem value="pet_friendly_car">Pet Friendly Car</SelectItem><SelectItem value="minibus_6_pet_friendly">Pet Friendly Minibus (6)</SelectItem><SelectItem value="minibus_8_pet_friendly">Pet Friendly Minibus (8)</SelectItem>
                <SelectItem value="disable_wheelchair_access">Wheelchair Accessible</SelectItem>
            </SelectContent></Select><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="passengers" render={({ field }) => (
            <FormItem><FormLabel className="flex items-center gap-1"><Users className="w-4 h-4" /> Passengers</FormLabel><FormControl><Input type="number" min="1" max="10" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 1)} /></FormControl><FormMessage /></FormItem>
        )} />

        <FormField control={form.control} name="daysOfWeek" render={() => (
          <FormItem><FormLabel className="flex items-center gap-1"><CalendarClock className="w-4 h-4" /> Schedule Days</FormLabel>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 p-2 border rounded-md bg-muted/30">
              {dayItems.map((item) => (
                <FormField key={item.id} control={form.control} name="daysOfWeek" render={({ field }) => (
                  <FormItem key={item.id} className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => {
                      return checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id))
                    }} /></FormControl><FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                  </FormItem>
                )} />
              ))}
            </div><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="pickupTime" render={({ field }) => (
            <FormItem><FormLabel>Pickup Time (HH:MM)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        
        <FormField control={form.control} name="isReturnJourneyScheduled" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-primary/5">
                <div className="space-y-0.5"><FormLabel className="text-base flex items-center gap-2"><RefreshCwIcon className="w-5 h-5 text-primary" />Schedule Return Journey?</FormLabel><p className="text-xs text-muted-foreground">Book a return trip for the same selected days.</p></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle return journey" className="data-[state=checked]:bg-primary" /></FormControl><FormMessage />
            </FormItem>
        )} />
        {watchedIsReturnJourneyScheduled && (
            <FormField control={form.control} name="returnPickupTime" render={({ field }) => (
                <FormItem className="ml-6 p-3 border-l-2 border-primary/30"><FormLabel>Return Pickup Time (HH:MM)</FormLabel><FormControl><Input type="time" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
            )} />
        )}
        
         <FormField control={form.control} name="isWaitAndReturnOutbound" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-accent/5">
                <div className="space-y-0.5"><FormLabel className="text-base flex items-center gap-2"><Timer className="w-5 h-5 text-accent" />Wait &amp; Return (Outbound)?</FormLabel><p className="text-xs text-muted-foreground">Driver waits at first dropoff for return leg.</p></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle wait and return for outbound" className="data-[state=checked]:bg-accent" /></FormControl><FormMessage />
            </FormItem>
        )} />
        {watchedIsWaitAndReturnOutbound && (
            <FormField control={form.control} name="estimatedWaitTimeMinutesOutbound" render={({ field }) => (
                <FormItem className="ml-6 p-3 border-l-2 border-accent/30"><FormLabel>Est. Wait Time at Outbound Destination (mins)</FormLabel><FormControl><Input type="number" min="0" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : parseInt(e.target.value,10) || 0)}/></FormControl><FormMessage /></FormItem>
            )} />
        )}

        <FormField control={form.control} name="driverNotes" render={({ field }) => (
            <FormItem><FormLabel className="flex items-center gap-1"><StickyNote className="w-4 h-4" /> Notes for Driver (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Specific entrance, contact on arrival." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="paymentMethod" render={({ field }) => (
            <FormItem className="space-y-2"><FormLabel className="text-base">Payment Method</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row sm:space-y-0 gap-2 sm:gap-4">
                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="card" /></FormControl><FormLabel className="font-normal flex items-center gap-1"><CreditCard className="w-4 h-4 text-blue-500" /> Card</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="cash" /></FormControl><FormLabel className="font-normal flex items-center gap-1"><Coins className="w-4 h-4 text-green-500" /> Cash</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="account" /></FormControl><FormLabel className="font-normal flex items-center gap-1"><Briefcase className="w-4 h-4 text-purple-500" /> Account</FormLabel></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>
        )} />

        <div className="text-center my-4 p-3 border rounded-md bg-muted/30">
            <p className="text-sm text-muted-foreground">Estimated Fare (One Way): <span className="font-semibold text-primary">{form.getValues("estimatedFareOneWay") !== null && form.getValues("estimatedFareOneWay") !== undefined ? `£${form.getValues("estimatedFareOneWay")?.toFixed(2)}` : "Not Calculated"}</span></p>
            {watchedIsReturnJourneyScheduled && <p className="text-sm text-muted-foreground">Estimated Fare (Return): <span className="font-semibold text-primary">{form.getValues("estimatedFareReturn") !== null && form.getValues("estimatedFareReturn") !== undefined ? `£${form.getValues("estimatedFareReturn")?.toFixed(2)}` : "Not Calculated"}</span></p>}
            <p className="text-xs text-muted-foreground mt-1">Fare estimation for scheduled rides is a placeholder. Actual fares are determined at the time of booking.</p>
        </div>

        {isEditMode && (
          <FormField control={form.control} name="isActive" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
              <div className="space-y-0.5">
                <FormLabel className="text-base flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" />
                  Schedule Active?
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  If inactive, automatic bookings will be paused for this schedule.
                </p>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle schedule active state" /></FormControl>
            </FormItem>
          )} />
        )}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-3" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          {isSubmitting ? (isEditMode ? 'Saving Changes...' : 'Saving Schedule...') : (isEditMode ? 'Save Changes' : 'Save Schedule')}
        </Button>
      </form>
    </Form>
  );
}

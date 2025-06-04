
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Car, DollarSign, Users, Loader2, Zap, Route, PlusCircle, XCircle, Calendar as CalendarIcon, Clock, Star, StickyNote, Save, List, Trash2, User as UserIcon, Home as HomeIcon, MapPin as StopMarkerIcon, Mic, Ticket, CalendarClock, Building, AlertTriangle, Info, LocateFixed, CheckCircle2, CreditCard, Coins, Send } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseBookingRequest, ParseBookingRequestInput, ParseBookingRequestOutput } from '@/ai/flows/parse-booking-request-flow';

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
  | "error_unavailable"
  | "error_geocoding";

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
  vehicleType: z.enum(["car", "estate", "minibus_6", "minibus_8"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
  driverNotes: z.string().max(200, { message: "Notes cannot exceed 200 characters."}).optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(["card", "cash"], { required_error: "Please select a payment method." }),
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
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
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
      promoCode: "",
      paymentMethod: "card",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "stops",
  });

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
    const fetchSurgeSetting = async () => {
      setIsLoadingSurgeSetting(true);
      try {
        const response = await fetch('/api/operator/settings/pricing');
        if (!response.ok) {
          console.warn('Failed to fetch surge pricing setting, defaulting to normal fares.');
          setIsOperatorSurgeEnabled(false); 
          return;
        }
        const data = await response.json();
        setIsOperatorSurgeEnabled(data.enableSurgePricing || false);
      } catch (error) {
        console.error('Error fetching surge pricing setting:', error);
        setIsOperatorSurgeEnabled(false); 
      } finally {
        setIsLoadingSurgeSetting(false);
      }
    };
    fetchSurgeSetting();
  }, []);


  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("Google Maps API Key is missing or empty. Address autocomplete will not work.");
      toast({ title: "Configuration Error", description: "Google Maps API Key is not set or empty. Address search is disabled.", variant: "destructive" });
      return;
    }
    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker", "maps"],
    });

    loader.load().then((google) => {
      if (google && google.maps && google.maps.Geocoder && google.maps.places && google.maps.places.AutocompleteService && google.maps.places.PlacesService) {
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        const mapDiv = document.createElement('div');
        placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
        autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        geocoderRef.current = new google.maps.Geocoder();

        if (navigator.geolocation) {
          setGeolocationFetchStatus('fetching');
          setShowGpsSuggestionAlert(false);
          setSuggestedGpsPickup(null);

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const currentCoords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              const accuracy = position.coords.accuracy;

              if (accuracy > 500) {
                setGeolocationFetchStatus('error_accuracy_poor');
                setSuggestedGpsPickup({ address: "", coords: currentCoords, accuracy });
                setShowGpsSuggestionAlert(false); 
                return;
              }

              if (geocoderRef.current) {
                geocoderRef.current.geocode({ location: currentCoords }, (results, status) => {
                  if (status === "OK" && results && results[0]) {
                    const geocodedAddress = results[0].formatted_address;
                    setSuggestedGpsPickup({ address: geocodedAddress, coords: currentCoords, accuracy });

                    if (accuracy <= 20) {
                      setGeolocationFetchStatus('success');
                      setShowGpsSuggestionAlert(true); 
                    } else { 
                      setGeolocationFetchStatus('error_accuracy_moderate');
                      setShowGpsSuggestionAlert(false); 
                    }
                  } else {
                    setGeolocationFetchStatus('error_geocoding');
                    setSuggestedGpsPickup({ address: "", coords: currentCoords, accuracy }); 
                    setShowGpsSuggestionAlert(false);
                  }
                });
              } else {
                  setGeolocationFetchStatus('error_unavailable'); 
                  toast({ title: "Service Error", description: "Geocoder service not available.", variant: "destructive" });
              }
            },
            (err) => {
              let status: GeolocationFetchStatus = 'error_unavailable';
              let message = "Could not get your location.";
              if (err.code === 1) { status = 'error_permission'; message = "Location permission denied. Enable in browser/system settings.";}
              else if (err.code === 2) message = "Location information is unavailable.";
              else if (err.code === 3) message = "Getting location timed out.";

              toast({ title: "Location Error", description: message, variant: "default", duration: 7000 });
              setGeolocationFetchStatus(status);
              setShowGpsSuggestionAlert(false);
              setSuggestedGpsPickup(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        } else {
          setGeolocationFetchStatus('error_unavailable');
        }
      } else {
        console.error("Google Maps API components not available after SDK load.");
        toast({ title: "Error", description: "Could not initialize map services.", variant: "destructive" });
      }
    }).catch(e => {
      console.error("Failed to load Google Maps API for address search", e);
      toast({ title: "Error", description: "Could not load address search. Check API key or network.", variant: "destructive" });
    });
  }, [toast]);

  const handleApplyGpsSuggestion = () => {
    if (suggestedGpsPickup && suggestedGpsPickup.accuracy <= 20) {
      form.setValue('pickupLocation', suggestedGpsPickup.address);
      setPickupInputValue(suggestedGpsPickup.address);
      setPickupCoords(suggestedGpsPickup.coords);
      setShowPickupSuggestions(false);
      setShowGpsSuggestionAlert(false);
      setGeolocationFetchStatus('success');
      toast({ title: "GPS Location Applied", description: `Pickup set to: ${suggestedGpsPickup.address}`});
    } else if (suggestedGpsPickup) {
        toast({ title: "Cannot Apply Suggestion", description: `Location accuracy (${suggestedGpsPickup.accuracy.toFixed(0)}m) is not high enough. Please type or select.`, variant: "default"});
    }
  };

  const fetchUserFavoriteLocations = useCallback(async () => {
    if (!user) return;
    setIsLoadingFavorites(true);
    try {
      const response = await fetch(`/api/users/favorite-locations/list?userId=${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch favorites");
      const data: FavoriteLocation[] = await response.json();
      setFavoriteLocations(data);
    } catch (err) {
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
      if (!response.ok) throw new Error("Failed to fetch saved routes");
      const data: SavedRoute[] = await response.json();
      setSavedRoutes(data);
    } catch (err) {
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
    setFareEstimate(null);
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

    formOnChange(addressText);

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
          fields: ['geometry.location'],
          sessionToken: autocompleteSessionTokenRef.current
        },
        (place, status) => {
          setIsFetchingDetailsFunc(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setCoordsFunc({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            toast({ title: "Location Selected", description: `${addressText} coordinates captured.`});
          } else {
            toast({ title: "Error", description: "Could not get location details. Please try again.", variant: "destructive"});
            setCoordsFunc(null);
            if (formFieldNameOrStopIndex === 'pickupLocation') {}
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else {
      setIsFetchingDetailsFunc(false);
      setCoordsFunc(null);
      if (formFieldNameOrStopIndex === 'pickupLocation') {}
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
    append({ location: "", doorOrFlat: "" });
    setStopAutocompleteData(prev => [
      ...prev,
      {
        fieldId: `stop-temp-${prev.length}-${Date.now()}`,
        inputValue: "",
        suggestions: [],
        showSuggestions: false,
        isFetchingSuggestions: false,
        isFetchingDetails: false,
        coords: null,
      }
    ]);
  };

  const handleRemoveStop = (index: number) => {
    remove(index);
    setStopAutocompleteData(prev => prev.filter((_, i) => i !== index));
  };

  const anyFetchingDetails = isFetchingPickupDetails || isFetchingDropoffDetails || stopAutocompleteData.some(s => s.isFetchingDetails);


  useEffect(() => {
    let totalDistanceMiles = 0;
    const validStopsForFare = stopAutocompleteData.filter((stopData, index) => {
        const formStopValue = form.getValues(`stops.${index}.location`);
        return stopData.coords && formStopValue && formStopValue.trim() !== "";
    });

    if (pickupCoords && dropoffCoords && !isLoadingSurgeSetting) { 
      let currentPoint = pickupCoords;
      for (const stopData of validStopsForFare) {
        if (stopData.coords) {
          totalDistanceMiles += getDistanceInMiles(currentPoint, stopData.coords);
          currentPoint = stopData.coords;
        }
      }
      totalDistanceMiles += getDistanceInMiles(currentPoint, dropoffCoords);
      setEstimatedDistance(parseFloat(totalDistanceMiles.toFixed(2)));

      const duration = (totalDistanceMiles / AVERAGE_SPEED_MPH) * 60;
      setEstimatedDurationMinutes(totalDistanceMiles > 0 ? parseFloat(duration.toFixed(0)) : null);

      const potentialSurgeConditionsMet = Math.random() < 0.3; 
      const actualSurgeIsActive = isOperatorSurgeEnabled && potentialSurgeConditionsMet;
      setIsSurgeActive(actualSurgeIsActive);
      
      const surgeMultiplierToApply = actualSurgeIsActive ? SURGE_MULTIPLIER_VALUE : 1;
      setCurrentSurgeMultiplier(surgeMultiplierToApply);

      let calculatedFareBeforeMultipliers = 0;

      if (totalDistanceMiles <= 0) {
        calculatedFareBeforeMultipliers = 0;
      } else {
        const estimatedTripDurationMinutesFareCalc = (totalDistanceMiles / AVERAGE_SPEED_MPH) * 60;
        const timeFare = estimatedTripDurationMinutesFareCalc * PER_MINUTE_RATE;
        const distanceBasedFare = (totalDistanceMiles * PER_MILE_RATE) + (totalDistanceMiles > 0 ? FIRST_MILE_SURCHARGE : 0);
        const subTotal = BASE_FARE + timeFare + distanceBasedFare;
        calculatedFareBeforeMultipliers = subTotal + BOOKING_FEE;
      }

      const stopSurchargeAmount = validStopsForFare.length * PER_STOP_SURCHARGE;
      calculatedFareBeforeMultipliers += stopSurchargeAmount;

      calculatedFareBeforeMultipliers = Math.max(calculatedFareBeforeMultipliers, MINIMUM_FARE);

      const fareWithSurge = calculatedFareBeforeMultipliers * surgeMultiplierToApply;

      let vehicleMultiplier = 1.0;
      if (watchedVehicleType === "estate") vehicleMultiplier = 1.0; 
      if (watchedVehicleType === "minibus_6") vehicleMultiplier = 1.5;
      if (watchedVehicleType === "minibus_8") vehicleMultiplier = 1.6;

      const passengerCount = Number(watchedPassengers) || 1;
      const passengerAdjustment = 1 + (Math.max(0, passengerCount - 1)) * 0.1; 

      const finalCalculatedFare = fareWithSurge * vehicleMultiplier * passengerAdjustment;
      setFareEstimate(parseFloat(finalCalculatedFare.toFixed(2)));

    } else {
      setFareEstimate(null);
      setEstimatedDistance(null);
      setEstimatedDurationMinutes(null);
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
    }
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, watchedStops, watchedVehicleType, watchedPassengers, form, isOperatorSurgeEnabled, isLoadingSurgeSetting]); 


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
                label: `S${index + 1}`
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

    if (fareEstimate === null) {
        toast({ title: "Fare Not Calculated", description: "Could not calculate fare. Ensure addresses are valid.", variant: "destructive" });
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

    const bookingPayload = {
      passengerId: user.id,
      passengerName: user.name || "Passenger",
      pickupLocation: { address: values.pickupLocation, latitude: pickupCoords.lat, longitude: pickupCoords.lng, doorOrFlat: values.pickupDoorOrFlat },
      dropoffLocation: { address: values.dropoffLocation, latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, doorOrFlat: values.dropoffDoorOrFlat },
      stops: validStopsData,
      vehicleType: values.vehicleType,
      passengers: values.passengers,
      fareEstimate: fareEstimate,
      isSurgeApplied: isSurgeActive, 
      surgeMultiplier: currentSurgeMultiplier, 
      stopSurchargeTotal: validStopsForFare.length * PER_STOP_SURCHARGE,
      scheduledPickupAt,
      driverNotes: values.driverNotes,
      promoCode: values.promoCode,
      paymentMethod: values.paymentMethod,
    };

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
      
      
      if (values.bookingType === 'asap' && !scheduledPickupAt) {
          toast({ 
            title: "Booking Confirmed!", 
            description: `Ride ID: ${result.bookingId}. We'll notify you when your driver is on the way.`, 
            variant: "default", 
            duration: 7000 
          });
      } else {
          toast({ 
            title: "Booking Confirmed!", 
            description: `Ride ID: ${result.bookingId}. Your driver will be assigned shortly for the scheduled time.`, 
            variant: "default", 
            duration: 7000 
          });
      }
      
      setShowConfirmationDialog(false); 
      form.reset();
      setPickupInputValue("");
      setDropoffInputValue("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setStopAutocompleteData([]);
      setFareEstimate(null);
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


    } catch (error) {
        console.error("Booking error:", error);
        toast({ title: "Booking Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
    } finally {
        setIsBooking(false);
    }
  }

  const handleSaveCurrentRoute = () => {
    if (!pickupCoords || !dropoffCoords || !form.getValues('pickupLocation') || !form.getValues('dropoffLocation')) {
      toast({ title: "Cannot Save Route", description: "Please select valid pickup and drop-off locations before saving.", variant: "destructive"});
      return;
    }
    setNewRouteLabel("");
    setSaveRouteDialogOpen(true);
  };

  const submitSaveRoute = async () => {
    if (!user || !pickupCoords || !dropoffCoords || !form.getValues('pickupLocation') || !form.getValues('dropoffLocation') || !newRouteLabel.trim()) {
      toast({ title: "Error", description: "Missing information to save route or label is empty.", variant: "destructive"});
      return;
    }
    setIsSavingRoute(true);
    const currentStops = form.getValues('stops') || [];
    const currentStopData = stopAutocompleteData;

    const routeStops: SavedRouteLocationPoint[] = currentStops
      .map((stop, index) => {
        const stopData = currentStopData[index];
        if (stop.location && stopData && stopData.coords) {
          return { address: stop.location, latitude: stopData.coords.lat, longitude: stopData.coords.lng, doorOrFlat: stop.doorOrFlat };
        }
        return null;
      })
      .filter(s => s !== null) as SavedRouteLocationPoint[];

    const payload = {
      userId: user.id,
      label: newRouteLabel,
      pickupLocation: { address: form.getValues('pickupLocation'), latitude: pickupCoords.lat, longitude: pickupCoords.lng, doorOrFlat: form.getValues('pickupDoorOrFlat') },
      dropoffLocation: { address: form.getValues('dropoffLocation'), latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, doorOrFlat: form.getValues('dropoffDoorOrFlat') },
      stops: routeStops,
    };

    try {
      const response = await fetch('/api/users/saved-routes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error (await response.json().then(e => e.message || "Failed to save route"));
      const newSavedRoute: SavedRoute = await response.json().then(r => r.route);
      setSavedRoutes(prev => [newSavedRoute, ...prev]);
      toast({ title: "Route Saved!", description: `"${newRouteLabel}" has been added to your saved routes.`});
      setSaveRouteDialogOpen(false);
    } catch (error) {
      toast({ title: "Save Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive"});
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleApplySavedRoute = (route: SavedRoute) => {
    form.setValue('pickupDoorOrFlat', route.pickupLocation.doorOrFlat || "");
    form.setValue('pickupLocation', route.pickupLocation.address);
    setPickupInputValue(route.pickupLocation.address);
    setPickupCoords({ lat: route.pickupLocation.latitude, lng: route.pickupLocation.longitude });
    setShowPickupSuggestions(false);
    setShowGpsSuggestionAlert(false);
    setGeolocationFetchStatus('idle');

    form.setValue('dropoffDoorOrFlat', route.dropoffLocation.doorOrFlat || "");
    form.setValue('dropoffLocation', route.dropoffLocation.address);
    setDropoffInputValue(route.dropoffLocation.address);
    setDropoffCoords({ lat: route.dropoffLocation.latitude, lng: route.dropoffLocation.longitude });
    setShowDropoffSuggestions(false);

    const newStopsForForm = route.stops?.map(s => ({ location: s.address, doorOrFlat: s.doorOrFlat || "" })) || [];
    replace(newStopsForForm);

    const newStopAutocompleteData: AutocompleteData[] = route.stops?.map((s, index) => ({
      fieldId: `stop-applied-${index}-${Date.now()}`,
      inputValue: s.address,
      coords: { lat: s.latitude, lng: s.longitude },
      suggestions: [],
      showSuggestions: false,
      isFetchingSuggestions: false,
      isFetchingDetails: false,
    })) || [];
    setStopAutocompleteData(newStopAutocompleteData);

    toast({ title: "Route Applied", description: `Route "${route.label}" loaded into the form.`});
  };

  const handleDeleteSavedRoute = async (routeId: string) => {
    if (!user) return;
    setIsDeletingRouteId(routeId);
    try {
      const response = await fetch(`/api/users/saved-routes/remove?id=${routeId}&userId=${user.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error (await response.json().then(e => e.message || "Failed to delete route"));
      setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
      toast({ title: "Route Deleted", description: "The saved route has been removed."});
    } catch (error) {
      toast({ title: "Delete Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive"});
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
              { placeId: firstPrediction.place_id!, fields: ['geometry.location', 'formatted_address'], sessionToken: autocompleteSessionTokenRef.current },
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
      if (typeof window !== 'undefined') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (!audioCtxRef.current) return;
    }
    const audioContext = audioCtxRef.current;
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) {
        console.error("Error resuming AudioContext:", e);
        toast({ title: "Audio Error", description: "Could not play sound cues.", variant: "default" });
        return;
      }
    }

    const playSingleBeep = (frequency: number, durationMs: number, volume = 0.2) => {
      return new Promise<void>(resolve => {
        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + durationMs / 1000);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.onended = () => resolve();
          oscillator.start();
          oscillator.stop(audioContext.currentTime + durationMs / 1000);
        } catch (e) {
          console.error("Error playing beep:", e);
          resolve();
        }
      });
    };

    if (type === 'start') {
      await playSingleBeep(880, 300);
    } else if (type === 'stop') {
      await playSingleBeep(1046, 100);
      await new Promise(resolve => setTimeout(resolve, 50));
      await playSingleBeep(1046, 100);
    }
  }, [toast]);


  useEffect(() => {
    if (typeof window !== 'undefined' && !audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser does not support speech-to-text. Please type your request.",
        variant: "default",
        duration: 7000,
      });
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';

    recognition.onstart = () => {
        setIsListening(true);
        playSound('start');
        toast({ title: "Listening...", description: "Speak your booking request.", duration: 3000 });
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      setIsProcessingAi(true);
      toast({ title: "Processing your request...", description: `Heard: "${transcript}"`, duration: 2000 });

      if (transcript) {
          try {
              const aiInput: ParseBookingRequestInput = { userRequestText: transcript };
              const aiOutput: ParseBookingRequestOutput = await parseBookingRequest(aiInput);

              let appliedFieldsCount = 0;

              if (aiOutput.pickupAddress) {
                await geocodeAiAddress(aiOutput.pickupAddress, setPickupCoords, setPickupInputValue, "pickupLocation", "pickup");
                appliedFieldsCount++;
              }
              if (aiOutput.dropoffAddress) {
                await geocodeAiAddress(aiOutput.dropoffAddress, setDropoffCoords, setDropoffInputValue, "dropoffLocation", "dropoff");
                appliedFieldsCount++;
              }

              if (aiOutput.numberOfPassengers) {
                form.setValue('passengers', aiOutput.numberOfPassengers);
                 appliedFieldsCount++;
              } else {
                form.setValue('passengers', 1);
              }
              if (aiOutput.additionalNotes) {
                form.setValue('driverNotes', aiOutput.additionalNotes);
                appliedFieldsCount++;
              } else {
                form.setValue('driverNotes', "");
              }

              if (aiOutput.requestedTime && aiOutput.requestedTime.toLowerCase() !== 'asap' && aiOutput.requestedTime.toLowerCase() !== 'now') {
                form.setValue('bookingType', 'scheduled');
                toast({ title: "AI Suggested Time", description: `AI suggests: "${aiOutput.requestedTime}". Please set date/time manually if needed.`, duration: 5000});
                appliedFieldsCount++;
              } else {
                  form.setValue('bookingType', 'asap');
                  form.setValue('desiredPickupDate', undefined);
                  form.setValue('desiredPickupTime', "");
                  if (aiOutput.requestedTime) appliedFieldsCount++;
              }

              if (appliedFieldsCount > 0) {
                  toast({ title: "AI Processing Complete", description: "Review fields and complete your booking.", duration: 5000 });
              } else {
                  toast({ title: "AI Could Not Extract Details", description: "Please fill the form manually.", variant: "default", duration: 5000 });
              }

          } catch (aiError) {
              console.error("AI Parsing Error:", aiError);
              toast({ title: "AI Error", description: "Could not understand your request via AI. Please try typing or rephrasing.", variant: "destructive"});
          } finally {
            setIsProcessingAi(false);
          }
      } else {
        toast({ title: "No speech detected", description: "Please try speaking again.", variant: "default"});
        setIsProcessingAi(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error);
      let errorMessage = "Speech recognition failed.";
      if (event.error === 'no-speech') errorMessage = "No speech was detected. Please try again.";
      else if (event.error === 'audio-capture') errorMessage = "Microphone problem. Please check permissions.";
      else if (event.error === 'not-allowed') errorMessage = "Permission to use microphone was denied. Please enable it in your browser settings for this site.";
      toast({ title: "Voice Error", description: errorMessage, variant: "destructive" });
      setIsListening(false);
      setIsProcessingAi(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      playSound('stop');
    };
  }, [toast, form, geocodeAiAddress, playSound]);

 const handleMicMouseDown = async () => {
    if (!recognitionRef.current) {
      toast({ title: "Error", description: "Speech recognition is not initialized. Please refresh the page.", variant: "destructive" });
      return;
    }
    if (isProcessingAi) {
      toast({ title: "AI Busy", description: "Please wait for the current request to complete.", variant: "default" });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      recognitionRef.current.start();
    } catch (err) {
      console.error("Microphone permission error or start error:", err);
      let message = "Could not start listening.";
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        message = "Microphone permission denied. Please enable it in your browser settings for this site.";
      } else if (err instanceof Error && err.name === 'NotFoundError') {
        message = "No microphone found. Please connect a microphone.";
      }
      toast({ title: "Microphone Error", description: message, variant: "destructive" });
      setIsListening(false);
    }
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
    if (showGpsSuggestionAlert) return null; 

    switch (geolocationFetchStatus) {
        case 'fetching':
            return <p className="text-xs text-muted-foreground mt-1 flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Fetching your current location...</p>;
        case 'error_permission':
            return <p className="text-xs text-red-600 mt-1 flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Location permission denied. Please enable in your browser settings.</p>;
        case 'error_unavailable':
            return <p className="text-xs text-red-600 mt-1 flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Geolocation is unavailable on this device.</p>;
        case 'error_accuracy_poor':
            const accPoor = suggestedGpsPickup?.accuracy?.toFixed(0) || 'N/A';
            return <p className="text-xs text-orange-600 mt-1 flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Your location accuracy ({accPoor}m) is too low. <strong>Please enter your pickup address manually.</strong></p>;
        case 'error_accuracy_moderate':
            const accMod = suggestedGpsPickup?.accuracy?.toFixed(0) || 'N/A';
            return <p className="text-xs text-orange-600 mt-1 flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Location found (Accuracy: {accMod}m), but not precise enough. <strong>Please enter your pickup address manually.</strong></p>;
        case 'error_geocoding':
            return <p className="text-xs text-orange-600 mt-1 flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Could not find an address for your current location. <strong>Please enter your pickup address manually.</strong></p>;
        case 'success': 
             if (suggestedGpsPickup && suggestedGpsPickup.accuracy <=20) {
                return <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" />GPS location was used for pickup.</p>;
             }
            return null;
        case 'idle':
        default:
            return null;
    }
};

const handleProceedToConfirmation = async () => {
    const pickupValid = await form.trigger("pickupLocation");
    const dropoffValid = await form.trigger("dropoffLocation");
    await form.trigger("stops"); 

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
                    title: `Incomplete Stop ${i+1}`,
                    description: `Please select stop ${i+1} from suggestions or remove it.`,
                    variant: "destructive",
                 });
                 return;
            }
        }
    }
    setShowConfirmationDialog(true);
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
              <CardDescription>Enter details, load a saved route, or use voice input (Beta). Add stops and schedule.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            <div className="w-full h-[35vh] rounded-lg overflow-hidden border shadow-md bg-muted/30 mb-3">
                <GoogleMapDisplay
                    key="book-ride-map"
                    center={currentMapCenter}
                    zoom={(pickupCoords || dropoffCoords || stopAutocompleteData.some(s=>s.coords)) ? 13 : 12}
                    markers={mapMarkers}
                    className="w-full h-full"
                 />
              </div>

            <div className="flex justify-center gap-4 mb-3">
              <Button variant="outline" onClick={handleSaveCurrentRoute} disabled={!pickupCoords || !dropoffCoords || saveRouteDialogOpen} className="w-1/2 sm:w-auto">
                <Save className="mr-2 h-4 w-4" /> Save Route
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-1/2 sm:w-auto">
                    <List className="mr-2 h-4 w-4" /> Load Route
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <ScrollArea className="h-auto max-h-72">
                    <div className="p-2">
                      <p className="text-sm font-medium p-2">Your Saved Routes</p>
                      {isLoadingSavedRoutes && <div className="p-2 text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</div>}
                      {!isLoadingSavedRoutes && savedRoutes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No routes saved yet.</p>}
                      {!isLoadingSavedRoutes && savedRoutes.map(route => (
                        <div key={route.id} className="p-2 hover:bg-muted rounded-md">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-semibold">{route.label}</p>
                              <p className="text-xs text-muted-foreground truncate w-48" title={`${route.pickupLocation.address} to ${route.dropoffLocation.address}`}>
                                {route.pickupLocation.address.split(',')[0]} to {route.dropoffLocation.address.split(',')[0]}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-accent" onClick={() => handleApplySavedRoute(route)}>Apply</Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSavedRoute(route.id)} disabled={isDeletingRouteId === route.id}>
                                {isDeletingRouteId === route.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleBookRide)} className="space-y-6">
                {showGpsSuggestionAlert && suggestedGpsPickup && suggestedGpsPickup.accuracy <= 20 && (
                  <Alert variant="default" className="bg-green-50 border-green-300">
                    <LocateFixed className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-700">Use Current Location for Pickup?</AlertTitle>
                    <AlertDescription className="text-green-600">
                      {suggestedGpsPickup.address} (Accuracy: {suggestedGpsPickup.accuracy.toFixed(0)}m)
                      <div className="mt-2 space-x-2">
                        <Button type="button" size="sm" onClick={handleApplyGpsSuggestion} className="bg-green-600 hover:bg-green-700 text-white">Use this</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => {setShowGpsSuggestionAlert(false); setGeolocationFetchStatus('idle');}}>Dismiss</Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-1"><UserIcon className="w-4 h-4 text-muted-foreground" /> Pickup Location</FormLabel>
                        <div className={cn("p-1 rounded-lg shadow-md transition-colors", isListening ? "bg-red-600" : "bg-green-700 hover:bg-green-600")}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onMouseDown={handleMicMouseDown}
                            onMouseUp={handleMicMouseUpOrLeave}
                            onMouseLeave={handleMicMouseUpOrLeave}
                            disabled={isProcessingAi || !recognitionRef.current}
                            className="h-8 w-8 text-white focus-visible:ring-white focus-visible:ring-offset-green-700 disabled:opacity-75"
                            aria-label={isProcessingAi ? "Processing AI..." : isListening ? "Listening... Release to process" : "Hold to speak for voice input"}
                        >
                            {isProcessingAi ? <Loader2 className={cn("h-5 w-5 animate-spin")} /> : <Mic className={cn("h-5 w-5", isListening && "animate-pulse opacity-75")} /> }
                        </Button>
                        </div>
                    </div>
                    <FormField
                        control={form.control}
                        name="pickupDoorOrFlat"
                        render={({ field }) => (
                        <FormItem className="mb-1">
                            <FormControl>
                            <Input placeholder="Door/Flat/Unit (Optional)" {...field} className="h-9 text-sm" />
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


                  {fields.map((stopField, index) => {
                    const currentStopData = stopAutocompleteData[index] || { inputValue: '', suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null, fieldId: stopField.id };
                    return (
                      <div key={stopField.id} className="space-y-2">
                        <FormLabel className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><StopMarkerIcon className="w-4 h-4 text-muted-foreground" /> Stop {index + 1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveStop(index)} className="text-destructive hover:text-destructive-foreground px-1 py-0 h-auto">
                            <XCircle className="mr-1 h-4 w-4" /> Remove Stop
                            </Button>
                        </FormLabel>
                        <FormField
                            control={form.control}
                            name={`stops.${index}.doorOrFlat`}
                            render={({ field }) => (
                            <FormItem className="mb-1">
                                <FormControl>
                                <Input placeholder="Door/Flat/Unit (Optional)" {...field} className="h-9 text-sm"/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
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
                                    value={currentStopData.inputValue}
                                    onChange={(e) => handleAddressInputChangeFactory(index)(e.target.value, field.onChange)}
                                    onFocus={handleFocusFactory(index)}
                                    onBlur={handleBlurFactory(index)}
                                    autoComplete="off"
                                    className="pr-10 border-2 border-primary shadow-none"
                                    />
                                </FormControl>
                                {renderFavoriteLocationsPopover(handleFavoriteSelectFactory(index, field.onChange, `stops.${index}.doorOrFlat`), `stop-${index}`)}
                                {currentStopData.showSuggestions && renderSuggestions(
                                    currentStopData.suggestions,
                                    currentStopData.isFetchingSuggestions,
                                    currentStopData.isFetchingDetails,
                                    currentStopData.inputValue,
                                    (sugg) => handleSuggestionClickFactory(index)(sugg, field.onChange),
                                    `stop-${index}`
                                )}
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>
                    );
                  })}

                  <div className="flex justify-center my-3">
                      <Button
                          type="button"
                          variant="ghost"
                          onClick={handleAddStop}
                          className="text-sm font-semibold text-accent hover:text-accent/90 bg-accent/10 hover:bg-accent/20 px-6 py-2 rounded-lg shadow-sm"
                      >
                          <PlusCircle className="mr-2 h-4 w-4" /> (+ Stop/Pickup)
                      </Button>
                  </div>

                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-1"><HomeIcon className="w-4 h-4 text-muted-foreground" /> Drop-off Location</FormLabel>
                    <FormField
                        control={form.control}
                        name="dropoffDoorOrFlat"
                        render={({ field }) => (
                        <FormItem className="mb-1">
                            <FormControl>
                            <Input placeholder="Door/Flat/Unit (Optional)" {...field} className="h-9 text-sm" />
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
                    name="driverNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><StickyNote className="w-4 h-4 text-muted-foreground" /> Notes for Driver (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Ring doorbell on arrival, specific gate number, etc."
                            className="min-h-[80px] border-2 border-yellow-500 shadow-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bookingType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base">Booking Time</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value: "asap" | "scheduled") => {
                              field.onChange(value);
                              if (value === "asap") {
                                form.setValue("desiredPickupDate", undefined);
                                form.setValue("desiredPickupTime", "");
                                form.clearErrors(["desiredPickupDate", "desiredPickupTime"]);
                              }
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="asap" id="asap" />
                              </FormControl>
                              <FormLabel htmlFor="asap" className="font-normal flex items-center gap-1">
                                <Zap className="w-4 h-4 text-orange-500" /> ASAP
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="scheduled" id="scheduled" />
                              </FormControl>
                              <FormLabel htmlFor="scheduled" className="font-normal flex items-center gap-1">
                                <CalendarClock className="w-4 h-4 text-blue-500" /> Schedule for Later
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedBookingType === 'scheduled' && (
                    <>
                      <FormField
                        control={form.control}
                        name="desiredPickupDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-muted-foreground" /> Desired Pickup Date</FormLabel>
                             <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    setIsDatePickerOpen(false);
                                  }}
                                  disabled={(date) =>
                                    date < new Date(new Date().setHours(0,0,0,0))
                                  }
                                  initialFocus
                                />
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
                          <FormItem>
                            <FormLabel className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> Desired Pickup Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
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
                    name="promoCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Ticket className="w-4 h-4 text-muted-foreground" /> Promo Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter promo code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="button" 
                    onClick={handleProceedToConfirmation} 
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-3 mt-8"
                    disabled={anyFetchingDetails || isBooking || !pickupCoords || !dropoffCoords || isLoadingSurgeSetting}
                  >
                     {isLoadingSurgeSetting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" /> }
                     {isLoadingSurgeSetting ? 'Loading Settings...' : 'Review & Confirm Ride'}
                  </Button>

                  <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
                    <DialogContent className="sm:max-w-md grid grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-headline">Confirm Your Booking</DialogTitle>
                        <DialogDescription>
                          Please review your ride details and confirm payment.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4 overflow-y-auto">
                        <Card className="w-full text-center shadow-md">
                          <CardHeader>
                            <CardTitle className="text-2xl font-headline flex items-center justify-center gap-2">
                              <DollarSign className="w-7 h-7 text-accent" /> Fare Estimate
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {anyFetchingDetails && pickupCoords ? (
                              <div className="flex flex-col items-center justify-center space-y-2">
                                  <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                                  <p className="text-xl font-bold text-muted-foreground">Calculating...</p>
                              </div>
                            ) : fareEstimate !== null ? (
                              <>
                                <p className="text-4xl font-bold text-accent">£{fareEstimate.toFixed(2)}</p>
                                {isSurgeActive && (
                                  <p className="text-sm font-semibold text-orange-500 flex items-center justify-center gap-1">
                                    <Zap className="w-4 h-4" /> Surge Pricing Applied ({currentSurgeMultiplier}x)
                                  </p>
                                )}
                                {!isSurgeActive && <p className="text-sm text-muted-foreground">(Normal Fare)</p>}
                              </>
                            ) : (
                              <p className="text-xl text-muted-foreground">Enter pickup & drop-off to see fare.</p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">
                              Estimates may vary based on real-time conditions.
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="shadow-md bg-gradient-to-r from-accent/5 via-transparent to-primary/5">
                          <CardHeader>
                            <CardTitle className="text-xl font-headline flex items-center gap-2">
                              <CreditCard className="w-6 h-6 text-primary" /> Payment Method
                            </CardTitle>
                            <CardDescription>Choose how you'd like to pay for your ride.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="paymentMethod"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                                    >
                                      <FormItem className="flex-1">
                                        <FormControl>
                                          <RadioGroupItem value="card" id="dialog-card" className="sr-only peer" />
                                        </FormControl>
                                        <Label
                                          htmlFor="dialog-card"
                                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                        >
                                          <CreditCard className="mb-3 h-8 w-8 text-primary peer-data-[state=checked]:text-primary" />
                                          Pay by Card
                                        </Label>
                                      </FormItem>
                                      <FormItem className="flex-1">
                                        <FormControl>
                                          <RadioGroupItem value="cash" id="dialog-cash" className="sr-only peer" />
                                        </FormControl>
                                        <Label
                                          htmlFor="dialog-cash"
                                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/80 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 [&:has([data-state=checked])]:border-primary cursor-pointer"
                                        >
                                          <Coins className="mb-3 h-8 w-8 text-green-600 peer-data-[state=checked]:text-green-600" />
                                          Pay with Cash
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
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isBooking}>Back to Edit</Button>
                        </DialogClose>
                        <Button 
                          type="submit" 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground" 
                          disabled={!fareEstimate || form.formState.isSubmitting || anyFetchingDetails || isBooking}
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
          <DialogHeader>
            <DialogTitle>Save Current Route</DialogTitle>
            <DialogDescription>
              Enter a label for this route (e.g., Home to Work, Airport Trip).
            </DialogDescription>
          </DialogHeader>
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

    </div>
  );
}


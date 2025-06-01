
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { MapPin, Car, DollarSign, Users, Loader2, Zap, Route, PlusCircle, XCircle, Calendar as CalendarIcon, Clock, Star } from 'lucide-react';
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

interface MapMarker {
  position: google.maps.LatLngLiteral;
  title?: string;
  iconUrl?: string;
  iconScaledSize?: { width: number; height: number };
}


const bookingFormSchema = z.object({
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array(
    z.object({
      location: z.string().min(3, { message: "Stop location must be at least 3 characters." })
    })
  ).optional(),
  vehicleType: z.enum(["car", "estate", "minibus_6", "minibus_8"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(), // HH:mm format
}).refine(data => {
  if (data.desiredPickupDate && !data.desiredPickupTime) {
    return false; 
  }
  if (!data.desiredPickupDate && data.desiredPickupTime) {
    return false; 
  }
  return true;
}, {
  message: "Both date and time must be provided for a scheduled pickup, or neither can be set.",
  path: ["desiredPickupTime"], 
});

type AutocompleteData = {
  fieldId: string; 
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
};

const defaultMapCenter: google.maps.LatLngLiteral = { lat: 51.5074, lng: -0.1278 };

// Fare Calculation Constants
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
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coords2.lat - coords1.lat);
  const dLon = deg2rad(coords2.lng - coords1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coords1.lat)) * Math.cos(deg2rad(coords2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 0.621371; // Distance in miles
}


export default function BookRidePage() {
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth(); 
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const [isSurgeActive, setIsSurgeActive] = useState(false);
  const [currentSurgeMultiplier, setCurrentSurgeMultiplier] = useState(1);
  
  const [stopAutocompleteData, setStopAutocompleteData] = useState<AutocompleteData[]>([]);
  const [isBooking, setIsBooking] = useState(false);

  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      stops: [],
      vehicleType: "car",
      passengers: 1,
      desiredPickupDate: undefined,
      desiredPickupTime: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
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
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("Google Maps API Key is missing or empty. Address autocomplete will not work.");
      toast({ title: "Configuration Error", description: "Google Maps API Key is not set or empty. Address search is disabled.", variant: "destructive" });
      return;
    }
    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker"], 
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const mapDiv = document.createElement('div'); 
      placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => {
      console.error("Failed to load Google Maps API for address search", e);
      toast({ title: "Error", description: "Could not load address search. Please check API key or network.", variant: "destructive" });
    });
  }, [toast]);

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
    if (formFieldNameOrStopIndex === 'pickupLocation') { // Reset wait time if pickup input changes
      setEstimatedWaitTime(null);
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
          setPickupCoords(null); setShowPickupSuggestions(false); setEstimatedWaitTime(null);
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
            if (formFieldNameOrStopIndex === 'pickupLocation') setEstimatedWaitTime(null);
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken(); 
        }
      );
    } else {
      setIsFetchingDetailsFunc(false);
      setCoordsFunc(null);
      if (formFieldNameOrStopIndex === 'pickupLocation') setEstimatedWaitTime(null);
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
    formOnChange: (value: string) => void
  ) => (fav: FavoriteLocation) => {
    formOnChange(fav.address);
    const newCoords = { lat: fav.latitude, lng: fav.longitude };

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
    } else { // dropoffLocation
      setDropoffInputValue(fav.address);
      setDropoffCoords(newCoords);
      setShowDropoffSuggestions(false);
    }
    toast({ title: "Favorite Applied", description: `${fav.label}: ${fav.address} selected.` });
  };


  const watchedVehicleType = form.watch("vehicleType");
  const watchedPassengers = form.watch("passengers");
  const watchedStops = form.watch("stops");
  const watchedDesiredDate = form.watch("desiredPickupDate");

  const handleAddStop = () => {
    append({ location: "" });
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
    let waitTimeoutId: NodeJS.Timeout;
    if (pickupCoords && !anyFetchingDetails && !form.formState.isSubmitting) {
      // Simulate wait time: random number between 3 and 10 minutes
      // Adding a slight delay to simulate an API call
      waitTimeoutId = setTimeout(() => {
        const randomWaitTime = Math.floor(Math.random() * (10 - 3 + 1)) + 3;
        setEstimatedWaitTime(randomWaitTime);
      }, 700); // 0.7 second delay
    } else if (!pickupCoords) { // If pickupCoords is cleared, reset wait time immediately
      setEstimatedWaitTime(null);
    }
    return () => clearTimeout(waitTimeoutId);
  }, [pickupCoords, anyFetchingDetails, form.formState.isSubmitting]);


  useEffect(() => {
    let totalDistanceMiles = 0;
    const validStopsForFare = stopAutocompleteData.filter((stopData, index) => {
        const formStopValue = form.getValues(`stops.${index}.location`);
        return stopData.coords && formStopValue && formStopValue.trim() !== "";
    });
    
    if (pickupCoords && dropoffCoords) {
      let currentPoint = pickupCoords;
      for (const stopData of validStopsForFare) { 
        if (stopData.coords) { 
          totalDistanceMiles += getDistanceInMiles(currentPoint, stopData.coords);
          currentPoint = stopData.coords;
        }
      }
      totalDistanceMiles += getDistanceInMiles(currentPoint, dropoffCoords);
      setEstimatedDistance(parseFloat(totalDistanceMiles.toFixed(2)));
      
      const isCurrentlySurge = Math.random() < 0.3; 
      setIsSurgeActive(isCurrentlySurge);
      const surgeMultiplierToApply = isCurrentlySurge ? SURGE_MULTIPLIER_VALUE : 1;
      setCurrentSurgeMultiplier(surgeMultiplierToApply);

      let calculatedFareBeforeMultipliers = 0;

      if (totalDistanceMiles <= 0) {
        calculatedFareBeforeMultipliers = 0;
      } else {
        const estimatedTripDurationMinutes = (totalDistanceMiles / AVERAGE_SPEED_MPH) * 60;
        const timeFare = estimatedTripDurationMinutes * PER_MINUTE_RATE;
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
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
    }
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, watchedStops, watchedVehicleType, watchedPassengers, form]);

 useEffect(() => {
    const newMarkers: MapMarker[] = [];
    if (pickupCoords) {
      newMarkers.push({ position: pickupCoords, title: `Pickup: ${form.getValues('pickupLocation')}` });
    }
    const currentFormStops = form.getValues('stops');
    currentFormStops?.forEach((formStop, index) => {
        const stopData = stopAutocompleteData[index];
        if (stopData && stopData.coords && formStop.location && formStop.location.trim() !== "") {
             newMarkers.push({ position: stopData.coords, title: `Stop: ${formStop.location}` });
        }
    });
    if (dropoffCoords) {
      newMarkers.push({ position: dropoffCoords, title: `Dropoff: ${form.getValues('dropoffLocation')}` });
    }
    setMapMarkers(newMarkers);
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, form, watchedStops]); 


  async function handleBookRide(values: z.infer<typeof bookingFormSchema>) {
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
            });
        }
    }

    if (fareEstimate === null) {
        toast({ title: "Fare Not Calculated", description: "Could not calculate fare. Ensure addresses are valid.", variant: "destructive" });
        return;
    }
    
    let scheduledPickupAt: string | undefined = undefined;
    if (values.desiredPickupDate && values.desiredPickupTime) {
      const [hours, minutes] = values.desiredPickupTime.split(':').map(Number);
      const combinedDateTime = new Date(values.desiredPickupDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      scheduledPickupAt = combinedDateTime.toISOString();
    }


    setIsBooking(true);

    const bookingPayload = {
      passengerId: user.id,
      passengerName: user.name,
      pickupLocation: { address: values.pickupLocation, latitude: pickupCoords.lat, longitude: pickupCoords.lng },
      dropoffLocation: { address: values.dropoffLocation, latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
      stops: validStopsData,
      vehicleType: values.vehicleType,
      passengers: values.passengers,
      fareEstimate: fareEstimate,
      isSurgeApplied: isSurgeActive,
      surgeMultiplier: currentSurgeMultiplier,
      stopSurchargeTotal: validStopsData.length * PER_STOP_SURCHARGE,
      scheduledPickupAt,
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
      
      let rideDescription = `Your ride from ${values.pickupLocation}`;
      if (validStopsData.length > 0) {
          rideDescription += ` via ${validStopsData.map(s => s.address).join(' via ')}`;
      }
      rideDescription += ` to ${values.dropoffLocation} is confirmed (ID: ${result.bookingId}). Vehicle: ${values.vehicleType}. Estimated fare: £${fareEstimate}${isSurgeActive ? ' (Surge Applied)' : ''}.`;
      if (scheduledPickupAt) {
        rideDescription += ` Scheduled for: ${format(new Date(scheduledPickupAt), "PPPp")}.`;
      }
      rideDescription += ` A driver will be assigned.`;

      
      toast({ title: "Booking Confirmed!", description: rideDescription, variant: "default", duration: 7000 });
      
      form.reset(); 
      setPickupInputValue("");
      setDropoffInputValue("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setStopAutocompleteData([]); 
      setFareEstimate(null);
      setEstimatedDistance(null);
      setEstimatedWaitTime(null);
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
      setMapMarkers([]);
      setPickupSuggestions([]); 
      setDropoffSuggestions([]); 

    } catch (error) {
        console.error("Booking error:", error);
        toast({ title: "Booking Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
    } finally {
        setIsBooking(false);
    }
  }

  const renderSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetchingSuggestions: boolean,
    isFetchingDetails: boolean,
    inputValue: string,
    onSuggestionClick: (suggestion: google.maps.places.AutocompletePrediction) => void, 
    fieldKey: string 
  ) => (
    <div className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
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
          className="p-2 text-sm hover:bg-muted cursor-pointer"
          onMouseDown={() => onSuggestionClick(suggestionItem)}
        >
          {suggestionItem.description}
        </div>
      ))}
    </div>
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
                onClick={() => { onSelectFavorite(fav); (document.activeElement as HTMLElement)?.blur(); }} // Close popover
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

  const currentMapCenter = pickupCoords || defaultMapCenter;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
          <CardDescription>Enter your pickup and drop-off details. You can add multiple intermediate stops and schedule for later.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleBookRide)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="pickupLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Pickup Location</FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              placeholder="Type pickup address"
                              {...field}
                              value={pickupInputValue}
                              onChange={(e) => handleAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)}
                              onFocus={handleFocusFactory('pickupLocation')}
                              onBlur={handleBlurFactory('pickupLocation')}
                              autoComplete="off"
                              className="pr-10"
                            />
                          </FormControl>
                          {renderFavoriteLocationsPopover(handleFavoriteSelectFactory('pickupLocation', field.onChange), "pickup")}
                          {showPickupSuggestions && renderSuggestions(
                            pickupSuggestions, 
                            isFetchingPickupSuggestions, 
                            isFetchingPickupDetails, 
                            pickupInputValue, 
                            (sugg) => handleSuggestionClickFactory('pickupLocation')(sugg, field.onChange),
                            "pickup"
                          )}
                        </div>
                        <FormDescription>
                          If autocomplete doesn't provide a door number, please add it manually for accuracy.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {fields.map((stopField, index) => {
                    const currentStopData = stopAutocompleteData[index] || { inputValue: '', suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null, fieldId: stopField.id };
                    return (
                      <FormField
                        key={stopField.id} 
                        control={form.control}
                        name={`stops.${index}.location`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center justify-between">
                              <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Stop {index + 1}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveStop(index)} className="text-destructive hover:text-destructive-foreground px-1 py-0 h-auto">
                                <XCircle className="mr-1 h-4 w-4" /> Remove Stop
                              </Button>
                            </FormLabel>
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
                                  className="pr-10"
                                />
                              </FormControl>
                              {renderFavoriteLocationsPopover(handleFavoriteSelectFactory(index, field.onChange), `stop-${index}`)}
                              {currentStopData.showSuggestions && renderSuggestions(
                                currentStopData.suggestions, 
                                currentStopData.isFetchingSuggestions, 
                                currentStopData.isFetchingDetails, 
                                currentStopData.inputValue, 
                                (sugg) => handleSuggestionClickFactory(index)(sugg, field.onChange),
                                `stop-${index}`
                              )}
                            </div>
                            <FormDescription>
                              If autocomplete doesn't provide a door number, please add it manually for accuracy.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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

                  <FormField
                    control={form.control}
                    name="dropoffLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Drop-off Location</FormLabel>
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
                              className="pr-10"
                            />
                          </FormControl>
                           {renderFavoriteLocationsPopover(handleFavoriteSelectFactory('dropoffLocation', field.onChange), "dropoff")}
                          {showDropoffSuggestions && renderSuggestions(
                            dropoffSuggestions, 
                            isFetchingDropoffSuggestions, 
                            isFetchingDropoffDetails, 
                            dropoffInputValue, 
                            (sugg) => handleSuggestionClickFactory('dropoffLocation')(sugg, field.onChange), 
                            "dropoff"
                          )}
                        </div>
                        <FormDescription>
                          If autocomplete doesn't provide a door number, please add it manually for accuracy.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="desiredPickupDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-muted-foreground" /> Desired Pickup Date (Optional)</FormLabel>
                        <Popover>
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
                                if (!date) { 
                                  form.setValue("desiredPickupTime", "");
                                }
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
                        <FormLabel className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> Desired Pickup Time (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            disabled={!watchedDesiredDate}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                   <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!fareEstimate || form.formState.isSubmitting || anyFetchingDetails || isBooking}>
                     {isBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                     {isBooking ? 'Processing...' : 'Book Ride'}
                  </Button>
                </form>
              </Form>

              <Card className="w-full text-center shadow-md mt-6">
                <CardHeader>
                  <CardTitle className="text-2xl font-headline flex items-center justify-center gap-2">
                    <DollarSign className="w-7 h-7 text-accent" /> Fare & Wait Estimate
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

                  {/* Estimated Wait Time Display Logic */}
                  {!anyFetchingDetails && estimatedWaitTime !== null && pickupCoords && (
                    <p className="text-lg text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
                      <Clock className="w-5 h-5 text-primary" /> Estimated Wait: ~{estimatedWaitTime} min
                    </p>
                  )}
                  {anyFetchingDetails && pickupCoords && !estimatedWaitTime && ( // Show estimating if pickup details are being fetched
                     <p className="text-lg text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
                       <Clock className="w-5 h-5 text-primary animate-pulse" /> Estimating wait time...
                    </p>
                  )}
                   {!anyFetchingDetails && pickupCoords && estimatedWaitTime === null && ( // Show estimating if pickup is set, not fetching, but wait time not calculated yet
                     <p className="text-lg text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
                       <Clock className="w-5 h-5 text-primary animate-pulse" /> Estimating wait time...
                    </p>
                  )}


                  <p className="text-sm text-muted-foreground mt-3">
                    {(anyFetchingDetails || fareEstimate !== null || (pickupCoords && estimatedWaitTime !== null)) ? "Estimates may vary based on real-time conditions." : "Enter details to see your fare & wait estimate here."}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col items-center justify-center bg-muted/50 p-2 md:p-6 rounded-lg min-h-[300px] md:min-h-[400px]">
              <div className="w-full h-64 md:h-80 mb-6">
                <GoogleMapDisplay 
                    key="book-ride-map"
                    center={currentMapCenter} 
                    zoom={(pickupCoords || dropoffCoords || stopAutocompleteData.some(s=>s.coords)) ? 12 : 10} 
                    markers={mapMarkers} 
                    className="w-full h-full" 
                 />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    

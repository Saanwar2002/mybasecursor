
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { MapPin, Car, DollarSign, Users, Loader2, Zap, Route, PlusCircle, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader } from '@googlemaps/js-api-loader';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

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
});

type AutocompleteData = {
  fieldId: string; // For stops, this will be react-hook-form's field.id
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
};

const defaultMapCenter: [number, number] = [51.5074, -0.1278]; // London

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
  const { toast } = useToast();
  const [mapMarkers, setMapMarkers] = useState<Array<{ position: [number, number]; popupText?: string }>>([]);
  
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const [isSurgeActive, setIsSurgeActive] = useState(false);
  const [currentSurgeMultiplier, setCurrentSurgeMultiplier] = useState(1);
  
  const [stopAutocompleteData, setStopAutocompleteData] = useState<AutocompleteData[]>([]);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      stops: [],
      vehicleType: "car",
      passengers: 1,
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
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing. Address autocomplete will not work.");
      toast({ title: "Configuration Error", description: "Google Maps API Key is not set. Address search is disabled.", variant: "destructive" });
      return;
    }
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places"],
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
    formOnChange(inputValue); // Update react-hook-form state
    setFareEstimate(null);
    setEstimatedDistance(null);

    if (typeof formFieldNameOrStopIndex === 'number') { // It's a stop
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
        setPickupSuggestions([]); // Clear old suggestions
      } else {
        setIsFetchingPickupSuggestions(false);
        setPickupSuggestions([]);
      }
    } else { // dropoffLocation
      setDropoffInputValue(inputValue);
      setDropoffCoords(null);
      setShowDropoffSuggestions(inputValue.length >=2);
       if(inputValue.length >=2) {
        setIsFetchingDropoffSuggestions(true);
        setDropoffSuggestions([]); // Clear old suggestions
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
      } else { // dropoffLocation
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
      // Reset relevant input state
      if (typeof formFieldNameOrStopIndex === 'string') {
        if (formFieldNameOrStopIndex === 'pickupLocation') {
          setPickupInputValue(prev => form.getValues('pickupLocation') || prev); // Revert to form value or keep current if form value is also problematic
          setPickupCoords(null); setShowPickupSuggestions(false);
        } else { // dropoffLocation
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

    formOnChange(addressText); // Update react-hook-form state

    const setIsFetchingDetailsFunc = (isFetching: boolean) => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingDetails: isFetching } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setIsFetchingPickupDetails(isFetching);
      } else { // dropoffLocation
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
      } else { // dropoffLocation
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
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken(); // Refresh token
        }
      );
    } else {
      setIsFetchingDetailsFunc(false);
      setCoordsFunc(null);
      toast({ title: "Warning", description: "Could not fetch location details (missing place ID or service).", variant: "default" });
    }
  }, [toast, placesServiceRef, autocompleteSessionTokenRef, form]);


  const handleFocusFactory = (formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    let currentInputValue: string;
    let currentSuggestions: google.maps.places.AutocompletePrediction[];

    if (typeof formFieldNameOrStopIndex === 'number') { // Stop
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
    } else { // dropoffLocation
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
      } else { // dropoffLocation
        setShowDropoffSuggestions(false);
      }
    }, 150); // Delay to allow click on suggestion
  };

  const watchedVehicleType = form.watch("vehicleType");
  const watchedPassengers = form.watch("passengers");
  const watchedStops = form.watch("stops");

  const handleAddStop = () => {
    // Append to react-hook-form's fields array
    append({ location: "" });
    // Add corresponding entry to our local state for autocomplete management
    setStopAutocompleteData(prev => [
      ...prev,
      {
        fieldId: `stop-temp-${prev.length}-${Date.now()}`, // This will be updated once field.id is available
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
    remove(index); // remove from react-hook-form
    setStopAutocompleteData(prev => prev.filter((_, i) => i !== index)); // remove from local state by index
  };


  useEffect(() => {
    let totalDistanceMiles = 0;
    // Filter stopAutocompleteData for stops that have coordinates AND have a non-empty location string in the form
    const validStopsForFare = stopAutocompleteData.filter((stopData, index) => {
        const formStopValue = form.getValues(`stops.${index}.location`);
        return stopData.coords && formStopValue && formStopValue.trim() !== "";
    });
    
    if (pickupCoords && dropoffCoords) {
      let currentPoint = pickupCoords;
      for (const stopData of validStopsForFare) { // Iterate over validated stops
        if (stopData.coords) { // This check is redundant due to filter, but safe
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
    const newMarkers = [];
    if (pickupCoords) {
      newMarkers.push({ position: [pickupCoords.lat, pickupCoords.lng], popupText: `Pickup: ${form.getValues('pickupLocation')}` });
    }
    // Iterate through form.getValues('stops') to ensure we only add markers for stops that are still in the form
    const currentFormStops = form.getValues('stops');
    currentFormStops?.forEach((formStop, index) => {
        const stopData = stopAutocompleteData[index];
        if (stopData && stopData.coords && formStop.location && formStop.location.trim() !== "") {
             newMarkers.push({ position: [stopData.coords.lat, stopData.coords.lng], popupText: `Stop: ${formStop.location}` });
        }
    });
    if (dropoffCoords) {
      newMarkers.push({ position: [dropoffCoords.lat, dropoffCoords.lng], popupText: `Dropoff: ${form.getValues('dropoffLocation')}` });
    }
    setMapMarkers(newMarkers);
  }, [pickupCoords, dropoffCoords, stopAutocompleteData, form, watchedStops]); // watchedStops to re-run when form.stops changes


  function handleBookRide(values: z.infer<typeof bookingFormSchema>) {
     if (!pickupCoords || !dropoffCoords) {
      toast({
        title: "Missing Location Details",
        description: "Please select valid pickup and drop-off locations from the suggestions.",
        variant: "destructive",
      });
      return;
    }

    for (let i = 0; i < (values.stops?.length || 0); i++) {
        const stopLocationInput = values.stops?.[i]?.location;
        const stopData = stopAutocompleteData[i];
        if (stopLocationInput && stopLocationInput.trim() !== "" && !stopData?.coords) {
            toast({
                title: `Missing Stop ${i + 1} Details`,
                description: `Please select a valid location for stop ${i+1} or remove it. Empty stops will be ignored.`,
                variant: "destructive",
            });
            return;
        }
    }

    if (fareEstimate === null) {
      toast({
        title: "Fare Not Calculated",
        description: "Could not calculate fare. Please ensure addresses are valid.",
        variant: "destructive",
      });
      return;
    }

    let rideDescription = `Your ride from ${values.pickupLocation}`;
    const validStopLocations = values.stops?.filter(s => s.location.trim() !== "").map(s => s.location) || [];
    if (validStopLocations.length > 0) {
        rideDescription += ` via ${validStopLocations.join(' via ')}`;
    }
    rideDescription += ` to ${values.dropoffLocation} is confirmed. Vehicle: ${values.vehicleType}. Estimated fare: £${fareEstimate}${isSurgeActive ? ' (Surge Pricing Applied)' : ''}. A driver will be assigned shortly.`;

    toast({
      title: "Booking Confirmed!",
      description: rideDescription,
      variant: "default",
    });
    form.reset(); // This also resets 'stops' field array
    setPickupInputValue("");
    setDropoffInputValue("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setStopAutocompleteData([]); 
    setFareEstimate(null);
    setEstimatedDistance(null);
    setIsSurgeActive(false);
    setCurrentSurgeMultiplier(1);
    setMapMarkers([]);
    setPickupSuggestions([]); 
    setDropoffSuggestions([]); 
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
  
  const anyFetchingDetails = isFetchingPickupDetails || isFetchingDropoffDetails || stopAutocompleteData.some(s => s.isFetchingDetails);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
          <CardDescription>Enter your pickup and drop-off details. You can add multiple intermediate stops.</CardDescription>
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
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="Type pickup address"
                              {...field}
                              value={pickupInputValue}
                              onChange={(e) => handleAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)}
                              onFocus={handleFocusFactory('pickupLocation')}
                              onBlur={handleBlurFactory('pickupLocation')}
                              autoComplete="off"
                            />
                          </FormControl>
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
                      </FormItem>
                    )}
                  />
                  
                  {fields.map((stopField, index) => {
                    const currentStopData = stopAutocompleteData[index] || { inputValue: '', suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null, fieldId: stopField.id };
                    return (
                      <FormField
                        key={stopField.id} // Unique key from useFieldArray
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
                            <div className="relative">
                              <FormControl>
                                <Input
                                  placeholder={`Type stop ${index + 1} address`}
                                  {...field}
                                  value={currentStopData.inputValue}
                                  onChange={(e) => handleAddressInputChangeFactory(index)(e.target.value, field.onChange)}
                                  onFocus={handleFocusFactory(index)}
                                  onBlur={handleBlurFactory(index)}
                                  autoComplete="off"
                                />
                              </FormControl>
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
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="Type drop-off address"
                              {...field}
                              value={dropoffInputValue}
                               onChange={(e) => handleAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)}
                               onFocus={handleFocusFactory('dropoffLocation')}
                               onBlur={handleBlurFactory('dropoffLocation')}
                              autoComplete="off"
                            />
                          </FormControl>
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
                   <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!fareEstimate || form.formState.isSubmitting || anyFetchingDetails}>
                     Book Ride
                  </Button>
                </form>
              </Form>

              <Card className="w-full text-center shadow-md mt-6">
                <CardHeader>
                  <CardTitle className="text-2xl font-headline flex items-center justify-center gap-2">
                    <DollarSign className="w-7 h-7 text-accent" /> Fare Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {anyFetchingDetails ? (
                     <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                        <p className="text-2xl font-bold text-muted-foreground">Calculating...</p>
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
                     <p className="text-xl text-muted-foreground">Select locations to see fare.</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {(anyFetchingDetails || fareEstimate !== null) ? "This is an estimated fare. Actual fare may vary." : "Enter details to see your fare estimate here."}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col items-center justify-center bg-muted/50 p-2 md:p-6 rounded-lg min-h-[300px] md:min-h-[400px]">
              <div className="w-full h-64 md:h-80 mb-6">
                <MapDisplay 
                    center={(pickupCoords && [pickupCoords.lat, pickupCoords.lng]) || defaultMapCenter} 
                    zoom={(pickupCoords || dropoffCoords || stopAutocompleteData.some(s=>s.coords)) ? 12 : 10} 
                    markers={mapMarkers} 
                    className="w-full h-full" 
                    scrollWheelZoom={true}
                 />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

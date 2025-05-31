
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { MapPin, Car, DollarSign, Users, Briefcase, Loader2, Zap, Route, PlusCircle, XCircle } from 'lucide-react';
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
  intermediateStop1Location: z.string().optional(),
  vehicleType: z.enum(["car", "estate", "minibus_6", "minibus_8"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
});

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
  const [intermediateStop1Coords, setIntermediateStop1Coords] = useState<google.maps.LatLngLiteral | null>(null);

  const [isSurgeActive, setIsSurgeActive] = useState(false);
  const [currentSurgeMultiplier, setCurrentSurgeMultiplier] = useState(1);
  const [showIntermediateStop1, setShowIntermediateStop1] = useState(false);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      intermediateStop1Location: "",
      vehicleType: "car",
      passengers: 1,
    },
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
  
  const [intermediateStop1InputValue, setIntermediateStop1InputValue] = useState("");
  const [intermediateStop1Suggestions, setIntermediateStop1Suggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showIntermediateStop1SuggestionsField, setShowIntermediateStop1SuggestionsField] = useState(false);
  const [isFetchingIntermediateStop1Suggestions, setIsFetchingIntermediateStop1Suggestions] = useState(false);
  const [isFetchingIntermediateStop1Details, setIsFetchingIntermediateStop1Details] = useState(false);

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
    setSuggestionsState: React.Dispatch<React.SetStateAction<google.maps.places.AutocompletePrediction[]>>,
    setIsFetchingState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!autocompleteServiceRef.current || inputValue.length < 2) {
      setSuggestionsState([]);
      setIsFetchingState(false);
      return;
    }

    setIsFetchingState(true);
    autocompleteServiceRef.current.getPlacePredictions(
      { 
        input: inputValue, 
        sessionToken: autocompleteSessionTokenRef.current,
        componentRestrictions: { country: 'gb' } 
      },
      (predictions, status) => {
        setIsFetchingState(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestionsState(predictions);
        } else {
          setSuggestionsState([]);
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
             console.warn("Autocomplete prediction error:", status);
          }
        }
      }
    );
  }, []);

  const handleAddressInputChange = useCallback((
    inputValue: string,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setSuggestionsState: React.Dispatch<React.SetStateAction<google.maps.places.AutocompletePrediction[]>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    setIsFetchingState: React.Dispatch<React.SetStateAction<boolean>>,
    formOnChange: (value: string) => void,
    setCoordsState: React.Dispatch<React.SetStateAction<google.maps.LatLngLiteral | null>>
  ) => {
    setInputValueState(inputValue);
    formOnChange(inputValue);
    setCoordsState(null); 
    setFareEstimate(null);
    setEstimatedDistance(null);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (inputValue.length < 2) {
      setSuggestionsState([]);
      setShowSuggestionsState(false);
      setIsFetchingState(false);
      return;
    }
    
    setShowSuggestionsState(true);
    setIsFetchingState(true);
    setSuggestionsState([]); 

    debounceTimeoutRef.current = setTimeout(() => {
      fetchAddressSuggestions(inputValue, setSuggestionsState, setIsFetchingState);
    }, 300);
  }, [fetchAddressSuggestions]);

  const handleSuggestionClick = useCallback((
    suggestion: google.maps.places.AutocompletePrediction,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    formOnChange: (value: string) => void,
    setCoordsState: React.Dispatch<React.SetStateAction<google.maps.LatLngLiteral | null>>,
    setIsFetchingDetailsState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const addressText = suggestion.description;
    setInputValueState(addressText);
    formOnChange(addressText); 
    setShowSuggestionsState(false);

    if (placesServiceRef.current && suggestion.place_id) {
      setIsFetchingDetailsState(true);
      placesServiceRef.current.getDetails(
        { 
          placeId: suggestion.place_id, 
          fields: ['geometry.location'], 
          sessionToken: autocompleteSessionTokenRef.current 
        }, 
        (place, status) => {
          setIsFetchingDetailsState(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setCoordsState({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            toast({ title: "Location Selected", description: `${addressText} coordinates captured.`});
          } else {
            toast({ title: "Error", description: "Could not get location details. Please try again.", variant: "destructive"});
            setCoordsState(null);
          }
          // Renew the session token after each getDetails call
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else {
      setCoordsState(null);
      toast({ title: "Warning", description: "Could not fetch location details (missing place ID or service).", variant: "default" });
    }
  }, [toast]);
  
  const handleFocus = (
    inputValue: string,
    suggestions: google.maps.places.AutocompletePrediction[],
    setSuggestionsState: React.Dispatch<React.SetStateAction<google.maps.places.AutocompletePrediction[]>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    setIsFetchingState: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (inputValue.length >=2 && suggestions.length > 0) {
        setShowSuggestionsState(true);
    } else if (inputValue.length >= 2 && autocompleteServiceRef.current) {
        fetchAddressSuggestions(inputValue, setSuggestionsState, setIsFetchingState);
        setShowSuggestionsState(true);
    } else {
        setShowSuggestionsState(false);
    }
  };
  
  const handleBlur = (
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    // Delay hiding suggestions to allow click event on suggestion item
    setTimeout(() => {
      setShowSuggestionsState(false);
    }, 150); 
  };

  const watchedVehicleType = form.watch("vehicleType");
  const watchedPassengers = form.watch("passengers");

  const toggleIntermediateStop = () => {
    const newShowState = !showIntermediateStop1;
    setShowIntermediateStop1(newShowState);
    if (!newShowState) { // If hiding the stop
      form.setValue("intermediateStop1Location", "");
      setIntermediateStop1InputValue("");
      setIntermediateStop1Coords(null);
      setIntermediateStop1Suggestions([]);
    }
  };

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      let totalDistanceMiles = 0;
      if (showIntermediateStop1 && intermediateStop1Coords) {
        const dist1 = getDistanceInMiles(pickupCoords, intermediateStop1Coords);
        const dist2 = getDistanceInMiles(intermediateStop1Coords, dropoffCoords);
        totalDistanceMiles = dist1 + dist2;
      } else {
        totalDistanceMiles = getDistanceInMiles(pickupCoords, dropoffCoords);
      }
      
      setEstimatedDistance(totalDistanceMiles);
      
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
        
        // Adjusted distance fare: First mile has a surcharge
        const distanceBasedFare = (totalDistanceMiles * PER_MILE_RATE) + (totalDistanceMiles > 0 ? FIRST_MILE_SURCHARGE : 0);
        
        const subTotal = BASE_FARE + timeFare + distanceBasedFare;
        const fareWithBookingFee = subTotal + BOOKING_FEE;
        calculatedFareBeforeMultipliers = Math.max(fareWithBookingFee, MINIMUM_FARE);
      }

      const fareWithSurge = calculatedFareBeforeMultipliers * surgeMultiplierToApply;

      let vehicleMultiplier = 1.0;
      if (watchedVehicleType === "estate") vehicleMultiplier = 1.0; // Same as car
      if (watchedVehicleType === "minibus_6") vehicleMultiplier = 1.5; // Car + 50%
      if (watchedVehicleType === "minibus_8") vehicleMultiplier = 1.6; // Car + 60%
      
      const passengerCount = Number(watchedPassengers) || 1;
      // Example: 10% extra for each additional passenger beyond the first
      const passengerAdjustment = 1 + (Math.max(0, passengerCount - 1)) * 0.1; 
      
      const finalCalculatedFare = fareWithSurge * vehicleMultiplier * passengerAdjustment;
      setFareEstimate(parseFloat(finalCalculatedFare.toFixed(2)));

    } else {
      setFareEstimate(null);
      setEstimatedDistance(null);
      setIsSurgeActive(false);
      setCurrentSurgeMultiplier(1);
    }
  }, [pickupCoords, dropoffCoords, intermediateStop1Coords, showIntermediateStop1, watchedVehicleType, watchedPassengers]);

 useEffect(() => {
    const newMarkers = [];
    if (pickupCoords) {
      newMarkers.push({ position: [pickupCoords.lat, pickupCoords.lng], popupText: `Pickup: ${form.getValues('pickupLocation')}` });
    }
    if (showIntermediateStop1 && intermediateStop1Coords) {
      newMarkers.push({ position: [intermediateStop1Coords.lat, intermediateStop1Coords.lng], popupText: `Stop: ${form.getValues('intermediateStop1Location')}` });
    }
    if (dropoffCoords) {
      newMarkers.push({ position: [dropoffCoords.lat, dropoffCoords.lng], popupText: `Dropoff: ${form.getValues('dropoffLocation')}` });
    }
    setMapMarkers(newMarkers);
  }, [pickupCoords, dropoffCoords, intermediateStop1Coords, showIntermediateStop1, form]);


  function handleBookRide(values: z.infer<typeof bookingFormSchema>) {
     if (!pickupCoords || !dropoffCoords) {
      toast({
        title: "Missing Location Details",
        description: "Please select valid pickup and drop-off locations from the suggestions.",
        variant: "destructive",
      });
      return;
    }
    if (showIntermediateStop1 && values.intermediateStop1Location && !intermediateStop1Coords) {
      toast({
        title: "Missing Stop Details",
        description: "Please select a valid intermediate stop location from the suggestions or remove it.",
        variant: "destructive",
      });
      return;
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
    if (showIntermediateStop1 && values.intermediateStop1Location) {
      rideDescription += ` via ${values.intermediateStop1Location}`;
    }
    rideDescription += ` to ${values.dropoffLocation} is confirmed. Vehicle: ${values.vehicleType}. Estimated fare: £${fareEstimate}${isSurgeActive ? ' (Surge Pricing Applied)' : ''}. A driver will be assigned shortly.`;

    toast({
      title: "Booking Confirmed!",
      description: rideDescription,
      variant: "default",
    });
    form.reset();
    setPickupInputValue("");
    setDropoffInputValue("");
    setIntermediateStop1InputValue("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setIntermediateStop1Coords(null);
    setShowIntermediateStop1(false);
    setFareEstimate(null);
    setEstimatedDistance(null);
    setIsSurgeActive(false);
    setCurrentSurgeMultiplier(1);
    setMapMarkers([]);
    setPickupSuggestions([]); 
    setDropoffSuggestions([]); 
    setIntermediateStop1Suggestions([]);
  }

  const renderSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetchingSuggestions: boolean,
    isFetchingDetails: boolean,
    inputValue: string,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    formOnChange: (value: string) => void,
    setCoordsState: React.Dispatch<React.SetStateAction<google.maps.LatLngLiteral | null>>,
    setIsFetchingDetailsState: React.Dispatch<React.SetStateAction<boolean>>,
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
      {!isFetchingSuggestions && !isFetchingDetails && suggestions.map((suggestion) => (
        <div
          key={`${fieldKey}-${suggestion.place_id}`} 
          className="p-2 text-sm hover:bg-muted cursor-pointer"
          onMouseDown={() => handleSuggestionClick(suggestion, setInputValueState, setShowSuggestionsState, formOnChange, setCoordsState, setIsFetchingDetailsState)}
        >
          {suggestion.description}
        </div>
      ))}
    </div>
  );

  const anyFetchingDetails = isFetchingPickupDetails || isFetchingDropoffDetails || (showIntermediateStop1 && isFetchingIntermediateStop1Details);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
          <CardDescription>Enter your pickup and drop-off details to find a taxi. You can add one intermediate stop.</CardDescription>
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
                              onChange={(e) => handleAddressInputChange(e.target.value, setPickupInputValue, setPickupSuggestions, setShowPickupSuggestions, setIsFetchingPickupSuggestions, field.onChange, setPickupCoords)}
                              onFocus={() => handleFocus(pickupInputValue, pickupSuggestions, setPickupSuggestions, setShowPickupSuggestions, setIsFetchingPickupSuggestions)}
                              onBlur={() => handleBlur(setShowPickupSuggestions)}
                              autoComplete="off"
                            />
                          </FormControl>
                          {showPickupSuggestions && renderSuggestions(pickupSuggestions, isFetchingPickupSuggestions, isFetchingPickupDetails, pickupInputValue, setPickupInputValue, setShowPickupSuggestions, field.onChange, setPickupCoords, setIsFetchingPickupDetails, "pickup")}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!showIntermediateStop1 && (
                    <div className="flex justify-center my-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={toggleIntermediateStop}
                            className="text-sm font-semibold text-accent hover:text-accent/90 bg-accent/10 hover:bg-accent/20 px-6 py-2 rounded-lg shadow-sm"
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> (+ Stop/Pickup)
                        </Button>
                    </div>
                  )}

                  {showIntermediateStop1 && (
                    <FormField
                      control={form.control}
                      name="intermediateStop1Location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Intermediate Stop</span>
                            <Button type="button" variant="ghost" size="sm" onClick={toggleIntermediateStop} className="text-destructive hover:text-destructive-hover px-1 py-0 h-auto">
                              <XCircle className="mr-1 h-4 w-4" /> Remove Stop
                            </Button>
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                placeholder="Type intermediate stop address"
                                {...field}
                                value={intermediateStop1InputValue}
                                onChange={(e) => handleAddressInputChange(e.target.value, setIntermediateStop1InputValue, setIntermediateStop1Suggestions, setShowIntermediateStop1SuggestionsField, setIsFetchingIntermediateStop1Suggestions, field.onChange, setIntermediateStop1Coords)}
                                onFocus={() => handleFocus(intermediateStop1InputValue, intermediateStop1Suggestions, setIntermediateStop1Suggestions, setShowIntermediateStop1SuggestionsField, setIsFetchingIntermediateStop1Suggestions)}
                                onBlur={() => handleBlur(setShowIntermediateStop1SuggestionsField)}
                                autoComplete="off"
                              />
                            </FormControl>
                            {showIntermediateStop1SuggestionsField && renderSuggestions(intermediateStop1Suggestions, isFetchingIntermediateStop1Suggestions, isFetchingIntermediateStop1Details, intermediateStop1InputValue, setIntermediateStop1InputValue, setShowIntermediateStop1SuggestionsField, field.onChange, setIntermediateStop1Coords, setIsFetchingIntermediateStop1Details, "intermediateStop1")}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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
                              onChange={(e) => handleAddressInputChange(e.target.value, setDropoffInputValue, setDropoffSuggestions, setShowDropoffSuggestions, setIsFetchingDropoffSuggestions, field.onChange, setDropoffCoords)}
                              onFocus={() => handleFocus(dropoffInputValue, dropoffSuggestions, setDropoffSuggestions, setShowDropoffSuggestions, setIsFetchingDropoffSuggestions)}
                              onBlur={() => handleBlur(setShowDropoffSuggestions)}
                              autoComplete="off"
                            />
                          </FormControl>
                          {showDropoffSuggestions && renderSuggestions(dropoffSuggestions, isFetchingDropoffSuggestions, isFetchingDropoffDetails, dropoffInputValue, setDropoffInputValue, setShowDropoffSuggestions, field.onChange, setDropoffCoords, setIsFetchingDropoffDetails, "dropoff")}
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
                    <Briefcase className="mr-2 h-4 w-4" /> Book Ride (£{fareEstimate ? fareEstimate.toFixed(2) : '---'}) {isSurgeActive && <Zap className="ml-2 h-4 w-4 text-yellow-300" />}
                  </Button>
                </form>
              </Form>
            </div>
            <div className="flex flex-col items-center justify-center bg-muted/50 p-2 md:p-6 rounded-lg min-h-[300px] md:min-h-[400px]">
              <div className="w-full h-64 md:h-80 mb-6">
                <MapDisplay 
                    center={(pickupCoords && [pickupCoords.lat, pickupCoords.lng]) || defaultMapCenter} 
                    zoom={(pickupCoords || dropoffCoords || (showIntermediateStop1 && intermediateStop1Coords)) ? 12 : 10} 
                    markers={mapMarkers} 
                    className="w-full h-full" 
                 />
              </div>
              <Card className="w-full text-center shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl font-headline">Fare Estimate</CardTitle>
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
                       {estimatedDistance !== null && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                            <Route className="w-4 h-4" /> Estimated Distance: {estimatedDistance.toFixed(2)} miles
                          </p>
                        )}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


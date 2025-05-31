
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
import { MapPin, Car, DollarSign, Users, Briefcase, Loader2 } from 'lucide-react';
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
  vehicleType: z.enum(["sedan", "suv", "van", "luxury"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
});

const defaultMapCenter: [number, number] = [51.5074, -0.1278]; // London

export default function BookRidePage() {
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const { toast } = useToast();
  const [mapMarkers, setMapMarkers] = useState<Array<{ position: [number, number]; popupText?: string }>>([]);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      vehicleType: "sedan",
      passengers: 1,
    },
  });

  const [pickupInputValue, setPickupInputValue] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [isFetchingPickupSuggestions, setIsFetchingPickupSuggestions] = useState(false);

  const [dropoffInputValue, setDropoffInputValue] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [isFetchingDropoffSuggestions, setIsFetchingDropoffSuggestions] = useState(false);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      version: "weekly",
      libraries: ["places"],
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // Create a dummy map div for PlacesService, it doesn't need to be visible
      const mapDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => {
      console.error("Failed to load Google Maps API", e);
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
        sessionToken: sessionTokenRef.current,
        componentRestrictions: { country: 'gb' } // Restrict to UK for better results
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
    formOnChange: (value: string) => void
  ) => {
    setInputValueState(inputValue);
    formOnChange(inputValue); // Keep RHF updated with typed value

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (inputValue.length < 2) {
      setSuggestionsState([]);
      setShowSuggestionsState(false);
      setIsFetchingState(false);
      return;
    }
    
    setShowSuggestionsState(true); // Show dropdown (can show loading state here)
    setIsFetchingState(true); // Set fetching to true before debounce
    setSuggestionsState([]); // Clear previous suggestions

    debounceTimeoutRef.current = setTimeout(() => {
      fetchAddressSuggestions(inputValue, setSuggestionsState, setIsFetchingState);
    }, 300); // 300ms debounce
  }, [fetchAddressSuggestions]);

  const handleSuggestionClick = (
    suggestion: google.maps.places.AutocompletePrediction,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    formOnChange: (value: string) => void
  ) => {
    const addressText = suggestion.description;
    setInputValueState(addressText);
    formOnChange(addressText); 
    setShowSuggestionsState(false);
    // Optionally, fetch place details if needed for lat/lng
    // if (placesServiceRef.current && suggestion.place_id) {
    //   placesServiceRef.current.getDetails({ placeId: suggestion.place_id, sessionToken: sessionTokenRef.current }, (place, status) => {
    //     if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
    //       console.log("Selected place coordinates:", place.geometry.location.lat(), place.geometry.location.lng());
    //       // You might want to store these coordinates if needed
    //     }
    //   });
    // }
    // Renew session token for next set of autocompletes
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  };
  
  const handleFocus = (
    inputValue: string,
    setSuggestionsState: React.Dispatch<React.SetStateAction<google.maps.places.AutocompletePrediction[]>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    setIsFetchingState: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (inputValue.length >= 2 && autocompleteServiceRef.current) {
        fetchAddressSuggestions(inputValue, setSuggestionsState, setIsFetchingState);
        setShowSuggestionsState(true);
    } else {
        setShowSuggestionsState(false); // Don't show if less than 2 chars or service not ready
    }
  };
  
  const handleBlur = (
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setTimeout(() => {
      setShowSuggestionsState(false);
    }, 150);
  };

  function onSubmit(values: z.infer<typeof bookingFormSchema>) {
    const baseFare = 5;
    const distanceFare = Math.random() * 20 + 5; 
    let vehicleMultiplier = 1;
    if (values.vehicleType === "suv") vehicleMultiplier = 1.5;
    if (values.vehicleType === "van") vehicleMultiplier = 2;
    if (values.vehicleType === "luxury") vehicleMultiplier = 3;
    
    const calculatedFare = baseFare + distanceFare * vehicleMultiplier * (1 + (values.passengers -1) * 0.1);
    setFareEstimate(parseFloat(calculatedFare.toFixed(2)));

    const newMarkers = [
        { position: [defaultMapCenter[0] + 0.01, defaultMapCenter[1] + 0.01] as [number, number], popupText: `Pickup: ${values.pickupLocation}` },
        { position: [defaultMapCenter[0] - 0.01, defaultMapCenter[1] - 0.01] as [number, number], popupText: `Dropoff: ${values.dropoffLocation}` }
    ];
    setMapMarkers(newMarkers);

    toast({
      title: "Ride Details Submitted",
      description: "Checking for available taxis and calculating fare...",
    });
  }

  const handleConfirmBooking = () => {
    toast({
      title: "Booking Confirmed!",
      description: `Your ride is confirmed. Estimated fare: £${fareEstimate}. A driver will be assigned shortly.`,
      variant: "default",
    });
    form.reset();
    setPickupInputValue("");
    setDropoffInputValue("");
    setFareEstimate(null);
    setMapMarkers([]);
  };

  const renderSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetching: boolean,
    inputValue: string,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>,
    formOnChange: (value: string) => void,
    fieldKey: string
  ) => (
    <div className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
      {isFetching && (
        <div className="p-2 text-sm text-muted-foreground flex items-center justify-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading suggestions...
        </div>
      )}
      {!isFetching && suggestions.length === 0 && inputValue.length >= 2 && (
         <div className="p-2 text-sm text-muted-foreground">No suggestions found.</div>
      )}
      {!isFetching && suggestions.map((suggestion) => (
        <div
          key={`${fieldKey}-${suggestion.place_id}`}
          className="p-2 text-sm hover:bg-muted cursor-pointer"
          onMouseDown={() => handleSuggestionClick(suggestion, setInputValueState, setShowSuggestionsState, formOnChange)}
        >
          {suggestion.description}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
          <CardDescription>Enter your pickup and drop-off details to find a taxi.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              onChange={(e) => handleAddressInputChange(e.target.value, setPickupInputValue, setPickupSuggestions, setShowPickupSuggestions, setIsFetchingPickupSuggestions, field.onChange)}
                              onFocus={() => handleFocus(pickupInputValue, setPickupSuggestions, setShowPickupSuggestions, setIsFetchingPickupSuggestions)}
                              onBlur={() => handleBlur(setShowPickupSuggestions)}
                              autoComplete="off"
                            />
                          </FormControl>
                          {showPickupSuggestions && renderSuggestions(pickupSuggestions, isFetchingPickupSuggestions, pickupInputValue, setPickupInputValue, setShowPickupSuggestions, field.onChange, "pickup")}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                              onChange={(e) => handleAddressInputChange(e.target.value, setDropoffInputValue, setDropoffSuggestions, setShowDropoffSuggestions, setIsFetchingDropoffSuggestions, field.onChange)}
                              onFocus={() => handleFocus(dropoffInputValue, setDropoffSuggestions, setShowDropoffSuggestions, setIsFetchingDropoffSuggestions)}
                              onBlur={() => handleBlur(setShowDropoffSuggestions)}
                              autoComplete="off"
                            />
                          </FormControl>
                          {showDropoffSuggestions && renderSuggestions(dropoffSuggestions, isFetchingDropoffSuggestions, dropoffInputValue, setDropoffInputValue, setShowDropoffSuggestions, field.onChange, "dropoff")}
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
                            <SelectItem value="sedan">Sedan (Standard)</SelectItem>
                            <SelectItem value="suv">SUV (More space)</SelectItem>
                            <SelectItem value="van">Van (Large group)</SelectItem>
                            <SelectItem value="luxury">Luxury (Premium)</SelectItem>
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
                          <Input type="number" min="1" max="10" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <DollarSign className="mr-2 h-4 w-4" /> Get Fare Estimate
                  </Button>
                </form>
              </Form>
            </div>
            <div className="flex flex-col items-center justify-center bg-muted/50 p-2 md:p-6 rounded-lg min-h-[300px] md:min-h-[400px]">
              <div className="w-full h-64 md:h-80 mb-6">
                <MapDisplay center={defaultMapCenter} zoom={12} markers={mapMarkers} className="w-full h-full" />
              </div>
              {fareEstimate !== null && (
                <Card className="w-full text-center shadow-md">
                  <CardHeader>
                    <CardTitle className="text-2xl font-headline">Fare Estimate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-accent">£{fareEstimate}</p>
                    <p className="text-sm text-muted-foreground mt-1">This is an estimated fare. Actual fare may vary.</p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={handleConfirmBooking} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Briefcase className="mr-2 h-4 w-4" /> Confirm Booking
                    </Button>
                  </CardFooter>
                </Card>
              )}
              {fareEstimate === null && (
                 <p className="text-muted-foreground">Enter details to see your fare estimate here.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

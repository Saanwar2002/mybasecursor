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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Car, Clock, Coins, Info, Loader2, LocateFixed, MapPin, MinusCircle, PlusCircle, Star, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useGoogleMaps } from '@/contexts/google-maps/google-maps-provider';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMinutes, set } from 'date-fns';
import { cn } from '@/lib/utils';
import { TimePicker } from '@/components/ui/time-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';

// Zod schema for a single stop
const stopSchema = z.object({
    location: z.string().min(5, { message: "Stop location must be at least 5 characters." }),
    // Additional stop-specific fields can be added here
});

// Zod schema for the entire booking form
const formSchema = z.object({
    pickupLocation: z.string().min(5, {
        message: "Pickup location must be at least 5 characters.",
    }),
    dropoffLocation: z.string().min(5, {
        message: "Dropoff location must be at least 5 characters.",
    }),
    stops: z.array(stopSchema).optional(),
    bookingType: z.enum(['now', 'scheduled']),
    scheduledTime: z.date().optional(),
    vehicleType: z.enum(['standard', 'estate', 'minibus', 'pet_friendly', 'disability_access']),
    numberOfPassengers: z.coerce.number().min(1, "At least 1 passenger is required.").max(8, "Maximum 8 passengers allowed."),
    specialInstructions: z.string().max(200, "Instructions cannot exceed 200 characters.").optional(),
    useAccount: z.boolean().default(false),
    paymentMethod: z.string().optional(),
    waitTimeMinutes: z.coerce.number().min(0).optional(),
    priorityFee: z.coerce.number().min(0).optional(),
}).refine(data => {
    if (data.bookingType === 'scheduled' && !data.scheduledTime) {
        return false;
    }
    return true;
}, {
    message: "Scheduled time is required for scheduled bookings.",
    path: ["scheduledTime"],
}).refine(data => {
    if (data.useAccount && !data.paymentMethod) {
        // In a real app, you'd check if the user has a valid account here
        // For now, we'll just check if a payment method is selected
        return false;
    }
    return true;
}, {
    message: "A payment method must be selected for account bookings.",
    path: ["paymentMethod"],
});

type BookingFormValues = z.infer<typeof formSchema>;

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full rounded-lg shadow-md" />,
});

// Copied from driver's available-rides page for consistency
const driverCarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="45" viewBox="0 0 30 45"><path d="M15 45 L10 30 H20 Z" fill="black"/><circle cx="15" cy="16" r="12" fill="#3B82F6" stroke="black" stroke-width="2"/><rect x="12" y="10.5" width="6" height="4" fill="white" rx="1"/><rect x="9" y="14.5" width="12" height="5" fill="white" rx="1"/></svg>`;
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(driverCarIconSvg)}` : '';

interface MapMarker {
  position: google.maps.LatLngLiteral;
  title?: string;
  iconUrl?: string;
  iconScaledSize?: { width: number; height: number };
}

interface FavoriteLocation {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

type GeolocationFetchStatus = 'idle' | 'fetching' | 'success' | 'error';


type AutocompleteData = {
  fieldId: string;
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
};

export default function BookRidePage() {
  const { isLoaded: isMapSdkLoaded, loadError, autocompleteService, placesService, geocoder, createSessionToken } = useGoogleMaps();
  const { user } = useAuth();
  const router = useRouter();
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mockAvailableDriverMarkers, setMockAvailableDriverMarkers] = useState<MapMarker[]>([]);

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

  const [baseFareEstimate, setBaseFareEstimate] = useState<number | null>(null);
  const [totalFareEstimate, setTotalFareEstimate] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(null);

  const { toast } = useToast();

  const [geolocationFetchStatus, setGeolocationFetchStatus] = useState<GeolocationFetchStatus>("idle");
  const [showGpsSuggestionAlert, setShowGpsSuggestionAlert] = useState(false);

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmedBookingDetails, setConfirmedBookingDetails] = useState<BookingFormValues | null>(null);

  const [mapBusynessLevel, setMapBusynessLevel] = useState<'idle' | 'moderate' | 'high'>('idle');
  
  const searchParams = useSearchParams();
  const operatorPreference = searchParams.get('operator_preference');

  const [isWaitTimeDialogOpen, setIsWaitTimeDialogOpen] = useState(false);
  const [isPriorityFeeDialogOpen, setIsPriorityFeeDialogOpen] = useState(false);
  const waitTimeInputRef = useRef<HTMLInputElement>(null);
  const priorityFeeInputRef = useRef<HTMLInputElement>(null);
  const [operatorSurcharge, setOperatorSurcharge] = useState(0);

  const mapCenterPinRef = useRef<HTMLDivElement>(null);
  const pinPeekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken>();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      stops: [],
      bookingType: 'now',
      vehicleType: 'standard',
      numberOfPassengers: 1,
      specialInstructions: "",
      useAccount: false,
      waitTimeMinutes: 0,
      priorityFee: 0,
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
    // This effect handles fetching the operator's surge pricing setting
    const fetchOperatorSettings = async () => {
      if (!operatorPreference) {
        setIsLoadingSurgeSetting(false);
        return;
      }
      try {
        setIsLoadingSurgeSetting(true);
        // In a real app, you'd get the operator's ID, not just the name.
        // This is a placeholder for fetching settings.
        const response = await fetch(`/api/operator/settings/operational?operatorName=${encodeURIComponent(operatorPreference)}`);
        if (response.ok) {
          const settings = await response.json();
          setIsOperatorSurgeEnabled(settings.enableSurgePricing || false);
        }
      } catch (error) {
        console.error("Error fetching operator settings:", error);
      } finally {
        setIsLoadingSurgeSetting(false);
      }
    };
    fetchOperatorSettings();
  }, [operatorPreference]);

  useEffect(() => {
    // Create a new session token when the component mounts and Google Maps is loaded
    if (isMapSdkLoaded) {
      autocompleteSessionTokenRef.current = createSessionToken();
    }
  }, [isMapSdkLoaded, createSessionToken]);

  useEffect(() => {
    if (loadError) {
      toast({
        title: "Map Service Error",
        description: `Could not load Google Maps services: ${loadError.message}. Please try refreshing the page.`,
        variant: "destructive",
      });
    }
  }, [loadError, toast]);

  const fetchAddressSuggestions = useCallback((
    inputValue: string,
    setSuggestionsFunc: (suggestions: google.maps.places.AutocompletePrediction[]) => void,
    setIsFetchingFunc: (isFetching: boolean) => void
  ) => {
    if (!isMapSdkLoaded || !autocompleteService || inputValue.length < 2) {
      setSuggestionsFunc([]);
      setIsFetchingFunc(false);
      return;
    }

    setIsFetchingFunc(true);
    autocompleteService.getPlacePredictions(
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
  }, [isMapSdkLoaded, autocompleteService]);

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
          (sugg) => setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg, isFetchingSuggestions: false } : item)),
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
        setStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, coords } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setPickupCoords(coords);
      } else {
        setDropoffCoords(coords);
      }
    };

    setIsFetchingDetailsFunc(true);
    if (isMapSdkLoaded && placesService && suggestion.place_id) {
      placesService.getDetails(
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
          autocompleteSessionTokenRef.current = createSessionToken();
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
  }, [isMapSdkLoaded, placesService, createSessionToken, form, toast]);

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
        } else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteService) {
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
        else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteService) {
            fetchAddressSuggestions(currentInputValue, setPickupSuggestions, setIsFetchingPickupSuggestions);
            setShowPickupSuggestions(true);
        } else setShowPickupSuggestions(false);
    } else {
        currentInputValue = dropoffInputValue;
        currentSuggestions = dropoffSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowDropoffSuggestions(true);
        else if (currentInputValue.length >= 2 && isMapSdkLoaded && autocompleteService) {
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

  // ... rest of the component logic ...
}











    







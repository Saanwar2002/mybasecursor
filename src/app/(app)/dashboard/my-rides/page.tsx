
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, Calendar as CalendarIconLucide, MapPin, DollarSign, Loader2, AlertTriangle, Trash2, Edit, Clock, PlusCircle, XCircle } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Loader } from '@googlemaps/js-api-loader';
import { Skeleton } from '@/components/ui/skeleton';


interface JsonTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: JsonTimestamp | null;
  scheduledPickupAt?: string | null; 
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
}

const formatDate = (timestamp?: JsonTimestamp | null, isoString?: string | null): string => {
  if (isoString) {
    try {
      const date = parseISO(isoString);
       if (!isValid(date)) {
        console.warn("formatDate (ISO): Created an invalid date from ISO string:", isoString);
        return 'Scheduled time N/A (Invalid ISO Date)';
      }
      return format(date, "PPPp"); 
    } catch (e) {
      console.error("formatDate (ISO): Error parsing ISO string:", e, "from isoString:", isoString);
      return 'Scheduled time N/A (ISO Parse Error)';
    }
  }

  if (!timestamp) return 'Date/Time N/A (Missing)';
  if (typeof timestamp._seconds !== 'number' || typeof timestamp._nanoseconds !== 'number') {
    return 'Date/Time N/A (Bad Timestamp Structure)';
  }

  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (!isValid(date)) {
      console.warn(`formatDate (Object): Created an invalid date from object:`, timestamp);
      return 'Date/Time N/A (Invalid Date Obj)';
    }
    return format(date, "PPPp");
  } catch (e) {
    console.error("formatDate (Object): Error converting object to date string:", e, "from timestamp object:", timestamp);
    return 'Date/Time N/A (Conversion Error)';
  }
};

const editDetailsFormSchema = z.object({
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array(
    z.object({
      location: z.string().min(3, { message: "Stop location must be at least 3 characters." })
    })
  ).optional(),
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(),
}).refine(data => {
  if ((data.desiredPickupDate && !data.desiredPickupTime) || (!data.desiredPickupDate && data.desiredPickupTime)) {
    return false;
  }
  return true;
}, {
  message: "Both date and time must be provided if scheduling, or both left empty for ASAP.",
  path: ["desiredPickupTime"],
});

type EditDetailsFormValues = z.infer<typeof editDetailsFormSchema>;

type DialogAutocompleteData = {
  fieldId: string; 
  inputValue: string;
  suggestions: google.maps.places.AutocompletePrediction[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  isFetchingDetails: boolean;
  coords: google.maps.LatLngLiteral | null;
};

export default function MyRidesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [rideToEditDetails, setRideToEditDetails] = useState<Ride | null>(null);
  const [isEditDetailsDialogOpen, setIsEditDetailsDialogOpen] = useState(false);
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  // Autocomplete state for the dialog
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

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  const editDetailsForm = useForm<EditDetailsFormValues>({
    resolver: zodResolver(editDetailsFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      stops: [],
      desiredPickupDate: undefined,
      desiredPickupTime: "",
    },
  });

  const { fields: editStopsFields, append: appendEditStop, remove: removeEditStop } = useFieldArray({
    control: editDetailsForm.control,
    name: "stops",
  });
  
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing for MyRidesPage. Address autocomplete will not work.");
      return;
    }
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places", "marker"], // Standardized order
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const mapDiv = document.createElement('div'); 
      placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => console.error("Failed to load Google Maps API for address search in MyRidesPage", e));
  }, []);


  const fetchDialogAddressSuggestions = useCallback((
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
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestionsFunc(predictions);
        } else {
          setSuggestionsFunc([]);
        }
      }
    );
  }, []);

  const handleDialogAddressInputChangeFactory = useCallback((
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number
  ) => (
    inputValue: string,
    formOnChange: (value: string) => void,
  ) => {
    formOnChange(inputValue); 

    if (typeof formFieldNameOrStopIndex === 'number') { 
      setDialogStopAutocompleteData(prev => prev.map((item, idx) => 
        idx === formFieldNameOrStopIndex 
        ? { ...item, inputValue, coords: null, suggestions: inputValue.length >= 2 ? item.suggestions : [], showSuggestions: inputValue.length >=2, isFetchingSuggestions: inputValue.length >=2 } 
        : item
      ));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
      setDialogPickupInputValue(inputValue); setDialogPickupCoords(null); setShowDialogPickupSuggestions(inputValue.length >=2);
      if(inputValue.length >=2) { setIsFetchingDialogPickupSuggestions(true); setDialogPickupSuggestions([]); } 
      else { setIsFetchingDialogPickupSuggestions(false); setDialogPickupSuggestions([]); }
    } else { 
      setDialogDropoffInputValue(inputValue); setDialogDropoffCoords(null); setShowDialogDropoffSuggestions(inputValue.length >=2);
      if(inputValue.length >=2) { setIsFetchingDialogDropoffSuggestions(true); setDialogDropoffSuggestions([]); }
      else { setIsFetchingDialogDropoffSuggestions(false); setDialogDropoffSuggestions([]); }
    }

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (inputValue.length < 2) return;

    debounceTimeoutRef.current = setTimeout(() => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        fetchDialogAddressSuggestions(inputValue, 
          (sugg) => setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg } : item)),
          (fetch) => setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingSuggestions: fetch } : item))
        );
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        fetchDialogAddressSuggestions(inputValue, setDialogPickupSuggestions, setIsFetchingDialogPickupSuggestions);
      } else { 
        fetchDialogAddressSuggestions(inputValue, setDialogDropoffSuggestions, setIsFetchingDialogDropoffSuggestions);
      }
    }, 300);
  }, [fetchDialogAddressSuggestions]);

  const handleDialogSuggestionClickFactory = useCallback((
    formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number
  ) => (
    suggestion: google.maps.places.AutocompletePrediction,
    formOnChange: (value: string) => void,
  ) => {
    const addressText = suggestion?.description;
    if (!addressText) return;
    formOnChange(addressText); 

    const setIsFetchingDetailsFunc = (isFetching: boolean) => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingDetails: isFetching } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') setIsFetchingDialogPickupDetails(isFetching);
      else setIsFetchingDialogDropoffDetails(isFetching);
    };

    const setCoordsFunc = (coords: google.maps.LatLngLiteral | null) => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, coords, inputValue: addressText, showSuggestions: false } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        setDialogPickupCoords(coords); setDialogPickupInputValue(addressText); setShowDialogPickupSuggestions(false);
      } else { 
        setDialogDropoffCoords(coords); setDialogDropoffInputValue(addressText); setShowDialogDropoffSuggestions(false);
      }
    };
    
    setIsFetchingDetailsFunc(true);
    if (placesServiceRef.current && suggestion.place_id) {
      placesServiceRef.current.getDetails(
        { placeId: suggestion.place_id, fields: ['geometry.location'], sessionToken: autocompleteSessionTokenRef.current }, 
        (place, status) => {
          setIsFetchingDetailsFunc(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setCoordsFunc({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          } else setCoordsFunc(null);
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken(); 
        }
      );
    } else { setIsFetchingDetailsFunc(false); setCoordsFunc(null); }
  }, [toast, placesServiceRef, autocompleteSessionTokenRef, editDetailsForm]);

const handleDialogFocusFactory = (formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    let currentInputValue: string; let currentSuggestions: google.maps.places.AutocompletePrediction[];
    if (typeof formFieldNameOrStopIndex === 'number') { 
        const stopData = dialogStopAutocompleteData[formFieldNameOrStopIndex]; if (!stopData) return;
        currentInputValue = stopData.inputValue; currentSuggestions = stopData.suggestions;
        if (currentInputValue.length >= 2 && currentSuggestions.length > 0) {
             setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: true } : item));
        } else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
            fetchDialogAddressSuggestions(currentInputValue, 
                (sugg) => setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, suggestions: sugg, showSuggestions: true } : item)),
                (fetch) => setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, isFetchingSuggestions: fetch } : item))
            );
        } else setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: false } : item));
    } else if (formFieldNameOrStopIndex === 'pickupLocation') {
        currentInputValue = dialogPickupInputValue; currentSuggestions = dialogPickupSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowDialogPickupSuggestions(true);
        else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
            fetchDialogAddressSuggestions(currentInputValue, setDialogPickupSuggestions, setIsFetchingDialogPickupSuggestions);
            setShowDialogPickupSuggestions(true);
        } else setShowDialogPickupSuggestions(false);
    } else { 
        currentInputValue = dialogDropoffInputValue; currentSuggestions = dialogDropoffSuggestions;
        if (currentInputValue.length >=2 && currentSuggestions.length > 0) setShowDialogDropoffSuggestions(true);
        else if (currentInputValue.length >= 2 && autocompleteServiceRef.current) {
            fetchDialogAddressSuggestions(currentInputValue, setDialogDropoffSuggestions, setIsFetchingDialogDropoffSuggestions);
            setShowDialogDropoffSuggestions(true);
        } else setShowDialogDropoffSuggestions(false);
    }
  };
  
  const handleDialogBlurFactory = (formFieldNameOrStopIndex: 'pickupLocation' | 'dropoffLocation' | number) => () => {
    setTimeout(() => {
      if (typeof formFieldNameOrStopIndex === 'number') {
        setDialogStopAutocompleteData(prev => prev.map((item, idx) => idx === formFieldNameOrStopIndex ? { ...item, showSuggestions: false } : item));
      } else if (formFieldNameOrStopIndex === 'pickupLocation') setShowDialogPickupSuggestions(false);
      else setShowDialogDropoffSuggestions(false);
    }, 150); 
  };

  const handleAddEditStop = () => {
    appendEditStop({ location: "" });
    setDialogStopAutocompleteData(prev => [ ...prev, { fieldId: `edit-stop-${prev.length}-${Date.now()}`, inputValue: "", suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null }]);
  };
  const handleRemoveEditStop = (index: number) => { removeEditStop(index); setDialogStopAutocompleteData(prev => prev.filter((_, i) => i !== index)); };


  useEffect(() => {
    if (user?.id) {
      const fetchRides = async () => {
        setIsLoading(true); setError(null);
        try {
          const response = await fetch(`/api/bookings/my-rides?passengerId=${user.id}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Failed to fetch rides: ${response.status}` }));
            throw new Error(errorData.details || errorData.message);
          }
          const data: Ride[] = await response.json();
          setRides(data);
        } catch (err) {
          const displayMessage = err instanceof Error ? err.message : "An unknown error occurred.";
          setError(displayMessage);
          toast({ title: "Error Fetching Rides", description: displayMessage, variant: "destructive", duration: 7000 });
        } finally { setIsLoading(false); }
      };
      fetchRides();
    } else setIsLoading(false);
  }, [user, toast]);

  const handleRateRide = (ride: Ride) => { setSelectedRideForRating(ride); setCurrentRating(ride.rating || 0); };
  const submitRating = async () => {
    if (!selectedRideForRating || !user) return;
    const updatedRides = rides.map(r => r.id === selectedRideForRating.id ? { ...r, rating: currentRating } : r);
    setRides(updatedRides); 
    toast({ title: "Rating Submitted", description: `You rated your ride ${currentRating} stars.`});
    setSelectedRideForRating(null); setCurrentRating(0);
  };

  const handleOpenCancelDialog = (ride: Ride) => setRideToCancel(ride);
  const handleConfirmCancel = async () => {
    if (!rideToCancel || !user) return;
    setIsCancelling(true);
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: rideToCancel.id, passengerId: user.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Cancellation failed."}));
        throw new Error(errorData.message);
      }
      setRides(prevRides => prevRides.map(r => r.id === rideToCancel.id ? { ...r, status: 'cancelled' } : r));
      toast({ title: "Booking Cancelled", description: "Your ride has been successfully cancelled." });
    } catch (error) {
      toast({ title: "Cancellation Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally { setIsCancelling(false); setRideToCancel(null); }
  };

  const handleOpenEditDetailsDialog = (ride: Ride) => {
    setRideToEditDetails(ride);
    editDetailsForm.reset({
      pickupLocation: ride.pickupLocation.address,
      dropoffLocation: ride.dropoffLocation.address,
      stops: ride.stops?.map(s => ({ location: s.address })) || [],
      desiredPickupDate: ride.scheduledPickupAt ? parseISO(ride.scheduledPickupAt) : undefined,
      desiredPickupTime: ride.scheduledPickupAt ? format(parseISO(ride.scheduledPickupAt), "HH:mm") : "",
    });
    setDialogPickupInputValue(ride.pickupLocation.address);
    setDialogPickupCoords({ lat: ride.pickupLocation.latitude, lng: ride.pickupLocation.longitude });
    setDialogDropoffInputValue(ride.dropoffLocation.address);
    setDialogDropoffCoords({ lat: ride.dropoffLocation.latitude, lng: ride.dropoffLocation.longitude });
    setDialogStopAutocompleteData(ride.stops?.map((s, i) => ({
        fieldId: `edit-stop-initial-${i}`,
        inputValue: s.address,
        coords: { lat: s.latitude, lng: s.longitude },
        suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false,
    })) || []);
    setIsEditDetailsDialogOpen(true);
  };

  async function onSubmitEditDetails(values: EditDetailsFormValues) {
    if (!rideToEditDetails || !user) return;
    
    if (!dialogPickupCoords || !dialogDropoffCoords) {
        toast({ title: "Missing Location Coordinates", description: "Please ensure valid pickup and dropoff locations are selected from suggestions.", variant: "destructive" });
        return;
    }

    const updatedStops: LocationPoint[] = [];
    for (let i = 0; i < (values.stops?.length || 0); i++) {
        const stopInput = values.stops?.[i]?.location;
        const stopData = dialogStopAutocompleteData[i];
        if (stopInput && stopInput.trim() !== "" && !stopData?.coords) {
            toast({ title: `Invalid Stop ${i + 1}`, description: `Please select stop ${i + 1} from suggestions or remove it.`, variant: "destructive" });
            return;
        }
        if (stopData?.coords && stopInput && stopInput.trim() !== "") {
            updatedStops.push({ address: stopInput, latitude: stopData.coords.lat, longitude: stopData.coords.lng });
        }
    }

    setIsUpdatingDetails(true);
    let newScheduledPickupAt: string | null = null;
    if (values.desiredPickupDate && values.desiredPickupTime) {
      const [hours, minutes] = values.desiredPickupTime.split(':').map(Number);
      const combinedDateTime = new Date(values.desiredPickupDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      newScheduledPickupAt = combinedDateTime.toISOString();
    }

    const payload = {
        bookingId: rideToEditDetails.id,
        passengerId: user.id,
        pickupLocation: { address: values.pickupLocation, latitude: dialogPickupCoords.lat, longitude: dialogPickupCoords.lng },
        dropoffLocation: { address: values.dropoffLocation, latitude: dialogDropoffCoords.lat, longitude: dialogDropoffCoords.lng },
        stops: updatedStops,
        scheduledPickupAt: newScheduledPickupAt,
    };

    try {
      const response = await fetch('/api/bookings/update-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update details."}));
        throw new Error(errorData.message);
      }
      const updatedRideData = await response.json();
      setRides(prevRides => prevRides.map(r => r.id === rideToEditDetails.id ? { 
          ...r, 
          pickupLocation: updatedRideData.pickupLocation,
          dropoffLocation: updatedRideData.dropoffLocation,
          stops: updatedRideData.stops,
          scheduledPickupAt: updatedRideData.scheduledPickupAt 
        } : r
      ));
      toast({ title: "Booking Details Updated", description: "Your ride details have been changed." });
      setIsEditDetailsDialogOpen(false);
    } catch (error) {
      toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally { setIsUpdatingDetails(false); }
  }
  
  const renderDialogSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetchingSuggestions: boolean, isFetchingDetails: boolean, inputValue: string,
    onSuggestionClick: (suggestion: google.maps.places.AutocompletePrediction) => void, fieldKey: string 
  ) => (
    <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
      {isFetchingSuggestions && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>}
      {isFetchingDetails && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</div>}
      {!isFetchingSuggestions && !isFetchingDetails && suggestions.length === 0 && inputValue.length >= 2 && <div className="p-2 text-sm text-muted-foreground">No suggestions.</div>}
      {!isFetchingSuggestions && !isFetchingDetails && suggestions.map((s) => (
        <div key={`${fieldKey}-${s.place_id}`} className="p-2 text-sm hover:bg-muted cursor-pointer" onMouseDown={() => onSuggestionClick(s)}>{s.description}</div>
      ))}
    </div>
  );
  
  const anyDialogFetchingDetails = isFetchingDialogPickupDetails || isFetchingDialogDropoffDetails || dialogStopAutocompleteData.some(s => s.isFetchingDetails);

  if (isLoading) { 
    return (
      <div className="space-y-6">
        <Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">My Rides</CardTitle><CardDescription>Loading your rides...</CardDescription></CardHeader></Card>
        <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (error && rides.length === 0) { 
    return (
      <div className="space-y-6">
        <Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">My Rides</CardTitle><CardDescription>View past rides, rate experiences, manage bookings.</CardDescription></CardHeader></Card>
        <Card className="border-destructive bg-destructive/10"><CardContent className="pt-6 text-center text-destructive">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p className="font-semibold">Could not load rides.</p><p className="text-sm">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-3xl font-headline">My Rides</CardTitle><CardDescription>View past rides, rate experiences, manage bookings. ({rides.length} found)</CardDescription></CardHeader>
      </Card>

      {rides.length === 0 && !isLoading && !error && ( <Card><CardContent className="pt-6 text-center text-muted-foreground">You have no rides yet.</CardContent></Card> )}
      {error && rides.length > 0 && ( <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg"><p><strong>Error:</strong> {error}</p></div> )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {rides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> {ride.vehicleType?.charAt(0).toUpperCase() + ride.vehicleType?.slice(1).replace(/_/g, ' ') || 'Vehicle'}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm"><CalendarIconLucide className="w-4 h-4" /> Booked: {formatDate(ride.bookingTimestamp)}</CardDescription>
                </div>
                <Badge variant={ ride.status === 'completed' ? 'default' : ride.status === 'cancelled' ? 'destructive' : ride.status === 'in_progress' ? 'outline' : 'secondary' }
                  className={ cn( ride.status === 'in_progress' && 'border-blue-500 text-blue-500', ride.status === 'pending_assignment' && 'bg-yellow-400/80 text-yellow-900', ride.status === 'driver_assigned' && 'bg-sky-400/80 text-sky-900', ride.status === 'completed' && 'bg-green-500/80 text-green-950', ride.status === 'cancelled' && 'bg-red-500/80 text-red-950' )}>
                  {ride.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ride.driver && (
                <div className="flex items-center gap-2">
                    <Image src={ride.driverAvatar || `https://placehold.co/40x40.png?text=${ride.driver.charAt(0)}`} alt={ride.driver} width={40} height={40} className="rounded-full" data-ai-hint="avatar driver" />
                    <div><p className="font-medium">{ride.driver}</p><p className="text-xs text-muted-foreground">Driver</p></div>
                </div>
              )}
              {!ride.driver && ride.status !== 'completed' && ride.status !== 'cancelled' && <p className="text-sm text-muted-foreground">Waiting for driver assignment...</p>}
              
              {ride.scheduledPickupAt && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Scheduled Pickup:</p>
                  <div 
                    className="flex items-center gap-2 text-sm bg-sky-100 dark:bg-sky-700/30 border border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-100 px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    <Clock className="w-5 h-5" /> 
                    <span className="font-semibold">{formatDate(null, ride.scheduledPickupAt)}</span>
                  </div>
                </div>
              )}

              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => (
                    <p key={index} className="flex items-start gap-1 pl-5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index+1}:</strong> {stop.address}</p>
                ))}
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}{ride.isSurgeApplied && <Badge variant="outline" className="ml-1 border-orange-500 text-orange-500">Surge</Badge>}</div>
              </div>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                {ride.status === 'completed' && (ride.rating ? (<div className="flex items-center"><p className="text-sm mr-2">Your Rating:</p>{[...Array(5)].map((_, i) => (<Star key={i} className={`w-5 h-5 ${i < ride.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />))}</div>) : (<Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>Rate Ride</Button>))}
                {ride.status === 'pending_assignment' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditDetailsDialog(ride)} className="w-full sm:w-auto"><Edit className="mr-2 h-4 w-4" /> Edit Booking</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleOpenCancelDialog(ride)} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Cancel Ride</Button>
                  </>
                )}
                {['driver_assigned', 'in_progress'].includes(ride.status) && (<Button variant="outline" size="sm" disabled className="w-full sm:w-auto">Cannot Modify Ride</Button>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRideForRating && (
         <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
           <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRideForRating(null)} />
           <div className="relative bg-card rounded-lg p-6">
                <CardHeader><CardTitle>Rate ride with {selectedRideForRating.driver || 'driver'}</CardTitle><CardDescription>{formatDate(selectedRideForRating.bookingTimestamp)} - {selectedRideForRating.pickupLocation.address} to {selectedRideForRating.dropoffLocation.address}</CardDescription></CardHeader>
                <CardContent className="flex justify-center space-x-1 py-4">{[...Array(5)].map((_, i) => (<Star key={i} className={`w-8 h-8 cursor-pointer ${i < currentRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} onClick={() => setCurrentRating(i + 1)}/>))}</CardContent>
                <CardFooter className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelectedRideForRating(null)}>Cancel</Button><Button onClick={submitRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit</Button></CardFooter>
            </div>
        </Card>
      )}
      
      <AlertDialog open={!!rideToCancel} onOpenChange={(open) => !open && setRideToCancel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel ride?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isCancelling}>Back</AlertDialogCancel><AlertDialogAction onClick={handleConfirmCancel} disabled={isCancelling} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancel</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rideToEditDetails && (
        <Dialog open={isEditDetailsDialogOpen} onOpenChange={setIsEditDetailsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit Booking Details</DialogTitle><DialogDescription>Modify pickup, dropoff, stops, or time for your ride. Fare may change based on new details (not recalculated here).</DialogDescription></DialogHeader>
            <Form {...editDetailsForm}>
              <form onSubmit={editDetailsForm.handleSubmit(onSubmitEditDetails)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">
                <FormField control={editDetailsForm.control} name="pickupLocation" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Pickup</FormLabel>
                    <div className="relative"><FormControl><Input placeholder="Pickup address" {...field} value={dialogPickupInputValue} onChange={(e) => handleDialogAddressInputChangeFactory('pickupLocation')(e.target.value, field.onChange)} onFocus={handleDialogFocusFactory('pickupLocation')} onBlur={handleDialogBlurFactory('pickupLocation')} autoComplete="off"/></FormControl>
                      {showDialogPickupSuggestions && renderDialogSuggestions(dialogPickupSuggestions, isFetchingDialogPickupSuggestions, isFetchingDialogPickupDetails, dialogPickupInputValue, (sugg) => handleDialogSuggestionClickFactory('pickupLocation')(sugg, field.onChange), "dialog-pickup")}
                    </div><FormMessage />
                  </FormItem>)}
                />
                {editStopsFields.map((stopField, index) => {
                  const currentStopData = dialogStopAutocompleteData[index] || { inputValue: '', suggestions: [], showSuggestions: false, isFetchingSuggestions: false, isFetchingDetails: false, coords: null, fieldId: stopField.id };
                  return (<FormField key={stopField.id} control={editDetailsForm.control} name={`stops.${index}.location`} render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center justify-between"><span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Stop {index + 1}</span><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveEditStop(index)} className="text-destructive hover:text-destructive-foreground px-1 py-0 h-auto"><XCircle className="mr-1 h-4 w-4" /> Remove</Button></FormLabel>
                      <div className="relative"><FormControl><Input placeholder={`Stop ${index + 1} address`} {...field} value={currentStopData.inputValue} onChange={(e) => handleDialogAddressInputChangeFactory(index)(e.target.value, field.onChange)} onFocus={handleDialogFocusFactory(index)} onBlur={handleDialogBlurFactory(index)} autoComplete="off"/></FormControl>
                        {currentStopData.showSuggestions && renderDialogSuggestions(currentStopData.suggestions, currentStopData.isFetchingSuggestions, currentStopData.isFetchingDetails, currentStopData.inputValue, (sugg) => handleDialogSuggestionClickFactory(index)(sugg, field.onChange), `dialog-stop-${index}`)}
                      </div><FormMessage />
                    </FormItem>)}
                  />);
                })}
                <div className="flex justify-center"><Button type="button" variant="outline" size="sm" onClick={handleAddEditStop} className="text-accent hover:text-accent/90 border-accent/50"><PlusCircle className="mr-2 h-4 w-4" /> Add Stop</Button></div>
                <FormField control={editDetailsForm.control} name="dropoffLocation" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Dropoff</FormLabel>
                    <div className="relative"><FormControl><Input placeholder="Dropoff address" {...field} value={dialogDropoffInputValue} onChange={(e) => handleDialogAddressInputChangeFactory('dropoffLocation')(e.target.value, field.onChange)} onFocus={handleDialogFocusFactory('dropoffLocation')} onBlur={handleDialogBlurFactory('dropoffLocation')} autoComplete="off"/></FormControl>
                      {showDialogDropoffSuggestions && renderDialogSuggestions(dialogDropoffSuggestions, isFetchingDialogDropoffSuggestions, isFetchingDialogDropoffDetails, dialogDropoffInputValue, (sugg) => handleDialogSuggestionClickFactory('dropoffLocation')(sugg, field.onChange), "dialog-dropoff")}
                    </div><FormMessage />
                  </FormItem>)}
                />
                <FormField control={editDetailsForm.control} name="desiredPickupDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>New Pickup Date (Optional)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); if (!date) editDetailsForm.setValue("desiredPickupTime", "");}} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } initialFocus/></PopoverContent></Popover><FormMessage /></FormItem>)}
                />
                <FormField control={editDetailsForm.control} name="desiredPickupTime" render={({ field }) => (
                  <FormItem><FormLabel>New Pickup Time (Optional)</FormLabel><FormControl><Input type="time" {...field} disabled={!editDetailsForm.watch("desiredPickupDate")}/></FormControl><FormMessage /></FormItem>)}
                />
                <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isUpdatingDetails || anyDialogFetchingDetails}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isUpdatingDetails || anyDialogFetchingDetails} className="bg-primary hover:bg-primary/90 text-primary-foreground">{isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

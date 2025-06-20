"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Star, Car, Calendar as CalendarIconLucide, MapPin, DollarSign, Loader2, AlertTriangle, Trash2, Edit, Clock, PlusCircle, XCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, UserX, ThumbsUp } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth, UserRole } from '@/contexts/auth-context';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Renamed DialogDescription
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
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescriptionForAlert } from "@/components/ui/alert"; // Renamed AlertDescription for Alert
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


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
  displayBookingId?: string;
  originatingOperatorId?: string;
  bookingTimestamp?: JsonTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  driverId?: string;
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
  notifiedPassengerArrivalTimestamp?: JsonTimestamp | null;
  passengerAcknowledgedArrivalTimestamp?: JsonTimestamp | null;
  rideStartedAt?: JsonTimestamp | null; 
  paymentMethod?: "card" | "cash";
}

const formatDate = (timestamp?: JsonTimestamp | null, isoString?: string | null): string => {
  if (isoString) {
    try {
      const date = parseISO(isoString);
       if (!isValid(date)) return 'Scheduled time N/A (Invalid ISO Date)';
      return format(date, "PPPp");
    } catch (e) { return 'Scheduled time N/A (ISO Parse Error)'; }
  }
  if (!timestamp) return 'Date/Time N/A (Missing)';
  if (typeof timestamp._seconds !== 'number' || typeof timestamp._nanoseconds !== 'number') return 'Date/Time N/A (Bad Timestamp Structure)';
  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (!isValid(date)) return 'Date/Time N/A (Invalid Date Obj)';
    return format(date, "PPPp");
  } catch (e) { return 'Date/Time N/A (Conversion Error)'; }
};

const editDetailsFormSchema = z.object({
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  stops: z.array( z.object({ location: z.string().min(3, { message: "Stop location must be at least 3 characters." }) }) ).optional(),
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(),
}).refine(data => !((data.desiredPickupDate && !data.desiredPickupTime) || (!data.desiredPickupDate && data.desiredPickupTime)), {
  message: "Both date and time must be provided if scheduling, or both left empty for ASAP.", path: ["desiredPickupTime"],
});

type EditDetailsFormValues = z.infer<typeof editDetailsFormSchema>;
type DialogAutocompleteData = { fieldId: string; inputValue: string; suggestions: google.maps.places.AutocompletePrediction[]; showSuggestions: boolean; isFetchingSuggestions: boolean; isFetchingDetails: boolean; coords: google.maps.LatLngLiteral | null; };

export default function MyRidesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allFetchedRides, setAllFetchedRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [favoritingDriverId, setFavoritingDriverId] = useState<string | null>(null);

  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellingRideIdSwitch, setCancellingRideIdSwitch] = useState<string | null>(null);

  const [rideToEditDetails, setRideToEditDetails] = useState<Ride | null>(null);
  const [isEditDetailsDialogOpen, setIsEditDetailsDialogOpen] = useState(false);
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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
    defaultValues: { pickupLocation: "", dropoffLocation: "", stops: [], desiredPickupDate: undefined, desiredPickupTime: "" },
  });

  const { fields: editStopsFields, append: appendEditStop, remove: removeEditStop } = useFieldArray({ control: editDetailsForm.control, name: "stops" });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) { console.warn("Google Maps API Key missing."); return; }
    const loader = new Loader({ 
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, 
      version: "weekly", 
      libraries: ["geocoding", "maps", "marker", "places", "geometry", "routes"] 
    });
    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => console.error("Failed to load Google Maps API for MyRidesPage", e));
  }, []);


  useEffect(() => {
    if (user?.id) {
      const fetchRides = async () => {
        setIsLoading(true); setError(null);
        try {
          const response = await fetch(`/api/bookings/my-rides?passengerId=${user.id}`);
          if (!response.ok) { const errorData = await response.json().catch(() => ({ message: `Failed to fetch rides: ${response.status}` })); throw new Error(errorData.details || errorData.message); }
          const data: Ride[] = await response.json();
          setAllFetchedRides(data);
        } catch (err) { const displayMessage = err instanceof Error ? err.message : "An unknown error occurred."; setError(displayMessage); toast({ title: "Error Fetching Rides History", description: displayMessage, variant: "destructive", duration: 7000 });
        } finally { setIsLoading(false); }
      };
      fetchRides();
    } else setIsLoading(false);
  }, [user, toast]);

  const displayedRides = allFetchedRides.filter(ride => ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'cancelled_by_driver');

  const handleRateRide = (ride: Ride) => { setSelectedRideForRating(ride); setCurrentRating(ride.rating || 0); };
  
  const submitRating = async () => {
    if (!selectedRideForRating || !user) return;
    
    setAllFetchedRides(prevRides => 
      prevRides.map(r => r.id === selectedRideForRating.id ? { ...r, rating: currentRating } : r)
    );

    let toastDescription = `You rated your ride ${currentRating} stars. (Ride ID: ${selectedRideForRating.displayBookingId || selectedRideForRating.id})`;
    
    toast({
      title: "Rating Submitted (Mock)",
      description: toastDescription,
    });

    setSelectedRideForRating(null);
    setCurrentRating(0);
  };


  const handleOpenCancelDialog = (ride: Ride) => {
    toast({title: "Action Not Available", description: "Cancellation is handled on the 'My Active Ride' page for pending rides."});
  };
  const handleOpenEditDetailsDialog = (ride: Ride) => {
     toast({title: "Action Not Available", description: "Booking details can be edited on the 'My Active Ride' page for pending rides."});
  };
   const handleAcknowledgeArrival = async (rideId: string) => {
     toast({title: "Action Not Available", description: "Arrival acknowledgement is on the 'My Active Ride' page."});
  };

  const handleBlockDriver = async (rideToBlock: Ride) => {
    if (!user || !rideToBlock.driverId || !rideToBlock.driver) {
      toast({ title: "Cannot Block", description: "Driver information is missing for this ride.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [`block-${rideToBlock.driverId}`]: true }));
    try {
      const response = await fetch('/api/users/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerId: user.id,
          blockedId: rideToBlock.driverId,
          blockerRole: user.role,
          blockedRole: 'driver' as UserRole,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to block driver. Status: ${response.status}`);
      }
      toast({ title: "Driver Blocked", description: `${rideToBlock.driver} has been added to your block list.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while blocking driver.";
      toast({ title: "Blocking Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`block-${rideToBlock.driverId}`]: false }));
    }
  };

  const handleFavoriteDriver = async (rideToFavorite: Ride) => {
    if (!user || !rideToFavorite.driverId || !rideToFavorite.driver) {
      toast({ title: "Cannot Favorite", description: "Driver information is missing for this ride.", variant: "destructive" });
      return;
    }
    setFavoritingDriverId(rideToFavorite.driverId);
    try {
      const response = await fetch('/api/users/favorite-drivers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: rideToFavorite.driverId,
          driverName: rideToFavorite.driver,
          vehicleInfo: `${rideToFavorite.vehicleType}`,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to favorite driver. Status: ${response.status}`);
      }
      toast({ title: "Driver Favorited", description: `${rideToFavorite.driver} has been added to your favorites list.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while favoriting driver.";
      toast({ title: "Favoriting Failed", description: message, variant: "destructive" });
    } finally {
      setFavoritingDriverId(null);
    }
  };

  if (isLoading) return ( <div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Rides History</CardTitle><CardDescription>Loading your past rides...</CardDescription></CardHeader></Card><div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></div> );
  if (error && displayedRides.length === 0) return ( <div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Rides History</CardTitle><CardDescription>View past completed or cancelled rides.</CardDescription></CardHeader></Card><Card className="border-destructive bg-destructive/10"><CardContent className="pt-6 text-center text-destructive"><AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p className="font-semibold">Could not load rides history.</p><p className="text-sm">{error}</p><Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Try Again</Button></CardContent></Card></div> );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Rides History</CardTitle><CardDescription>View your past completed or cancelled rides. ({displayedRides.length} found)</CardDescription></CardHeader></Card>
      {displayedRides.length === 0 && !isLoading && !error && ( <Card><CardContent className="pt-6 text-center text-muted-foreground">You have no completed or cancelled rides yet.</CardContent></Card> )}
      {error && displayedRides.length > 0 && ( <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg"><p><strong>Error:</strong> {error}</p><p className="text-xs">Displaying cached or partially loaded data.</p></div> )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {displayedRides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> {ride.vehicleType?.charAt(0).toUpperCase() + ride.vehicleType?.slice(1).replace(/_/g, ' ') || 'Vehicle'}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-sm"><CalendarIconLucide className="w-4 h-4" /> Booked: {formatDate(ride.bookingTimestamp)}</CardDescription>
                    <CardDescription className="text-xs mt-1">ID: {ride.displayBookingId || ride.id}</CardDescription> {/* Added displayBookingId here */}
                </div>
                <Badge variant={
                    ride.status === 'completed' ? 'default' :
                    ride.status === 'cancelled' || ride.status === 'cancelled_by_driver' ? 'destructive' :
                    'secondary'
                  }
                  className={cn(
                    ride.status === 'completed' && 'bg-green-500/80 text-green-950',
                    (ride.status === 'cancelled' || ride.status === 'cancelled_by_driver') && 'bg-red-500/80 text-red-950'
                  )}
                >
                  {ride.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Image src={ride.driverAvatar || `https://placehold.co/48x48.png?text=${ride.driver?.charAt(0) || 'D'}`} alt="Driver" width={48} height={48} className="rounded-full" />
                  <div>
                    <p className="text-sm font-medium">{ride.driver}</p>
                    <p className="text-xs text-muted-foreground">{ride.vehicleType}</p>
                  </div>
                </div>
                {ride.status === 'completed' && (
                   <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`cursor-pointer ${i < (ride.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} onClick={() => handleRateRide(ride)} />
                    ))}
                   </div>
                )}
              </div>
              {ride.scheduledPickupAt && (<div className="mt-2"><p className="text-xs font-medium text-muted-foreground mb-1">Originally Scheduled For:</p><div className="flex items-center gap-2 text-sm bg-muted/50 border border-muted px-3 py-1.5 rounded-lg shadow-sm"><Clock className="w-5 h-5" /> <span className="font-semibold">{formatDate(null, ride.scheduledPickupAt)}</span></div></div>)}
              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => ( <p key={index} className="flex items-start gap-1 pl-5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index+1}:</strong> {stop.address}</p> ))}
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}{ride.isSurgeApplied && <Badge variant="outline" className="ml-1 border-orange-500 text-orange-500">Surge</Badge>}</div>
                 {ride.paymentMethod && (
                  <div className="flex items-center gap-1">
                    {ride.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
                    <strong>Payment:</strong> {ride.paymentMethod === 'card' ? 'Card (Mock Paid)' : 'Cash to Driver'}
                  </div>
                )}
              </div>
              <CardFooter className="flex flex-wrap gap-2 pt-4 border-t">
                {ride.status === 'completed' && (
                  <Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>
                    <Star className="mr-2 h-4 w-4" /> Rate Ride
                  </Button>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!ride.driverId || actionLoading[`block-${ride.driverId}`]}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {actionLoading[`block-${ride.driverId}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                      Block Driver
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Block {ride.driver || 'this driver'}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to block this driver? You will not be matched with them for future rides. This can be undone in your profile settings.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBlockDriver(ride)} className={buttonVariants({ variant: "destructive" })}>Confirm Block</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {ride.status === 'completed' && ride.driverId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleFavoriteDriver(ride)}
                    disabled={favoritingDriverId === ride.driverId}
                  >
                    {favoritingDriverId === ride.driverId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                    Favorite Driver
                  </Button>
                )}

                {ride.status === 'pending' && (
                   <Button variant="outline" size="sm" onClick={() => handleOpenEditDetailsDialog(ride)}><Edit className="mr-2 h-4 w-4"/> Edit Details</Button>
                )}

                {ride.status === 'pending' && (
                   <Button variant="destructive" size="sm" onClick={() => handleOpenCancelDialog(ride)}><XCircle className="mr-2 h-4 w-4" /> Cancel Booking</Button>
                )}
                 
                {ride.status === 'driver_assigned' && ride.notifiedPassengerArrivalTimestamp && !ride.passengerAcknowledgedArrivalTimestamp && (
                  <Button size="sm" onClick={() => handleAcknowledgeArrival(ride.id)} className="bg-green-600 hover:bg-green-700">
                    <CheckCheck className="mr-2 h-4 w-4" /> Acknowledge Driver Arrival
                  </Button>
                )}
              </CardFooter>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRideForRating && ( 
        <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRideForRating(null)} />
          <div className="relative bg-card rounded-lg p-6">
            <CardHeader>
              <CardTitle>Rate ride with {selectedRideForRating.driver || 'driver'}</CardTitle>
              <CardDescription>{formatDate(selectedRideForRating.bookingTimestamp)} - {selectedRideForRating.pickupLocation.address} to {selectedRideForRating.dropoffLocation.address} (ID: {selectedRideForRating.displayBookingId || selectedRideForRating.id})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center space-x-1 py-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-8 h-8 cursor-pointer ${i < currentRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} onClick={() => setCurrentRating(i + 1)}/>
                ))}
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Enjoyed your ride? Consider tipping your driver directly next time!
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedRideForRating(null)}>Cancel</Button>
              <Button onClick={submitRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit</Button>
            </CardFooter>
          </div>
        </Card> 
      )}
    </div>
  );
}

    



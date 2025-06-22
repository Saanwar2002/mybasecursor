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
import { Textarea } from "@/components/ui/textarea";


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
  reviewSubmitted?: boolean;
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
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRideForReview, setSelectedRideForReview] = useState<Ride | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComments, setReviewComments] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
          setRides(data);
        } catch (err) { const displayMessage = err instanceof Error ? err.message : "An unknown error occurred."; setError(displayMessage); toast({ title: "Error Fetching Rides History", description: displayMessage, variant: "destructive", duration: 7000 });
        } finally { setIsLoading(false); }
      };
      fetchRides();
    } else setIsLoading(false);
  }, [user, toast]);

  const displayedRides = rides.filter(ride => ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'cancelled_by_driver');

  const handleRateRide = (ride: Ride) => { 
    setSelectedRideForReview(ride);
    setReviewRating(ride.rating || 0);
    setReviewComments(""); // Reset comments
  };
  
  const submitReview = async () => {
    if (!selectedRideForReview || !user || reviewRating === 0) {
      toast({ title: "Incomplete Review", description: "Please provide a star rating.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingReview(true);

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterId: user.id,
          submitterName: user.name,
          submitterEmail: user.email,
          submitterRole: user.role,
          category: reviewRating >= 4 ? "driver_compliment" : "driver_complaint",
          details: reviewComments || (reviewRating >= 4 ? 'Great ride!' : 'Ride issue.'),
          rideId: selectedRideForReview.id,
          rating: reviewRating,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: "Submission failed."}));
        throw new Error(errorData.message);
      }
      
      setRides(prevRides => 
        prevRides.map(r => r.id === selectedRideForReview.id ? { ...r, rating: reviewRating, reviewSubmitted: true } : r)
      );

      toast({
        title: "Review Submitted",
        description: "Thank you for your feedback!",
      });
      setSelectedRideForReview(null);
      
    } catch (error) {
       const message = error instanceof Error ? error.message : "Could not submit review.";
       toast({ title: "Submission Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmittingReview(false);
    }
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
    setActionLoading(prev => ({ ...prev, [`fav-${rideToFavorite.driverId}`]: true }));
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
      setActionLoading(prev => ({ ...prev, [`fav-${rideToFavorite.driverId}`]: false }));
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs" 
                          disabled={ride.reviewSubmitted} 
                          onClick={() => handleRateRide(ride)}
                        >
                          {ride.reviewSubmitted ? 'Review Submitted' : 'Rate Ride'}
                        </Button>
                    </AlertDialogTrigger>
                    {selectedRideForReview && selectedRideForReview.id === ride.id && (
                       <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rate your ride with {ride.driver}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Your feedback helps us improve. Please leave a rating and optional comments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="flex items-center justify-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn("h-8 w-8 cursor-pointer transition-colors", reviewRating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")}
                                  onClick={() => setReviewRating(star)}
                                />
                              ))}
                            </div>
                            <Textarea 
                              placeholder="Add a comment... (optional)" 
                              value={reviewComments}
                              onChange={(e) => setReviewComments(e.target.value)}
                              className="min-h-[80px]"
                            />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setSelectedRideForReview(null)}>Cancel</AlertDialogCancel>
                          <Button onClick={submitReview} disabled={isSubmittingReview}>
                            {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Review
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    )}
                  </AlertDialog>
                )}
                {user?.role === 'passenger' && ride.status === 'completed' && ride.driverId && (
                  <Button onClick={() => handleBlockDriver(ride)} disabled={actionLoading[`block-${ride.driverId}`]} variant="destructive" size="sm" className="text-xs">
                    <UserX className="mr-1 h-3.5 w-3.5" /> Block Driver
                  </Button>
                )}
                 {user?.role === 'passenger' && ride.status === 'completed' && ride.driverId && (
                  <Button onClick={() => handleFavoriteDriver(ride)} disabled={actionLoading[`fav-${ride.driverId}`]} variant="outline" size="sm" className="text-xs">
                    <ThumbsUp className="mr-1 h-3.5 w-3.5" /> Favorite Driver
                  </Button>
                )}
              </CardFooter>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

    



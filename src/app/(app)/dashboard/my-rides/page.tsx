"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Star, Car, Calendar as CalendarIconLucide, MapPin, DollarSign, Loader2, AlertTriangle, Trash2, Edit, Clock, PlusCircle, XCircle, BellRing, CheckCheck, ShieldX, CreditCard, Coins, UserX, UserCircle, CalendarDays } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDescriptionForAlert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePassengerBookings } from '@/hooks/usePassengerBookings';
import { useFavoriteDrivers, addFavoriteDriver } from '@/hooks/useFavoriteDrivers';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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
  const { bookings, loading, error } = usePassengerBookings(user?.id);

  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);

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

  const [favoriteActionLoading, setFavoriteActionLoading] = useState<Record<string, boolean>>({});
  const [driverCustomIds, setDriverCustomIds] = useState<Record<string, string>>({});
  const { favoriteDrivers } = useFavoriteDrivers(user?.id);

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

  const displayedRides = bookings.filter(ride => ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'cancelled_by_driver')
    .map(ride => ({
      ...ride,
      driver: ride.driver || ride.driverName || ride.driver_name || '',
    }));

  const handleRateRide = (ride: Ride) => { setSelectedRideForRating(ride); setCurrentRating(ride.rating || 0); };
  
  const submitRating = async () => {
    if (!selectedRideForRating || !user || !db) return;
    try {
      await updateDoc(doc(db, 'bookings', selectedRideForRating.id), { rating: currentRating });
      toast({
        title: "Rating Submitted",
        description: `You rated your ride ${currentRating} stars. (Ride ID: ${selectedRideForRating.displayBookingId || selectedRideForRating.id})`,
      });
    } catch (err) {
      toast({
        title: "Error submitting rating",
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
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

  const handleAddFavoriteDriver = async (ride: Ride) => {
    if (!user || !ride.driverId || !ride.driver) {
      toast({ title: "Cannot Favorite", description: "Driver information is missing for this ride.", variant: "destructive" });
      return;
    }
    setFavoriteActionLoading(prev => ({ ...prev, [ride.driverId!]: true }));
    try {
      await addFavoriteDriver(user.id, ride.driverId!, ride.driver);
      toast({ title: "Driver Favorited", description: `${ride.driver} has been added to your favorite drivers.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while adding favorite driver.";
      toast({ title: "Favorite Failed", description: message, variant: "destructive" });
    } finally {
      setFavoriteActionLoading(prev => ({ ...prev, [ride.driverId!]: false }));
    }
  };

  useEffect(() => {
    // Fetch customId for each unique driverId in completed rides
    const uniqueDriverIds = Array.from(new Set(displayedRides.filter(r => r.driverId).map(r => r.driverId)));
    uniqueDriverIds.forEach(async (driverId) => {
      if (!driverId || driverCustomIds[driverId]) return;
      try {
        if (!db) {
          console.error('Firestore database not initialized');
          return;
        }
        const driverDoc = await getDoc(doc(db, 'users', driverId));
        if (driverDoc.exists()) {
          const data = driverDoc.data();
          const customId = data.customId || data.driverIdentifier || '';
          setDriverCustomIds(prev => ({ ...prev, [driverId]: customId }));
        }
      } catch {}
    });
  }, [displayedRides]);

  if (loading) return ( <div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Rides History</CardTitle><CardDescription>Loading your past rides...</CardDescription></CardHeader></Card><div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></div> );
  if (error && displayedRides.length === 0) return ( <div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Rides History</CardTitle><CardDescription>View past completed or cancelled rides.</CardDescription></CardHeader></Card><Card className="border-destructive bg-destructive/10"><CardContent className="pt-6 text-center text-destructive"><AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p className="font-semibold">Could not load rides history.</p><p className="text-sm">{error}</p><Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Try Again</Button></CardContent></Card></div> );

  return (
    <div className="space-y-6">
      <TooltipProvider>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Rides History</CardTitle>
            <CardDescription>View your past completed or cancelled rides. ({displayedRides.length} found)</CardDescription>
          </CardHeader>
          {displayedRides.length === 0 && !loading && !error && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                You have no completed or cancelled rides yet.
              </CardContent>
            </Card>
          )}
          {loading && (
            <Card>
              <CardContent className="pt-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="mt-2 text-muted-foreground">Loading your rides...</p>
              </CardContent>
            </Card>
          )}
          {error && (
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                <p className="mt-2 text-red-600">Error loading rides: {error}</p>
              </CardContent>
            </Card>
          )}
          {!loading && !error && displayedRides.length > 0 && (
            <div className="space-y-4 p-6">
              {displayedRides.map((ride) => (
                <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-primary" />
                        <span className="font-semibold">{String(ride.driver) || 'Driver'}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          <CalendarDays className="inline w-4 h-4 mr-1" />
                          {formatDate(ride.bookingTimestamp as JsonTimestamp, ride.scheduledPickupAt)}
                        </span>
                      </div>
                      <Badge variant={ride.status === 'completed' ? 'default' : 'destructive'}>
                        {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground pl-10 pb-2">
                      Booked: {formatDate(ride.bookingTimestamp as JsonTimestamp, ride.scheduledPickupAt) || 'N/A'} |
                      Picked up: {formatDate(ride.rideStartedAt as JsonTimestamp) || 'N/A'} |
                      Drop off: {formatDate(ride.completedAt as JsonTimestamp) || 'N/A'}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={ride.status === 'completed' ? 'default' : 'secondary'}>
                            {ride.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date((ride.bookingTimestamp as any)?._seconds * 1000 || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          Booking ID: {String(ride.displayBookingId || ride.id)}
                        </CardDescription>
                        {ride.driverId && driverCustomIds[ride.driverId] && (
                          <CardDescription className="text-xs">
                            Driver ID: {driverCustomIds[ride.driverId]}
                          </CardDescription>
                        )}
                        {ride.driver && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              {ride.driver.avatarUrl ? (
                                <Image
                                  src={ride.driver.avatarUrl}
                                  alt={ride.driver.name || 'Driver'}
                                  width={32}
                                  height={32}
                                  className="rounded-full"
                                />
                              ) : (
                                <UserX className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{ride.driver.name || 'Driver'}</p>
                              <p className="text-sm text-muted-foreground">
                                {ride.driver.vehicleMakeModel || 'Vehicle info not available'}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="mt-3 space-y-1">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Pickup</p>
                              <p className="text-xs text-muted-foreground">
                                {typeof ride.pickupLocation === 'string' ? ride.pickupLocation : ride.pickupLocation?.address || 'Location not available'}
                              </p>
                            </div>
                          </div>
                          {ride.stops && ride.stops.length > 0 && ride.stops.map((stop: any, index: number) => (
                            <div key={index} className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">Stop {index + 1}</p>
                                <p className="text-xs text-muted-foreground">
                                  {typeof stop === 'string' ? stop : stop?.address || 'Location not available'}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Dropoff</p>
                              <p className="text-xs text-muted-foreground">
                                {typeof ride.dropoffLocation === 'string' ? ride.dropoffLocation : ride.dropoffLocation?.address || 'Location not available'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <TooltipProvider>
                          <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                            {ride.status === 'completed' && (
                              ride.rating ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow flex items-center gap-2"
                                      onClick={() => handleRateRide(ride)}
                                    >
                                      <span>You rated this driver</span>
                                      <span className="flex items-center ml-1">
                                        {[...Array(5)].map((_, i) => (
                                          <Star key={i} className={`w-4 h-4 ${i < ride.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                        ))}
                                      </span>
                                      <Edit className="w-3 h-3 ml-1" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit your rating for this driver</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>Rate Ride</Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Rate your experience with this driver</TooltipContent>
                                </Tooltip>
                              )
                            )}
                            {ride.status === 'completed' && ride.driverId && ride.driver && (
                              <div className="flex gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shadow
                                        ${favoriteDrivers.some(fd => fd.driverId === ride.driverId)
                                          ? 'bg-green-500 text-white cursor-default'
                                          : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
                                      disabled={favoriteActionLoading[ride.driverId] || favoriteDrivers.some(fd => fd.driverId === ride.driverId)}
                                      onClick={() => handleAddFavoriteDriver(ride)}
                                    >
                                      {favoriteActionLoading[ride.driverId]
                                        ? 'Adding...'
                                        : favoriteDrivers.some(fd => fd.driverId === ride.driverId)
                                          ? 'Already in Favourites'
                                          : 'Add to Favourite Drivers'}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {favoriteDrivers.some(fd => fd.driverId === ride.driverId)
                                      ? 'You have already added this driver to your favourites.'
                                      : 'Add this driver to your favourites for future rides.'}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors shadow"
                                          disabled={actionLoading[`block-${ride.driverId}`]}
                                        >
                                          {actionLoading[`block-${ride.driverId}`] ? 'Blocking...' : 'Block Driver'}
                                        </button>
                                      </AlertDialogTrigger>
                                      <EnhancedBlockDriverDialog ride={ride} onBlock={handleBlockDriver} loading={actionLoading[`block-${ride.driverId}`]} />
                                    </AlertDialog>
                                  </TooltipTrigger>
                                  <TooltipContent>Block this driver to avoid being matched in the future</TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TooltipProvider>
      {selectedRideForRating && (
        <Dialog open={!!selectedRideForRating} onOpenChange={() => setSelectedRideForRating(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rate Your Ride</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 py-4">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCurrentRating(star)}
                  className={star <= currentRating ? "text-yellow-400" : "text-gray-300"}
                >
                  <Star className="w-8 h-8" fill={star <= currentRating ? "#facc15" : "none"} />
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button
                onClick={submitRating}
                disabled={currentRating === 0}
              >
                Submit Rating
              </Button>
              <Button variant="outline" onClick={() => setSelectedRideForRating(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EnhancedBlockDriverDialog({ ride, onBlock, loading }: { ride: any, onBlock: (ride: any, reason: string) => void, loading: boolean }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const reasons = [
    '',
    'Rude behavior',
    'Unsafe driving',
    'Vehicle issue',
    'Other',
  ];
  const isOther = reason === 'Other';
  const isValid = (reason && (reason !== 'Other' || customReason.trim().length > 2)) && confirmText === 'BLOCK';
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Block {ride.driver}?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to block this driver? You will not be matched with them for future rides. This action can be undone in your profile settings.<br /><br />
          <span className="font-semibold">Please select a reason for blocking:</span>
          <select
            className="block w-full mt-2 p-2 border rounded"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            {reasons.map(r => <option key={r} value={r}>{r || 'Select a reason...'}</option>)}
          </select>
          {isOther && (
            <input
              className="block w-full mt-2 p-2 border rounded"
              type="text"
              placeholder="Enter custom reason"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
            />
          )}
          <div className="mt-4">
            <span className="font-semibold">Type <span className="bg-gray-200 px-1 rounded">BLOCK</span> to confirm:</span>
            <input
              className="block w-full mt-2 p-2 border rounded"
              type="text"
              placeholder="Type BLOCK to confirm"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={!isValid || loading}
          className="bg-red-500 hover:bg-red-600 text-white"
          onClick={() => onBlock(ride, isOther ? customReason : reason)}
        >
          {loading ? 'Blocking...' : 'Block Driver'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

    



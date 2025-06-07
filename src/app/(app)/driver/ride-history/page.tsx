
"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, Calendar as CalendarIconLucide, MapPin, DollarSign, Loader2, AlertTriangle, UserX } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from "@/lib/utils";
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

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  driverRatingForPassenger?: number; // Driver's rating for the passenger
}

const formatDate = (timestamp?: SerializedTimestamp | null, isoString?: string | null): string => {
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

export default function DriverRideHistoryPage() {
  const { user: driverUser } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});


  const fetchRideHistory = useCallback(async () => {
    if (!driverUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/driver/ride-history?driverId=${driverUser.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to fetch ride history: ${response.status}` }));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }
      const data: Ride[] = await response.json();
      setRides(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Ride History", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [driverUser, toast]);

  useEffect(() => {
    fetchRideHistory();
  }, [fetchRideHistory]);

  const handleRatePassenger = (ride: Ride) => {
    setSelectedRideForRating(ride);
    setCurrentRating(ride.driverRatingForPassenger || 0);
  };

  const submitPassengerRating = async () => {
    if (!selectedRideForRating || !driverUser) return;
    // Mock: In a real app, POST this rating to the backend
    const updatedRides = rides.map(r =>
      r.id === selectedRideForRating.id ? { ...r, driverRatingForPassenger: currentRating } : r
    );
    setRides(updatedRides);
    toast({ title: "Passenger Rating Submitted (Mock)", description: `You rated ${selectedRideForRating.passengerName} ${currentRating} stars.` });
    setSelectedRideForRating(null);
    setCurrentRating(0);
  };

  const handleBlockPassenger = async (rideToBlock: Ride) => {
    if (!driverUser || !rideToBlock.passengerId || !rideToBlock.passengerName) {
      toast({ title: "Cannot Block", description: "Passenger information is missing for this ride.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [`block-${rideToBlock.passengerId}`]: true }));
    try {
      const response = await fetch('/api/users/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerId: driverUser.id,
          blockedId: rideToBlock.passengerId,
          blockerRole: 'driver',
          blockedRole: 'passenger',
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to block passenger. Status: ${response.status}`);
      }
      toast({ title: "Passenger Blocked", description: `${rideToBlock.passengerName} has been added to your block list.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while blocking passenger.";
      toast({ title: "Blocking Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`block-${rideToBlock.passengerId}`]: false }));
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">My Ride History</CardTitle>
            <CardDescription>Loading your past rides...</CardDescription>
          </CardHeader>
        </Card>
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">My Ride History</CardTitle>
            <CardDescription>View your completed or cancelled rides.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6 text-center text-destructive">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-semibold">Could not load ride history.</p>
            <p className="text-sm">{error}</p>
            <Button variant="outline" onClick={fetchRideHistory} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">My Ride History</CardTitle>
          <CardDescription>View your completed or cancelled rides. ({rides.length} found)</CardDescription>
        </CardHeader>
      </Card>

      {rides.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You have no past rides in your history.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {rides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" /> {ride.vehicleType?.charAt(0).toUpperCase() + ride.vehicleType?.slice(1).replace(/_/g, ' ') || 'Vehicle'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm">
                    <CalendarIconLucide className="w-4 h-4" /> Booked: {formatDate(ride.bookingTimestamp)}
                  </CardDescription>
                </div>
                <Badge
                  variant={ride.status === 'completed' ? 'default' : ride.status === 'cancelled' ? 'destructive' : 'secondary'}
                  className={cn(ride.status === 'completed' && 'bg-green-500/80 text-green-950', ride.status === 'cancelled' && 'bg-red-500/80 text-red-950')}
                >
                  {ride.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Image
                  src={ride.passengerAvatar || `https://placehold.co/40x40.png?text=${ride.passengerName.charAt(0)}`}
                  alt={ride.passengerName}
                  data-ai-hint="passenger avatar"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div>
                  <p className="font-medium">{ride.passengerName}</p>
                  <p className="text-xs text-muted-foreground">Passenger</p>
                </div>
              </div>
              {ride.scheduledPickupAt && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Originally Scheduled For:</p>
                  <div className="flex items-center gap-2 text-sm bg-muted/50 border border-muted px-3 py-1.5 rounded-lg shadow-sm">
                    <CalendarIconLucide className="w-5 h-5" /> <span className="font-semibold">{formatDate(null, ride.scheduledPickupAt)}</span>
                  </div>
                </div>
              )}
              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => (
                  <p key={index} className="flex items-start gap-1 pl-5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index + 1}:</strong> {stop.address}</p>
                ))}
                <p className="flex items-start gap-1"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}
                </div>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                {ride.status === 'completed' && (
                  ride.driverRatingForPassenger ? (
                    <div className="flex items-center">
                      <p className="text-sm mr-2">Your Rating for Passenger:</p>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < ride.driverRatingForPassenger! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleRatePassenger(ride)}>Rate Passenger</Button>
                  )
                )}
                 {ride.status === 'completed' && ride.passengerId && ride.passengerName && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="bg-destructive/80 hover:bg-destructive text-destructive-foreground" disabled={actionLoading[`block-${ride.passengerId}`]}>
                        {actionLoading[`block-${ride.passengerId}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                        Block Passenger
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Block {ride.passengerName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to block this passenger? You will not receive ride offers from them in the future. This action can be undone in your profile settings.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleBlockPassenger(ride)} className="bg-destructive hover:bg-destructive/90">Block Passenger</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRideForRating && (
        <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRideForRating(null)} />
          <div className="relative bg-card rounded-lg p-6">
            <CardHeader>
              <CardTitle>Rate {selectedRideForRating.passengerName}</CardTitle>
              <CardDescription>
                {formatDate(selectedRideForRating.bookingTimestamp)} - {selectedRideForRating.pickupLocation.address} to {selectedRideForRating.dropoffLocation.address}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center space-x-1 py-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-8 h-8 cursor-pointer ${i < currentRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                  onClick={() => setCurrentRating(i + 1)}
                />
              ))}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedRideForRating(null)}>Cancel</Button>
              <Button onClick={submitPassengerRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit Rating</Button>
            </CardFooter>
          </div>
        </Card>
      )}
    </div>
  );
}

    
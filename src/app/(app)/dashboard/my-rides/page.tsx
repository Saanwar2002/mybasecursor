"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, Calendar, MapPin, DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

// Interface for how Timestamp will look after JSON serialization from API
interface JsonTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: JsonTimestamp | null;
  pickupLocation: { address: string };
  dropoffLocation: { address: string };
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
}

// Helper function to format JSON serialized Firestore Timestamp
const formatDate = (timestamp?: JsonTimestamp | null): string => {
  console.log("formatDate: Received timestamp object:", timestamp ? JSON.stringify(timestamp) : String(timestamp));

  if (!timestamp) {
    console.warn("formatDate: Timestamp object is null or undefined.");
    return 'Date/Time N/A (Missing)';
  }
  if (typeof timestamp._seconds !== 'number') {
    console.warn(`formatDate: timestamp._seconds is not a number. Value: ${timestamp._seconds}, Type: ${typeof timestamp._seconds}`);
    return 'Date/Time N/A (Bad Seconds)';
  }
  if (typeof timestamp._nanoseconds !== 'number') {
    console.warn(`formatDate: timestamp._nanoseconds is not a number. Value: ${timestamp._nanoseconds}, Type: ${typeof timestamp._nanoseconds}`);
    return 'Date/Time N/A (Bad Nanos)';
  }

  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (isNaN(date.getTime())) {
      console.warn("formatDate: Created an invalid date (isNaN). Seconds:", timestamp._seconds, "Nanoseconds:", timestamp._nanoseconds);
      return 'Date/Time N/A (Invalid Date Obj)';
    }
    
    // Changed to toLocaleString and added time options
    const formattedDateTimeString = date.toLocaleString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Optional: use 12-hour format with AM/PM
    });
    console.log(`formatDate: Successfully formatted. Returning: "${formattedDateTimeString}" for input: ${JSON.stringify(timestamp)}`);
    return formattedDateTimeString;

  } catch (e) {
    console.error("formatDate: Error creating Date object:", e, "from timestamp:", JSON.stringify(timestamp));
    return 'Date/Time N/A (Conversion Error)';
  }
};


export default function MyRidesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);

  useEffect(() => {
    if (user?.id) {
      console.log("MyRidesPage: Attempting to fetch rides for passengerId:", user.id);
      const fetchRides = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/bookings/my-rides?passengerId=${user.id}`);
          if (!response.ok) {
            let errorData = { message: `Failed to fetch rides: ${response.status}`, details: '' };
            try {
              errorData = await response.json(); 
            } catch (e) {
              console.error("Response was not JSON:", response.statusText);
            }
            throw new Error(errorData.details || errorData.message || `Failed to fetch rides: ${response.status}`);
          }
          const data: Ride[] = await response.json();
          console.log("MyRidesPage: Rides data received from API:", JSON.stringify(data, null, 2));
          if (data.length > 0 && data[0].bookingTimestamp) {
            console.log("MyRidesPage: Inspecting bookingTimestamp of first ride:", JSON.stringify(data[0].bookingTimestamp));
          } else if (data.length > 0) {
            console.log("MyRidesPage: First ride has no bookingTimestamp or it's null.");
          }
          setRides(data);
        } catch (err) {
          console.error("Error fetching rides (Client):", err);
          const displayMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching rides.";
          setError(displayMessage);
          toast({
            title: "Error Fetching Rides",
            description: `${displayMessage} Check browser console or server logs for more details.`,
            variant: "destructive",
            duration: 10000,
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchRides();
    } else {
      console.log("MyRidesPage: No user ID found, skipping fetch.");
      setIsLoading(false);
    }
  }, [user, toast]);

  const handleRateRide = (ride: Ride) => {
    setSelectedRide(ride);
    setCurrentRating(ride.rating || 0);
  };

  const submitRating = async () => {
    if (selectedRide && user) {
      console.log(`Submitting rating ${currentRating} for ride ${selectedRide.id} by user ${user.id}`);
      // For demo purposes, update local state and show toast
      const updatedRides = rides.map(r =>
        r.id === selectedRide.id ? { ...r, rating: currentRating } : r
      );
      setRides(updatedRides);
      toast({ title: "Rating Submitted", description: `You rated your ride ${currentRating} stars.`});
      setSelectedRide(null);
      setCurrentRating(0);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">My Rides</CardTitle>
            <CardDescription>View your past rides and provide ratings.</CardDescription>
          </CardHeader>
        </Card>
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Loading your rides...</p>
        </div>
      </div>
    );
  }

  if (error && rides.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">My Rides</CardTitle>
            <CardDescription>View your past rides and provide ratings.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6 text-center text-destructive">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-semibold">Could not load your rides.</p>
            <p className="text-sm">{error}</p>
            <Button variant="outline" onClick={() => {
              if (user?.id) {
                 if (typeof window !== 'undefined') window.location.reload();
              } else {
                if (typeof window !== 'undefined') window.location.reload();
              }
            }} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">My Rides</CardTitle>
          <CardDescription>View your past rides and provide ratings. ({rides.length} rides found)</CardDescription>
        </CardHeader>
      </Card>

      {rides.length === 0 && !isLoading && !error && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You have no past rides yet. Why not book one?
          </CardContent>
        </Card>
      )}

      {error && rides.length > 0 && (
         <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg">
            <p><strong>Error:</strong> {error}</p>
            <p className="text-xs">Some data might be missing or outdated. Please try refreshing.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {rides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" /> {ride.vehicleType ? ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1).replace(/_/g, ' ') : 'Vehicle'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm">
                    <Calendar className="w-4 h-4" /> {formatDate(ride.bookingTimestamp)}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    ride.status === 'completed' ? 'default' :
                    ride.status === 'cancelled' ? 'destructive' :
                    ride.status === 'in_progress' ? 'outline' :
                    'secondary'
                  }
                  className={
                    ride.status === 'in_progress' ? 'border-blue-500 text-blue-500' :
                    ride.status === 'pending_assignment' ? 'bg-yellow-400/80 text-yellow-900' :
                    ride.status === 'driver_assigned' ? 'bg-sky-400/80 text-sky-900' :
                    ride.status === 'completed' ? 'bg-green-500/80 text-green-950': ''
                  }
                >
                  {ride.status ? ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ride.driver && (
                <div className="flex items-center gap-2">
                  <Image src={ride.driverAvatar || `https://placehold.co/40x40.png?text=${ride.driver.charAt(0)}`} alt={ride.driver} width={40} height={40} className="rounded-full" data-ai-hint="avatar driver" />
                  <div>
                    <p className="font-medium">{ride.driver}</p>
                    <p className="text-xs text-muted-foreground">Driver</p>
                  </div>
                </div>
              )}
              {!ride.driver && ride.status !== 'completed' && ride.status !== 'cancelled' && <p className="text-sm text-muted-foreground">Waiting for driver assignment...</p>}
              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" /> 
                  <strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}{' '}
                  {ride.isSurgeApplied && (
                    <Badge variant="outline" className="ml-1 border-orange-500 text-orange-500">
                      Surge
                    </Badge>
                  )}
                </div>
              </div>
              {ride.status === 'completed' && (
                <div className="pt-2">
                  {ride.rating ? (
                    <div className="flex items-center">
                      <p className="text-sm mr-2">Your Rating:</p>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < ride.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>
                      Rate Ride
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRide && (
        <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
           <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRide(null)} />
           <div className="relative bg-card rounded-lg p-6">
            <CardHeader>
              <CardTitle>Rate your ride with {selectedRide.driver || 'your driver'}</CardTitle>
              <CardDescription>{formatDate(selectedRide.bookingTimestamp)} - {selectedRide.pickupLocation.address} to {selectedRide.dropoffLocation.address}</CardDescription>
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
              <Button variant="ghost" onClick={() => setSelectedRide(null)}>Cancel</Button>
              <Button onClick={submitRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit Rating</Button>
            </CardFooter>
          </div>
        </Card>
      )}
    </div>
  );
}

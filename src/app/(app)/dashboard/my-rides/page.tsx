
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
  _seconds: number; // Firestore Timestamps are often serialized with _seconds
  _nanoseconds: number; // and _nanoseconds when passed through Next.js API routes
}

interface Ride {
  id: string;
  bookingTimestamp: JsonTimestamp;
  pickupLocation: { address: string };
  dropoffLocation: { address: string };
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string; // Added as it's part of the booking data
  isSurgeApplied?: boolean;
}

// Helper function to format JSON serialized Firestore Timestamp
const formatDate = (timestamp: JsonTimestamp | undefined | null): string => {
  if (!timestamp || typeof timestamp._seconds !== 'number' || typeof timestamp._nanoseconds !== 'number') {
    return 'N/A';
  }
  return new Date(timestamp._seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
      console.log("MyRidesPage: Attempting to fetch rides for passengerId:", user.id); // Log current user ID
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
              // If response is not JSON, use the status text or a generic message
              console.error("Response was not JSON:", response.statusText);
            }
            // Use details if available, otherwise the message from errorData, or fallback
            throw new Error(errorData.details || errorData.message || `Failed to fetch rides: ${response.status}`);
          }
          const data: Ride[] = await response.json();
          console.log("MyRidesPage: Rides data received from API:", data); // Log received data
          setRides(data);
        } catch (err) {
          console.error("Error fetching rides (Client):", err);
          const displayMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching rides.";
          setError(displayMessage);
          toast({
            title: "Error Fetching Rides",
            description: `${displayMessage} Check browser console or server logs for more details.`,
            variant: "destructive",
            duration: 10000, // Give more time to read potentially long messages
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
      // TODO: API call to update rating in Firestore for selectedRide.id
      // Example:
      // try {
      //   const response = await fetch('/api/bookings/rate-ride', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ rideId: selectedRide.id, rating: currentRating, passengerId: user.id }),
      //   });
      //   if (!response.ok) throw new Error('Failed to submit rating');
      //   const updatedRide = await response.json();
      //   setRides(prevRides => prevRides.map(r => r.id === updatedRide.id ? updatedRide : r));
      //   toast({ title: "Rating Submitted", description: `You rated your ride ${currentRating} stars.`});
      // } catch (e) {
      //   toast({ title: "Rating Error", description: e.message, variant: "destructive"});
      // }

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

  if (error && rides.length === 0) { // Only show full page error if no rides loaded at all
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
              if (user?.id) { // Trigger refetch logic
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

      {error && rides.length > 0 && ( // Show error as a dismissable toast if some rides are already loaded
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
                <p className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)} {ride.isSurgeApplied && <Badge variant="outline" className="ml-1 border-orange-500 text-orange-500">Surge</Badge>}</p>
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


"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Car, Loader2, AlertTriangle, RefreshCw, Edit, X } from "lucide-react";
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { doc as firestoreDoc, onSnapshot, query, where, collection, limit, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGoogleMaps } from '@/contexts/google-maps/google-maps-provider';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
import { Star, User, Clock, Phone, XCircle } from 'lucide-react';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-md" />,
});

const carIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#2563EB" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(carIconSvg)}` : '';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface ActiveRide {
  id: string;
  bookingTimestamp?: string;
  driverName: string;
  driverAvatar: string;
  driverPhone: string;
  vehicleMakeModel: string;
  vehicleRegistration: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  status: 'searching' | 'accepted' | 'en_route_to_pickup' | 'at_pickup' | 'in_progress' | 'completed' | 'cancelled';
  estimatedArrivalTime: string; // ISO string
  driverCurrentLocation: { lat: number; lng: number };
  driverRating: number;
  driverVehicleDetails?: string;
  displayBookingId?: string;
  fareEstimate?: number;
  vehicleType?: string;
  paymentMethod?: 'card' | 'cash' | 'account';
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

// A mapping from ride status to a user-friendly display name and description
const statusMeanings: { [key: string]: { name: string; description: string } } = {
  searching: { name: 'Searching', description: 'We are searching for a driver for your ride.' },
  pending: { name: 'Pending', description: 'Your ride is pending operator assignment.' },
  accepted: { name: 'Driver Assigned', description: 'Your driver is on their way to the pickup location.' },
  en_route_to_pickup: { name: 'En Route to Pickup', description: 'Your driver is getting close.' },
  at_pickup: { name: 'Driver Arrived', description: 'Your driver is waiting for you at the pickup location.' },
  in_progress: { name: 'Ride in Progress', description: 'You are on your way to your destination.' },
  completed: { name: 'Ride Completed', description: 'You have arrived at your destination.' },
  cancelled: { name: 'Ride Cancelled', description: 'This ride has been cancelled.' },
};

export default function TrackRidePage() {
  const { user, loading: authLoading, getAuthToken } = useAuth();
  const { isLoaded: isGoogleMapsLoaded, google } = useGoogleMaps();
  const { toast } = useToast();
  const router = useRouter();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<google.maps.LatLngLiteral[]>([]);
  const [isCanceling, setIsCanceling] = useState(false);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(huddersfieldCenterGoogle);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user || authLoading) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isComponentMounted = true;

    const runLongPoll = async () => {
      setIsLoading(true);
      while (isComponentMounted) {
        try {
          const token = await getAuthToken();
          if (!token) {
            toast({ title: 'Authentication Error', description: 'Could not get auth token. Retrying...', variant: 'destructive' });
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          const response = await fetch('/api/bookings/my-active-ride', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
          });

          if (!isComponentMounted) break;

          if (response.status === 404) {
            setActiveRide(null);
          } else if (response.ok) {
            const ride = await response.json();
            setActiveRide(ride);
          } else {
            // If there's a server error, wait a bit before retrying to avoid spamming.
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (err) {
          // This catches network errors or abort errors.
          // If the component is still mounted and it wasn't an abort, it's a network error.
          if (isComponentMounted && (err as Error).name !== 'AbortError') {
            // Wait longer on network errors before retrying.
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        } finally {
          // This ensures loading is only true for the very first fetch.
          if (isComponentMounted && isLoading) {
            setIsLoading(false);
          }
        }
      }
    };

    runLongPoll();

    return () => {
      isComponentMounted = false;
      controller.abort();
    };
  }, [user, authLoading, getAuthToken, toast]);

  const directionsCallback = useCallback((response: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
    if (status === 'OK' && response) {
      const route = response.routes[0];
      if (route?.overview_path) {
        const points = route.overview_path.map(p => p.toJSON());
        setRoutePolyline(points);
      }
    } else {
      console.error(`Directions request failed due to ${status}`);
    }
  }, []);

  useEffect(() => {
    if (activeRide && isGoogleMapsLoaded && google) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route({
        origin: new google.maps.LatLng(activeRide.pickupLocation.latitude, activeRide.pickupLocation.longitude),
        destination: new google.maps.LatLng(activeRide.dropoffLocation.latitude, activeRide.dropoffLocation.longitude),
        travelMode: google.maps.TravelMode.DRIVING,
      }, directionsCallback);
    }
  }, [activeRide, isGoogleMapsLoaded, google, directionsCallback]);

  const mapMarkers = useMemo(() => {
    if (!activeRide || !google) return [];
    
    const markers: Array<{
      id: string;
      position: google.maps.LatLngLiteral;
      label: string;
      iconUrl?: string;
      iconScaledSize?: { width: number, height: number };
    }> = [
      { id: 'pickup', position: { lat: activeRide.pickupLocation.latitude, lng: activeRide.pickupLocation.longitude }, label: 'Pickup' },
      { id: 'dropoff', position: { lat: activeRide.dropoffLocation.latitude, lng: activeRide.dropoffLocation.longitude }, label: 'Drop-off' }
    ];

    if (activeRide.driverCurrentLocation) {
      markers.push({
        id: 'driver',
        position: activeRide.driverCurrentLocation,
        label: 'Driver',
        iconUrl: driverCarIconDataUrl,
        iconScaledSize: { width: 32, height: 32 },
      });
    }
    return markers;
  }, [activeRide, google]);

  const bookingTime = useMemo(() => {
    if (!activeRide?.bookingTimestamp) return null;
    try {
      return format(parseISO(activeRide.bookingTimestamp), "eee, do MMM yyyy 'at' HH:mm");
    } catch (error) {
      console.error("Error parsing booking timestamp:", error);
      return "Invalid date";
    }
  }, [activeRide?.bookingTimestamp]);

  const handleCancelRide = async () => {
    if (!user || !activeRide) return;
    setIsCanceling(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication failed. Please log in again.");
      }

      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: activeRide.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel ride.');
      }

      toast({
        title: 'Ride Cancelled',
        description: 'Your ride has been successfully cancelled.',
      });
      setActiveRide(null);

    } catch (error) {
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 md:p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Card className="w-full max-w-md p-8">
          <CardHeader className="items-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <CardTitle>Oops! Something went wrong.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeRide) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Card className="w-full max-w-md p-8">
          <CardHeader>
            <CardTitle>No Active Rides</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">You have no active rides at the moment.</p>
            <Button asChild>
              <Link href="/dashboard/book-ride">Book a New Ride</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { name: statusName, description: statusDescription } = statusMeanings[activeRide.status] || { name: 'Unknown Status', description: 'The ride status is not recognized.'};
  
  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Tracking Your Ride</CardTitle>
              <p className="text-sm text-muted-foreground">Booking ID: {activeRide.id}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${activeRide.status === 'in_progress' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {statusName}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-center text-muted-foreground mb-4">{statusDescription}</p>
            <div className="h-[400px] w-full bg-muted rounded-md overflow-hidden">
              {isGoogleMapsLoaded && google ? (
                <GoogleMapDisplay markers={mapMarkers} />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>
          </div>
          
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Driver Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Driver Details</h3>
              {activeRide.driverName ? (
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={activeRide.driverAvatar || '/default-avatar.png'} alt={activeRide.driverName} />
                    <AvatarFallback>{activeRide.driverName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-xl">{activeRide.driverName}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Star className="w-4 h-4 mr-1 text-yellow-500" />
                      <span>{activeRide.driverRating || 'N/A'}</span>
                    </div>
                    <p>{activeRide.vehicleMakeModel} - {activeRide.vehicleRegistration}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <User className="h-5 w-5" />
                  <span>Searching for a driver...</span>
                </div>
              )}
            </div>

            {/* Ride Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Ride Details</h3>
              <div className="text-sm space-y-2">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Booked on: {bookingTime}</span>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 mt-1" />
                  <div>
                    <strong>From:</strong> {activeRide.pickupLocation.address}
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 mt-1 text-green-500" />
                  <div>
                    <strong>To:</strong> {activeRide.dropoffLocation.address}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={() => router.push('/dashboard/chat')}>
            <Phone className="w-4 h-4 mr-2" /> Contact Driver
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isCanceling}>
                {isCanceling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Cancel Ride
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. A cancellation fee may apply depending on the operator's policy and the ride status.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelRide} className="bg-destructive hover:bg-destructive/90">
                  Yes, Cancel Ride
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
    




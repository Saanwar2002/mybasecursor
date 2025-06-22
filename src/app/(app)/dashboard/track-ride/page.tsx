"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Car, Loader2, AlertTriangle, RefreshCw, Edit, X } from "lucide-react";
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { doc as firestoreDoc, onSnapshot, query, where, collection, limit, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGoogleMaps } from '@/contexts/google-maps/google-maps-provider';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const carIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#2563EB" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
const driverCarIconDataUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa(carIconSvg)}` : '';

interface LocationPoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ActiveRide {
  id: string;
  displayBookingId?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  driverCurrentLocation?: { lat: number; lng: number, heading?: number | null };
  driverName?: string;
  driverVehicleDetails?: string;
  status: string;
  fareEstimate?: number;
  vehicleType?: string;
  paymentMethod?: 'card' | 'cash' | 'account';
  bookingTimestamp?: { seconds: number; nanoseconds: number };
  scheduledPickupAt?: string | null;
  driverNotes?: string;
}

const huddersfieldCenterGoogle: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 };

export default function TrackRidePage() {
  const { user, loading: authLoading } = useAuth();
  const { isLoaded: isGoogleMapsLoaded, google } = useGoogleMaps();
  const { toast } = useToast();
  const router = useRouter();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<google.maps.LatLngLiteral[]>([]);
  const [isCanceling, setIsCanceling] = useState(false);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(huddersfieldCenterGoogle);

  const fetchActiveRide = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/bookings/my-active-ride');
      
      if (response.status === 404) {
          setActiveRide(null);
          return;
      }

      if (!response.ok) {
          throw new Error('Failed to fetch ride status');
      }

      const data = await response.json();

      if (data.ride) {
        if (data.ride.status === 'completed') {
          setActiveRide(null); 
          router.push(`/dashboard/ride-summary/${data.ride.id}`);
          return; 
        }
        setActiveRide(data.ride);
        if (data.ride.driverCurrentLocation) {
          setMapCenter(data.ride.driverCurrentLocation);
        }
      } else {
        setActiveRide(null);
      }
    } catch (error) {
      console.error("Failed to fetch active ride:", error);
      toast({ title: "Error", description: "Could not fetch ride status.", variant: "destructive" });
      setActiveRide(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, router, toast]);
  
  useEffect(() => {
      fetchActiveRide(); // Initial fetch
      const interval = setInterval(fetchActiveRide, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
  }, [fetchActiveRide]);

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
    const date = new Date(activeRide.bookingTimestamp.seconds * 1000);
    return date.toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [activeRide?.bookingTimestamp]);

  const handleCancelRide = async () => {
    if (!user || !activeRide) return;
    setIsCanceling(true);
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: activeRide.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to cancel ride");
      }

      toast({ title: "Ride Cancelled", description: "Your ride has been successfully cancelled." });
      setActiveRide(null); 
    } catch (error) {
      toast({ title: "Cancellation Error", description: (error as Error).message, variant: "destructive" });
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Track Your Ride</CardTitle>
              <CardDescription>Status: <span className="font-semibold capitalize">{activeRide.status.replace(/_/g, ' ')}</span></CardDescription>
            </div>
            <div className="flex gap-2">
              {activeRide.status === 'searching' && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link href={`/dashboard/ride/edit/${activeRide.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelRide}
                disabled={isCanceling || activeRide.status === 'cancelled'}
              >
                {isCanceling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              
              <div>
                <h3 className="font-semibold flex items-center mb-2 text-lg"><Car className="mr-2 h-5 w-5 text-primary" /> Driver Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-7">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{activeRide.driverName || 'Assigning...'}</span>
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span>{activeRide.driverVehicleDetails || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2">
                 <h3 className="font-semibold flex items-center mb-2 text-lg"><MapPin className="mr-2 h-5 w-5 text-primary" /> Trip Details</h3>
                 <div className="pl-7 space-y-2 text-sm">
                    <p><strong>From:</strong> {activeRide.pickupLocation.address || `${activeRide.pickupLocation.latitude.toFixed(4)}, ${activeRide.pickupLocation.longitude.toFixed(4)}`}</p>
                    <p><strong>To:</strong> {activeRide.dropoffLocation.address || `${activeRide.dropoffLocation.latitude.toFixed(4)}, ${activeRide.dropoffLocation.longitude.toFixed(4)}`}</p>
                 </div>
              </div>
              
               <div>
                <h3 className="font-semibold flex items-center mb-2 text-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5 text-primary"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l10-10a1 1 0 0 0 0-1.41L12 2z"></path><path d="M7 7h.01"></path></svg> Booking Details</h3>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-7">
                    <span className="text-muted-foreground">Booking ID:</span>
                    <span>{activeRide.displayBookingId || 'N/A'}</span>
                    <span className="text-muted-foreground">Fare:</span>
                    <span>{activeRide.fareEstimate ? `~£${activeRide.fareEstimate.toFixed(2)}` : 'N/A'}</span>
                     <span className="text-muted-foreground">Vehicle:</span>
                    <span className="capitalize">{activeRide.vehicleType || 'Any'}</span>
                    <span className="text-muted-foreground">Payment:</span>
                    <span className="capitalize">{activeRide.paymentMethod || 'N/A'}</span>
                    <span className="text-muted-foreground">Booked At:</span>
                    <span>{bookingTime || 'N/A'}</span>
                 </div>
              </div>

            </div>
            <div className="h-80 md:h-full w-full rounded-md overflow-hidden border">
              {isGoogleMapsLoaded ? (
                <GoogleMapDisplay
                  center={mapCenter}
                  zoom={14}
                  markers={mapMarkers}
                  polylines={[{ path: routePolyline, color: '#2563EB', weight: 5 }]}
                />
              ) : <Skeleton className="w-full h-full" />}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    




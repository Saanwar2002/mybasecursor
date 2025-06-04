
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Car, Clock } from "lucide-react";
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Use the new GoogleMapDisplay component
const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const huddersfieldCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 }; 
const initialTaxiLocationHuddersfield: google.maps.LatLngLiteral = { lat: 53.6500, lng: -1.7750 }; 

export default function TrackRidePage() {
  const [taxiLocation, setTaxiLocation] = useState<google.maps.LatLngLiteral>(initialTaxiLocationHuddersfield);
  const [estimatedArrival, setEstimatedArrival] = useState(5); 

  useEffect(() => {
    // Simulate taxi movement
    const interval = setInterval(() => {
      setTaxiLocation(prev => {
        const newLat = prev.lat - (prev.lat - huddersfieldCenter.lat) * 0.1;
        const newLng = prev.lng - (prev.lng - huddersfieldCenter.lng) * 0.1;
        return { lat: newLat, lng: newLng };
      });
      setEstimatedArrival(prev => Math.max(0, prev - 1));
    }, 5000); 

    return () => clearInterval(interval);
  }, []);

  const mapMarkers = [
    { 
      position: taxiLocation, 
      title: "Your Taxi",
      // Example custom icon (optional, ensure the URL is valid or remove for default Google marker)
      // iconUrl: "/icons/taxi-marker.png", // Replace with your actual icon path
      // iconScaledSize: { width: 32, height: 32 }
    },
    { 
      position: huddersfieldCenter, 
      title: "Your Location (Huddersfield)" 
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <MapPin className="w-8 h-8 text-primary" /> Real-Time Ride Tracking
          </CardTitle>
          <CardDescription>
            Monitor your taxi's location live on the map. (Now using Google Maps)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative w-full h-96 md:h-[500px] rounded-lg overflow-hidden shadow-md border">
            <GoogleMapDisplay 
              center={huddersfieldCenter} 
              zoom={14} 
              markers={mapMarkers} 
              className="h-full w-full"
              disableDefaultUI={true}
            />
          </div>

          <Card className="bg-primary/10 border-primary/30">
            <CardHeader>
              <CardTitle className="text-xl">Ride Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> <strong>Vehicle:</strong> Toyota Camry (ABC 123)</p>
              <p className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> <strong>Driver:</strong> John B.</p>
              <p className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> <strong>Estimated Arrival:</strong> {estimatedArrival} minutes</p>
              <p className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> <strong>Current Location:</strong> Approaching Town Centre (Mock)</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}



"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Car, Clock } from "lucide-react";
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const defaultPassengerLocation: [number, number] = [51.5074, -0.1278]; 
const initialTaxiLocation: [number, number] = [51.515, -0.10]; 

export default function TrackRidePage() {
  const [taxiLocation, setTaxiLocation] = useState<[number, number]>(initialTaxiLocation);
  const [estimatedArrival, setEstimatedArrival] = useState(5); 

  useEffect(() => {
    const interval = setInterval(() => {
      setTaxiLocation(prev => {
        const newLat = prev[0] - (prev[0] - defaultPassengerLocation[0]) * 0.1;
        const newLng = prev[1] - (prev[1] - defaultPassengerLocation[1]) * 0.1;
        return [newLat, newLng];
      });
      setEstimatedArrival(prev => Math.max(0, prev - 1));
    }, 5000); 

    return () => clearInterval(interval);
  }, []);

  const mapMarkers = [
    { position: taxiLocation, popupText: "Your Taxi", iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png" },
    { position: defaultPassengerLocation, popupText: "Your Location" }
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <MapPin className="w-8 h-8 text-primary" /> Real-Time Ride Tracking
          </CardTitle>
          <CardDescription>
            Monitor your taxi's location live on the map.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative w-full h-96 md:h-[500px] rounded-lg overflow-hidden shadow-md border">
            <MapDisplay 
              center={defaultPassengerLocation} 
              zoom={14} 
              markers={mapMarkers} 
              className="h-full w-full"
              scrollWheelZoom={true}
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
              <p className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> <strong>Current Location:</strong> Approaching Oak Street (Mock)</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

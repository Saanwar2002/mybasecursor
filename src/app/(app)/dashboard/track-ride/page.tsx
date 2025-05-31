"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Car, Clock } from "lucide-react";
import Image from "next/image";

export default function TrackRidePage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <MapPin className="w-8 h-8 text-primary" /> Real-Time Ride Tracking
          </CardTitle>
          <CardDescription>
            Monitor your taxi's location live on the map. (This is a placeholder UI)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-md border">
            <Image 
              src="https://placehold.co/800x600.png?text=Live+Map+View" 
              alt="Live Map Placeholder" 
              layout="fill" 
              objectFit="cover"
              data-ai-hint="map navigation"
            />
            {/* You could overlay mock taxi icons here */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Car className="w-10 h-10 text-red-500 animate-pulse" />
            </div>
          </div>

          <Card className="bg-primary/10 border-primary/30">
            <CardHeader>
              <CardTitle className="text-xl">Ride Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> <strong>Vehicle:</strong> Toyota Camry (ABC 123)</p>
              <p className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> <strong>Driver:</strong> John B.</p>
              <p className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> <strong>Estimated Arrival:</strong> 5 minutes</p>
              <p className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> <strong>Current Location:</strong> Approaching Oak Street</p>
            </CardContent>
          </Card>
          <p className="text-center text-muted-foreground">
            Real-time updates will appear here. This feature is currently under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

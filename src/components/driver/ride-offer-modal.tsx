
"use client";

import * as React from "react"; // Added this line
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Clock } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress as ShadCNProgress } from "@/components/ui/progress"; // Renamed to avoid conflict
import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "@radix-ui/react-progress";


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

export interface RideOffer {
  id: string;
  pickupLocation: string;
  pickupCoords: { lat: number; lng: number };
  dropoffLocation: string;
  dropoffCoords: { lat: number; lng: number };
  fareEstimate: number;
  passengerCount: number;
  passengerName?: string;
  notes?: string;
}

interface RideOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (rideId: string) => void;
  onDecline: (rideId: string) => void;
  rideDetails: RideOffer | null;
}

const COUNTDOWN_SECONDS = 20;

// Custom Progress component to allow dynamic indicator color
interface CustomProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const ProgressIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: number | null; className?: string }
>(({ value, className, ...props }, ref) => (
  <div
    ref={ref}
    style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    className={cn("h-full w-full flex-1 bg-primary transition-all", className)} // Default to bg-primary
    {...props}
  />
));
ProgressIndicator.displayName = "ProgressIndicator";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  CustomProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2.5 w-full overflow-hidden rounded-full bg-secondary", // Adjusted height to h-2.5 for a bit more visibility
      className
    )}
    {...props}
  >
    <ProgressIndicator value={value ?? 0} className={indicatorClassName} />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;


export function RideOfferModal({ isOpen, onClose, onAccept, onDecline, rideDetails }: RideOfferModalProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(COUNTDOWN_SECONDS); // Reset countdown when modal is closed or re-opened
      return;
    }

    if (countdown === 0) {
      if (rideDetails) {
        onDecline(rideDetails.id); // Automatically decline if timer runs out
      }
      onClose();
      return;
    }

    const timerId = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId); // Cleanup timer on unmount or before next effect run
  }, [isOpen, countdown, onClose, rideDetails, onDecline]);

  const mapMarkers = useMemo(() => {
    if (!rideDetails) return [];
    const markers = [];
    if (rideDetails.pickupCoords) {
      markers.push({
        position: rideDetails.pickupCoords,
        title: `Pickup: ${rideDetails.pickupLocation}`,
        label: { text: "P", color: "white", fontWeight: "bold", fontSize: "14px" },
        // iconUrl: 'YOUR_GREEN_MARKER_ICON_URL' // Optional: for custom green marker
      });
    }
    if (rideDetails.dropoffCoords) {
      markers.push({
        position: rideDetails.dropoffCoords,
        title: `Dropoff: ${rideDetails.dropoffLocation}`,
        label: { text: "D", color: "white", fontWeight: "bold", fontSize: "14px" },
        // iconUrl: 'YOUR_RED_MARKER_ICON_URL' // Optional: for custom red marker
      });
    }
    return markers;
  }, [rideDetails]);

  const mapCenter = useMemo(() => {
    if (rideDetails?.pickupCoords) return rideDetails.pickupCoords;
    return { lat: 53.6450, lng: -1.7830 }; // Default center (Huddersfield)
  }, [rideDetails]);

  if (!rideDetails) {
    return null;
  }

  const handleAccept = () => {
    onAccept(rideDetails.id);
    onClose(); // Close modal after action
  };

  const handleDecline = () => {
    onDecline(rideDetails.id);
    onClose(); // Close modal after action
  };

  const getTimerColor = () => {
    if (countdown <= 5) return "text-red-500";
    if (countdown <= 10) return "text-orange-500";
    return "text-green-600";
  };

  const getProgressColorClass = () => {
    if (countdown <= 5) return "bg-red-500"; // For custom progress indicator
    if (countdown <= 10) return "bg-orange-500";
    return "bg-green-600";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card shadow-2xl border-primary/50">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-headline text-primary flex items-center gap-2">
            <Car className="w-7 h-7" /> New Ride Offer!
          </DialogTitle>
          <DialogDescription className="text-base">
            Review details and respond within the time limit.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-center my-2">
            <div className={`text-4xl font-bold ${getTimerColor()}`}>
                <Clock className="inline-block w-8 h-8 mr-2 align-middle" />{countdown}s
            </div>
          </div>
          <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={getProgressColorClass()} />


          <div className="h-48 w-full rounded-md overflow-hidden border my-3">
            {rideDetails.pickupCoords && rideDetails.dropoffCoords ? (
              <GoogleMapDisplay
                center={mapCenter}
                zoom={12}
                markers={mapMarkers}
                className="w-full h-full"
              />
            ) : (
              <Skeleton className="w-full h-full" />
            )}
          </div>

          <div className="p-3 bg-muted/50 rounded-lg border border-muted">
            <p className="flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-primary" /> 
              <strong>Pickup:</strong> {rideDetails.pickupLocation}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" /> 
              <strong>Dropoff:</strong> {rideDetails.dropoffLocation}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <p className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> ~£{rideDetails.fareEstimate.toFixed(2)}</p>
            <p className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /> <strong>Passengers:</strong> {rideDetails.passengerCount}</p>
          </div>

          {rideDetails.passengerName && (
            <p className="text-sm"><Info className="inline w-4 h-4 mr-1 text-muted-foreground" /><strong>Passenger:</strong> {rideDetails.passengerName}</p>
          )}
          {rideDetails.notes && (
             <div className="border-l-4 border-accent pl-3 py-1 bg-accent/10">
                <p className="text-sm font-semibold">Note:</p>
                <p className="text-sm text-muted-foreground">{rideDetails.notes}</p>
             </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:gap-4 pt-4">
          <Button variant="destructive" onClick={handleDecline} className="text-lg py-3">
            Decline
          </Button>
          <Button variant="default" onClick={handleAccept} className="bg-green-600 hover:bg-green-700 text-white text-lg py-3">
            Accept Ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

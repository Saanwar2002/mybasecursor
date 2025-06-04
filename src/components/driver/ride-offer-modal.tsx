
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    className={cn("h-full w-full flex-1 bg-primary transition-all", className)}
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
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
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
      setCountdown(COUNTDOWN_SECONDS); 
      return;
    }

    if (countdown === 0) {
      if (rideDetails) {
        onDecline(rideDetails.id); 
      }
      onClose(); 
      return;
    }

    const timerId = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [isOpen, countdown, onClose, rideDetails, onDecline]);

  const mapMarkers = useMemo(() => {
    if (!rideDetails) return [];
    const markers = [];
    if (rideDetails.pickupCoords) {
      markers.push({
        position: rideDetails.pickupCoords,
        title: `Pickup: ${rideDetails.pickupLocation}`,
        label: { text: "P", color: "white", fontWeight: "bold", fontSize: "14px" },
      });
    }
    if (rideDetails.dropoffCoords) {
      markers.push({
        position: rideDetails.dropoffCoords,
        title: `Dropoff: ${rideDetails.dropoffLocation}`,
        label: { text: "D", color: "white", fontWeight: "bold", fontSize: "14px" },
      });
    }
    return markers;
  }, [rideDetails]);

  const mapCenter = useMemo(() => {
    if (rideDetails?.pickupCoords) return rideDetails.pickupCoords;
    return { lat: 53.6450, lng: -1.7830 }; 
  }, [rideDetails]);

  if (!rideDetails) {
    return null;
  }

  const handleAccept = () => {
    onAccept(rideDetails.id);
    onClose();
  };

  const handleDecline = () => {
    onDecline(rideDetails.id);
    onClose();
  };

  const getProgressColorClass = () => {
    if (countdown <= 5) return "bg-red-500";
    if (countdown <= 10) return "bg-orange-500";
    return "bg-green-600";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent 
        className={cn(
          "sm:max-w-md bg-card shadow-2xl border-primary/50 p-0 flex flex-col",
          "h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)]" 
        )}
      >
        <DialogHeader className="p-4 pb-2 space-y-1 shrink-0 border-b">
          <DialogTitle className="text-xl md:text-xl font-headline text-primary flex items-center gap-2">
            <Car className="w-6 h-6" /> New Ride Offer!
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1"> 
          <div className="px-4 pt-2 pb-4 flex flex-col h-full">
            <div className="h-44 sm:h-52 w-full mb-3 rounded-md overflow-hidden border shrink-0">
                {(rideDetails.pickupCoords && rideDetails.dropoffCoords) ? (
                  <GoogleMapDisplay
                    center={mapCenter}
                    zoom={10} 
                    markers={mapMarkers}
                    className="w-full h-full"
                    disableDefaultUI={true}
                    fitBoundsToMarkers={true}
                  />
                ) : (
                  <Skeleton className="w-full h-full rounded-md" />
                )}
            </div>
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                <p className="flex items-start gap-2 mb-1 text-lg md:text-xl font-semibold">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-1" /> 
                  <span><strong>Pickup:</strong> {rideDetails.pickupLocation}</span>
                </p>
                <p className="flex items-start gap-2 text-lg md:text-xl font-semibold">
                  <MapPin className="w-5 h-5 text-accent shrink-0 mt-1" /> 
                  <span><strong>Dropoff:</strong> {rideDetails.dropoffLocation}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-lg md:text-xl font-semibold">
                <p className="flex items-center gap-1.5"><DollarSign className="w-5 h-5 text-muted-foreground shrink-0" /> <strong>Fare:</strong> ~£{rideDetails.fareEstimate.toFixed(2)}</p>
                <p className="flex items-center gap-1.5"><Users className="w-5 h-5 text-muted-foreground shrink-0" /> <strong>Passengers:</strong> {rideDetails.passengerCount}</p>
              </div>

              {rideDetails.passengerName && (
                <p className="text-lg md:text-xl font-semibold flex items-center gap-1.5"><Info className="inline w-5 h-5 mr-0.5 text-muted-foreground shrink-0" /><strong>Passenger:</strong> {rideDetails.passengerName}</p>
              )}
              {rideDetails.notes && (
                 <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md">
                    <p className="text-lg md:text-xl font-semibold text-accent-foreground/90">Note:</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{rideDetails.notes}</p>
                 </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-4 py-1.5 space-y-1 border-t border-border shrink-0"> {/* Reduced py-2.5 to py-1.5 and space-y-2 to space-y-1 */}
            <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={getProgressColorClass()} className="h-2" />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:gap-3 px-3 pt-2 pb-3 border-t border-border shrink-0"> {/* Changed p-3 to px-3 pt-2 pb-3 */}
          <Button variant="destructive" onClick={handleDecline} size="default" className="py-2 h-auto">
            Decline
          </Button>
          <Button variant="default" onClick={handleAccept} size="default" className="bg-green-600 hover:bg-green-700 text-white py-2 h-auto">
            Accept Ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

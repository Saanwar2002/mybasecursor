
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Briefcase, Route, CreditCard, Coins, Crown, AlertOctagon, CheckCircle } from "lucide-react"; // Added Crown, AlertOctagon, CheckCircle
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
  passengerId: string; // Added passengerId
  passengerName?: string;
  notes?: string;
  requiredOperatorId?: string;
  distanceMiles?: number;
  paymentMethod?: 'card' | 'cash';
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  dispatchMethod?: 'auto_system' | 'manual_operator' | 'priority_override';
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

  const totalFareForDriver = rideDetails.fareEstimate + (rideDetails.priorityFeeAmount || 0);

  const getDispatchMethodText = () => {
    if (!rideDetails.dispatchMethod) return null;
    switch (rideDetails.dispatchMethod) {
      case 'auto_system':
        return { text: "Dispatched: System (Auto)", icon: CheckCircle, color: "text-green-600" };
      case 'manual_operator':
        return { text: "Dispatched by: Your Operator", icon: Briefcase, color: "text-blue-600" };
      case 'priority_override':
        return { text: "Dispatched: Priority Override", icon: AlertOctagon, color: "text-purple-600" };
      default:
        return null;
    }
  };
  const dispatchInfo = getDispatchMethodText();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "sm:max-w-md bg-card shadow-2xl border-primary/50 p-0 flex flex-col",
           "h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] md:h-[calc(100vh-4rem)]"
        )}
      >
        <DialogHeader className="p-4 pb-2 space-y-1 shrink-0 border-b">
          <DialogTitle className="text-xl md:text-xl font-headline text-primary flex items-center gap-2">
            <Car className="w-6 h-6" /> New Ride Offer!
            {rideDetails.isPriorityPickup && (
                <Badge variant="outline" className="ml-auto text-xs border-orange-500 text-orange-600 bg-orange-500/10 py-0.5 px-1.5 flex items-center gap-1">
                    <Crown className="w-3 h-3"/> Priority
                </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Review the details below and respond quickly before the timer runs out.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 pt-2 pb-4">
            <div className="h-36 sm:h-48 w-full mb-3 rounded-md overflow-hidden border shrink-0">
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
            <div className="space-y-2.5">
              {rideDetails.requiredOperatorId && (
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-600 rounded-lg text-center">
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-200 flex items-center justify-center gap-1">
                    <Briefcase className="w-4 h-4"/> This ride is restricted to Operator: {rideDetails.requiredOperatorId}
                  </p>
                </div>
              )}
               {dispatchInfo && (
                <div className={`p-2 bg-muted/70 border border-border rounded-lg text-center`}>
                  <p className={`text-sm font-medium ${dispatchInfo.color} flex items-center justify-center gap-1`}>
                    <dispatchInfo.icon className="w-4 h-4"/> {dispatchInfo.text}
                  </p>
                </div>
              )}
              <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                <p className="flex items-start gap-2 mb-1 text-base md:text-lg font-semibold">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
                  <span><strong>Pickup:</strong> {rideDetails.pickupLocation}</span>
                </p>
                <p className="flex items-start gap-2 text-base md:text-lg font-semibold">
                  <MapPin className="w-4 h-4 text-accent shrink-0 mt-1" />
                  <span><strong>Dropoff:</strong> {rideDetails.dropoffLocation}</span>
                </p>
              </div>

              <div className="space-y-1 text-base md:text-lg font-semibold">
                <div className="flex justify-between items-center">
                  <p className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                    <strong>Total Est. Fare:</strong> ~£{totalFareForDriver.toFixed(2)}
                  </p>
                  <p className="flex items-center gap-1.5"><Users className="w-4 h-4 text-muted-foreground shrink-0" /> <strong>Passengers:</strong> {rideDetails.passengerCount}</p>
                </div>
                {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5"/> Includes +£{rideDetails.priorityFeeAmount.toFixed(2)} priority fee
                    </p>
                )}
                 {rideDetails.paymentMethod && (
                    <div className="flex items-center gap-1.5">
                      {rideDetails.paymentMethod === 'card' ?
                        <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" /> :
                        <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      <strong>Payment:</strong> {rideDetails.paymentMethod === 'card' ? 'Card' : 'Cash'}
                    </div>
                  )}
                {rideDetails.distanceMiles && (
                  <p className="flex items-center gap-1.5"><Route className="w-4 h-4 text-muted-foreground shrink-0" /> <strong>Distance:</strong> ~{rideDetails.distanceMiles.toFixed(1)} mi</p>
                )}
              </div>

              {rideDetails.passengerName && (
                <p className="text-base md:text-lg font-semibold flex items-center gap-1.5"><Info className="inline w-4 h-4 mr-0.5 text-muted-foreground shrink-0" /><strong>Passenger:</strong> {rideDetails.passengerName}</p>
              )}
              {rideDetails.notes && (
                 <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md">
                    <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap">{rideDetails.notes}</p>
                 </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-4 py-0.5 border-t border-border shrink-0">
            <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={getProgressColorClass()} className="h-2" />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:gap-3 px-3 pt-2 pb-3 border-t border-border shrink-0">
          <Button variant="destructive" onClick={handleDecline} size="sm" className="py-1 h-8">
            Decline ({countdown}s)
          </Button>
          <Button variant="default" onClick={handleAccept} size="sm" className="bg-green-600 hover:bg-green-700 text-white py-1 h-8">
            Accept Ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

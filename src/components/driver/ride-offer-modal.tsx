
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Briefcase, Route, CreditCard, Coins, Crown, AlertOctagon, CheckCircle, LockKeyhole } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_OPERATOR_CODE, useAuth } from '@/contexts/auth-context';
import type { LabelType, ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor } from '@/components/ui/custom-map-label-overlay';
import { getCustomMapLabelOverlayClass } from '@/components/ui/custom-map-label-overlay';


const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

export interface RideOffer {
  id: string; 
  displayBookingId?: string; 
  originatingOperatorId?: string; 
  pickupLocation: string;
  pickupCoords: { lat: number; lng: number };
  dropoffLocation: string;
  dropoffCoords: { lat: number; lng: number };
  stops?: Array<{ address: string; coords: { lat: number; lng: number } }>;
  fareEstimate: number;
  passengerCount: number;
  passengerId: string;
  passengerName?: string;
  passengerPhone?: string;
  notes?: string;
  requiredOperatorId?: string;
  distanceMiles?: number;
  paymentMethod?: 'card' | 'cash' | 'account';
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  dispatchMethod?: 'auto_system' | 'manual_operator' | 'priority_override';
  accountJobPin?: string;
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
Progress.displayName = ProgressPrimitive.Root.displayName


function formatAddressForMapLabel(fullAddress: string, type: string): string {
  if (!fullAddress) return `${type}:\nN/A`;

  let addressRemainder = fullAddress;
  let outwardPostcode = "";

  const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s*(?:[0-9][A-Z]{2})?\b/i;
  const postcodeMatch = fullAddress.match(postcodeRegex);

  if (postcodeMatch) {
    outwardPostcode = postcodeMatch[1].toUpperCase();
    addressRemainder = fullAddress.replace(postcodeMatch[0], '').replace(/,\s*$/, '').trim();
  }

  const parts = addressRemainder.split(',').map(p => p.trim()).filter(Boolean);

  let street = parts[0] || "Location";
  let area = "";

  if (parts.length > 1) {
    area = parts[1];
    if (street.toLowerCase().includes(area.toLowerCase()) && street.length > area.length + 2) {
        street = street.substring(0, street.toLowerCase().indexOf(area.toLowerCase())).replace(/,\s*$/,'').trim();
    }
  } else if (parts.length === 0 && outwardPostcode) {
    street = "Area";
  }

  if (!area && parts.length > 2) {
      area = parts.slice(1).join(', ');
  }

  let locationLine = area;
  if (outwardPostcode) {
    locationLine = (locationLine ? locationLine + " " : "") + outwardPostcode;
  }

  if (locationLine.trim() === outwardPostcode && (street === "Location" || street === "Area" || street === "Unknown Street")) {
      street = "";
  }
  if (street && !locationLine) {
     return `${type}:\n${street}`;
  }
  if (!street && locationLine) {
     return `${type}:\n${locationLine}`;
  }
  if (!street && !locationLine) {
      return `${type}:\nDetails N/A`;
  }

  return `${type}:\n${street}\n${locationLine}`;
}


export function RideOfferModal({ isOpen, onClose, onAccept, onDecline, rideDetails }: RideOfferModalProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const { user: driverUser } = useAuth();
  const [isMapSdkLoadedForModal, setIsMapSdkLoadedForModal] = useState(false);


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

  const mapDisplayElements = useMemo(() => {
    if (!rideDetails) return { markers: [], labels: [] };
    const markers: Array<{ position: google.maps.LatLngLiteral; title?: string; label?: string | google.maps.MarkerLabel; iconUrl?: string; iconScaledSize?: {width: number, height: number} }> = [];
    const labels: Array<{ position: google.maps.LatLngLiteral; content: string; type: LabelType, variant?: 'default' | 'compact' }> = [];

    if (rideDetails.pickupCoords) {
        markers.push({
            position: rideDetails.pickupCoords,
            title: `Pickup: ${rideDetails.pickupLocation}`,
            label: { text: "P", color: "white", fontWeight: "bold"}
        });
        labels.push({
            position: rideDetails.pickupCoords,
            content: formatAddressForMapLabel(rideDetails.pickupLocation, 'Pickup'),
            type: 'pickup',
            variant: 'default' 
        });
    }
    rideDetails.stops?.forEach((stop, index) => {
        if (stop.coords) {
            markers.push({
                position: stop.coords,
                title: `Stop ${index + 1}: ${stop.address}`,
                label: { text: `S${index + 1}`, color: "white", fontWeight: "bold"}
            });
            labels.push({
                position: stop.coords,
                content: formatAddressForMapLabel(stop.address, `Stop ${index + 1}`),
                type: 'stop',
                variant: 'default'
            });
        }
    });
    if (rideDetails.dropoffCoords) {
        markers.push({
            position: rideDetails.dropoffCoords,
            title: `Dropoff: ${rideDetails.dropoffLocation}`,
            label: { text: "D", color: "white", fontWeight: "bold"}
        });
        labels.push({
            position: rideDetails.dropoffCoords,
            content: formatAddressForMapLabel(rideDetails.dropoffLocation, 'Dropoff'),
            type: 'dropoff',
            variant: 'default'
        });
    }
    return { markers, labels };
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
  
  const progressColorClass = "bg-green-500";


  const totalFareForDriver = (rideDetails.fareEstimate || 0) + (rideDetails.priorityFeeAmount || 0);

  const getDispatchMethodText = () => {
    if (!rideDetails) return null;

    const isManual = rideDetails.dispatchMethod === 'manual_operator';
    const isPriority = rideDetails.dispatchMethod === 'priority_override';

    let text = "";
    let icon = CheckCircle;
    let bgColorClassName = "bg-green-600";

    if (rideDetails.requiredOperatorId === PLATFORM_OPERATOR_CODE) {
      if (isManual) {
        text = "Dispatched By App: MANUAL MODE";
        icon = Briefcase;
        bgColorClassName = "bg-blue-600";
      } else {
        text = "Dispatched By App: AUTO MODE";
        icon = CheckCircle;
      }
    } else if (driverUser && rideDetails.requiredOperatorId === driverUser.operatorCode) {
      if (isManual) {
        text = "Dispatched By YOUR BASE: MANUAL MODE";
        icon = Briefcase;
        bgColorClassName = "bg-blue-600";
      } else {
        text = "Dispatched By YOUR BASE: AUTO MODE";
        icon = CheckCircle;
        bgColorClassName = "bg-green-600";
      }
    } else {
      if (isManual) {
        text = rideDetails.requiredOperatorId
          ? `Manual Dispatch from ${rideDetails.requiredOperatorId}`
          : "Manually Dispatched by Platform Admin";
        icon = Briefcase;
        bgColorClassName = "bg-blue-600";
      } else if (isPriority) {
        text = "Dispatched by Operator (Priority)";
        icon = AlertOctagon;
        bgColorClassName = "bg-purple-600";
      } else {
        text = "Dispatched By App (Auto)";
        icon = CheckCircle;
      }
    }
    return { text, icon, bgColorClassName };
  };
  const dispatchInfo = getDispatchMethodText();

  const getPaymentMethodDisplay = () => {
    if (!rideDetails.paymentMethod) return "N/A";
    switch (rideDetails.paymentMethod) {
      case "card": return "Card";
      case "cash": return "Cash";
      case "account": return "Account Job";
      default: return "N/A";
    }
  };

  const getPaymentMethodIcon = () => {
    if (!rideDetails.paymentMethod) return Info;
    switch (rideDetails.paymentMethod) {
      case "card": return CreditCard;
      case "cash": return Coins;
      case "account": return LockKeyhole;
      default: return Info;
    }
  };
  const PaymentIcon = getPaymentMethodIcon();


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "sm:max-w-md bg-card shadow-2xl p-0 flex flex-col",
           "h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] md:h-[calc(100vh-4rem)] overflow-hidden"
        )}
      >
        <DialogHeader className="p-3 pb-2 space-y-1 shrink-0 border-b bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Car className="w-5 h-5 text-primary" />
              New Ride Offer!
            </DialogTitle>
            {rideDetails.displayBookingId && <Badge variant="outline" className="text-xs">{rideDetails.displayBookingId}</Badge>}
          </div>
        </DialogHeader>

        {/* Main content area with scroll */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col"> {/* Content wrapper inside ScrollArea */}
            <div className="h-48 sm:h-56 w-full bg-muted shrink-0"> {/* Map Area */}
                {(rideDetails.pickupCoords && rideDetails.dropoffCoords) ? (
                  <GoogleMapDisplay
                    center={mapCenter}
                    zoom={13}
                    markers={mapDisplayElements.markers}
                    customMapLabels={mapDisplayElements.labels}
                    className="w-full h-full"
                    disableDefaultUI={true}
                    fitBoundsToMarkers={true}
                    onSdkLoaded={setIsMapSdkLoadedForModal}
                  />
                ) : (
                  <Skeleton className="w-full h-full" />
                )}
            </div>

            {/* Dispatch Info Bar */}
            {dispatchInfo && (
              <div className={cn(
                "p-2 mx-2 mt-2 rounded-md text-center text-white font-semibold shadow", 
                dispatchInfo.bgColorClassName, 
                "border border-black/20" // Added slight border for definition
              )}>
                <p className="text-sm flex items-center justify-center gap-1.5">
                  <dispatchInfo.icon className="w-4 h-4 text-white"/> {dispatchInfo.text}
                </p>
              </div>
            )}

            {/* Fare & Distance Bar */}
            <div className="py-2 px-3 mx-2 mt-2 rounded-md bg-amber-500 text-white shadow border border-black/20 flex flex-col justify-center items-center">
                <span className="text-xl font-bold">
                    £{totalFareForDriver.toFixed(2)}
                </span>
                {rideDetails.distanceMiles && (
                    <span className="text-xs font-medium">({rideDetails.distanceMiles.toFixed(1)} Miles)</span>
                )}
            </div>
            
            {/* Pickup/Dropoff Details Area */}
            <div className="p-3 mx-2 mt-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 space-y-1.5">
              <p className="flex items-start gap-2 text-sm md:text-base font-medium text-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="font-semibold mr-1">Pickup:</span>{rideDetails.pickupLocation}
              </p>
              {rideDetails.stops && rideDetails.stops.length > 0 && (
                <div className="mt-1.5 pl-2">
                  {rideDetails.stops.map((stop, index) => (
                    <p key={`stop-display-${index}`} className="flex items-start gap-2 mb-1 text-sm md:text-base font-medium text-foreground">
                       <MapPin className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                       <span className="font-semibold mr-1">Stop {index + 1}:</span>{stop.address}
                    </p>
                  ))}
                </div>
              )}
              <p className="flex items-start gap-2 text-sm md:text-base font-medium text-foreground">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="font-semibold mr-1">Dropoff:</span>{rideDetails.dropoffLocation}
              </p>
            </div>

            {/* Other Info - Placed below address block */}
            <div className="px-3 pt-2 pb-1 space-y-1 text-sm">
              {rideDetails.passengerName && (
                <p className="flex items-center gap-1.5 font-medium"><Info className="inline w-4 h-4 mr-0.5 text-muted-foreground shrink-0" />Passenger: {rideDetails.passengerName}</p>
              )}
              {rideDetails.notes && (
                 <div className="rounded-md p-1.5 my-1 bg-yellow-100 dark:bg-yellow-700/30 border-l-2 border-yellow-500 dark:border-yellow-400">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium whitespace-pre-wrap">
                      Notes: {rideDetails.notes}
                    </p>
                 </div>
              )}
              <p className="flex items-center gap-1.5 font-medium"><Users className="w-4 h-4 text-muted-foreground shrink-0" /> Passengers: {rideDetails.passengerCount}</p>
              {rideDetails.paymentMethod && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <PaymentIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    Payment: {getPaymentMethodDisplay()}
                  </div>
                )}
               {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 && (
                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-500/10 mt-1">
                    <Crown className="h-3 w-3 mr-1"/>Priority +£{rideDetails.priorityFeeAmount.toFixed(2)}
                  </Badge>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Progress bar always at the bottom of the scrollable content, before footer */}
        <div className="px-3 py-2 border-t border-border shrink-0">
            <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={progressColorClass} className="h-2.5 rounded-full" />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:gap-3 px-3 pt-2 pb-3 border-t border-border shrink-0">
          <Button variant="destructive" onClick={handleDecline} size="lg" className="font-bold text-base py-2.5 h-auto bg-red-600 hover:bg-red-700 text-white">
            Decline ({countdown}s)
          </Button>
          <Button variant="default" onClick={handleAccept} size="lg" className="font-bold text-base py-2.5 h-auto bg-green-600 hover:bg-green-700 text-white">
            Accept Ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

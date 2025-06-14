
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Removed DialogDescription
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
Progress.displayName = ProgressPrimitive.Root.displayName;


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
            variant: 'compact'
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
                variant: 'compact'
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
            variant: 'compact'
        });
    }
    return { markers, labels };
  }, [rideDetails]);


  const mapCenter = useMemo(() => {
    if (rideDetails?.pickupCoords) return rideDetails.pickupCoords;
    return { lat: 53.6450, lng: -1.7830 }; // Huddersfield center
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
        bgColorClassName = "bg-green-600";
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
        bgColorClassName = "bg-green-600";
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
          "sm:max-w-md bg-card shadow-2xl border-primary/50 p-0 flex flex-col",
           "h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] md:h-[calc(100vh-4rem)]"
        )}
      >
        <DialogHeader className="p-4 pb-2 space-y-1 shrink-0 border-b">
          <DialogTitle className={cn(
            "text-xl md:text-xl font-headline flex items-center gap-2",
            )}>
            <span className="flex items-center gap-2">
              <Car className={cn(
                "w-6 h-6",
                dispatchInfo?.bgColorClassName === "bg-green-600" && "text-green-600 dark:text-green-500",
                dispatchInfo?.bgColorClassName === "bg-blue-600" && "text-blue-600 dark:text-blue-500",
                dispatchInfo?.bgColorClassName === "bg-purple-600" && "text-purple-600 dark:text-purple-500",
                !dispatchInfo?.bgColorClassName && "text-primary"
              )} />
              New Ride Offer!
            </span>
          </DialogTitle>
          {/* DialogDescription removed as per user request */}
          {rideDetails.paymentMethod === 'account' && (
            <Badge variant="default" className="mt-2 text-sm py-1 px-3 w-fit self-center bg-purple-600 hover:bg-purple-700 text-white shadow-md">
              <LockKeyhole className="w-4 h-4 mr-1.5" />
              ACCOUNT JOB
            </Badge>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-4 pt-2 pb-4">
            <div className="h-36 sm:h-48 w-full mb-3 rounded-md overflow-hidden border shrink-0">
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
                  <Skeleton className="w-full h-full rounded-md" />
                )}
            </div>
            
            {dispatchInfo && (
              <div className={cn("p-2 my-1.5 rounded-lg text-center text-white", dispatchInfo.bgColorClassName)}>
                <p className="text-sm font-medium flex items-center justify-center gap-1">
                  <dispatchInfo.icon className="w-4 h-4 text-white"/> {dispatchInfo.text}
                </p>
              </div>
            )}
             
            <div className="flex items-center justify-between gap-2 my-1.5">
              <div className="flex-grow px-3 py-1.5 bg-yellow-600 text-white font-bold rounded-md text-center shadow-sm">
                {(rideDetails.distanceMiles !== undefined && totalFareForDriver > 0) ? (
                  <>
                    <span className="text-lg">
                      £{totalFareForDriver.toFixed(2)}
                    </span>
                    <span className="text-sm ml-2">
                      ({rideDetails.distanceMiles.toFixed(1)} Miles)
                    </span>
                  </>
                ) : (
                  <span className="text-sm">Calculating...</span>
                )}
              </div>

              {rideDetails.isPriorityPickup && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs border-2 dark:border-red-500 text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-800/30 py-1 px-2 flex items-center gap-1 h-full"
                  >
                      <Crown className="w-3.5 h-3.5"/> Priority
                  </Badge>
              )}
            </div>
              
            <div className="p-3 bg-muted/50 rounded-lg border border-muted mt-2">
              <p className="flex items-start gap-2 mb-1 text-base md:text-lg font-semibold">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
                <span>Pickup: {rideDetails.pickupLocation}</span>
              </p>
              {rideDetails.stops && rideDetails.stops.length > 0 && (
                <div className="mt-1.5 pl-2">
                  {rideDetails.stops.map((stop, index) => (
                    <p key={`stop-display-${index}`} className="flex items-start gap-2 mb-1 text-base md:text-lg font-semibold">
                       <MapPin className="w-4 h-4 text-yellow-500 shrink-0 mt-1" />
                       <span>Stop {index + 1}: {stop.address}</span>
                    </p>
                  ))}
                </div>
              )}
              <p className="flex items-start gap-2 text-base md:text-lg font-semibold">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-1" />
                <span>Dropoff: {rideDetails.dropoffLocation}</span>
              </p>
            </div>

            {/* Summary Box - New Styling */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-black/70 dark:border-green-700 text-green-900 dark:text-green-100 text-base font-bold">
              <div className="col-span-1 border-2 border-black dark:border-gray-700 rounded-md px-2 py-1 mb-1">
                <p className="flex items-center gap-1.5 font-bold">
                  <DollarSign className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                  Total Est. Fare: £{totalFareForDriver.toFixed(2)}
                </p>
              </div>
              <p className="flex items-center gap-1.5 font-bold"><Users className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Passengers: {rideDetails.passengerCount}</p>
              {rideDetails.distanceMiles && (
                <p className="flex items-center gap-1.5 font-bold"><Route className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" /> Distance: ~{rideDetails.distanceMiles.toFixed(1)} mi</p>
              )}
              {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5 font-bold col-span-2">
                      <Crown className="w-3.5 h-3.5"/> Includes +£{rideDetails.priorityFeeAmount.toFixed(2)} priority fee
                  </p>
              )}
               {rideDetails.paymentMethod && (
                  <div className="col-span-2 flex items-center gap-1.5 font-bold">
                    <PaymentIcon className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                    Payment: {getPaymentMethodDisplay()}
                  </div>
                )}
            </div>
            {/* End Summary Box */}


            {rideDetails.passengerName && (
              <p className="text-sm flex items-center gap-1.5 mt-1.5"><Info className="inline w-4 h-4 mr-0.5 text-muted-foreground shrink-0" /><strong>Passenger:</strong> {rideDetails.passengerName}</p>
            )}
            {rideDetails.notes && (
               <div className="border-l-4 border-accent pl-3 py-1.5 bg-accent/10 rounded-r-md mt-1.5">
                  <p className="text-xs md:text-sm text-foreground font-semibold whitespace-pre-wrap">{rideDetails.notes}</p>
               </div>
            )}
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


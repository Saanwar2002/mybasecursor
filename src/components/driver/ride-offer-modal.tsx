
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Briefcase, Route, CreditCard, Coins, Crown, AlertOctagon, CheckCircle, LockKeyhole, X } from "lucide-react"; // Added X
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from "@/components/ui/badge";
import { PLATFORM_OPERATOR_CODE, useAuth } from '@/contexts/auth-context';
import type { LabelType, ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor } from '@/components/ui/custom-map-label-overlay';
import { getCustomMapLabelOverlayClass } from '@/components/ui/custom-map-label-overlay';
import { Separator } from "@/components/ui/separator";
import { formatAddressForMapLabel } from '@/lib/utils';


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
      "relative h-3 w-full overflow-hidden rounded-full bg-secondary", // Increased height
      className
    )}
    {...props}
  >
    <ProgressIndicator value={value ?? 0} className={indicatorClassName} />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName


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


  const baseFare = rideDetails.fareEstimate || 0;
  const priorityFee = rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount ? rideDetails.priorityFeeAmount : 0;
  const totalFareForDriver = baseFare + priorityFee;


  const getDispatchMethodText = () => {
    if (!rideDetails) return null;

    const isManual = rideDetails.dispatchMethod === 'manual_operator';
    const isPriorityOverride = rideDetails.dispatchMethod === 'priority_override';

    let text = "";
    let icon = CheckCircle;

    if (rideDetails.requiredOperatorId === PLATFORM_OPERATOR_CODE) {
      text = isManual ? "Dispatched By App (MANUAL MODE)" : "Dispatched By App (AUTO MODE)";
      icon = isManual ? Briefcase : CheckCircle;
    } else if (driverUser && rideDetails.requiredOperatorId === driverUser.operatorCode) {
      text = isManual ? "Dispatched By YOUR BASE (MANUAL MODE)" : "Dispatched By YOUR BASE (AUTO MODE)";
      icon = isManual ? Briefcase : CheckCircle;
    } else {
      if (isManual) {
        text = rideDetails.requiredOperatorId
          ? `Manual Dispatch from ${rideDetails.requiredOperatorId}`
          : "Manually Dispatched by Platform Admin";
        icon = Briefcase;
      } else if (isPriorityOverride) {
        text = "Dispatched by Operator (Priority)";
        icon = AlertOctagon;
      }
       else {
        text = "Dispatched By App (Auto)";
        icon = CheckCircle;
      }
    }
    return { text, icon };
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
      <DialogContent className="sm:max-w-md bg-card shadow-2xl p-0 flex flex-col">
        <DialogHeader className="p-3 pb-2 space-y-1 border-b bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
              <Car className="w-5 h-5 text-primary" />
              New Ride Offer!
            </DialogTitle>
            {rideDetails.displayBookingId && <Badge variant="outline" className="text-xs border-primary/50 text-primary/90">{rideDetails.displayBookingId}</Badge>}
          </div>
        </DialogHeader>

        <div className="h-48 sm:h-56 w-full bg-muted flex-shrink-0">
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
        
        {dispatchInfo && (
            <div className="py-1.5 px-3 bg-green-500 text-white text-center">
                <p className="text-xs font-semibold flex items-center justify-center gap-1">
                    <dispatchInfo.icon className="w-3.5 h-3.5"/> {dispatchInfo.text}
                </p>
            </div>
        )}

        <div className="py-1.5 px-3 bg-amber-500 text-black text-center flex justify-between items-center">
            <p className="text-sm font-bold flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                <span>
                {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 ? (
                    <>
                    Est. Fare: <span className="font-bold">£{(rideDetails.fareEstimate || 0).toFixed(2)}</span>
                    {' + '}
                    <span className="font-bold text-red-700">
                        £{(rideDetails.priorityFeeAmount || 0).toFixed(2)} (Priority)
                    </span>
                    {' = '}
                    <span className="font-extrabold">
                        £{totalFareForDriver.toFixed(2)}
                    </span>
                    </>
                ) : (
                   <>Est. Fare: <span className="font-bold">£{(rideDetails.fareEstimate || 0).toFixed(2)}</span></>
                )}
                </span>
            </p>
            {rideDetails.distanceMiles && (
                <p className="text-sm font-bold flex items-center gap-1">
                    <Route className="w-4 h-4" /> ~{rideDetails.distanceMiles.toFixed(1)} miles
                </p>
            )}
        </div>

        <ScrollArea className="flex-1">
            <div className="px-3 pt-2 pb-1 space-y-1.5">
                <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                    <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="font-bold">{rideDetails.pickupLocation}</span>
                    </p>
                    {rideDetails.stops && rideDetails.stops.length > 0 && (
                        <div className="ml-2 my-0.5 border-l-2 border-dashed border-slate-400 dark:border-slate-600 pl-2.5">
                            {rideDetails.stops.map((stop, index) => (
                                <p key={`stop-offer-${index}`} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 py-0.5">
                                <MapPin className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                                <span className="font-bold">{stop.address}</span>
                                </p>
                            ))}
                        </div>
                    )}
                    <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                        <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span className="font-bold">{rideDetails.dropoffLocation}</span>
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs pt-1">
                    {rideDetails.passengerName && (
                        <p className="flex items-center gap-1 font-medium"><Info className="inline w-3.5 h-3.5 text-muted-foreground shrink-0" />Pass: <span className="font-bold">{rideDetails.passengerName}</span></p>
                    )}
                    <p className="flex items-center gap-1 font-medium"><Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Pax: <span className="font-bold">{rideDetails.passengerCount}</span></p>
                    {rideDetails.paymentMethod && (
                        <p className="col-span-2 flex items-center gap-1 font-medium">
                            <PaymentIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            Payment: {rideDetails.paymentMethod === 'account' ? 
                                <Badge variant="default" className="ml-1 text-xs px-2 py-0.5 bg-purple-600 dark:bg-purple-500 text-white dark:text-purple-foreground">ACCOUNT JOB</Badge>
                                : <span className="font-bold">{getPaymentMethodDisplay()}</span>
                            }
                        </p>
                    )}
                </div>

                {rideDetails.notes && (
                    <div className="rounded-md p-1.5 my-1 bg-yellow-100 dark:bg-yellow-700/30 border-l-2 border-yellow-500 dark:border-yellow-400">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200 whitespace-pre-wrap">
                        <span className="font-bold">Notes:</span> <span className="font-bold">{rideDetails.notes}</span>
                        </p>
                    </div>
                )}
            </div>
        </ScrollArea>

        <div className="px-3 py-2 border-t bg-card">
            <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={progressColorClass} className="h-2.5 rounded-full" />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:gap-3 p-3 border-t bg-muted/30">
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


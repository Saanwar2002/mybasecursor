"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Briefcase, Route, CreditCard, Coins, Crown, AlertOctagon, CheckCircle, LockKeyhole, X, Eye } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/contexts/auth-context';
import type { LabelType, ICustomMapLabelOverlay, CustomMapLabelOverlayConstructor } from '@/components/ui/custom-map-label-overlay';
import { getCustomMapLabelOverlayClass } from '@/components/ui/custom-map-label-overlay';
import { Separator } from "@/components/ui/separator";
import { formatAddressForMapLabel } from '@/lib/utils';
import type { LucideIcon } from "lucide-react";


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
      "relative h-2.5 w-full overflow-hidden rounded-full bg-secondary", // h-2.5 for slightly taller progress bar
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
    return { lat: 53.6450, lng: -1.7830 }; // Default to Huddersfield
  }, [rideDetails]);

  if (!rideDetails) {
    return null;
  }

  const handleAccept = () => {
    onAccept(rideDetails.id);
    onClose();
  };

  // Decline button is removed, so this function might not be directly called from UI
  // but kept for logic (e.g. timeout auto-decline)
  const handleDecline = () => { 
    onDecline(rideDetails.id);
    onClose();
  };

  const progressColorClass = 
    countdown <= 5 ? "bg-red-500" : 
    countdown <= 10 ? "bg-yellow-500" : 
    "bg-green-500";


  const baseFare = rideDetails.fareEstimate || 0;
  const priorityFeeAmount = rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount ? rideDetails.priorityFeeAmount : 0;
  const totalFareForDriver = baseFare + priorityFeeAmount;


 const getDispatchMethodInfo = (): { text: string; icon: LucideIcon; iconColorClass: string; textColorClass: string } => {
    if (!rideDetails) return { text: "Dispatch Info N/A", icon: Info, iconColorClass: "text-slate-400", textColorClass: "text-slate-300" };

    const isManual = rideDetails.dispatchMethod === 'manual_operator';
    const isPriorityOverride = rideDetails.dispatchMethod === 'priority_override';

    let text = "";
    let icon: LucideIcon = CheckCircle;
    let iconColorClass = "text-green-400";
    let textColorClass = "text-green-300"; 

    if (rideDetails.requiredOperatorId === PLATFORM_OPERATOR_CODE) {
      text = isManual ? "Dispatched By App (MANUAL MODE)" : "Dispatched By App (AUTO MODE)";
      icon = isManual ? Briefcase : CheckCircle;
      iconColorClass = isManual ? "text-blue-400" : "text-green-400";
      textColorClass = isManual ? "text-blue-300" : "text-green-300";
    } else if (driverUser && rideDetails.requiredOperatorId === driverUser.operatorCode) {
      text = isManual ? "Dispatched By YOUR BASE (MANUAL)" : "Dispatched By YOUR BASE (AUTO)";
      icon = isManual ? Briefcase : CheckCircle;
      iconColorClass = isManual ? "text-sky-400" : "text-emerald-400";
      textColorClass = isManual ? "text-sky-300" : "text-emerald-300";
    } else { 
      if (isManual) {
        text = rideDetails.requiredOperatorId
          ? `Manual Dispatch: ${rideDetails.requiredOperatorId}`
          : "Manually Dispatched by Platform Admin";
        icon = Briefcase;
        iconColorClass = "text-slate-400"; 
        textColorClass = "text-slate-300";
      } else if (isPriorityOverride) {
        text = "Dispatched by Operator (PRIORITY)";
        icon = AlertOctagon;
        iconColorClass = "text-purple-400";
        textColorClass = "text-purple-300";
      } else { 
        text = "Dispatched By App (Automatic)";
        icon = CheckCircle;
        iconColorClass = "text-green-400";
        textColorClass = "text-green-300";
      }
    }
    return { text, icon, iconColorClass, textColorClass };
  };
  const dispatchInfo = getDispatchMethodInfo();

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
      <DialogContent className="w-full sm:max-w-md bg-card shadow-2xl p-0 flex flex-col h-[88vh] max-h-[88vh]">
        <DialogHeader className="p-3 pb-2 space-y-1 border-b bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
              <Car className="w-5 h-5 text-primary" />
              New Ride Offer!
            </DialogTitle>
            <div className="flex items-center gap-2">
              {rideDetails.displayBookingId && (
                <Badge variant="outline" className="text-xs border-primary/50 text-primary/90">
                  {rideDetails.displayBookingId}
                </Badge>
              )}
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7 p-0 rounded-md"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="h-24 sm:h-28 w-full bg-muted flex-shrink-0">
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
            <div className="py-1.5 px-3 text-center bg-slate-700 dark:bg-slate-800">
                <p className="text-xs font-semibold flex items-center justify-center gap-1">
                    <dispatchInfo.icon className={cn("w-3.5 h-3.5", dispatchInfo.iconColorClass)}/> 
                    <span className={dispatchInfo.textColorClass}>{dispatchInfo.text}</span>
                </p>
            </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 pt-2 pb-1 space-y-1.5">
            
            <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
              <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="font-bold">{rideDetails.pickupLocation || "Pickup N/A"}</span>
              </p>
              {rideDetails.stops && rideDetails.stops.length > 0 && (
                <div className="ml-2 my-0.5 border-l-2 border-dashed border-slate-400 dark:border-slate-600 pl-2.5">
                  {rideDetails.stops.map((stop, index) => (
                    <p key={`stop-offer-${index}`} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 py-0.5">
                      <MapPin className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                      <span className="font-bold">{stop.address || `Stop ${index + 1} N/A`}</span>
                    </p>
                  ))}
                </div>
              )}
              <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="font-bold">{rideDetails.dropoffLocation || "Dropoff N/A"}</span>
              </p>
            </div>

             <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border mt-2">
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                {rideDetails.passengerName && (
                  <p className="flex items-center gap-1 font-medium">
                    <Info className="inline w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    Pass: <span className="font-bold">{rideDetails.passengerName || "Passenger N/A"}</span>
                  </p>
                )}
                <p className="flex items-center gap-1 font-medium justify-end">
                  <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Pax: <span className="font-bold">{rideDetails.passengerCount}</span>
                </p>
                {rideDetails.paymentMethod && (
                  <p className="col-span-2 flex items-center gap-1 font-medium pt-0.5">
                    <PaymentIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    Payment: <span className="font-bold">{getPaymentMethodDisplay()}</span>
                    {rideDetails.paymentMethod === 'account' && (
                        <Badge variant="secondary" className="ml-1 text-[10px] px-2 py-0.5 bg-purple-600 dark:bg-purple-500 text-white dark:text-purple-foreground">
                           <span className="font-bold">ACCOUNT JOB</span>
                        </Badge>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t bg-muted/30 space-y-2 mt-auto">
            <div className={cn(
              "py-1 px-2 text-base text-center text-white border rounded-md shadow font-bold flex items-center justify-between w-full",
              "bg-orange-600 border-orange-700" 
            )}>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 shrink-0 text-white" />
                {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 ? (
                  <>
                    <span>(£{baseFare.toFixed(2)}</span>
                    <span className="text-white"> + </span>
                    <span className="bg-yellow-400 text-black px-1 py-0.5 rounded-sm inline-flex items-center gap-0.5 leading-none">
                      <Crown className="w-3.5 h-3.5 text-black" /> Prio £{(rideDetails.priorityFeeAmount || 0).toFixed(2)}
                    </span>
                    <span>) = £{totalFareForDriver.toFixed(2)}</span>
                  </>
                ) : (
                  <span>£{baseFare.toFixed(2)}</span>
                )}
              </span>

              {rideDetails.distanceMiles !== undefined && (
                <span className="font-bold text-white text-base">
                  (~{rideDetails.distanceMiles.toFixed(1)} mi)
                </span>
              )}
            </div>
          <Progress value={(countdown / COUNTDOWN_SECONDS) * 100} indicatorClassName={progressColorClass} className="h-2.5 rounded-full" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            <Button variant="default" onClick={handleAccept} size="sm" className="font-bold text-sm bg-green-600 hover:bg-green-700 text-white h-10 w-full">
              Accept Ride ({countdown}s)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


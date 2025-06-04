
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Users, DollarSign, MapPin, Info, Clock } from "lucide-react";
import { useEffect, useState } from "react";

// Define and export the RideOffer type
export interface RideOffer {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  fareEstimate: number;
  passengerCount: number;
  passengerName?: string; // Optional
  notes?: string; // Optional
}

interface RideOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (rideId: string) => void;
  onDecline: (rideId: string) => void;
  rideDetails: RideOffer | null; // Use the defined type
}

const COUNTDOWN_SECONDS = 20;

export function RideOfferModal({ isOpen, onClose, onAccept, onDecline, rideDetails }: RideOfferModalProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(COUNTDOWN_SECONDS); // Reset countdown when modal closes
      return;
    }

    if (countdown === 0) {
      if (rideDetails) {
        onDecline(rideDetails.id); // Auto-decline if timer runs out
      }
      onClose();
      return;
    }

    const timerId = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [isOpen, countdown, onClose, rideDetails, onDecline]);

  if (!rideDetails) {
    return null; // Or some loading/error state if isOpen is true but no details
  }

  const handleAccept = () => {
    onAccept(rideDetails.id);
    onClose();
  };

  const handleDecline = () => {
    onDecline(rideDetails.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card shadow-2xl border-primary/50">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-headline text-primary flex items-center gap-2">
            <Car className="w-7 h-7" /> New Ride Offer!
          </DialogTitle>
          <DialogDescription className="text-base">
            You have a new ride offer. Please review the details and respond within the time limit.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-center my-2">
            <div className="text-4xl font-bold text-accent animate-pulse">
                <Clock className="inline-block w-8 h-8 mr-2 align-middle" />{countdown}s
            </div>
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

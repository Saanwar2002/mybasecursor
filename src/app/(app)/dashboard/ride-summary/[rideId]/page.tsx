"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Loader2, AlertTriangle, MapPin, Coins, CreditCard, UserCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface LocationPointSummary {
  address: string;
  doorOrFlat?: string;
}

interface CompletedRideDetails {
  id: string;
  displayBookingId?: string;
  driverName: string;
  driverAvatar?: string;
  driverId?: string;
  driverCustomId?: string;
  pickupLocation: LocationPointSummary;
  dropoffLocation: LocationPointSummary;
  stops?: Array<LocationPointSummary>;
  fareEstimate: number;
  paymentMethod?: string;
  status?: string;
  vehicleType?: string;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  accumulatedStopWaitingCharges?: number;
  pickupWaitingCharge?: number;
  finalCalculatedFare: number;
}

const FareBreakdown: React.FC<{ ride: CompletedRideDetails }> = ({ ride }) => {
  const baseFare = ride.fareEstimate;
  const priority = ride.isPriorityPickup && ride.priorityFeeAmount ? ride.priorityFeeAmount : 0;
  const pickupWaiting = ride.pickupWaitingCharge || 0;
  const stopWaiting = ride.accumulatedStopWaitingCharges || 0;
  let waitAndReturnSurcharge = 0;
  if (ride.waitAndReturn && typeof ride.estimatedAdditionalWaitTimeMinutes === 'number') {
    const oneWayBaseForWRSurcharge = ride.fareEstimate;
    const wrBaseMultiplier = 0.70;
    const waitingChargePerMinute = 0.20;
    const freeWaitMinutes = 10;
    const chargeableWait = Math.max(0, ride.estimatedAdditionalWaitTimeMinutes - freeWaitMinutes);
    waitAndReturnSurcharge = (oneWayBaseForWRSurcharge * wrBaseMultiplier) + (chargeableWait * waitingChargePerMinute);
  }
  const calculatedTotalFare = baseFare + priority + pickupWaiting + stopWaiting + waitAndReturnSurcharge;
  const totalFare = ride.finalCalculatedFare && ride.finalCalculatedFare > calculatedTotalFare ? ride.finalCalculatedFare : calculatedTotalFare;
  return (
    <div className="text-center my-4 p-3 border rounded-md bg-muted/30">
      <div className="inline-block px-8 py-3 rounded-full bg-green-500 border-2 border-green-700 mb-2 shadow-lg">
        <p className="text-3xl font-bold text-white">£{(totalFare ?? 0).toFixed(2)}</p>
        <p className="text-xs text-white font-semibold">Total Fare Paid</p>
      </div>
      <Separator className="my-1.5" />
      <div className="text-xs text-muted-foreground space-y-0.5 text-left">
        <p className="font-bold">Base Journey Fare: £{baseFare.toFixed(2)}</p>
        {priority > 0 && <p className="text-orange-600 font-bold">Priority Fee: +£{priority.toFixed(2)}</p>}
        <p className="text-yellow-600 font-bold">Pickup Waiting Time: +£{pickupWaiting.toFixed(2)}</p>
        {stopWaiting > 0 && <p className="text-yellow-600">Stop(s) Waiting Time: +£{stopWaiting.toFixed(2)}</p>}
      </div>
      {ride.waitAndReturn && waitAndReturnSurcharge > 0 && (
        <p className="text-indigo-600">Wait & Return Surcharge: +£{waitAndReturnSurcharge.toFixed(2)}</p>
      )}
    </div>
  );
};

export default function PassengerRideSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const rideId = params.rideId as string;

  const [rideDetails, setRideDetails] = useState<CompletedRideDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [driverRating, setDriverRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const fetchRideDetails = useCallback(async () => {
    if (!rideId) {
      setErrorDetails("Ride ID is missing.");
      setIsLoadingDetails(false);
      return;
    }
    setIsLoadingDetails(true);
    setErrorDetails(null);
    try {
      const response = await fetch(`/api/bookings/${rideId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API Error ${response.status}` }));
        throw new Error(errorData.message || `Failed to fetch ride details: ${response.status}`);
      }
      const data = await response.json();
      if (!data.booking) {
        throw new Error("Ride data not found in API response.");
      }
      const bookingData = data.booking;
      // Fetch driver customId
      let driverCustomId = '';
      if (bookingData.driverId) {
        try {
          if (!db) {
            console.error('Firestore database not initialized');
            return;
          }
          const driverDoc = await getDoc(doc(db, 'users', bookingData.driverId));
          if (driverDoc.exists()) {
            const d = driverDoc.data();
            driverCustomId = d.customId || d.driverIdentifier || '';
          }
        } catch {}
      }
      const details: CompletedRideDetails = {
        id: bookingData.id,
        displayBookingId: bookingData.displayBookingId,
        driverName: bookingData.driverName || 'N/A',
        driverAvatar: bookingData.driverAvatar,
        driverId: bookingData.driverId,
        driverCustomId,
        pickupLocation: { address: bookingData.pickupLocation?.address || 'N/A', doorOrFlat: bookingData.pickupLocation?.doorOrFlat },
        dropoffLocation: { address: bookingData.dropoffLocation?.address || 'N/A', doorOrFlat: bookingData.dropoffLocation?.doorOrFlat },
        stops: bookingData.stops?.map((s: any) => ({ address: s.address, doorOrFlat: s.doorOrFlat })) || [],
        fareEstimate: bookingData.fareEstimate ?? 0,
        paymentMethod: bookingData.paymentMethod,
        status: bookingData.status,
        vehicleType: bookingData.vehicleType,
        isPriorityPickup: bookingData.isPriorityPickup,
        priorityFeeAmount: bookingData.priorityFeeAmount,
        waitAndReturn: bookingData.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: bookingData.estimatedAdditionalWaitTimeMinutes,
        accumulatedStopWaitingCharges: bookingData.accumulatedStopWaitingCharges,
        pickupWaitingCharge: bookingData.pickupWaitingCharge,
        finalCalculatedFare: bookingData.finalCalculatedFare ?? 0,
      };
      setRideDetails(details);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setErrorDetails(message);
      toast({ title: "Error Fetching Ride Details", description: message, variant: "destructive" });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [rideId, toast]);

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  const handleRatingSubmit = async () => {
    if (driverRating === 0) {
      toast({ title: "No Rating Selected", description: "Please select a star rating for the driver.", variant: "default"});
      return;
    }
    setIsSubmittingRating(true);
    // TODO: Submit rating to backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: "Rating Submitted (Mock)",
      description: `You rated ${rideDetails?.driverName || 'the driver'} ${driverRating} stars. Thank you!`,
    });
    setIsSubmittingRating(false);
    setRatingSubmitted(true);
  };

  if (isLoadingDetails) return (<div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>);
  if (errorDetails) return (<div className="flex flex-col items-center py-10"><AlertTriangle className="w-12 h-12 text-destructive mb-2" /><p className="font-semibold text-destructive">{errorDetails}</p></div>);
  if (!rideDetails) return null;

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><UserCircle className="w-6 h-6 text-primary" /> Ride Summary</CardTitle>
          <CardDescription className="text-xs mt-1">Booking ID: {rideDetails.displayBookingId || rideDetails.id}</CardDescription>
          {rideDetails.driverCustomId && <CardDescription className="text-xs mt-1">Driver ID: {rideDetails.driverCustomId}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src={rideDetails.driverAvatar || `https://placehold.co/40x40.png?text=${rideDetails.driverName?.charAt(0) || '?'}`}
              alt={rideDetails.driverName || 'Driver'}
              width={40}
              height={40}
              className="rounded-full"
              data-ai-hint="driver avatar"
            />
            <div>
              <p className="font-medium">{rideDetails.driverName || <span className="italic text-gray-400">Unknown Driver</span>}</p>
              <p className="text-xs text-muted-foreground">Driver</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-1">
            <MapPin className="w-4 h-4 inline-block mr-1" /> <strong>From:</strong> {rideDetails.pickupLocation.address}
          </div>
          {rideDetails.stops && rideDetails.stops.length > 0 && rideDetails.stops.map((stop, idx) => (
            <div key={idx} className="text-xs text-muted-foreground mb-1 pl-5">
              <MapPin className="w-4 h-4 inline-block mr-1" /> <strong>Stop {idx+1}:</strong> {stop.address}
            </div>
          ))}
          <div className="text-xs text-muted-foreground mb-1">
            <MapPin className="w-4 h-4 inline-block mr-1" /> <strong>To:</strong> {rideDetails.dropoffLocation.address}
          </div>
          <FareBreakdown ride={rideDetails} />
          <div className="flex items-center gap-1 text-xs">
            {rideDetails.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
            <strong>Payment:</strong> {rideDetails.paymentMethod === 'card' ? 'Card' : 'Cash'}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          {!ratingSubmitted ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm font-medium">Rate your driver:</span>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-6 h-6 cursor-pointer ${i < driverRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                    onClick={() => setDriverRating(i + 1)}
                  />
                ))}
              </div>
              <Button onClick={handleRatingSubmit} disabled={isSubmittingRating || driverRating === 0} className="w-full">
                {isSubmittingRating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Rating'}
              </Button>
            </div>
          ) : (
            <div className="text-green-700 font-semibold flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Thank you for rating your driver!</div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 
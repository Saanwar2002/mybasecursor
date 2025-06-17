
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, CheckCircle, Loader2, AlertTriangle, MapPin, Briefcase, Coins, CreditCard, RefreshCwIcon, Crown, TimerIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole, PLATFORM_OPERATOR_CODE } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label"; // Added Label import

interface LocationPointSummary {
  address: string;
  doorOrFlat?: string;
}

interface CompletedRideDetails {
  id: string;
  displayBookingId?: string;
  passengerName: string;
  pickupLocation: LocationPointSummary;
  dropoffLocation: LocationPointSummary;
  stops?: Array<LocationPointSummary>;
  fareEstimate: number; // This is likely the base or initially estimated fare
  paymentMethod?: string;
  status?: string;
  vehicleType?: string;
  driverNotes?: string | null;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number;
  accumulatedStopWaitingCharges?: number;
  pickupWaitingCharge?: number;
  finalCalculatedFare: number; // Ensures this is always a number
}

export default function RideSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: driverUser, setActiveRide: clearActiveRideState, setIsPollingEnabled } = useAuth();

  const rideId = params.rideId as string;

  const [rideDetails, setRideDetails] = useState<CompletedRideDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [passengerRating, setPassengerRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRideDetails = useCallback(async () => {
    if (!rideId) {
      setErrorDetails("Ride ID is missing.");
      setIsLoadingDetails(false);
      return;
    }
    setIsLoadingDetails(true);
    setErrorDetails(null);
    try {
      const response = await fetch(`/api/operator/bookings/${rideId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API Error ${response.status}` }));
        throw new Error(errorData.message || `Failed to fetch ride details: ${response.status}`);
      }
      const data = await response.json();
      if (!data.booking) {
        throw new Error("Ride data not found in API response.");
      }
      
      const bookingData = data.booking;
      
      const baseFare = typeof bookingData.fareEstimate === 'number' ? bookingData.fareEstimate : 0;
      const priorityFee = (bookingData.isPriorityPickup && typeof bookingData.priorityFeeAmount === 'number') ? bookingData.priorityFeeAmount : 0;
      
      let wrSurcharge = 0;
      if (bookingData.waitAndReturn && typeof bookingData.estimatedAdditionalWaitTimeMinutes === 'number') {
        // Assuming original fareEstimate was one-way and W&R base is 1.7x + waiting
        const oneWayBase = baseFare; // This might need adjustment if fareEstimate already included W&R base
        const wrBaseMultiplier = 1.70; // 70% surcharge
        const waitingChargePerMinute = 0.20; // Example, should match definition if available elsewhere
        const freeWaitMinutes = 10; // Example
        
        const chargeableWait = Math.max(0, bookingData.estimatedAdditionalWaitTimeMinutes - freeWaitMinutes);
        wrSurcharge = (oneWayBase * (wrBaseMultiplier - 1)) + (chargeableWait * waitingChargePerMinute);
      }

      const pickupWaitCharge = typeof bookingData.pickupWaitingCharge === 'number' ? bookingData.pickupWaitingCharge : 0;
      const stopWaitCharges = bookingData.completedStopWaitCharges ? Object.values(bookingData.completedStopWaitCharges).reduce((sum: number, charge: any) => sum + (typeof charge === 'number' ? charge : 0), 0) : 0;
      
      const calculatedFinalFare = baseFare + priorityFee + wrSurcharge + pickupWaitCharge + stopWaitCharges;


      const details: CompletedRideDetails = {
        id: bookingData.id,
        displayBookingId: bookingData.displayBookingId,
        passengerName: bookingData.passengerName || "N/A",
        pickupLocation: { 
            address: bookingData.pickupLocation?.address || "N/A",
            doorOrFlat: bookingData.pickupLocation?.doorOrFlat
        },
        dropoffLocation: { 
            address: bookingData.dropoffLocation?.address || "N/A",
            doorOrFlat: bookingData.dropoffLocation?.doorOrFlat
        },
        stops: bookingData.stops?.map((s: any) => ({ address: s.address, doorOrFlat: s.doorOrFlat })) || [],
        fareEstimate: typeof bookingData.fareEstimate === 'number' ? bookingData.fareEstimate : 0,
        paymentMethod: bookingData.paymentMethod,
        status: bookingData.status,
        vehicleType: bookingData.vehicleType,
        driverNotes: bookingData.driverNotes,
        isPriorityPickup: bookingData.isPriorityPickup,
        priorityFeeAmount: typeof bookingData.priorityFeeAmount === 'number' ? bookingData.priorityFeeAmount : 0,
        waitAndReturn: bookingData.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: typeof bookingData.estimatedAdditionalWaitTimeMinutes === 'number' ? bookingData.estimatedAdditionalWaitTimeMinutes : 0,
        accumulatedStopWaitingCharges: typeof stopWaitCharges === 'number' ? stopWaitCharges : 0,
        pickupWaitingCharge: typeof pickupWaitCharge === 'number' ? pickupWaitCharge : 0,
        finalCalculatedFare: typeof bookingData.fareEstimate === 'number' ? bookingData.fareEstimate : 0, // Default to fareEstimate from booking if present
      };
      // If the booking already has a finalFare from the server, use that. Otherwise, use the client-calculated one.
      details.finalCalculatedFare = typeof bookingData.finalCalculatedFare === 'number' 
        ? bookingData.finalCalculatedFare 
        : calculatedFinalFare;


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
    if (passengerRating === 0) {
      toast({ title: "No Rating Selected", description: "Please select a star rating for the passenger.", variant: "default"});
      return;
    }
    setIsSubmitting(true);
    // Simulate submitting rating
    console.log(`Mock Submit: Driver ${driverUser?.id || 'N/A'} rated passenger for ride ${rideId} with ${passengerRating} stars.`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Rating Submitted (Mock)",
      description: `You rated ${rideDetails?.passengerName || 'the passenger'} ${passengerRating} stars. Thank you!`,
    });
    setIsSubmitting(false);
    
    if (typeof clearActiveRideState === 'function') {
      clearActiveRideState(null); // Clear active ride from context
    }
    if (typeof setIsPollingEnabled === 'function') {
      setIsPollingEnabled(true); // Re-enable polling on available rides page
    }

    router.push('/driver/available-rides'); 
  };

  if (isLoadingDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ride summary...</p>
      </div>
    );
  }

  if (errorDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="font-semibold text-lg text-destructive">Error Loading Ride Summary</p>
        <p className="text-muted-foreground mb-4">{errorDetails}</p>
        <Button onClick={() => router.push('/driver/available-rides')} variant="outline">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!rideDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="font-semibold text-lg">Ride Details Not Found</p>
        <Button onClick={() => router.push('/driver/available-rides')} variant="outline">
          Back to Dashboard
        </Button>
      </div>
    );
  }
  
  const getPaymentMethodIcon = () => {
    if (!rideDetails.paymentMethod) return Briefcase;
    switch (rideDetails.paymentMethod.toLowerCase()) {
      case "card": return CreditCard;
      case "cash": return Coins;
      case "account": return Briefcase;
      default: return Briefcase;
    }
  };
  const PaymentIcon = getPaymentMethodIcon();

  // Fare Breakdown Component
  const FareBreakdown: React.FC<{ ride: CompletedRideDetails }> = ({ ride }) => {
    const baseFare = ride.fareEstimate; // Assume fareEstimate is the base before addons
    const priority = ride.isPriorityPickup && ride.priorityFeeAmount ? ride.priorityFeeAmount : 0;
    const pickupWaiting = ride.pickupWaitingCharge || 0;
    const stopWaiting = ride.accumulatedStopWaitingCharges || 0;
    
    let waitAndReturnSurcharge = 0;
    if (ride.waitAndReturn && typeof ride.estimatedAdditionalWaitTimeMinutes === 'number') {
      const oneWayBaseForWRSurcharge = ride.fareEstimate; // Or however your base is defined before W&R
      const wrBaseMultiplier = 0.70; // The surcharge percentage
      const waitingChargePerMinute = 0.20; 
      const freeWaitMinutes = 10; 
      
      const chargeableWait = Math.max(0, ride.estimatedAdditionalWaitTimeMinutes - freeWaitMinutes);
      waitAndReturnSurcharge = (oneWayBaseForWRSurcharge * wrBaseMultiplier) + (chargeableWait * waitingChargePerMinute);
    }
    
    const totalFare = ride.finalCalculatedFare;

    return (
      <div className="text-center my-4 p-3 border rounded-md bg-muted/30">
        <p className="text-3xl font-bold text-primary">£{(totalFare ?? 0).toFixed(2)}</p>
        <p className="text-xs text-muted-foreground mb-2">Total Fare Collected</p>
        
        <Separator className="my-1.5" />
        <div className="text-xs text-muted-foreground space-y-0.5 text-left">
          {baseFare > 0 && <p>Base Journey Fare: £{baseFare.toFixed(2)}</p>}
          {priority > 0 && <p className="text-orange-600">Priority Fee: +£{priority.toFixed(2)}</p>}
          {pickupWaiting > 0 && <p className="text-yellow-600">Pickup Wait: +£{pickupWaiting.toFixed(2)}</p>}
          {stopWaiting > 0 && <p className="text-yellow-600">Stop(s) Wait: +£{stopWaiting.toFixed(2)}</p>}
          {ride.waitAndReturn && waitAndReturnSurcharge > 0 && (
            <p className="text-indigo-600">Wait & Return Surcharge: +£{waitAndReturnSurcharge.toFixed(2)}</p>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6 p-2 md:p-4 max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 dark:bg-green-800/30 p-3 rounded-full w-fit mb-3 border-2 border-green-500">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-headline">Ride Completed!</CardTitle>
          <CardDescription>
            Summary for Job ID: {rideDetails.displayBookingId || rideDetails.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-muted/50 rounded-lg border space-y-1.5">
            <p><strong>Passenger:</strong> {rideDetails.passengerName}</p>
            <p className="flex items-start"><MapPin className="w-4 h-4 mr-1.5 mt-0.5 text-green-500 shrink-0"/><strong>From:</strong> <span className="ml-1">{rideDetails.pickupLocation.address} {rideDetails.pickupLocation.doorOrFlat && `(${rideDetails.pickupLocation.doorOrFlat})`}</span></p>
            {rideDetails.stops && rideDetails.stops.length > 0 && (
                <div className="pl-2">
                {rideDetails.stops.map((stop, index) => (
                    <p key={`summary-stop-${index}`} className="flex items-start text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-blue-500 shrink-0"/>
                        <strong>Stop {index+1}:</strong> <span className="ml-1">{stop.address} {stop.doorOrFlat && `(${stop.doorOrFlat})`}</span>
                    </p>
                ))}
                </div>
            )}
            <p className="flex items-start"><MapPin className="w-4 h-4 mr-1.5 mt-0.5 text-red-500 shrink-0"/><strong>To:</strong> <span className="ml-1">{rideDetails.dropoffLocation.address} {rideDetails.dropoffLocation.doorOrFlat && `(${rideDetails.dropoffLocation.doorOrFlat})`}</span></p>
            
            <Separator className="my-2.5" />
            
            <FareBreakdown ride={rideDetails} />

            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              <PaymentIcon className="w-4 h-4" />
              <span>Payment Method: <span className="capitalize">{rideDetails.paymentMethod || "N/A"}</span></span>
            </div>

            {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 && (
              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-500/10">
                <Crown className="h-3 w-3 mr-1"/>Priority Included
              </Badge>
            )}
             {rideDetails.waitAndReturn && (
              <Badge variant="outline" className="text-xs border-indigo-500 text-indigo-600 bg-indigo-500/10">
                <RefreshCwIcon className="h-3 w-3 mr-1"/>Wait & Return Journey
              </Badge>
            )}
          </div>
          
          <Separator />

          <div className="text-center space-y-2 pt-2">
            <Label htmlFor="passenger-rating" className="text-lg font-semibold">
              Rate Your Passenger:
            </Label>
            <div id="passenger-rating" className="flex justify-center space-x-1 py-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-8 h-8 cursor-pointer ${
                    i < passengerRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                  }`}
                  onClick={() => setPassengerRating(i + 1)}
                />
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleRatingSubmit} 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Submitting..." : "Finalize & Go Online"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


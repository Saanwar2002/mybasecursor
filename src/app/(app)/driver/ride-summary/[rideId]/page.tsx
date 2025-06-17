
"use client";

import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, CheckCircle, Loader2, AlertTriangle, MapPin, Briefcase, Coins, CreditCard, RefreshCwIcon, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label";

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
  fareEstimate: number;
  paymentMethod?: string;
  status?: string;
  vehicleType?: string;
  driverNotes?: string | null;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  waitAndReturn?: boolean;
  estimatedAdditionalWaitTimeMinutes?: number; // From original booking for W&R
  accumulatedStopWaitingCharges?: number; // Total from all stops
  pickupWaitingCharge?: number; // Waiting charge at initial pickup
  // These are illustrative; the actual fare calculation might happen on backend or be passed differently
  finalCalculatedFare?: number; 
}

export default function RideSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: driverUser, setActiveRide: clearActiveRideState, setIsPollingEnabled } = useAuth(); // Get setActiveRide and setIsPollingEnabled

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
      // Map API response to CompletedRideDetails structure
      const bookingData = data.booking;
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
        fareEstimate: bookingData.fareEstimate || 0,
        paymentMethod: bookingData.paymentMethod,
        status: bookingData.status,
        vehicleType: bookingData.vehicleType,
        driverNotes: bookingData.driverNotes,
        isPriorityPickup: bookingData.isPriorityPickup,
        priorityFeeAmount: bookingData.priorityFeeAmount,
        waitAndReturn: bookingData.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: bookingData.estimatedAdditionalWaitTimeMinutes,
        // For actual accumulated charges, these would typically come from the completed ride object
        // Mocking them for now if not present, assuming they are part of fareEstimate already
        accumulatedStopWaitingCharges: bookingData.completedStopWaitCharges ? Object.values(bookingData.completedStopWaitCharges).reduce((sum: number, charge: any) => sum + charge, 0) : 0,
        pickupWaitingCharge: bookingData.pickupWaitingCharge || 0, // Example: This would be calculated and stored on the booking
        finalCalculatedFare: bookingData.fareEstimate, // Assuming fareEstimate is the final one for summary
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
    
    // Clear active ride state and re-enable polling from AuthContext
    if (typeof clearActiveRideState === 'function') {
      clearActiveRideState(null);
    }
    if (typeof setIsPollingEnabled === 'function') {
      setIsPollingEnabled(true);
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
    if (!rideDetails.paymentMethod) return Briefcase; // Default or N/A icon
    switch (rideDetails.paymentMethod.toLowerCase()) {
      case "card": return CreditCard;
      case "cash": return Coins;
      case "account": return Briefcase; // Or some other icon for account
      default: return Briefcase;
    }
  };
  const PaymentIcon = getPaymentMethodIcon();

  const finalFare = rideDetails.finalCalculatedFare || rideDetails.fareEstimate;

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
            
            <div className="font-semibold text-lg">
              Total Fare: <span className="text-primary">£{finalFare.toFixed(2)}</span>
            </div>

            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              <PaymentIcon className="w-4 h-4" />
              <span>Payment Method: <span className="capitalize">{rideDetails.paymentMethod || "N/A"}</span></span>
            </div>

            {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 && (
              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-500/10">
                <Crown className="h-3 w-3 mr-1"/>Priority +£{rideDetails.priorityFeeAmount.toFixed(2)}
              </Badge>
            )}
             {rideDetails.waitAndReturn && (
              <Badge variant="outline" className="text-xs border-indigo-500 text-indigo-600 bg-indigo-500/10">
                <RefreshCwIcon className="h-3 w-3 mr-1"/>W&R (~{rideDetails.estimatedAdditionalWaitTimeMinutes || 0}m)
              </Badge>
            )}
            {(rideDetails.pickupWaitingCharge || 0) > 0 && (
                 <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 bg-yellow-500/10">
                    Pickup Wait: +£{(rideDetails.pickupWaitingCharge || 0).toFixed(2)}
                </Badge>
            )}
             {(rideDetails.accumulatedStopWaitingCharges || 0) > 0 && (
                 <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 bg-yellow-500/10">
                    Stop Wait: +£{(rideDetails.accumulatedStopWaitingCharges || 0).toFixed(2)}
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

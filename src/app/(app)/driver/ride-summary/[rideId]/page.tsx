
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, CheckCircle, Loader2, AlertTriangle, MapPin, Briefcase, Coins, CreditCard, RefreshCwIcon, Crown, TimerIcon, Send } from "lucide-react"; // Added Send
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole, PLATFORM_OPERATOR_CODE } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // Added Input
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components

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
        <p className="text-xs text-white font-semibold">Total Fare Collected</p>
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
  const [isSubmittingRating, setIsSubmittingRating] = useState(false); // Renamed from isSubmitting

  // State for fare adjustment
  const [isEditingFare, setIsEditingFare] = useState(false);
  const [proposedFareInput, setProposedFareInput] = useState<string>("");
  const [fareAdjustmentStatus, setFareAdjustmentStatus] = useState<'idle' | 'pending_approval' | 'approved' | 'declined'>('idle');
  const [adjustedFareAmount, setAdjustedFareAmount] = useState<number | null>(null);
  const [isSubmittingFareProposal, setIsSubmittingFareProposal] = useState(false);


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
        const oneWayBaseForWRSurcharge = baseFare; 
        const wrBaseMultiplier = 0.70; 
        const waitingChargePerMinute = 0.20; 
        const freeWaitMinutes = 10; 
        
        const chargeableWait = Math.max(0, bookingData.estimatedAdditionalWaitTimeMinutes - freeWaitMinutes);
        wrSurcharge = (oneWayBaseForWRSurcharge * wrBaseMultiplier) + (chargeableWait * waitingChargePerMinute);
      }

      const pickupWaitCharge = typeof bookingData.pickupWaitingCharge === 'number' ? bookingData.pickupWaitingCharge : 0;
      const stopWaitChargesValue = bookingData.completedStopWaitCharges && typeof bookingData.completedStopWaitCharges === 'object' 
        ? Object.values(bookingData.completedStopWaitCharges).reduce((sum: number, charge: unknown) => sum + (typeof charge === 'number' ? charge : 0), 0) 
        : 0;
      
      const calculatedFinalFare = baseFare + priorityFee + wrSurcharge + pickupWaitCharge + stopWaitChargesValue;

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
        stops: bookingData.stops?.map((s: { address: string; doorOrFlat?: string }) => ({ address: s.address, doorOrFlat: s.doorOrFlat })) || [],
        fareEstimate: baseFare, // Store the original base fare
        paymentMethod: bookingData.paymentMethod,
        status: bookingData.status,
        vehicleType: bookingData.vehicleType,
        driverNotes: bookingData.driverNotes,
        isPriorityPickup: bookingData.isPriorityPickup,
        priorityFeeAmount: priorityFee,
        waitAndReturn: bookingData.waitAndReturn,
        estimatedAdditionalWaitTimeMinutes: typeof bookingData.estimatedAdditionalWaitTimeMinutes === 'number' ? bookingData.estimatedAdditionalWaitTimeMinutes : 0,
        accumulatedStopWaitingCharges: typeof stopWaitChargesValue === 'number' ? stopWaitChargesValue : 0,
        pickupWaitingCharge: pickupWaitCharge,
        finalCalculatedFare: typeof bookingData.finalCalculatedFare === 'number' ? bookingData.finalCalculatedFare : calculatedFinalFare,
      };
      setRideDetails(details);
      setProposedFareInput(details.finalCalculatedFare.toFixed(2)); // Initialize proposed fare input

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
    setIsSubmittingRating(true);
    console.log(`Mock Submit: Driver ${driverUser?.id || 'N/A'} rated passenger for ride ${rideId} with ${passengerRating} stars.`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Rating Submitted (Mock)",
      description: `You rated ${rideDetails?.passengerName || 'the passenger'} ${passengerRating} stars. Thank you!`,
    });
    setIsSubmittingRating(false);
    
    if (typeof clearActiveRideState === 'function') {
      clearActiveRideState(null);
    }
    if (typeof setIsPollingEnabled === 'function') {
      setIsPollingEnabled(true);
    }

    router.push('/driver/available-rides'); 
  };

  const handleSendFareProposal = async () => {
    if (!rideDetails || !driverUser?.id) return;
    const newProposed = parseFloat(proposedFareInput);
    if (isNaN(newProposed) || newProposed <= 0) {
        toast({ title: "Invalid Fare Amount", description: "Please enter a valid positive number for the fare.", variant: "destructive"});
        return;
    }
    if (newProposed === rideDetails.finalCalculatedFare) {
        toast({ title: "No Change", description: "Proposed fare is the same as the current fare.", variant: "default"});
        setIsEditingFare(false);
        return;
    }
    try {
      setIsSubmittingFareProposal(true);
      const response = await fetch("/api/bookings/adjust-fare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: rideDetails.id, driverId: driverUser.id, newFare: newProposed })
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: "Fare Adjustment Failed", description: data.message || "Could not adjust fare.", variant: "destructive" });
        setIsSubmittingFareProposal(false);
        return;
      }
      setAdjustedFareAmount(newProposed);
      setFareAdjustmentStatus('approved');
      setRideDetails(prevDetails => prevDetails ? { ...prevDetails, finalCalculatedFare: newProposed } : null);
      toast({ title: "Fare Adjustment Proposed!", description: `New fare proposed: £${newProposed.toFixed(2)}` });
      setIsEditingFare(false);
      setIsSubmittingFareProposal(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to propose fare adjustment.", variant: "destructive" });
      setIsEditingFare(false);
      setIsSubmittingFareProposal(false);
    }
  };
// REMOVE THIS EXTRA CLOSING BRACE
// };

  if (isLoadingDetails) {
    return ( <div className="flex flex-col items-center justify-center h-full p-4"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-muted-foreground">Loading ride summary...</p> </div> );
  }
  if (errorDetails) {
    return ( <div className="flex flex-col items-center justify-center h-full p-4 text-center"> <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> <p className="font-semibold text-lg text-destructive">Error Loading Ride Summary</p> <p className="text-muted-foreground mb-4">{errorDetails}</p> <Button onClick={() => router.push('/driver/available-rides')} variant="outline"> Back to Dashboard </Button> </div> );
  }
  if (!rideDetails) {
    return ( <div className="flex flex-col items-center justify-center h-full p-4 text-center"> <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> <p className="font-semibold text-lg">Ride Details Not Found</p> <Button onClick={() => router.push('/driver/available-rides')} variant="outline"> Back to Dashboard </Button> </div> );
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

  return (
    <div className="space-y-6 p-2 md:p-4 max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 dark:bg-green-800/30 p-3 rounded-full w-fit mb-3 border-2 border-green-500">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-headline">Ride Completed!</CardTitle>
          <CardDescription>Summary for Job ID: {rideDetails.displayBookingId || rideDetails.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-muted/50 rounded-lg border space-y-1.5">
            <p><strong>Passenger:</strong> {rideDetails.passengerName}</p>
            <p className="flex items-start"><MapPin className="w-4 h-4 mr-1.5 mt-0.5 text-green-500 shrink-0"/><strong>From:</strong> <span className="ml-1">{rideDetails.pickupLocation.address} {rideDetails.pickupLocation.doorOrFlat && `(${rideDetails.pickupLocation.doorOrFlat})`}</span></p>
            {rideDetails.stops && rideDetails.stops.length > 0 && (
                <div className="pl-2"> {rideDetails.stops.map((stop, index) => ( <p key={`summary-stop-${index}`} className="flex items-start text-sm text-muted-foreground"> <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-blue-500 shrink-0"/> <strong>Stop {index+1}:</strong> <span className="ml-1">{stop.address} {stop.doorOrFlat && `(${stop.doorOrFlat})`}</span> </p> ))} </div>
            )}
            <p className="flex items-start"><MapPin className="w-4 h-4 mr-1.5 mt-0.5 text-red-500 shrink-0"/><strong>To:</strong> <span className="ml-1">{rideDetails.dropoffLocation.address} {rideDetails.dropoffLocation.doorOrFlat && `(${rideDetails.dropoffLocation.doorOrFlat})`}</span></p>
            <Separator className="my-2.5" />
            <FareBreakdown ride={rideDetails} />
            <div className="text-sm text-muted-foreground flex items-center gap-1.5"> <PaymentIcon className="w-4 h-4" /> <span>Payment Method: <span className="capitalize">{rideDetails.paymentMethod || "N/A"}</span></span> {rideDetails.paymentMethod === 'account' && (<span style={{background:'#5B2A86',color:'#fff',borderRadius:'6px',padding:'2px 18px',marginLeft:'8px',fontWeight:'bold',fontSize:'0.95em',display:'inline-block'}}>Account Job</span>)} </div>
            {rideDetails.isPriorityPickup && rideDetails.priorityFeeAmount && rideDetails.priorityFeeAmount > 0 && ( <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-500/10"> <Crown className="h-3 w-3 mr-1"/>Priority Included </Badge> )}
            {rideDetails.waitAndReturn && ( <Badge variant="outline" className="text-xs border-indigo-500 text-indigo-600 bg-indigo-500/10"> <RefreshCwIcon className="h-3 w-3 mr-1"/>Wait & Return Journey </Badge> )}
          </div>
          <Separator />

          {/* Fare Adjustment Section */}
          <div>
            <Label className="text-md font-semibold">Fare Adjustment</Label>
            {fareAdjustmentStatus === 'idle' && !isEditingFare && (
              <Button variant="outline" size="sm" className="mt-2 w-full border-accent text-accent hover:bg-accent/10" onClick={() => { setProposedFareInput(rideDetails.finalCalculatedFare.toFixed(2)); setIsEditingFare(true); }} >
                Propose Fare Adjustment
              </Button>
            )}
            {isEditingFare && (
              <div className="mt-2 space-y-2 p-3 border rounded-md bg-muted/50">
                <Label htmlFor="proposed-fare-input" className="text-sm">New Proposed Total Fare (£)</Label>
                <Input id="proposed-fare-input" type="number" step="0.01" value={proposedFareInput} onChange={(e) => setProposedFareInput(e.target.value)} placeholder={rideDetails.finalCalculatedFare.toFixed(2)} disabled={isSubmittingFareProposal} className="h-9"/>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleSendFareProposal} disabled={isSubmittingFareProposal || !proposedFareInput || parseFloat(proposedFareInput) <= 0} size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-8">
                    {isSubmittingFareProposal ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                    Send Proposal
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsEditingFare(false); setProposedFareInput(rideDetails.finalCalculatedFare.toFixed(2)); }} disabled={isSubmittingFareProposal} className="h-8">Cancel</Button>
                </div>
              </div>
            )}
            {fareAdjustmentStatus === 'pending_approval' && (
              <Alert variant="default" className="mt-2 bg-yellow-50 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 text-xs p-2.5">
                <TimerIcon className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                <AlertTitle className="text-yellow-700 dark:text-yellow-300 text-sm">Proposal Sent</AlertTitle>
                <AlertDescription className="text-yellow-600 dark:text-yellow-500"> Fare adjustment of £{parseFloat(proposedFareInput).toFixed(2)} sent. Awaiting approval. </AlertDescription>
              </Alert>
            )}
            {fareAdjustmentStatus === 'approved' && adjustedFareAmount !== null && (
              <Alert variant="default" className="mt-2 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-xs p-2.5">
                <CheckCircle className="h-4 w-4 !text-green-600 dark:!text-green-400" />
                <AlertTitle className="text-green-700 dark:text-green-300 text-sm">Adjustment Approved</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-500"> Passenger approved new total fare of £{adjustedFareAmount.toFixed(2)}. </AlertDescription>
              </Alert>
            )}
            {fareAdjustmentStatus === 'declined' && (
              <Alert variant="destructive" className="mt-2 text-xs p-2.5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Adjustment Declined</AlertTitle>
                <AlertDescription> Passenger declined. Original fare of £{rideDetails.finalCalculatedFare.toFixed(2)} applies. </AlertDescription>
              </Alert>
            )}
          </div>
          <Separator />
          <div className="text-center space-y-2 pt-2">
            <Label htmlFor="passenger-rating" className="text-lg font-semibold"> Rate Your Passenger: </Label>
            <div id="passenger-rating" className="flex justify-center space-x-1 py-2"> {[...Array(5)].map((_, i) => ( <Star key={i} className={`w-8 h-8 cursor-pointer ${ i < passengerRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300" }`} onClick={() => setPassengerRating(i + 1)} /> ))} </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRatingSubmit} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmittingRating || isSubmittingFareProposal || fareAdjustmentStatus === 'pending_approval'}>
            {isSubmittingRating ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <ThumbsUp className="mr-2 h-4 w-4" /> )}
            {isSubmittingRating ? "Submitting..." : "Finalize & Go Online"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
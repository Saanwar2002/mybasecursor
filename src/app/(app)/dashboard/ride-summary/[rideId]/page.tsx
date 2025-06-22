"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle, Loader2, AlertTriangle, MapPin, Coins, CreditCard, User, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface LocationPointSummary {
  address: string;
}

interface RideSummaryDetails {
  id: string;
  driverName: string;
  driverAvatar?: string;
  vehicleModel: string;
  vehicleReg: string;
  pickupLocation: LocationPointSummary;
  dropoffLocation: LocationPointSummary;
  finalFare: number;
  paymentMethod?: 'card' | 'cash';
  fareProposal?: {
    proposedAmount: number;
    reason: string;
    status: 'pending' | 'approved' | 'declined';
  }
}

export default function PassengerRideSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const rideId = params.rideId as string;

  const [rideDetails, setRideDetails] = useState<RideSummaryDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(true); // Open by default
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComments, setReviewComments] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchRideSummary = useCallback(async () => {
    if (!rideId || !user) return;
    setIsLoading(true);
    setError(null);
    try {
      // We will create this API endpoint next
      const response = await fetch(`/api/bookings/ride-details/${rideId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch ride summary.");
      }
      const data = await response.json();
      setRideDetails(data.ride);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [rideId, user]);

  useEffect(() => {
    // Mock data for now until API is created
    // To test, navigate to /dashboard/ride-summary/test-ride
    if (rideId === 'test-ride') {
      setRideDetails({
        id: 'test-ride-123',
        driverName: 'John D.',
        vehicleModel: 'Toyota Prius',
        vehicleReg: 'YD18 ABC',
        pickupLocation: { address: '123 Kings Road, Huddersfield' },
        dropoffLocation: { address: 'Huddersfield Royal Infirmary' },
        finalFare: 12.50,
        paymentMethod: 'card',
      });
      setIsLoading(false);
    } else {
       fetchRideSummary();
    }
  }, [fetchRideSummary, rideId]);

  const submitReview = async () => {
    if (!rideDetails || !user || reviewRating === 0) {
      toast({ title: "Incomplete Review", description: "Please provide a star rating.", variant: "destructive" });
      return;
    }
    setIsSubmittingReview(true);
    try {
      await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterId: user.id,
          submitterName: user.name,
          submitterEmail: user.email,
          submitterRole: 'passenger',
          category: reviewRating >= 4 ? "driver_compliment" : "driver_complaint",
          details: reviewComments || (reviewRating >= 4 ? 'Great ride!' : 'Ride issue.'),
          rideId: rideDetails.id,
          rating: reviewRating,
        }),
      });
      toast({ title: "Review Submitted", description: "Thank you for your feedback!" });
      setIsReviewDialogOpen(false); // Close dialog on success
    } catch (error) {
       toast({ title: "Submission Error", description: "Could not submit your review.", variant: "destructive" });
    } finally {
      setIsSubmittingReview(false);
    }
  };
  
  const handleFareProposalDecision = async (decision: 'accepted' | 'rejected') => {
    // Logic to handle fare proposal decision
    console.log(`Passenger ${decision} the fare proposal.`);
    toast({ title: "Decision Recorded", description: "The fare has been updated." });
  };


  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  if (error) return <div className="flex items-center justify-center h-screen"><AlertTriangle className="w-12 h-12 text-destructive" /><p className="ml-4">{error}</p></div>;
  if (!rideDetails) return <div className="flex items-center justify-center h-screen"><p>Ride summary not found.</p></div>;

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto w-12 h-12 text-green-500 mb-2" />
          <CardTitle className="text-2xl font-headline">Ride Completed!</CardTitle>
          <CardDescription>Here is a summary of your trip.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <div>
                  <p className="font-semibold text-lg">{rideDetails.driverName}</p>
                  <p className="text-sm text-muted-foreground">{rideDetails.vehicleModel} ({rideDetails.vehicleReg})</p>
              </div>
              <Avatar className="w-12 h-12">
                  <AvatarImage src={rideDetails.driverAvatar || undefined} />
                  <AvatarFallback><User /></AvatarFallback>
              </Avatar>
          </div>
          
          <Separator />
          
          <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Fare</p>
              <p className="text-4xl font-bold text-primary">£{rideDetails.finalFare.toFixed(2)}</p>
              <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
                  {rideDetails.paymentMethod === 'card' ? <CreditCard className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                  <span className="capitalize">{rideDetails.paymentMethod}</span>
              </div>
          </div>

          {rideDetails.fareProposal?.status === 'pending' && (
            <Alert variant="default" className="border-yellow-500">
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Fare Adjustment Proposed</AlertTitle>
              <AlertDescription>
                The driver proposed a fare of £{rideDetails.fareProposal.proposedAmount.toFixed(2)} due to: "{rideDetails.fareProposal.reason}".
              </AlertDescription>
              <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => handleFareProposalDecision('accepted')}>Accept</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleFareProposalDecision('rejected')}>Decline</Button>
              </div>
            </Alert>
          )}

          <Separator />
          
           <div className="space-y-2 text-sm">
              <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-3 mt-1 text-green-500"/>
                  <div>
                      <p className="font-semibold">From</p>
                      <p className="text-muted-foreground">{rideDetails.pickupLocation.address}</p>
                  </div>
              </div>
               <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-3 mt-1 text-red-500"/>
                   <div>
                      <p className="font-semibold">To</p>
                      <p className="text-muted-foreground">{rideDetails.dropoffLocation.address}</p>
                  </div>
              </div>
          </div>

        </CardContent>
        <CardFooter>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>Done</Button>
        </CardFooter>
      </Card>
      
      {/* Review Dialog */}
      <AlertDialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>How was your ride with {rideDetails.driverName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Your feedback helps us improve. Please leave a rating and optional comments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn("h-8 w-8 cursor-pointer transition-colors", reviewRating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")}
                      onClick={() => setReviewRating(star)}
                    />
                  ))}
                </div>
                <Textarea 
                  placeholder="Add a comment... (e.g., driver was very friendly, car was clean)" 
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="min-h-[80px]"
                />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Maybe Later</AlertDialogCancel>
              <Button onClick={submitReview} disabled={isSubmittingReview}>
                {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Review
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 
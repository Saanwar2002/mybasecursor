
"use client";

import { useEffect, useState }
from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context'; // To potentially get driver details for API calls
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from "@/components/ui/label"; // Added this import

// Placeholder for ride details - in a real app, you'd fetch this
interface CompletedRideDetails {
  id: string;
  displayBookingId?: string;
  passengerName: string;
  pickupLocation: { address: string };
  dropoffLocation: { address: string };
  fareEstimate: number;
  paymentMethod?: string;
  // Add other relevant fields
}

export default function RideSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: driverUser } = useAuth();

  const rideId = params.rideId as string;

  const [rideDetails, setRideDetails] = useState<CompletedRideDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [passengerRating, setPassengerRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (rideId) {
      setIsLoadingDetails(true);
      setErrorDetails(null);
      // Simulate fetching ride details based on rideId
      // In a real app, replace this with an API call: fetch(`/api/operator/bookings/${rideId}`)
      setTimeout(() => {
        // Mock data - replace with actual fetch
        const mockRide: CompletedRideDetails = {
          id: rideId,
          displayBookingId: `MOCK/${rideId.substring(0,6).toUpperCase()}`,
          passengerName: "Mock Passenger",
          pickupLocation: { address: "Mock Pickup Location" },
          dropoffLocation: { address: "Mock Dropoff Location" },
          fareEstimate: Math.random() * 20 + 5, // Random fare between 5 and 25
          paymentMethod: Math.random() < 0.5 ? "Card" : "Cash",
        };
        setRideDetails(mockRide);
        setIsLoadingDetails(false);
      }, 1000);
    } else {
      setErrorDetails("Ride ID is missing.");
      setIsLoadingDetails(false);
    }
  }, [rideId]);

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
      description: `You rated the passenger ${passengerRating} stars. Thank you!`,
    });
    setIsSubmitting(false);
    router.push('/driver/available-rides'); // Navigate back to available rides screen
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
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p><strong>Passenger:</strong> {rideDetails.passengerName}</p>
            <p><strong>From:</strong> {rideDetails.pickupLocation.address}</p>
            <p><strong>To:</strong> {rideDetails.dropoffLocation.address}</p>
            <Separator className="my-2"/>
            <p className="font-semibold text-lg">Total Fare: <span className="text-primary">£{rideDetails.fareEstimate.toFixed(2)}</span></p>
            <p className="text-sm text-muted-foreground">Payment Method: {rideDetails.paymentMethod}</p>
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
    

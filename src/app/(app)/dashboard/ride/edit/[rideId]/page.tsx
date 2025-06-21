"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { ActiveRide } from '@/app/(app)/dashboard/track-ride/page';
import { EditRideForm, type EditRideFormValues } from "@/components/dashboard/EditRideForm";
import { doc, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';

export default function EditActiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const rideId = params.rideId as string;

  const [rideData, setRideData] = useState<ActiveRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRideDetails = useCallback(async () => {
    if (!rideId) {
      setError("Ride ID is missing.");
      setIsLoading(false);
      return;
    }
    if (!db) {
      setError("Database connection not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const rideRef = doc(db, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);

      if (!rideSnap.exists()) {
        throw new Error("Ride not found.");
      }
      
      const data = rideSnap.data() as Omit<ActiveRide, 'id'>;
      
      // Basic validation
      if (data.passengerId !== user?.id) {
          throw new Error("You are not authorized to view this ride.");
      }

      setRideData({ ...data, id: rideSnap.id });

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Ride", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [rideId, toast, user?.id]);

  useEffect(() => {
    if (user) { // Only fetch if user is loaded
        fetchRideDetails();
    }
  }, [fetchRideDetails, user]);

  const handleFormSubmit = async (values: EditRideFormValues) => {
    if (!rideId || !user?.id) {
        toast({ title: "Error", description: "Missing ride ID or user information.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    try {
        const response = await fetch('/api/bookings/update-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rideId,
                passengerId: user.id,
                ...values
            }),
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to update ride.");
        }
        
        toast({
            title: "Success!",
            description: "Your ride details have been updated.",
        });
        router.push('/dashboard/track-ride');

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Update Failed", description: message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" /> Loading Ride Details...
          </CardTitle>
        <Card>
          <CardContent className="p-6 flex justify-center items-center min-h-[200px]">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
          <CardTitle className="text-3xl font-headline flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-8 h-8" /> Error Loading Ride
          </CardTitle>
           <Button variant="outline" asChild className="w-full md:w-auto">
            <Link href="/dashboard/track-ride">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Ride Tracking
            </Link>
          </Button>
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchRideDetails} variant="destructive" className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!rideData) {
     return (
       <div className="space-y-6">
         <CardTitle className="text-3xl font-headline flex items-center gap-2">
            Ride Not Found
         </CardTitle>
         <Button variant="outline" asChild className="w-full md:w-auto">
           <Link href="/dashboard">
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
           </Link>
         </Button>
         <Card>
            <CardContent className="p-6">
                <p>The requested ride could not be found.</p>
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-3xl font-headline flex items-center gap-2">
          <Edit className="w-8 h-8 text-primary" /> Edit Active Ride
        </CardTitle>
        <Button variant="outline" asChild className="w-full md:w-auto">
          <Link href="/dashboard/track-ride">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Ride Tracking
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardDescription>
            Modify the details of your active ride. Changes can only be made while the ride is still searching for a driver.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditRideForm initialData={rideData} onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>
    </div>
  );
} 
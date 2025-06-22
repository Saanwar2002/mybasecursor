
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { NewScheduleForm } from "@/components/dashboard/NewScheduleForm";
import { type ScheduledBooking } from '@/app/(app)/dashboard/scheduled-rides/page'; // Use the existing interface
import { useToast } from '@/hooks/use-toast';

export default function EditScheduledRidePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const scheduleId = params.scheduleId as string;

  const [initialData, setInitialData] = useState<ScheduledBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduleDetails = useCallback(async () => {
    if (!scheduleId) {
      setError("Schedule ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-bookings/${scheduleId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API Error ${response.status}` }));
        throw new Error(errorData.message || `Failed to fetch schedule: ${response.status}`);
      }
      const data: ScheduledBooking = await response.json();
      setInitialData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Schedule", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [scheduleId, toast]);

  useEffect(() => {
    fetchScheduleDetails();
  }, [fetchScheduleDetails]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" /> Loading Schedule...
          </CardTitle>
        </div>
        <Card className="shadow-md">
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
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-3xl font-headline flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-8 h-8" /> Error Loading Schedule
          </CardTitle>
          <Button variant="outline" asChild className="w-full md:w-auto">
            <Link href="/dashboard/scheduled-rides">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        <Card className="shadow-md border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchScheduleDetails} variant="destructive" className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!initialData) {
     return (
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
             Schedule Not Found
          </CardTitle>
           <Button variant="outline" asChild className="w-full md:w-auto">
            <Link href="/dashboard/scheduled-rides">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        <Card className="shadow-md">
            <CardContent className="p-6">
                <p>The requested schedule could not be found. It might have been deleted.</p>
            </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-3xl font-headline flex items-center gap-2">
          <CalendarClock className="w-8 h-8 text-primary" /> Edit Scheduled Ride
        </CardTitle>
        <Button variant="outline" asChild className="w-full md:w-auto">
          <Link href="/dashboard/scheduled-rides">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scheduled Rides
          </Link>
        </Button>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardDescription>
            Modify the details of your scheduled ride: "{initialData.label}".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm initialData={initialData} isEditMode={true} />
        </CardContent>
      </Card>
    </div>
  );
}

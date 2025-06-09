
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CreateScheduledRideForm } from "@/components/dashboard/create-scheduled-ride-form"; // Updated import

export default function CreateScheduledRidePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <CardTitle className="text-3xl font-headline flex items-center gap-2">
          <CalendarClock className="w-8 h-8 text-primary" /> Create New Scheduled Ride
        </CardTitle>
        <Button variant="outline" asChild>
          <Link href="/dashboard/scheduled-rides">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scheduled Rides
          </Link>
        </Button>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardDescription>
            Set up a recurring or future one-time booking. Specify locations, times, and frequency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateScheduledRideForm />
        </CardContent>
      </Card>
    </div>
  );
}

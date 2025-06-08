
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Placeholder for the form component we will build
// import { CreateScheduledRideForm } from "@/components/dashboard/create-scheduled-ride-form";

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
            The actual form will be implemented in the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold mb-2">Scheduled Ride Form - Coming Soon!</p>
            <p>This section will contain a detailed form to:</p>
            <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-sm">
              <li>Select pickup and dropoff locations (with stops).</li>
              <li>Choose vehicle type and passenger count.</li>
              <li>Set pickup time.</li>
              <li>Define recurrence (days of the week).</li>
              <li>Optionally schedule a return journey for the same day.</li>
              <li>Add notes and payment preferences.</li>
            </ul>
          </div>
          {/* <CreateScheduledRideForm /> Placeholder for actual form */}
        </CardContent>
      </Card>
    </div>
  );
}

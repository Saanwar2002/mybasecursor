
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewScheduleForm } from "@/components/dashboard/NewScheduleForm"; // Updated import

export default function CreateScheduledRidePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-3xl font-headline flex items-center gap-2">
          <CalendarClock className="w-8 h-8 text-primary" /> Create New Scheduled Ride
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
            Set up a recurring or future one-time booking. Specify locations, times, and frequency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm />
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, PlusCircle, Edit, Trash2, Play, Pause, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Interface for Firestore Timestamp (if directly used from backend)
interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

// Matches the data model discussed
export interface ScheduledBooking {
  id: string; // Firestore document ID
  passengerId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number;
  driverNotes?: string;
  paymentMethod: "card" | "cash";
  daysOfWeek: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  pickupTime: string; // e.g., "08:30"
  isReturnJourneyScheduled: boolean;
  returnPickupTime?: string; // e.g., "17:00"
  isWaitAndReturnOutbound?: boolean;
  estimatedWaitTimeMinutesOutbound?: number;
  isActive: boolean;
  pausedDates?: string[]; // Array of "YYYY-MM-DD"
  nextRunDate?: string; // "YYYY-MM-DD"
  createdAt: string; // ISO string from API
  updatedAt: string; // ISO string from API
  estimatedFareOneWay?: number;
  estimatedFareReturn?: number;
}

export default function ScheduledRidesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledBookings, setScheduledBookings] = useState<ScheduledBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchScheduledBookings = useCallback(async () => {
    if (!user?.id) {
      console.log("ScheduledRidesPage: fetchScheduledBookings - No user ID, skipping fetch.");
      setIsLoading(false);
      setScheduledBookings([]); // Clear bookings if no user
      return;
    }
    console.log(`ScheduledRidesPage: Fetching schedules for passengerId: ${user.id}`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-bookings/list?passengerId=${user.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch scheduled bookings.');
      }
      const data = await response.json();
      console.log("ScheduledRidesPage: Data received from API:", data);
      setScheduledBookings(data.schedules || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      console.error("ScheduledRidesPage: Error fetching schedules:", message);
      toast({ title: "Error Fetching Schedules", description: message, variant: "destructive" });
      setScheduledBookings([]); // Clear bookings on error
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchScheduledBookings();
  }, [fetchScheduledBookings]);

  const handleDeleteSchedule = async (scheduleId: string) => {
    setActionLoading(prev => ({ ...prev, [scheduleId]: true }));
    try {
      const response = await fetch(`/api/scheduled-bookings/${scheduleId}?passengerId=${user?.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete schedule.');
      }
      toast({ title: "Schedule Deleted", description: "The scheduled ride has been removed." });
      fetchScheduledBookings(); // Refresh list
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Delete Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [scheduleId]: false }));
    }
  };

  const handleToggleActive = async (schedule: ScheduledBooking) => {
    setActionLoading(prev => ({ ...prev, [`toggle-${schedule.id}`]: true }));
    try {
      const response = await fetch(`/api/scheduled-bookings/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passengerId: user?.id, isActive: !schedule.isActive }), // Added passengerId for verification
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update schedule status.');
      }
      toast({ title: "Schedule Updated", description: `Schedule "${schedule.label}" is now ${!schedule.isActive ? 'active' : 'paused'}.` });
      fetchScheduledBookings(); // Refresh list
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Update Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`toggle-${schedule.id}`]: false }));
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <CalendarClock className="w-8 h-8 text-primary" /> Scheduled Rides
            </CardTitle>
            <CardDescription>Manage your recurring and future scheduled bookings.</CardDescription>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/dashboard/scheduled-rides/create">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Schedule
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Scheduled Rides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {error && !isLoading && (
            <div className="text-center py-10 text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
              <p className="font-semibold">Error loading scheduled rides:</p>
              <p>{error}</p>
              <Button onClick={fetchScheduledBookings} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && scheduledBookings.length === 0 && (
             <p className="text-center text-muted-foreground py-8">You have no scheduled rides yet. Click "Create New Schedule" to add one.</p>
          )}
          {!isLoading && !error && scheduledBookings.length > 0 && (
            <div className="space-y-4">
              {scheduledBookings.map((schedule) => (
                <Card key={schedule.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold">{schedule.label}</CardTitle>
                      <Button 
                        variant={schedule.isActive ? "outline" : "default"}
                        size="sm" 
                        className={`h-8 px-2 text-xs ${schedule.isActive ? 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                        onClick={() => handleToggleActive(schedule)}
                        disabled={actionLoading[`toggle-${schedule.id}`]}
                      >
                        {actionLoading[`toggle-${schedule.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : (schedule.isActive ? <Pause className="h-3 w-3 mr-1"/> : <Play className="h-3 w-3 mr-1"/>)}
                        {schedule.isActive ? 'Pause Schedule' : 'Resume Schedule'}
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      {schedule.daysOfWeek.join(', ')} at {schedule.pickupTime}
                      {schedule.isReturnJourneyScheduled && schedule.returnPickupTime && ` (Return at ${schedule.returnPickupTime})`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1 pt-0 pb-3">
                    <p><strong>From:</strong> {schedule.pickupLocation.address}</p>
                    <p><strong>To:</strong> {schedule.dropoffLocation.address}</p>
                    <p><strong>Vehicle:</strong> {schedule.vehicleType} ({schedule.passengers} passengers)</p>
                    {schedule.estimatedFareOneWay && <p><strong>Est. Fare (One Way):</strong> £{schedule.estimatedFareOneWay.toFixed(2)}</p>}
                  </CardContent>
                  <CardFooter className="border-t pt-3 pb-3 flex justify-end gap-2">
                     <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-primary" disabled>
                        <Edit className="h-3 w-3 mr-1"/> Edit (Soon)
                     </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-8 px-2 text-xs" disabled={actionLoading[schedule.id]}>
                           {actionLoading[schedule.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1"/>}
                           Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the scheduled ride "{schedule.label}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={actionLoading[schedule.id]}>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteSchedule(schedule.id)} 
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={actionLoading[schedule.id]}
                          >
                            {actionLoading[schedule.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Schedule"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        <Card className="mt-6">
            <CardHeader>
                <CardTitle>How Scheduled Rides Work</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>Automatic Booking (Backend Process):</strong> A backend system (not part of this UI demo) would check your active schedules daily. If a ride is due based on its `nextRunDate`, `daysOfWeek`, and is not paused for that specific day, a normal booking will be automatically created and assigned to a driver.</p>
                <p><strong>Pausing:</strong> You can pause the entire schedule (making it inactive) or add specific dates to skip (e.g., for holidays). Paused schedules or paused dates will prevent automatic booking creation.</p>
                <p><strong>Editing/Deleting:</strong> You can modify or delete your schedules at any time. Changes apply to future automatic bookings.</p>
                <p><strong>Notifications:</strong> You would typically receive a notification when a scheduled ride is automatically booked and when a driver is assigned, similar to regular bookings.</p>
            </CardContent>
        </Card>
    </div>
  );
}

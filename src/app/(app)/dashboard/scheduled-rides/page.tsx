
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, PlusCircle, Edit, Trash2, Play, Pause, Loader2, AlertTriangle, RefreshCwIcon, Timer, DollarSign } from "lucide-react";
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
import { Separator } from '@/components/ui/separator'; // Added Separator import


interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export interface LocationPoint { 
  address: string;
  latitude: number;
  longitude: number;
  doorOrFlat?: string;
}

export interface ScheduledBooking {
  id: string; 
  passengerId: string;
  label: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  vehicleType: string;
  passengers: number;
  driverNotes?: string | null; 
  paymentMethod: "card" | "cash";
  daysOfWeek: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  pickupTime: string; 
  isReturnJourneyScheduled: boolean;
  returnPickupTime?: string | null; 
  isWaitAndReturnOutbound?: boolean;
  estimatedWaitTimeMinutesOutbound?: number | null; 
  isActive: boolean;
  pausedDates?: string[]; 
  nextRunDate?: string; 
  createdAt: string; 
  updatedAt: string; 
  estimatedFareOneWay?: number | null; 
  estimatedFareReturn?: number | null; 
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
      setScheduledBookings([]); 
      return;
    }
    console.log(`ScheduledRidesPage: Fetching schedules for passengerId: ${user.id}`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-bookings/list?passengerId=${user.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API Error ${response.status}` }));
        throw new Error(errorData.message || `Failed to fetch scheduled bookings: ${response.status}`);
      }
      const data = await response.json();
      console.log("ScheduledRidesPage: Data received from API:", data); 
      setScheduledBookings(data.schedules || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      console.error("ScheduledRidesPage: Error fetching schedules:", message);
      toast({ title: "Error Fetching Schedules", description: message, variant: "destructive" });
      setScheduledBookings([]); 
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchScheduledBookings();
  }, [fetchScheduledBookings]);

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!user?.id) {
      toast({ title: "Error", description: "User not identified.", variant: "destructive"});
      return;
    }
    setActionLoading(prev => ({ ...prev, [scheduleId]: true }));
    try {
      const response = await fetch(`/api/scheduled-bookings/${scheduleId}?passengerId=${user.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete schedule.');
      }
      toast({ title: "Schedule Deleted", description: "The scheduled ride has been removed." });
      setScheduledBookings(prev => prev.filter(s => s.id !== scheduleId)); 
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Delete Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [scheduleId]: false }));
    }
  };

  const handleToggleActive = async (schedule: ScheduledBooking) => {
    if (!user?.id) {
      toast({ title: "Error", description: "User not identified.", variant: "destructive"});
      return;
    }
    const scheduleId = schedule.id;
    setActionLoading(prev => ({ ...prev, [`toggle-${scheduleId}`]: true }));
    try {
      const response = await fetch(`/api/scheduled-bookings/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passengerId: user.id, isActive: !schedule.isActive }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update schedule status.');
      }
      const updatedSchedule = await response.json();
      toast({ title: "Schedule Updated", description: `Schedule "${schedule.label}" is now ${updatedSchedule.data.isActive ? 'active' : 'paused'}.` });
      setScheduledBookings(prev => prev.map(s => s.id === scheduleId ? { ...s, isActive: updatedSchedule.data.isActive, updatedAt: updatedSchedule.data.updatedAt } : s));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Update Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`toggle-${scheduleId}`]: false }));
    }
  };

  console.log("ScheduledRidesPage: Rendering with scheduledBookings state:", scheduledBookings);

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
              {scheduledBookings.map((schedule) => {
                console.log("ScheduledRidesPage: Mapping schedule item:", schedule); 
                return (
                  <Card key={schedule.id} className="shadow-md hover:shadow-lg transition-shadow p-4">
                    <CardTitle className="text-lg font-semibold">{schedule.label || "No Label"}</CardTitle>
                    <CardDescription className="text-xs">
                        ID: {schedule.id} | Status: {schedule.isActive ? "Active" : "Paused"}
                         | Next Run: {schedule.nextRunDate || "N/A"}
                    </CardDescription>
                    <CardContent className="text-sm pt-2 px-0 pb-0 space-y-1">
                        <p><strong>From:</strong> {schedule.pickupLocation?.address || "N/A"} {schedule.pickupLocation?.doorOrFlat && `(${schedule.pickupLocation.doorOrFlat})`}</p>
                        {schedule.stops && schedule.stops.length > 0 && (
                           <p><strong>Stops:</strong> {schedule.stops.map(s => `${s.address}${s.doorOrFlat ? ` (${s.doorOrFlat})` : ''}`).join('; ') || "None"}</p>
                        )}
                        <p><strong>To:</strong> {schedule.dropoffLocation?.address || "N/A"} {schedule.dropoffLocation?.doorOrFlat && `(${schedule.dropoffLocation.doorOrFlat})`}</p>
                        <p><strong>Days:</strong> {schedule.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')} at {schedule.pickupTime}</p>
                        
                        <p><strong>Vehicle:</strong> {schedule.vehicleType}</p>
                        <p><strong>Passengers:</strong> {schedule.passengers}</p>
                        {schedule.isWaitAndReturnOutbound && <p><strong>Wait & Return (Outbound):</strong> Yes, ~{schedule.estimatedWaitTimeMinutesOutbound} mins</p>}
                        {schedule.estimatedFareOneWay !== null && schedule.estimatedFareOneWay !== undefined && (
                          <p className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> <strong>Est. Outbound Fare:</strong> £{schedule.estimatedFareOneWay.toFixed(2)}</p>
                        )}


                        {schedule.isReturnJourneyScheduled && (
                            <>
                                <Separator className="my-2"/>
                                <p className="font-medium text-primary">Return Trip Details:</p>
                                <p><strong>Return From:</strong> {schedule.dropoffLocation?.address || "N/A"} {schedule.dropoffLocation?.doorOrFlat && `(${schedule.dropoffLocation.doorOrFlat})`}</p>
                                <p><strong>Return To:</strong> {schedule.pickupLocation?.address || "N/A"} {schedule.pickupLocation?.doorOrFlat && `(${schedule.pickupLocation.doorOrFlat})`}</p>
                                <p><strong>Return Time:</strong> {schedule.returnPickupTime || "N/A"}</p>
                                {schedule.estimatedFareReturn !== null && schedule.estimatedFareReturn !== undefined && (
                                  <p className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> <strong>Est. Return Fare:</strong> £{schedule.estimatedFareReturn.toFixed(2)}</p>
                                )}
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="border-t pt-3 mt-3 pb-0 px-0 flex justify-end gap-2">
                        <Button 
                            variant={schedule.isActive ? "outline" : "default"}
                            size="sm" 
                            className={`h-8 px-2 text-xs ${schedule.isActive ? 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                            onClick={() => handleToggleActive(schedule)}
                            disabled={actionLoading[`toggle-${schedule.id}`]}
                        >
                            {actionLoading[`toggle-${schedule.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : (schedule.isActive ? <Pause className="h-3 w-3 mr-1"/> : <Play className="h-3 w-3 mr-1"/>)}
                            {schedule.isActive ? 'Pause' : 'Resume'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-primary" asChild>
                            <Link href={`/dashboard/scheduled-rides/edit/${schedule.id}`}>
                                <Edit className="h-3 w-3 mr-1"/> Edit
                            </Link>
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
                );
              })}
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


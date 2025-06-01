
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, Calendar as CalendarIconLucide, MapPin, DollarSign, Loader2, AlertTriangle, Trash2, Edit, Clock } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";


interface JsonTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  bookingTimestamp?: JsonTimestamp | null;
  scheduledPickupAt?: string | null; // ISO string
  pickupLocation: { address: string };
  dropoffLocation: { address: string };
  driver?: string;
  driverAvatar?: string;
  vehicleType: string;
  fareEstimate: number;
  status: string;
  rating?: number;
  passengerName: string;
  isSurgeApplied?: boolean;
}

const formatDate = (timestamp?: JsonTimestamp | null, isoString?: string | null): string => {
  if (isoString) {
    try {
      const date = parseISO(isoString);
       if (isNaN(date.getTime())) {
        console.warn("formatDate (ISO): Created an invalid date from ISO string:", isoString);
        return 'Scheduled time N/A (Invalid ISO Date)';
      }
      return format(date, "PPPp"); // e.g., Jun 1, 2025, 1:02 AM
    } catch (e) {
      console.error("formatDate (ISO): Error parsing ISO string:", e, "from isoString:", isoString);
      return 'Scheduled time N/A (ISO Parse Error)';
    }
  }

  if (!timestamp) {
    return 'Date/Time N/A (Missing)';
  }
  if (typeof timestamp._seconds !== 'number' || typeof timestamp._nanoseconds !== 'number') {
    return 'Date/Time N/A (Bad Timestamp Structure)';
  }

  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (isNaN(date.getTime())) {
      return 'Date/Time N/A (Invalid Date Obj)';
    }
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch (e) {
    return 'Date/Time N/A (Conversion Error)';
  }
};

const editTimeFormSchema = z.object({
  desiredPickupDate: z.date().optional(),
  desiredPickupTime: z.string().optional(), // HH:mm format
}).refine(data => {
  // If one is set, the other must be set. If both are clear, it's also valid (ASAP).
  if ((data.desiredPickupDate && !data.desiredPickupTime) || (!data.desiredPickupDate && data.desiredPickupTime)) {
    return false;
  }
  return true;
}, {
  message: "Both date and time must be provided if scheduling, or both left empty for ASAP.",
  path: ["desiredPickupTime"],
});

type EditTimeFormValues = z.infer<typeof editTimeFormSchema>;


export default function MyRidesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [rideToEditTime, setRideToEditTime] = useState<Ride | null>(null);
  const [isEditTimeDialogOpen, setIsEditTimeDialogOpen] = useState(false);
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  const editTimeForm = useForm<EditTimeFormValues>({
    resolver: zodResolver(editTimeFormSchema),
    defaultValues: {
      desiredPickupDate: undefined,
      desiredPickupTime: "",
    },
  });

  useEffect(() => {
    if (user?.id) {
      const fetchRides = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/bookings/my-rides?passengerId=${user.id}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Failed to fetch rides: ${response.status}` }));
            throw new Error(errorData.details || errorData.message);
          }
          const data: Ride[] = await response.json();
          setRides(data);
        } catch (err) {
          const displayMessage = err instanceof Error ? err.message : "An unknown error occurred.";
          setError(displayMessage);
          toast({ title: "Error Fetching Rides", description: displayMessage, variant: "destructive", duration: 7000 });
        } finally {
          setIsLoading(false);
        }
      };
      fetchRides();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  const handleRateRide = (ride: Ride) => {
    setSelectedRideForRating(ride);
    setCurrentRating(ride.rating || 0);
  };

  const submitRating = async () => {
    if (!selectedRideForRating || !user) return;
    const updatedRides = rides.map(r => r.id === selectedRideForRating.id ? { ...r, rating: currentRating } : r);
    setRides(updatedRides);
    toast({ title: "Rating Submitted", description: `You rated your ride ${currentRating} stars.`});
    setSelectedRideForRating(null);
    setCurrentRating(0);
  };

  const handleOpenCancelDialog = (ride: Ride) => setRideToCancel(ride);

  const handleConfirmCancel = async () => {
    if (!rideToCancel || !user) return;
    setIsCancelling(true);
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: rideToCancel.id, passengerId: user.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Cancellation failed."}));
        throw new Error(errorData.message);
      }
      setRides(prevRides => prevRides.map(r => r.id === rideToCancel.id ? { ...r, status: 'cancelled', scheduledPickupAt: r.scheduledPickupAt } : r));
      toast({ title: "Booking Cancelled", description: "Your ride has been successfully cancelled." });
    } catch (error) {
      toast({ title: "Cancellation Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setIsCancelling(false);
      setRideToCancel(null);
    }
  };

  const handleOpenEditTimeDialog = (ride: Ride) => {
    setRideToEditTime(ride);
    if (ride.scheduledPickupAt) {
      const scheduledDate = parseISO(ride.scheduledPickupAt);
      editTimeForm.reset({
        desiredPickupDate: scheduledDate,
        desiredPickupTime: format(scheduledDate, "HH:mm"),
      });
    } else {
      editTimeForm.reset({
        desiredPickupDate: undefined,
        desiredPickupTime: "",
      });
    }
    setIsEditTimeDialogOpen(true);
  };

  async function onSubmitEditTime(values: EditTimeFormValues) {
    if (!rideToEditTime || !user) return;
    setIsUpdatingTime(true);

    let newScheduledPickupAt: string | null = null;
    if (values.desiredPickupDate && values.desiredPickupTime) {
      const [hours, minutes] = values.desiredPickupTime.split(':').map(Number);
      const combinedDateTime = new Date(values.desiredPickupDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      newScheduledPickupAt = combinedDateTime.toISOString();
    }

    try {
      const response = await fetch('/api/bookings/update-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: rideToEditTime.id,
          passengerId: user.id,
          newScheduledPickupAt: newScheduledPickupAt,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update time."}));
        throw new Error(errorData.message);
      }
      const updatedRideData = await response.json();
      setRides(prevRides => prevRides.map(r => r.id === rideToEditTime.id ? { ...r, scheduledPickupAt: updatedRideData.newScheduledPickupAt } : r));
      toast({ title: "Booking Time Updated", description: "Your pickup time has been changed." });
      setIsEditTimeDialogOpen(false);
    } catch (error) {
      toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setIsUpdatingTime(false);
    }
  }

  if (isLoading) { /* ... loading JSX ... */ }
  if (error && rides.length === 0) { /* ... error JSX ... */ }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">My Rides</CardTitle>
          <CardDescription>View your past rides, rate experiences, and manage upcoming bookings. ({rides.length} rides found)</CardDescription>
        </CardHeader>
      </Card>

      {rides.length === 0 && !isLoading && !error && ( <Card><CardContent className="pt-6 text-center text-muted-foreground">You have no rides yet.</CardContent></Card> )}
      {error && rides.length > 0 && ( <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg"><p><strong>Error:</strong> {error}</p></div> )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {rides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" /> {ride.vehicleType?.charAt(0).toUpperCase() + ride.vehicleType?.slice(1).replace(/_/g, ' ') || 'Vehicle'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm">
                    <CalendarIconLucide className="w-4 h-4" /> Booked: {formatDate(ride.bookingTimestamp)}
                  </CardDescription>
                  {ride.scheduledPickupAt && (
                    <CardDescription className="flex items-center gap-1 text-sm mt-1">
                       <Clock className="w-4 h-4 text-blue-500" /> Scheduled: {formatDate(null, ride.scheduledPickupAt)}
                    </CardDescription>
                  )}
                </div>
                <Badge
                  variant={ ride.status === 'completed' ? 'default' : ride.status === 'cancelled' ? 'destructive' : ride.status === 'in_progress' ? 'outline' : 'secondary' }
                  className={ cn(
                    ride.status === 'in_progress' && 'border-blue-500 text-blue-500',
                    ride.status === 'pending_assignment' && 'bg-yellow-400/80 text-yellow-900',
                    ride.status === 'driver_assigned' && 'bg-sky-400/80 text-sky-900',
                    ride.status === 'completed' && 'bg-green-500/80 text-green-950',
                    ride.status === 'cancelled' && 'bg-red-500/80 text-red-950'
                  )}
                >
                  {ride.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ride.driver && ( /* ... driver info ... */ )}
              {!ride.driver && ride.status !== 'completed' && ride.status !== 'cancelled' && <p className="text-sm text-muted-foreground">Waiting for driver assignment...</p>}
              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}{' '}
                  {ride.isSurgeApplied && <Badge variant="outline" className="ml-1 border-orange-500 text-orange-500">Surge</Badge>}
                </div>
              </div>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                {ride.status === 'completed' && (
                  <>
                    {ride.rating ? ( /* ... rating display ... */ ) : (
                      <Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>Rate Ride</Button>
                    )}
                  </>
                )}
                {ride.status === 'pending_assignment' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditTimeDialog(ride)} className="w-full sm:w-auto">
                      <Edit className="mr-2 h-4 w-4" /> Edit Time
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleOpenCancelDialog(ride)} className="w-full sm:w-auto">
                      <Trash2 className="mr-2 h-4 w-4" /> Cancel Ride
                    </Button>
                  </>
                )}
                {ride.status !== 'pending_assignment' && ride.status !== 'cancelled' && ride.status !== 'completed' && (
                  <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">Cannot Modify</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRideForRating && ( /* ... rating dialog ... */ )}
      
      <AlertDialog open={!!rideToCancel} onOpenChange={(open) => !open && setRideToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel this ride?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isCancelling}>Back</AlertDialogCancel><AlertDialogAction onClick={handleConfirmCancel} disabled={isCancelling} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Cancel</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rideToEditTime && (
        <Dialog open={isEditTimeDialogOpen} onOpenChange={setIsEditTimeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Pickup Time</DialogTitle>
              <DialogDescription>
                Change the desired pickup time for your ride from <span className="font-semibold">{rideToEditTime.pickupLocation.address}</span>.
                Leave both date and time empty to make it an ASAP booking.
              </DialogDescription>
            </DialogHeader>
            <Form {...editTimeForm}>
              <form onSubmit={editTimeForm.handleSubmit(onSubmitEditTime)} className="space-y-4">
                <FormField
                  control={editTimeForm.control}
                  name="desiredPickupDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>New Pickup Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              if (!date) editTimeForm.setValue("desiredPickupTime", "");
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editTimeForm.control}
                  name="desiredPickupTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Pickup Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          disabled={!editTimeForm.watch("desiredPickupDate")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isUpdatingTime}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingTime} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isUpdatingTime && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Minimal JSX for loading and error states to keep snippet short
if (isLoading) { return <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Loading...</p></div>; }
if (error && rides.length === 0) { return <div className="text-center text-destructive py-10"><AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p>Error: {error}</p></div>; }
if (selectedRideForRating) { return <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl p-6">Rating UI...</Card>;}

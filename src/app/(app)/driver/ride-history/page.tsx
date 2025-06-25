
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, CalendarDays, MapPin, DollarSign, Loader2, AlertTriangle, UserX, MessageSquare, UserCircle, ShieldX, Coins, CreditCard } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger // Make sure AlertDialogTrigger is imported
} from "@/components/ui/alert-dialog";

import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface DriverRide {
  id: string;
  displayBookingId?: string;
  originatingOperatorId?: string;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  completedAt?: SerializedTimestamp | null;
  cancelledAt?: SerializedTimestamp | null;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string; // Assuming this might be available in future
  vehicleType: string;
  fareEstimate: number;
  status: string; // e.g., 'completed', 'cancelled_by_driver', 'cancelled_by_passenger', 'cancelled_no_show'
  ratingByPassenger?: number; // Rating given by passenger to this driver for this ride
  driverRatingForPassenger?: number | null; // Rating driver gave to passenger for this ride
  paymentMethod?: "card" | "cash" | "account";
}

const formatDate = (timestamp?: SerializedTimestamp | null, isoString?: string | null): string => {
  if (isoString) {
    try {
      const date = parseISO(isoString);
      return isValid(date) ? format(date, "PPPp") : 'Scheduled N/A';
    } catch (e) { return 'Scheduled N/A'; }
  }
  if (!timestamp || typeof timestamp._seconds !== 'number') return 'Date/Time N/A';
  try {
    const date = new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    return isValid(date) ? format(date, "PPPp") : 'Invalid Date';
  } catch (e) { return 'Date Error'; }
};

interface RideChatMessage {
  id: string;
  senderId: string;
  senderRole: 'driver' | 'passenger' | 'operator';
  message: string;
  timestamp: SerializedTimestamp;
}

export default function DriverRideHistoryPage() {
  const { user: driverUser } = useAuth();
  const { toast } = useToast();
  const [ridesHistory, setRidesHistory] = useState<DriverRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingRide, setRatingRide] = useState<DriverRide | null>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [blockingPassengerId, setBlockingPassengerId] = useState<string | null>(null);
  const [rideChats, setRideChats] = useState<{ [rideId: string]: RideChatMessage[] }>({});

  useEffect(() => {
    if (!driverUser?.id || !db) return;
    setIsLoading(true);
    setError(null);
    const ridesRef = collection(db, 'rides');
    let q = query(ridesRef, where('driverId', '==', driverUser.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData: DriverRide[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const convertTS = (ts: any): SerializedTimestamp | null => {
          if (ts instanceof Timestamp) {
            return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds };
          }
          return ts || null;
        };
        return {
          id: docSnap.id,
          displayBookingId: data.displayBookingId,
          originatingOperatorId: data.originatingOperatorId,
          bookingTimestamp: convertTS(data.bookingTimestamp),
          scheduledPickupAt: data.scheduledPickupAt || null,
          completedAt: convertTS(data.completedAt),
          cancelledAt: convertTS(data.cancelledAt),
          pickupLocation: data.pickupLocation,
          dropoffLocation: data.dropoffLocation,
          stops: data.stops || [],
          passengerId: data.passengerId,
          passengerName: data.passengerName,
          passengerAvatar: data.passengerAvatar,
          vehicleType: data.vehicleType,
          fareEstimate: data.fareEstimate,
          status: data.status,
          ratingByPassenger: data.ratingByPassenger,
          driverRatingForPassenger: data.driverRatingForPassenger || null,
          paymentMethod: data.paymentMethod,
        };
      });
      setRidesHistory(ridesData);
      setIsLoading(false);
      // Fetch chat messages for each ride
      ridesData.forEach(ride => {
        const chatRef = collection(db, 'rides', ride.id, 'chatMessages');
        const chatQuery = query(chatRef, orderBy('timestamp', 'asc'));
        onSnapshot(chatQuery, (chatSnap) => {
          setRideChats(prev => ({
            ...prev,
            [ride.id]: chatSnap.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                senderId: d.senderId,
                senderRole: d.senderRole,
                message: d.message,
                timestamp: d.timestamp instanceof Timestamp ? { _seconds: d.timestamp.seconds, _nanoseconds: d.timestamp.nanoseconds } : d.timestamp
              };
            })
          }));
        });
      });
    }, (err) => {
      setError("Error loading ride history: " + err.message);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [driverUser]);

  const handleRatePassenger = (ride: DriverRide) => {
    setRatingRide(ride);
    setCurrentRating(ride.driverRatingForPassenger || 0);
  };

  const submitPassengerRating = async () => {
    if (!ratingRide || !driverUser) return;
    // Mock: Update local state and show toast
    setRidesHistory(prev => prev.map(r => r.id === ratingRide.id ? { ...r, driverRatingForPassenger: currentRating } : r));
    toast({ title: "Passenger Rating Submitted (Mock)", description: `You rated ${ratingRide.passengerName} ${currentRating} stars for ride ${ratingRide.displayBookingId || ratingRide.id}.` });
    setRatingRide(null);
    setCurrentRating(0);
    // In a real app: await api.submitPassengerRating(ratingRide.id, driverUser.id, currentRating);
  };

  const handleBlockPassenger = async (rideToBlock: DriverRide) => {
    if (!driverUser || !rideToBlock.passengerId || !rideToBlock.passengerName) {
      toast({ title: "Cannot Block", description: "Passenger information is missing for this ride.", variant: "destructive" });
      return;
    }
    setBlockingPassengerId(rideToBlock.passengerId);
    try {
      // This uses the existing user blocking API
      const response = await fetch('/api/users/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerId: driverUser.id,
          blockedId: rideToBlock.passengerId,
          blockerRole: 'driver' as UserRole, // Current user's role
          blockedRole: 'passenger' as UserRole, // Role of the user being blocked
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to block passenger. Status: ${response.status}`);
      }
      toast({ title: "Passenger Blocked", description: `${rideToBlock.passengerName} has been added to your block list.` });
      // Optionally, you might want to re-fetch ride history or update UI if it shows blocked status
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while blocking passenger.";
      toast({ title: "Blocking Failed", description: message, variant: "destructive" });
    } finally {
      setBlockingPassengerId(null);
    }
  };
  
  const getRideTerminalDate = (ride: DriverRide) => {
    if (ride.status === 'completed' && ride.completedAt) return formatDate(ride.completedAt);
    if (ride.cancelledAt) return formatDate(ride.cancelledAt);
    return formatDate(ride.bookingTimestamp, ride.scheduledPickupAt);
  };


  if (isLoading) return (<div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Ride History</CardTitle><CardDescription>Loading your past rides...</CardDescription></CardHeader></Card><div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></div>);
  if (error && ridesHistory.length === 0) return (<div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Ride History</CardTitle><CardDescription>View your completed or cancelled rides.</CardDescription></CardHeader></Card><Card className="border-destructive bg-destructive/10"><CardContent className="pt-6 text-center text-destructive"><AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p className="font-semibold">Could not load ride history.</p><p className="text-sm">{error}</p><Button variant="outline" onClick={fetchRideHistory} className="mt-4">Try Again</Button></CardContent></Card></div>);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-3xl font-headline">Ride History</CardTitle><CardDescription>Review your completed or cancelled rides. ({ridesHistory.length} found)</CardDescription></CardHeader>
      </Card>
      {ridesHistory.length === 0 && !isLoading && !error && (<Card><CardContent className="pt-6 text-center text-muted-foreground">You have no completed or cancelled rides in your history yet.</CardContent></Card>)}
      {error && ridesHistory.length > 0 && (<div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg"><p><strong>Error:</strong> {error}</p><p className="text-xs">Displaying cached or partially loaded data.</p></div>)}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {ridesHistory.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <UserCircle className="w-5 h-5 text-primary" /> {ride.passengerName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm">
                    <CalendarDays className="w-4 h-4" />
                    {getRideTerminalDate(ride)}
                  </CardDescription>
                </div>
                <Badge variant={
                    ride.status === 'completed' ? 'default' :
                    ride.status.toLowerCase().includes('cancel') ? 'destructive' : 'secondary'
                  }
                  className={cn(
                    ride.status === 'completed' && 'bg-green-500/80 text-green-950',
                    ride.status.toLowerCase().includes('cancel') && 'bg-red-500/80 text-red-950'
                  )}
                >
                  {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
              {ride.displayBookingId && <CardDescription className="text-xs mt-1">ID: {ride.displayBookingId}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => (<p key={index} className="flex items-start gap-1.5 pl-5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index+1}:</strong> {stop.address}</p>))}
                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}</div>
                {ride.paymentMethod && (
                  <div className="flex items-center gap-1.5">
                    {ride.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
                    <strong>Payment:</strong> {ride.paymentMethod === 'card' ? 'Card (Mock Paid)' : 'Cash Received'}
                  </div>
                )}
                {ride.ratingByPassenger !== undefined && ride.ratingByPassenger > 0 && (
                  <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /><strong>Passenger Rating:</strong> {ride.ratingByPassenger}/5 stars</div>
                )}
              </div>
              <Separator />
              {/* Chat History Section */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">Chat History</span>
                </div>
                {rideChats[ride.id] && rideChats[ride.id].length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 bg-muted/30">
                    {rideChats[ride.id].map(msg => (
                      <div key={msg.id} className="text-xs flex gap-2 items-start">
                        <span className={
                          msg.senderRole === 'driver' ? 'text-primary font-bold' :
                          msg.senderRole === 'passenger' ? 'text-secondary-foreground' :
                          'text-muted-foreground'
                        }>
                          {msg.senderRole.charAt(0).toUpperCase() + msg.senderRole.slice(1)}:
                        </span>
                        <span>{msg.message}</span>
                        <span className="ml-auto text-muted-foreground">{formatDate(msg.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No chat messages for this ride.</div>
                )}
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                {ride.status === 'completed' && (
                  ride.driverRatingForPassenger ? (
                    <div className="flex items-center"><p className="text-sm mr-2">You Rated:</p>{[...Array(5)].map((_, i) => (<Star key={i} className={`w-5 h-5 ${i < ride.driverRatingForPassenger! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />))}</div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleRatePassenger(ride)}>Rate Passenger</Button>
                  )
                )}
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={blockingPassengerId === ride.passengerId}
                        >
                            {blockingPassengerId === ride.passengerId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                            Block Passenger
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Block {ride.passengerName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                            Are you sure you want to block this passenger? You will not be matched with them for future rides. This action can be undone in settings.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleBlockPassenger(ride)} className="bg-destructive hover:bg-destructive/90">Block Passenger</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ratingRide && (
        <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRatingRide(null)} />
          <div className="relative bg-card rounded-lg p-6">
            <CardHeader>
              <CardTitle>Rate {ratingRide.passengerName}</CardTitle>
              <CardDescription>How was your experience with this passenger? Ride ID: {ratingRide.displayBookingId || ratingRide.id}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center space-x-1 py-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-8 h-8 cursor-pointer ${i < currentRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                  onClick={() => setCurrentRating(i + 1)}
                />
              ))}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRatingRide(null)}>Cancel</Button>
              <Button onClick={submitPassengerRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit Rating</Button>
            </CardFooter>
          </div>
        </Card>
      )}
    </div>
  );
}


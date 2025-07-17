"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, CalendarDays, MapPin, DollarSign, Loader2, AlertTriangle, UserX, MessageSquare, UserCircle, ShieldX, Coins, CreditCard, Edit } from "lucide-react";
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
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc } from 'firebase/firestore';
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

function EnhancedBlockPassengerDialog({ ride, onBlock, loading }: { ride: DriverRide, onBlock: (ride: DriverRide, reason: string) => void, loading: boolean }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const reasons = [
    '',
    'Rude behavior',
    'No show',
    'Payment issue',
    'Other',
  ];
  const isOther = reason === 'Other';
  const isValid = (reason && (reason !== 'Other' || customReason.trim().length > 2)) && confirmText === 'BLOCK';
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Block {ride.passengerName}?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to block this passenger? You will not be matched with them for future rides. This action can be undone in your profile settings.<br /><br />
          <span className="font-semibold">Please select a reason for blocking:</span>
          <select
            className="block w-full mt-2 p-2 border rounded"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            {reasons.map(r => <option key={r} value={r}>{r || 'Select a reason...'}</option>)}
          </select>
          {isOther && (
            <input
              className="block w-full mt-2 p-2 border rounded"
              type="text"
              placeholder="Enter custom reason"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
            />
          )}
          <div className="mt-4">
            <span className="font-semibold">Type <span className="bg-gray-200 px-1 rounded">BLOCK</span> to confirm:</span>
            <input
              className="block w-full mt-2 p-2 border rounded"
              type="text"
              placeholder="Type BLOCK to confirm"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={!isValid || loading}
          className="bg-red-500 hover:bg-red-600 text-white"
          onClick={() => onBlock(ride, isOther ? customReason : reason)}
        >
          {loading ? 'Blocking...' : 'Block Passenger'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
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
  const [showAccountJobsOnly, setShowAccountJobsOnly] = useState(false);

  useEffect(() => {
    if (!driverUser?.id || !db) return;
    setIsLoading(true);
    setError(null);
    const ridesRef = collection(db, 'bookings');
    const q = query(ridesRef, where('driverId', '==', driverUser.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData: DriverRide[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const convertTS = (ts: unknown): SerializedTimestamp | null => {
          if (ts instanceof Timestamp) {
            return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds };
          }
          if (ts && typeof ts === 'object' && '_seconds' in ts && '_nanoseconds' in ts) {
            return ts as SerializedTimestamp;
          }
          return null;
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
        if (!db) return;
        const chatRef = collection(db, 'bookings', ride.id, 'chatMessages');
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
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      await updateDoc(doc(db, "bookings", ratingRide.id), {
        driverRatingForPassenger: currentRating
      });
      toast({ title: "Passenger Rating Submitted", description: `You rated ${ratingRide.passengerName} ${currentRating} stars for ride ${ratingRide.displayBookingId || ratingRide.id}.` });
    } catch (err) {
      toast({ title: "Error submitting rating", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
    setRatingRide(null);
    setCurrentRating(0);
  };

  const handleBlockPassenger = async (rideToBlock: DriverRide, reason: string) => {
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
          reason: reason,
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
  if (error && ridesHistory.length === 0) return (<div className="space-y-6"><Card className="shadow-lg"><CardHeader><CardTitle className="text-3xl font-headline">Ride History</CardTitle><CardDescription>View your completed or cancelled rides.</CardDescription></CardHeader></Card><Card className="border-destructive bg-destructive/10"><CardContent className="pt-6 text-center text-destructive"><AlertTriangle className="w-12 h-12 mx-auto mb-2" /><p className="font-semibold">Could not load ride history.</p><p className="text-sm">{error}</p><Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Try Again</Button></CardContent></Card></div>);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-3xl font-headline">Ride History</CardTitle><CardDescription>Review your completed or cancelled rides. ({ridesHistory.length} found)</CardDescription></CardHeader>
        <CardContent>
          <Button
            variant={showAccountJobsOnly ? "default" : "outline"}
            className="mb-2"
            onClick={() => setShowAccountJobsOnly(v => !v)}
          >
            {showAccountJobsOnly ? "Show All Rides" : "Show Only Account Jobs"}
          </Button>
        </CardContent>
      </Card>
      {ridesHistory.length === 0 && !isLoading && !error && (<Card><CardContent className="pt-6 text-center text-muted-foreground">You have no completed or cancelled rides in your history yet.</CardContent></Card>)}
      {error && ridesHistory.length > 0 && (<div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md shadow-lg"><p><strong>Error:</strong> {error}</p><p className="text-xs">Displaying cached or partially loaded data.</p></div>)}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {(showAccountJobsOnly ? ridesHistory.filter(r => r.paymentMethod === 'account') : ridesHistory).map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold">{ride.passengerName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    <CalendarDays className="inline w-4 h-4 mr-1" />
                    {getRideTerminalDate(ride)}
                  </span>
                </div>
                <Badge variant={ride.status === 'completed' ? 'default' : 'destructive'}>
                  {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground pl-10 pb-2">
                Booked: {formatDate(ride.bookingTimestamp, ride.scheduledPickupAt) || 'N/A'} |
                Picked up: N/A |
                Drop off: {formatDate(ride.completedAt) || 'N/A'}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>From:</strong> {ride.pickupLocation.address}</p>
                {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, index) => (<p key={index} className="flex items-start gap-1.5 pl-5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>Stop {index+1}:</strong> {stop.address}</p>))}
                <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <strong>To:</strong> {ride.dropoffLocation.address}</p>
                <div className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-muted-foreground" /><strong>Fare:</strong> £{ride.fareEstimate.toFixed(2)}</div>
                {ride.paymentMethod && (
                  <div className="flex items-center gap-1.5">
                    {ride.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : ride.paymentMethod === 'account' ? <UserCircle className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
                    <strong>Payment:</strong> {ride.paymentMethod === 'card' ? 'Card (Mock Paid)' : ride.paymentMethod === 'account' ? 'Account Job' : 'Cash Received'}
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
                    <button
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow flex items-center gap-2"
                      onClick={() => handleRatePassenger(ride)}
                    >
                      <span>You rated this passenger</span>
                      <span className="flex items-center ml-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < (ride.driverRatingForPassenger || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </span>
                      <Edit className="w-3 h-3 ml-1" />
                    </button>
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
                  <EnhancedBlockPassengerDialog ride={ride} onBlock={handleBlockPassenger} loading={blockingPassengerId === ride.passengerId} />
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


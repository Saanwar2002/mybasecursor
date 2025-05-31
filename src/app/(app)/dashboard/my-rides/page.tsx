
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Car, Calendar, MapPin, DollarSign, MessageSquare } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

interface Ride {
  id: string;
  date: string;
  pickup: string;
  dropoff: string;
  driver: string;
  driverAvatar: string;
  vehicle: string;
  fare: number;
  status: 'Completed' | 'Cancelled';
  rating?: number;
}

const mockRides: Ride[] = [
  { id: '1', date: '2023-10-25', pickup: '123 Main St, London', dropoff: 'Central Park, London', driver: 'John Doe', driverAvatar: 'https://placehold.co/40x40.png?text=JD', vehicle: 'Toyota Prius', fare: 25.50, status: 'Completed', rating: 5 },
  { id: '2', date: '2023-10-22', pickup: 'Airport Terminal B, London', dropoff: 'Grand Hotel, London', driver: 'Jane Smith', driverAvatar: 'https://placehold.co/40x40.png?text=JS', vehicle: 'Honda CRV', fare: 42.00, status: 'Completed' },
  { id: '3', date: '2023-10-20', pickup: 'Downtown Mall, London', dropoff: 'Residential Area, London', driver: 'Mike Brown', driverAvatar: 'https://placehold.co/40x40.png?text=MB', vehicle: 'Ford Transit', fare: 18.75, status: 'Cancelled' },
];

export default function MyRidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [currentRating, setCurrentRating] = useState(0);

  useEffect(() => {
    setRides(mockRides);
  }, []);

  const handleRateRide = (ride: Ride) => {
    setSelectedRide(ride);
    setCurrentRating(ride.rating || 0);
  };

  const submitRating = () => {
    if (selectedRide) {
      const updatedRides = rides.map(r => 
        r.id === selectedRide.id ? { ...r, rating: currentRating } : r
      );
      setRides(updatedRides);
      setSelectedRide(null);
      setCurrentRating(0);
      // Add toast notification for successful rating
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">My Rides</CardTitle>
          <CardDescription>View your past rides and provide ratings.</CardDescription>
        </CardHeader>
      </Card>

      {rides.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You have no past rides yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {rides.map((ride) => (
          <Card key={ride.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" /> {ride.vehicle}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-sm">
                    <Calendar className="w-4 h-4" /> {ride.date}
                  </CardDescription>
                </div>
                <Badge variant={ride.status === 'Completed' ? 'default' : 'destructive'}>
                  {ride.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Image src={ride.driverAvatar} alt={ride.driver} width={40} height={40} className="rounded-full" data-ai-hint="avatar driver" />
                <div>
                  <p className="font-medium">{ride.driver}</p>
                  <p className="text-xs text-muted-foreground">Driver</p>
                </div>
              </div>
              <Separator />
              <div className="text-sm space-y-1">
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>From:</strong> {ride.pickup}</p>
                <p className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> <strong>To:</strong> {ride.dropoff}</p>
                <p className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /> <strong>Fare:</strong> £{ride.fare.toFixed(2)}</p>
              </div>
              {ride.status === 'Completed' && (
                <div className="pt-2">
                  {ride.rating ? (
                    <div className="flex items-center">
                      <p className="text-sm mr-2">Your Rating:</p>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < ride.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleRateRide(ride)}>
                      Rate Ride
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRide && (
        <Card className="fixed inset-0 m-auto w-full max-w-md h-fit z-50 shadow-xl">
           <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRide(null)} />
           <div className="relative bg-card rounded-lg p-6">
            <CardHeader>
              <CardTitle>Rate your ride with {selectedRide.driver}</CardTitle>
              <CardDescription>{selectedRide.date} - {selectedRide.pickup} to {selectedRide.dropoff}</CardDescription>
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
              <Button variant="ghost" onClick={() => setSelectedRide(null)}>Cancel</Button>
              <Button onClick={submitRating} className="bg-primary hover:bg-primary/90 text-primary-foreground">Submit Rating</Button>
            </CardFooter>
          </div>
        </Card>
      )}
    </div>
  );
}

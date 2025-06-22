"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[400px] rounded-md" />,
});

const mockTaxiBases = [
  { position: { lat: 53.6450, lng: -1.7830 }, name: 'City Cabs' },
  { position: { lat: 53.6480, lng: -1.7780 }, name: 'Speedy Taxis' },
  { position: { lat: 53.6500, lng: -1.7800 }, name: 'Huddersfield Cars' },
  { position: { lat: 53.6420, lng: -1.7850 }, name: 'Town Taxis' },
  { position: { lat: 53.6400, lng: -1.7900 }, name: 'Metro Cars' },
];

export default function GuestPassengerPage() {
  const [bookingPreference, setBookingPreference] = useState('find_driver');
  const router = useRouter();

  const handleBookRideClick = () => {
    if (bookingPreference === 'find_driver') {
      router.push('/dashboard/book-ride');
    } else {
      // Logic for choosing a specific taxi base can be added here
      // For now, it will also redirect to the book-ride page
      router.push('/dashboard/book-ride');
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl font-bold">Welcome, Guest Passenger!</h1>
        <p className="text-muted-foreground">Manage your rides and explore MyBase features.</p>
      </div>

      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
        <CardContent className="pt-6">
          <p className="text-blue-800 dark:text-blue-200">
            Ride with confidence! MyBase ensures your driver receives 100% of the fare and any tips you give. We take no commission from their earnings on your journey.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Preference</CardTitle>
          <CardDescription>How would you like to book your next ride?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={bookingPreference} 
            onValueChange={setBookingPreference}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="find_driver" id="find_driver" />
              <Label htmlFor="find_driver" className="cursor-pointer">Let MyBase App Find Me Driver</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="choose_base" id="choose_base" />
              <Label htmlFor="choose_base" className="cursor-pointer">Choose a specific Taxi Base</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Button 
        onClick={handleBookRideClick}
        className="w-full text-lg py-6 bg-primary hover:bg-primary/90"
      >
        Book a New Ride
      </Button>

      <div className="h-[400px] w-full rounded-lg overflow-hidden border">
        <GoogleMapDisplay
          center={{ lat: 53.6450, lng: -1.7830 }}
          zoom={13}
          markers={mockTaxiBases.map(base => ({
            position: base.position,
            title: base.name,
          }))}
          disableDefaultUI={true}
          mapId="e9d24f2b3e5d0f1"
        />
      </div>
    </div>
  );
} 
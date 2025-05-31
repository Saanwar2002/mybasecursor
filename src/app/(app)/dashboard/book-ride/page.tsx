"use client";

import { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Car, DollarSign, Users, Briefcase } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

const bookingFormSchema = z.object({
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  vehicleType: z.enum(["sedan", "suv", "van", "luxury"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
});

export default function BookRidePage() {
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      vehicleType: "sedan",
      passengers: 1,
    },
  });

  function onSubmit(values: z.infer<typeof bookingFormSchema>) {
    // Simulate fare calculation
    const baseFare = 5;
    const distanceFare = Math.random() * 20 + 5; // Random distance component
    let vehicleMultiplier = 1;
    if (values.vehicleType === "suv") vehicleMultiplier = 1.5;
    if (values.vehicleType === "van") vehicleMultiplier = 2;
    if (values.vehicleType === "luxury") vehicleMultiplier = 3;
    
    const calculatedFare = baseFare + distanceFare * vehicleMultiplier * (1 + (values.passengers -1) * 0.1);
    setFareEstimate(parseFloat(calculatedFare.toFixed(2)));

    toast({
      title: "Ride Details Submitted",
      description: "Checking for available taxis and calculating fare...",
    });
  }

  const handleConfirmBooking = () => {
    toast({
      title: "Booking Confirmed!",
      description: `Your ride is confirmed. Estimated fare: $${fareEstimate}. A driver will be assigned shortly.`,
      variant: "default",
    });
    // Reset form or navigate away
    form.reset();
    setFareEstimate(null);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><Car className="w-8 h-8 text-primary" /> Book Your Ride</CardTitle>
          <CardDescription>Enter your pickup and drop-off details to find a taxi.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="pickupLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Pickup Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123 Main St, Anytown" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dropoffLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Drop-off Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 456 Market Ave, Anytown" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Car className="w-4 h-4 text-muted-foreground" /> Vehicle Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sedan">Sedan (Standard)</SelectItem>
                            <SelectItem value="suv">SUV (More space)</SelectItem>
                            <SelectItem value="van">Van (Large group)</SelectItem>
                            <SelectItem value="luxury">Luxury (Premium)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passengers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /> Number of Passengers</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="10" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <DollarSign className="mr-2 h-4 w-4" /> Get Fare Estimate
                  </Button>
                </form>
              </Form>
            </div>
            <div className="flex flex-col items-center justify-center bg-muted/50 p-6 rounded-lg">
              <Image src="https://placehold.co/600x400.png" data-ai-hint="map taxi route" alt="Map placeholder" width={600} height={400} className="rounded-md shadow-md mb-6 w-full" />
              {fareEstimate !== null && (
                <Card className="w-full text-center shadow-md">
                  <CardHeader>
                    <CardTitle className="text-2xl font-headline">Fare Estimate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-accent">${fareEstimate}</p>
                    <p className="text-sm text-muted-foreground mt-1">This is an estimated fare. Actual fare may vary.</p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={handleConfirmBooking} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Briefcase className="mr-2 h-4 w-4" /> Confirm Booking
                    </Button>
                  </CardFooter>
                </Card>
              )}
              {fareEstimate === null && (
                 <p className="text-muted-foreground">Enter details to see your fare estimate here.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

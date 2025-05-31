
"use client";

import { useState, useEffect } from 'react';
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
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const MapDisplay = dynamic(() => import('@/components/ui/map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-md" />,
});

const bookingFormSchema = z.object({
  pickupLocation: z.string().min(3, { message: "Pickup location is required." }),
  dropoffLocation: z.string().min(3, { message: "Drop-off location is required." }),
  vehicleType: z.enum(["sedan", "suv", "van", "luxury"], { required_error: "Please select a vehicle type." }),
  passengers: z.coerce.number().min(1, "At least 1 passenger.").max(10, "Max 10 passengers."),
});

const defaultMapCenter: [number, number] = [51.5074, -0.1278];

const mockAddresses: string[] = [
  "10 Downing Street, Westminster, London, SW1A 2AA",
  "Buckingham Palace, Westminster, London, SW1A 1AA",
  "Tower of London, Tower Hamlets, London, EC3N 4AB",
  "The Shard, 32 London Bridge St, Southwark, London, SE1 9SG",
  "Piccadilly Circus, Westminster, London, W1J 9HS",
  "Old Trafford, Sir Matt Busby Way, Trafford, Manchester, M16 0RA",
  "Anfield, Anfield Rd, Liverpool, L4 0TH",
  "Edinburgh Castle, Castlehill, Edinburgh, EH1 2NG",
  "350 Fifth Avenue, New York, NY 10118, USA",
  "Westfield Stratford City, Montfichet Rd, London, E20 1EJ",
  "Canary Wharf Station, London, E14 5LR",
  "Heathrow Airport Terminal 5, Hounslow, TW6 2GA",
  "Gatwick Airport South Terminal, Horley, Gatwick, RH6 0NP",
  "Kings Cross Station, Euston Rd, London, N1 9AL",
  "Paddington Station, Praed St, London, W2 1HQ"
];


export default function BookRidePage() {
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const { toast } = useToast();
  const [mapMarkers, setMapMarkers] = useState<Array<{ position: [number, number]; popupText?: string }>>([]);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickupLocation: "",
      dropoffLocation: "",
      vehicleType: "sedan",
      passengers: 1,
    },
  });

  // State for pickup autocomplete
  const [pickupInputValue, setPickupInputValue] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<string[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);

  // State for dropoff autocomplete
  const [dropoffInputValue, setDropoffInputValue] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState<string[]>([]);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);

  const handleAddressInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldOnChange: (...event: any[]) => void,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setSuggestionsState: React.Dispatch<React.SetStateAction<string[]>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const value = e.target.value;
    setInputValueState(value);
    fieldOnChange(value); // Update react-hook-form state
    if (value.length > 1) {
      setSuggestionsState(
        mockAddresses.filter(addr => addr.toLowerCase().includes(value.toLowerCase()))
      );
      setShowSuggestionsState(true);
    } else {
      setShowSuggestionsState(false);
      setSuggestionsState([]);
    }
  };

  const handleSuggestionClick = (
    address: string,
    fieldOnChange: (...event: any[]) => void,
    setInputValueState: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setInputValueState(address);
    fieldOnChange(address); // Update react-hook-form state
    setShowSuggestionsState(false);
  };


  function onSubmit(values: z.infer<typeof bookingFormSchema>) {
    const baseFare = 5;
    const distanceFare = Math.random() * 20 + 5; 
    let vehicleMultiplier = 1;
    if (values.vehicleType === "suv") vehicleMultiplier = 1.5;
    if (values.vehicleType === "van") vehicleMultiplier = 2;
    if (values.vehicleType === "luxury") vehicleMultiplier = 3;
    
    const calculatedFare = baseFare + distanceFare * vehicleMultiplier * (1 + (values.passengers -1) * 0.1);
    setFareEstimate(parseFloat(calculatedFare.toFixed(2)));

    const newMarkers = [
        { position: [defaultMapCenter[0] + 0.01, defaultMapCenter[1] + 0.01] as [number, number], popupText: `Pickup: ${values.pickupLocation}` },
        { position: [defaultMapCenter[0] - 0.01, defaultMapCenter[1] - 0.01] as [number, number], popupText: `Dropoff: ${values.dropoffLocation}` }
    ];
    setMapMarkers(newMarkers);

    toast({
      title: "Ride Details Submitted",
      description: "Checking for available taxis and calculating fare...",
    });
  }

  const handleConfirmBooking = () => {
    toast({
      title: "Booking Confirmed!",
      description: `Your ride is confirmed. Estimated fare: £${fareEstimate}. A driver will be assigned shortly.`,
      variant: "default",
    });
    form.reset();
    setPickupInputValue("");
    setDropoffInputValue("");
    setFareEstimate(null);
    setMapMarkers([]);
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
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="Type pickup address, e.g., 123 Main St"
                              {...field} // Spread field to pass ref, name, onBlur
                              value={pickupInputValue} // Control input with local state
                              onChange={(e) => handleAddressInputChange(e, field.onChange, setPickupInputValue, setPickupSuggestions, setShowPickupSuggestions)}
                              onFocus={() => {
                                if (pickupInputValue.length > 1 && pickupSuggestions.length > 0) {
                                    setShowPickupSuggestions(true);
                                }
                              }}
                              // Delay onBlur to allow click on suggestion
                              onBlur={() => { field.onBlur(); setTimeout(() => setShowPickupSuggestions(false), 150);}}
                            />
                          </FormControl>
                          {showPickupSuggestions && pickupSuggestions.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {pickupSuggestions.map((suggestion, index) => (
                                <div
                                  key={`pickup-${index}`}
                                  className="p-2 text-sm hover:bg-muted cursor-pointer"
                                  onMouseDown={() => handleSuggestionClick(suggestion, field.onChange, setPickupInputValue, setShowPickupSuggestions)}
                                >
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="Type drop-off address, e.g., 456 Market Ave"
                              {...field} // Spread field to pass ref, name, onBlur
                              value={dropoffInputValue} // Control input with local state
                              onChange={(e) => handleAddressInputChange(e, field.onChange, setDropoffInputValue, setDropoffSuggestions, setShowDropoffSuggestions)}
                               onFocus={() => {
                                if (dropoffInputValue.length > 1 && dropoffSuggestions.length > 0) {
                                    setShowDropoffSuggestions(true);
                                }
                              }}
                              // Delay onBlur to allow click on suggestion
                              onBlur={() => { field.onBlur(); setTimeout(() => setShowDropoffSuggestions(false), 150);}}
                            />
                          </FormControl>
                          {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {dropoffSuggestions.map((suggestion, index) => (
                                <div
                                  key={`dropoff-${index}`}
                                  className="p-2 text-sm hover:bg-muted cursor-pointer"
                                  onMouseDown={() => handleSuggestionClick(suggestion, field.onChange, setDropoffInputValue, setShowDropoffSuggestions)}
                                >
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
            <div className="flex flex-col items-center justify-center bg-muted/50 p-2 md:p-6 rounded-lg min-h-[300px] md:min-h-[400px]">
              <div className="w-full h-64 md:h-80 mb-6">
                <MapDisplay center={defaultMapCenter} zoom={12} markers={mapMarkers} className="w-full h-full" />
              </div>
              {fareEstimate !== null && (
                <Card className="w-full text-center shadow-md">
                  <CardHeader>
                    <CardTitle className="text-2xl font-headline">Fare Estimate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-accent">£{fareEstimate}</p>
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


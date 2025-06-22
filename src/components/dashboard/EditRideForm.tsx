"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";
import type { ActiveRide, LocationPoint } from "@/app/(app)/dashboard/track-ride/page";
import { useGoogleMaps } from "@/contexts/google-maps/google-maps-provider";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  pickupLocation: z.object({
    address: z.string().min(5, "Pickup address is required."),
    latitude: z.number(),
    longitude: z.number(),
  }),
  dropoffLocation: z.object({
    address: z.string().min(5, "Dropoff address is required."),
    latitude: z.number(),
    longitude: z.number(),
  }),
  driverNotes: z.string().optional(),
});

export type EditRideFormValues = z.infer<typeof formSchema>;

interface EditRideFormProps {
  initialData: ActiveRide;
  onSubmit: (values: EditRideFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function EditRideForm({ initialData, onSubmit, isSubmitting }: EditRideFormProps) {
  const { isLoaded, google } = useGoogleMaps();
  const form = useForm<EditRideFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pickupLocation: initialData.pickupLocation,
      dropoffLocation: initialData.dropoffLocation,
      driverNotes: initialData.driverNotes || "",
    },
  });

  const [pickupSuggestions, setPickupSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (isLoaded && google) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      placesService.current = new google.maps.places.PlacesService(document.createElement("div"));
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, [isLoaded, google]);

  const getSuggestions = useCallback((input: string, callback: (predictions: google.maps.places.AutocompletePrediction[]) => void) => {
    if (!autocompleteService.current || !input) {
      callback([]);
      return;
    }
    autocompleteService.current.getPlacePredictions({
      input,
      sessionToken: sessionToken.current!,
      componentRestrictions: { country: "gb" },
    }, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        callback(predictions);
      } else {
        callback([]);
      }
    });
  }, [google]);

  const handleSelectSuggestion = (
    prediction: google.maps.places.AutocompletePrediction,
    field: 'pickupLocation' | 'dropoffLocation',
    clearSuggestions: () => void
  ) => {
    if (!placesService.current) return;
    placesService.current.getDetails({
      placeId: prediction.place_id,
      fields: ['name', 'formatted_address', 'geometry.location'],
      sessionToken: sessionToken.current!,
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const location: LocationPoint = {
          address: place.formatted_address || prediction.description,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        };
        form.setValue(field, location, { shouldValidate: true });
        clearSuggestions();
        // Renew the session token after it's used
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <FormField
              control={form.control}
              name="pickupLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pickup Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="e.g., 123 Main St, Anytown"
                        {...field}
                        value={field.value.address}
                        onChange={(e) => {
                          field.onChange({ ...field.value, address: e.target.value });
                          getSuggestions(e.target.value, setPickupSuggestions);
                        }}
                        onBlur={() => setTimeout(() => setPickupSuggestions([]), 200)}
                        autoComplete="off"
                      />
                      {pickupSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                          {pickupSuggestions.map((p) => (
                            <div
                              key={p.place_id}
                              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                              onMouseDown={() => handleSelectSuggestion(p, 'pickupLocation', () => setPickupSuggestions([]))}
                            >
                               <MapPin className="w-4 h-4 text-gray-500" />
                               <span>{p.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                  <FormLabel>Drop-off Address</FormLabel>
                   <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="e.g., 456 Oak Ave, Otherville"
                        {...field}
                        value={field.value.address}
                        onChange={(e) => {
                          field.onChange({ ...field.value, address: e.target.value });
                          getSuggestions(e.target.value, setDropoffSuggestions);
                        }}
                        onBlur={() => setTimeout(() => setDropoffSuggestions([]), 200)}
                         autoComplete="off"
                      />
                      {dropoffSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                          {dropoffSuggestions.map((p) => (
                            <div
                              key={p.place_id}
                              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                              onMouseDown={() => handleSelectSuggestion(p, 'dropoffLocation', () => setDropoffSuggestions([]))}
                            >
                               <MapPin className="w-4 h-4 text-gray-500" />
                               <span>{p.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="driverNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes for Driver (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 'Call upon arrival', 'Apartment #5'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isLoaded}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
} 
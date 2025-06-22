"use client";

import { useAuth } from "@/contexts/auth-context";
import { useGoogleMaps } from "@/contexts/google-maps/google-maps-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, PlusCircle, Trash2, Loader2, AlertTriangle, Tag, Star } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface FavoriteLocation {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt?: { _seconds: number; _nanoseconds: number };
}

const favoriteLocationFormSchema = z.object({
  label: z.string().min(1, { message: "Label is required." }).max(50, { message: "Label too long."}),
  address: z.string().min(3, { message: "Address is required." }),
});

export default function FavoriteLocationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isLoaded: isGoogleMapsLoaded, 
    loadError: googleMapsLoadError,
    autocompleteService,
    placesService,
    createSessionToken 
  } = useGoogleMaps();

  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [errorFavorites, setErrorFavorites] = useState<string | null>(null);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);
  const [isRemovingFavorite, setIsRemovingFavorite] = useState<string | null>(null);

  const [newFavLocationAddress, setNewFavLocationAddress] = useState("");
  const [newFavLocationSuggestions, setNewFavLocationSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showNewFavLocationSuggestions, setShowNewFavLocationSuggestions] = useState(false);
  const [isFetchingNewFavLocationSuggestions, setIsFetchingNewFavLocationSuggestions] = useState(false);
  const [isFetchingNewFavLocationDetails, setIsFetchingNewFavLocationDetails] = useState(false);
  const [newFavLocationCoords, setNewFavLocationCoords] = useState<google.maps.LatLngLiteral | null>(null);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  const favoriteForm = useForm<z.infer<typeof favoriteLocationFormSchema>>({
    resolver: zodResolver(favoriteLocationFormSchema),
    defaultValues: {
      label: "",
      address: "",
    },
  });

  useEffect(() => {
    if (isGoogleMapsLoaded && !autocompleteSessionTokenRef.current) {
      autocompleteSessionTokenRef.current = createSessionToken();
    }
  }, [isGoogleMapsLoaded, createSessionToken]);
  
  useEffect(() => {
    if (googleMapsLoadError) {
      toast({
        title: "Map Service Error",
        description: "Address search functionality failed to load.",
        variant: "destructive"
      });
    }
  }, [googleMapsLoadError, toast]);

  const fetchFavoriteLocations = useCallback(async () => {
    if (!user) return;
    setIsLoadingFavorites(true);
    setErrorFavorites(null);
    try {
      const response = await fetch(`/api/users/favorite-locations/list?userId=${user.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch favorites: ${response.status}`);
      }
      const data: FavoriteLocation[] = await response.json();
      setFavoriteLocations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setErrorFavorites(message);
      toast({ title: "Error Fetching Favorites", description: message, variant: "destructive" });
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchFavoriteLocations();
  }, [fetchFavoriteLocations]);

  const fetchAddressSuggestions = useCallback((
    inputValue: string,
    setSuggestionsFunc: (suggestions: google.maps.places.AutocompletePrediction[]) => void,
    setIsFetchingFunc: (isFetching: boolean) => void
  ) => {
    if (!autocompleteService || inputValue.length < 2) {
      setSuggestionsFunc([]);
      setIsFetchingFunc(false);
      return;
    }
    setIsFetchingFunc(true);
    autocompleteService.getPlacePredictions(
      { input: inputValue, sessionToken: autocompleteSessionTokenRef.current, componentRestrictions: { country: 'gb' } },
      (predictions, status) => {
        setIsFetchingFunc(false);
        if (isGoogleMapsLoaded && status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestionsFunc(predictions);
        } else {
          setSuggestionsFunc([]);
        }
      }
    );
  }, [autocompleteService, isGoogleMapsLoaded]);

  const handleNewFavAddressInputChange = (inputValue: string, formOnChange: (value: string) => void) => {
    formOnChange(inputValue);
    setNewFavLocationAddress(inputValue);
    setNewFavLocationCoords(null);
    setShowNewFavLocationSuggestions(inputValue.length >= 2);
    if (inputValue.length >= 2) {
      setIsFetchingNewFavLocationSuggestions(true);
      setNewFavLocationSuggestions([]);
    } else {
      setIsFetchingNewFavLocationSuggestions(false);
      setNewFavLocationSuggestions([]);
    }

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (inputValue.length < 2) return;

    debounceTimeoutRef.current = setTimeout(() => {
      fetchAddressSuggestions(inputValue, setNewFavLocationSuggestions, setIsFetchingNewFavLocationSuggestions);
    }, 300);
  };

  const handleNewFavSuggestionClick = (suggestion: google.maps.places.AutocompletePrediction, formOnChange: (value: string) => void) => {
    const addressText = suggestion?.description;
    if (!addressText) return;
    formOnChange(addressText);
    setNewFavLocationAddress(addressText);
    setShowNewFavLocationSuggestions(false);
    setIsFetchingNewFavLocationDetails(true);

    if (placesService && suggestion.place_id) {
      placesService.getDetails(
        { placeId: suggestion.place_id, fields: ['geometry.location'], sessionToken: autocompleteSessionTokenRef.current },
        (place, status) => {
          setIsFetchingNewFavLocationDetails(false);
          if (isGoogleMapsLoaded && status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setNewFavLocationCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
            toast({ title: "Location Selected", description: `${addressText} coordinates captured.`});
          } else {
            setNewFavLocationCoords(null);
            toast({ title: "Error", description: "Could not get location details. Please try again.", variant: "destructive"});
          }
          autocompleteSessionTokenRef.current = createSessionToken();
        }
      );
    } else {
      setIsFetchingNewFavLocationDetails(false);
      setNewFavLocationCoords(null);
      toast({ title: "Warning", description: "Could not fetch location details (no Place ID/service).", variant: "default" });
    }
  };

  const handleNewFavFocus = () => {
    if (newFavLocationAddress.length >= 2 && newFavLocationSuggestions.length > 0) {
        setShowNewFavLocationSuggestions(true);
    } else if (newFavLocationAddress.length >= 2 && autocompleteService) {
        fetchAddressSuggestions(newFavLocationAddress, setNewFavLocationSuggestions, setIsFetchingNewFavLocationSuggestions);
        setShowNewFavLocationSuggestions(true);
    } else {
        setShowNewFavLocationSuggestions(false);
    }
  };
  const handleNewFavBlur = () => { setTimeout(() => setShowNewFavLocationSuggestions(false), 150); };

  async function handleAddFavoriteLocation(values: z.infer<typeof favoriteLocationFormSchema>) {
    if (!user || !newFavLocationCoords) {
      toast({ title: "Error", description: "User not found or address not fully selected from suggestions.", variant: "destructive" });
      return;
    }
    setIsAddingFavorite(true);
    try {
      const response = await fetch('/api/users/favorite-locations/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          label: values.label,
          address: values.address, 
          latitude: newFavLocationCoords.lat,
          longitude: newFavLocationCoords.lng,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add favorite.');
      }
      const newFavorite = await response.json();
      setFavoriteLocations(prev => [{ 
        id: newFavorite.id, 
        label: newFavorite.data.label,
        address: newFavorite.data.address,
        latitude: newFavorite.data.latitude,
        longitude: newFavorite.data.longitude,
        createdAt: newFavorite.data.createdAt ? { 
            _seconds: Math.floor(new Date(newFavorite.data.createdAt).getTime() / 1000),
            _nanoseconds: (new Date(newFavorite.data.createdAt).getTime() % 1000) * 1000000
        } : undefined
      }, ...prev]);
      toast({ title: "Favorite Added!", description: `${values.label} saved.` });
      favoriteForm.reset();
      setNewFavLocationAddress("");
      setNewFavLocationCoords(null);
      setNewFavLocationSuggestions([]);
    } catch (error) {
      toast({ title: "Failed to Add Favorite", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setIsAddingFavorite(false);
    }
  }

  async function handleRemoveFavoriteLocation(favId: string) {
    if (!user) return;
    setIsRemovingFavorite(favId);
    try {
      const response = await fetch(`/api/users/favorite-locations/remove?id=${favId}&userId=${user.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove favorite.');
      }
      setFavoriteLocations(prev => prev.filter(fav => fav.id !== favId));
      toast({ title: "Favorite Removed", description: "The location has been removed." });
    } catch (error) {
      toast({ title: "Failed to Remove Favorite", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setIsRemovingFavorite(null);
    }
  }
  
  const renderNewFavLocationSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    isFetchingSugg: boolean, isFetchingDet: boolean, inputValue: string,
    onSuggClick: (suggestion: google.maps.places.AutocompletePrediction) => void
  ) => (
    <div className="absolute z-20 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
      {isFetchingSugg && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>}
      {isFetchingDet && <div className="p-2 text-sm text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</div>}
      {!isFetchingSugg && !isFetchingDet && suggestions.length === 0 && inputValue.length >= 2 && <div className="p-2 text-sm text-muted-foreground">No suggestions.</div>}
      {!isFetchingSugg && !isFetchingDet && suggestions.map((s) => (
        <div key={s.place_id} className="p-2 text-sm hover:bg-muted cursor-pointer" onMouseDown={() => onSuggClick(s)}>{s.description}</div>
      ))}
    </div>
  );

  if (!user) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Star className="w-8 h-8 text-primary" /> Favorite Locations
          </CardTitle>
          <CardDescription>Manage your saved addresses for faster booking.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2"><PlusCircle className="w-6 h-6 text-accent" /> Add New Favorite</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...favoriteForm}>
            <form onSubmit={favoriteForm.handleSubmit(handleAddFavoriteLocation)} className="space-y-4">
              <FormField control={favoriteForm.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Tag className="w-4 h-4" /> Label (e.g., Home, Work)</FormLabel>
                  <FormControl><Input placeholder="My Office" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={favoriteForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Address</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        placeholder="Start typing an address..."
                        {...field}
                        value={newFavLocationAddress}
                        onChange={(e) => handleNewFavAddressInputChange(e.target.value, field.onChange)}
                        onFocus={handleNewFavFocus}
                        onBlur={handleNewFavBlur}
                        autoComplete="off"
                      />
                    </FormControl>
                    {showNewFavLocationSuggestions && renderNewFavLocationSuggestions(
                        newFavLocationSuggestions,
                        isFetchingNewFavLocationSuggestions,
                        isFetchingNewFavLocationDetails,
                        newFavLocationAddress,
                        (sugg) => handleNewFavSuggestionClick(sugg, field.onChange)
                    )}
                  </div>
                  <FormDescription>
                    If autocomplete doesn't provide a door number, please add it manually for accuracy.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={isAddingFavorite || !newFavLocationCoords || isFetchingNewFavLocationDetails} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isAddingFavorite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add to Favorites
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline">Your Saved Favorites</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingFavorites && <div className="flex items-center justify-center py-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading your favorites...</div>}
          {errorFavorites && <div className="text-red-600 flex items-center gap-2 p-3 bg-red-50 rounded-md"><AlertTriangle className="w-5 h-5"/> Error: {errorFavorites}</div>}
          
          {!isLoadingFavorites && !errorFavorites && favoriteLocations.length === 0 && (
            <p className="text-muted-foreground text-center py-4">You haven't added any favorite locations yet.</p>
          )}

          {!isLoadingFavorites && !errorFavorites && favoriteLocations.length > 0 && (
            <div className="space-y-3">
              {favoriteLocations.map(fav => (
                <Card key={fav.id} className="p-4 flex justify-between items-center bg-card hover:shadow-md transition-shadow">
                  <div>
                    <p className="font-semibold text-primary flex items-center gap-1"><Tag className="w-4 h-4 text-primary/80"/>{fav.label}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/>{fav.address}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveFavoriteLocation(fav.id)}
                    disabled={isRemovingFavorite === fav.id}
                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90"
                    aria-label={`Remove ${fav.label}`}
                  >
                    {isRemovingFavorite === fav.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


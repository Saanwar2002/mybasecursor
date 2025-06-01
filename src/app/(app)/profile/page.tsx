
"use client";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, MapPin, PlusCircle, Trash2, Loader2, AlertTriangle, Tag } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader } from '@googlemaps/js-api-loader';

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

export default function ProfilePage() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.role === 'driver' ? "555-0101" : "");

  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [errorFavorites, setErrorFavorites] = useState<string | null>(null);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);
  const [isRemovingFavorite, setIsRemovingFavorite] = useState<string | null>(null); // Store ID of favorite being removed

  // Autocomplete state for new favorite location
  const [newFavLocationAddress, setNewFavLocationAddress] = useState("");
  const [newFavLocationSuggestions, setNewFavLocationSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showNewFavLocationSuggestions, setShowNewFavLocationSuggestions] = useState(false);
  const [isFetchingNewFavLocationSuggestions, setIsFetchingNewFavLocationSuggestions] = useState(false);
  const [isFetchingNewFavLocationDetails, setIsFetchingNewFavLocationDetails] = useState(false);
  const [newFavLocationCoords, setNewFavLocationCoords] = useState<google.maps.LatLngLiteral | null>(null);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  const favoriteForm = useForm<z.infer<typeof favoriteLocationFormSchema>>({
    resolver: zodResolver(favoriteLocationFormSchema),
    defaultValues: {
      label: "",
      address: "",
    },
  });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing for ProfilePage. Address autocomplete for favorites will not work.");
      return;
    }
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places"],
    });

    loader.load().then((google) => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const mapDiv = document.createElement('div'); 
      placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
      autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(e => console.error("Failed to load Google Maps API for address search in ProfilePage", e));
  }, []);


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


  const handleSaveProfile = () => {
    login(email, name, user!.role); 
    setIsEditing(false);
    toast({ title: "Profile Updated", description: "Your profile details have been saved." });
  };

  const fetchAddressSuggestions = useCallback((
    inputValue: string,
    setSuggestionsFunc: (suggestions: google.maps.places.AutocompletePrediction[]) => void,
    setIsFetchingFunc: (isFetching: boolean) => void
  ) => {
    if (!autocompleteServiceRef.current || inputValue.length < 2) {
      setSuggestionsFunc([]);
      setIsFetchingFunc(false);
      return;
    }
    setIsFetchingFunc(true);
    autocompleteServiceRef.current.getPlacePredictions(
      { input: inputValue, sessionToken: autocompleteSessionTokenRef.current, componentRestrictions: { country: 'gb' } },
      (predictions, status) => {
        setIsFetchingFunc(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestionsFunc(predictions);
        } else {
          setSuggestionsFunc([]);
        }
      }
    );
  }, []);

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

    if (placesServiceRef.current && suggestion.place_id) {
      placesServiceRef.current.getDetails(
        { placeId: suggestion.place_id, fields: ['geometry.location'], sessionToken: autocompleteSessionTokenRef.current },
        (place, status) => {
          setIsFetchingNewFavLocationDetails(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            setNewFavLocationCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
            toast({ title: "Location Selected", description: `${addressText} coordinates captured for new favorite.`});
          } else {
            setNewFavLocationCoords(null);
            toast({ title: "Error", description: "Could not get location details for favorite. Please try again.", variant: "destructive"});
          }
          autocompleteSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      );
    } else {
      setIsFetchingNewFavLocationDetails(false);
      setNewFavLocationCoords(null);
      toast({ title: "Warning", description: "Could not fetch location details (missing place ID or service).", variant: "default" });
    }
  };

  const handleNewFavFocus = () => {
    if (newFavLocationAddress.length >= 2 && newFavLocationSuggestions.length > 0) {
        setShowNewFavLocationSuggestions(true);
    } else if (newFavLocationAddress.length >= 2 && autocompleteServiceRef.current) {
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
          address: values.address, // This is the text from the input, which should match the selected suggestion
          latitude: newFavLocationCoords.lat,
          longitude: newFavLocationCoords.lng,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add favorite.');
      }
      const newFavorite = await response.json();
      setFavoriteLocations(prev => [newFavorite.data, ...prev]); // Add to list
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
      toast({ title: "Favorite Removed", description: "The location has been removed from your favorites." });
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
            <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <UserCircle className="w-8 h-8 text-primary" /> Your Profile
          </CardTitle>
          <CardDescription>View and manage your account details and preferences.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile large"/>
            <AvatarFallback className="text-3xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <CardTitle className="text-2xl font-headline">{user.name}</CardTitle>
            <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1">
              <Briefcase className="w-4 h-4" /> {user.role}
            </CardDescription>
          </div>
          <Button variant={isEditing ? "destructive" : "outline"} onClick={() => setIsEditing(!isEditing)}>
            <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Profile"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name" className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</Label>
            {isEditing ? (
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            ) : (
              <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</Label>
            {isEditing ? (
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            ) : (
              <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
            )}
          </div>
          {user.role === 'driver' && (
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</Label>
              {isEditing ? (
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              ) : (
                <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{phone || "Not set"}</p>
              )}
            </div>
          )}
          {isEditing && (
            <Button onClick={handleSaveProfile} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">Save Profile Changes</Button>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-5 h-5 text-green-500" />
                Your information is kept secure.
            </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2"><MapPin className="w-6 h-6 text-primary" /> Favorite Locations</CardTitle>
            <CardDescription>Manage your saved addresses for faster booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...favoriteForm}>
            <form onSubmit={favoriteForm.handleSubmit(handleAddFavoriteLocation)} className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/30">
              <h3 className="text-lg font-semibold flex items-center gap-1"><PlusCircle className="w-5 h-5 text-accent" /> Add New Favorite</h3>
              <FormField control={favoriteForm.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Tag className="w-4 h-4" /> Label (e.g., Home, Work)</FormLabel>
                  <FormControl><Input placeholder="My Home" {...field} /></FormControl>
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
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={isAddingFavorite || !newFavLocationCoords || isFetchingNewFavLocationDetails} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isAddingFavorite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add Favorite
              </Button>
            </form>
          </Form>

          {isLoadingFavorites && <div className="flex items-center justify-center py-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading favorites...</div>}
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
      
      {user.role === 'passenger' && 
        <Card>
            <CardHeader><CardTitle>Payment Methods (Placeholder)</CardTitle></CardHeader>
            <CardContent>
                <Image src="https://placehold.co/300x100.png?text=Add+Payment+Method" data-ai-hint="credit card payment" alt="Payment methods" width={300} height={100} />
                <p className="text-muted-foreground mt-2">Secure payment gateway integration via Stripe (Test Mode).</p>
            </CardContent>
        </Card>
      }
    </div>
  );
}

    
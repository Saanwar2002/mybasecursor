"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError?: Error;
  google?: typeof google;
  autocompleteService: google.maps.places.AutocompleteService | null;
  placesService: google.maps.places.PlacesService | null;
  geocoder: google.maps.Geocoder | null;
  createSessionToken: () => google.maps.places.AutocompleteSessionToken;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined);

export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);
  const [google, setGoogle] = useState<typeof window.google | undefined>(undefined);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.");
      setLoadError(new Error("Google Maps API key is missing."));
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["geocoding", "maps", "marker", "places", "geometry", "routes", "core"],
    });

    loader.load().then(googleInstance => {
      setGoogle(googleInstance);
      setIsLoaded(true);
      
      const mapDivForServices = document.createElement('div');
      autocompleteServiceRef.current = new googleInstance.maps.places.AutocompleteService();
      placesServiceRef.current = new googleInstance.maps.places.PlacesService(mapDivForServices);
      geocoderRef.current = new googleInstance.maps.Geocoder();

    }).catch(e => {
      console.error("Failed to load Google Maps API:", e);
      setLoadError(e as Error);
    });
  }, []);

  const createSessionToken = () => {
    if (google) {
      return new google.maps.places.AutocompleteSessionToken();
    }
    // This should ideally not happen if the context is used correctly
    // after checking isLoaded, but as a fallback:
    console.warn("Attempted to create a session token before Google Maps SDK was loaded.");
    return {} as google.maps.places.AutocompleteSessionToken;
  };


  const value = {
    isLoaded,
    loadError,
    google,
    autocompleteService: autocompleteServiceRef.current,
    placesService: placesServiceRef.current,
    geocoder: geocoderRef.current,
    createSessionToken,
  };

  return (
    <GoogleMapsContext.Provider value={value}>
      {isLoaded ? children : null}
    </GoogleMapsContext.Provider>
  );
};

export const useGoogleMaps = (): GoogleMapsContextType => {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}; 
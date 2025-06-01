
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { cn } from "@/lib/utils";
import { Skeleton } from './skeleton';

interface GoogleMapDisplayProps {
  center: google.maps.LatLngLiteral;
  zoom?: number;
  markers?: Array<{
    position: google.maps.LatLngLiteral;
    title?: string;
    iconUrl?: string; 
    iconScaledSize?: { width: number; height: number }; 
  }>;
  className?: string;
  style?: React.CSSProperties;
  mapId?: string; 
}

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  mapId,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);

  const defaultStyle = React.useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("Google Maps API Key is missing or empty.");
      setError("Google Maps API Key is missing or empty. Map cannot be loaded. Please check your .env file and Google Cloud Console setup.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true); 
    setError(null); 

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker"], 
    });

    let localMapInstance: google.maps.Map | null = null;

    loader.load()
      .then((google) => {
        if (mapRef.current) {
          localMapInstance = new google.maps.Map(mapRef.current, {
            center, // Initial center
            zoom,   // Initial zoom
            mapId: mapId, 
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          });
          setMapInstance(localMapInstance);
        } else {
          console.warn("GoogleMapDisplay: mapRef.current is null when trying to initialize map.");
          setError("Map container not found. Cannot initialize map.");
        }
      })
      .catch(e => {
        console.error("Failed to load Google Maps SDK:", e);
        setError("Failed to load Google Maps SDK. Check API key, network, and browser console for details.");
      })
      .finally(() => {
        setIsLoading(false);
      });
      
    return () => {
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      // Clear the map instance from state when the component unmounts or mapId changes
      setMapInstance(null); 
    };
  // Only re-run this effect if mapId changes. API key presence is checked internally.
  // Center and zoom are initial values; subsequent changes are handled by the next useEffect.
  }, [mapId]); 

  useEffect(() => {
    if (!mapInstance) return;

    // Update map center and zoom if props change after initial load
    mapInstance.setCenter(center);
    mapInstance.setZoom(zoom);

    // Clear existing markers
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    // Add new markers
    if (markers) {
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: mapInstance,
          title: markerData.title,
        };

        if (markerData.iconUrl) {
          markerOptions.icon = {
            url: markerData.iconUrl,
            scaledSize: markerData.iconScaledSize 
              ? new google.maps.Size(markerData.iconScaledSize.width, markerData.iconScaledSize.height) 
              : undefined,
          };
        }
        
        const newMarker = new google.maps.Marker(markerOptions);
        currentMarkersRef.current.push(newMarker);
      });
    }

  }, [mapInstance, markers, center, zoom]);


  if (isLoading) {
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={mapStyle}>
        <p className="font-semibold mb-2">Map Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

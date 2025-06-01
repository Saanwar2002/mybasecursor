
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
      console.error("GoogleMapDisplay Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or empty.");
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

    let localMap: google.maps.Map | null = null;

    loader.load()
      .then((google) => {
        if (mapRef.current) {
          localMap = new google.maps.Map(mapRef.current, {
            center,
            zoom,
            mapId: mapId, 
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          });
          setMapInstance(localMap);
        } else {
          console.error("GoogleMapDisplay Critical: mapRef.current is null INSIDE loader.then() just before map creation.");
          setError("Map container not found during initialization. Please refresh or check console.");
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
      setMapInstance(null); 
    };
  }, [mapId]); 

  useEffect(() => {
    if (!mapInstance) return;

    mapInstance.setCenter(center);
    mapInstance.setZoom(zoom);

    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    if (markers) {
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: mapInstance,
          title: markerData.title,
        };

        if (markerData.iconUrl && typeof google !== 'undefined' && google.maps && google.maps.Size) {
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
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={{ ...mapStyle, border: '2px dashed blue' }} aria-label="Loading map..." />;
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={{ ...mapStyle, border: '2px solid orange' }}>
        <p className="font-semibold mb-2">Map Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} style={{ ...mapStyle, border: '2px solid red' }} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

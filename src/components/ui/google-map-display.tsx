
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
    iconUrl?: string; // URL for a custom marker icon
    iconScaledSize?: { width: number; height: number }; // e.g., { width: 30, height: 48 }
  }>;
  className?: string;
  style?: React.CSSProperties;
  mapId?: string; // Optional: For using specific Map IDs (custom styles)
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
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API Key is missing.");
      setError("Google Maps API Key is missing. Map cannot be loaded.");
      setIsLoading(false);
      return;
    }

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["marker", "places"], // "marker" for Advanced Markers
    });

    let map: google.maps.Map | null = null;

    loader.load()
      .then((google) => {
        if (mapRef.current) {
          map = new google.maps.Map(mapRef.current, {
            center,
            zoom,
            mapId: mapId, // For Cloud-based Maps Styling
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          });
          setMapInstance(map);
        }
      })
      .catch(e => {
        console.error("Failed to load Google Maps:", e);
        setError("Failed to load Google Maps. Please check the console for details.");
      })
      .finally(() => {
        setIsLoading(false);
      });
      
      return () => {
        // Basic cleanup, though Google Maps instances on a div are usually handled by DOM removal.
        // If more complex event listeners or resources were attached to the map instance directly,
        // they would need to be cleaned up here.
      };
  }, [center, zoom, mapId]); // Rerun if center, zoom, or mapId changes

  useEffect(() => {
    if (!mapInstance || !markers) return;

    // Clear existing markers
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    // Add new markers
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

  }, [mapInstance, markers]);


  if (isLoading) {
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center rounded-md shadow-md bg-destructive/10 text-destructive", className)} style={mapStyle}>
        <p>{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md", className)} />;
};

export default GoogleMapDisplay;

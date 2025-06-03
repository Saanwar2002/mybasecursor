
"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  mapId?: string; // For map styling (e.g., cloud-based map styling ID)
}

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  mapId: mapIdProp,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  useEffect(() => {
    let isMounted = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      if (isMounted) {
        setMapError("Google Maps API Key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing or empty. Map cannot be loaded.");
      }
      return;
    }
    if (isMounted) {
      setMapError(null); // Clear previous errors if key becomes available
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker", "maps"], // Added "maps" explicitly
    });

    loader.load().then((googleInstance) => { // googleInstance is the google global
      if (isMounted) {
        if (googleInstance && googleInstance.maps && googleInstance.maps.Map) {
           setIsSdkLoaded(true);
        } else {
           // This case handles if SDK loads but google.maps.Map is not defined (e.g. API not enabled for Maps JS)
           setMapError("Google Maps SDK loaded, but `google.maps.Map` is not available. Check API key permissions for Maps JavaScript API in Google Cloud Console.");
           setIsSdkLoaded(false);
        }
      }
    }).catch(e => {
      if (isMounted) {
        console.error("Failed to load Google Maps SDK:", e);
        setMapError(`Failed to load Google Maps SDK. Check API key, network, and console. Error: ${e.message || e}`);
        setIsSdkLoaded(false);
      }
    });
    return () => { isMounted = false; };
  }, []); // Runs once on mount to load SDK

  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current) {
      return;
    }

    // Initialize map if not already done
    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) { // Re-init if mapId changed
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: mapIdProp,
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });
    } else if (mapInstanceRef.current) { // Update existing map if necessary
      const currentMapCenter = mapInstanceRef.current.getCenter();
      if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
        mapInstanceRef.current.setCenter(center);
      }
      if (mapInstanceRef.current.getZoom() !== zoom) {
        mapInstanceRef.current.setZoom(zoom);
      }
    }

    // Clear old markers
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    // Add new markers
    if (markers && mapInstanceRef.current && typeof google !== 'undefined' && google.maps && google.maps.Marker && google.maps.Size) {
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: mapInstanceRef.current,
          title: markerData.title,
        };

        if (markerData.iconUrl) {
          markerOptions.icon = {
            url: markerData.iconUrl,
            scaledSize: markerData.iconScaledSize
              ? new google.maps.Size(markerData.iconScaledSize.width, markerData.iconScaledSize.height)
              : undefined, // Let Google Maps decide default size if not provided
          };
        }
        const newMarker = new google.maps.Marker(markerOptions);
        currentMarkersRef.current.push(newMarker);
      });
    }
  // Ensure mapRef.current is stable by not including it, or use a callback ref if mapRef.current itself needs to trigger re-runs.
  // For map initialization, mapRef.current should be available when isSdkLoaded is true.
  // The dependencies should primarily be data that changes the map's appearance or content.
  }, [isSdkLoaded, center, zoom, markers, mapIdProp]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      mapInstanceRef.current = null; 
    };
  }, []);

  if (mapError) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={mapStyle}>
        <p className="font-semibold mb-1 text-lg">Map Display Error</p>
        <p className="text-sm whitespace-pre-wrap">{mapError}</p>
        <p className="text-xs mt-2">Please verify API key, ensure "Maps JavaScript API" is enabled in Google Cloud Console, and check for restrictions.</p>
      </div>
    );
  }

  if (!isSdkLoaded && !mapError) { // Only show skeleton if SDK is loading AND there's no error yet
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }
  
  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

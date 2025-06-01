
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
  
  // Diagnostic borders (can be removed once stable)
  const diagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid red' } : {};
  const skeletonDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px dashed blue' } : {};
  const errorDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid orange' } : {};


  useEffect(() => {
    let isEffectMounted = true; // Flag to track if the effect is still active

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("GoogleMapDisplay Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or empty.");
      if (isEffectMounted) {
        setError("Google Maps API Key is missing or empty. Map cannot be loaded.");
        setIsLoading(false);
      }
      return;
    }

    if (isEffectMounted) {
      setIsLoading(true);
      setError(null);
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker"], 
    });

    let localMapInstance: google.maps.Map | null = null;

    loader.load()
      .then((google) => {
        if (!isEffectMounted) {
          console.log("GoogleMapDisplay: Map SDK loaded, but component unmounted. Skipping map creation.");
          return; 
        }
        if (mapRef.current) {
          localMapInstance = new google.maps.Map(mapRef.current, {
            center,
            zoom,
            mapId: mapId, 
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          });
          setMapInstance(localMapInstance);
        } else {
          console.error("GoogleMapDisplay Critical: mapRef.current is null INSIDE loader.then() and component IS mounted.");
          setError("Map container not found during initialization. Please refresh or check console.");
        }
      })
      .catch(e => {
        if (isEffectMounted) {
          console.error("Failed to load Google Maps SDK:", e);
          setError("Failed to load Google Maps SDK. Check API key, network, and browser console for details.");
        }
      })
      .finally(() => {
        if (isEffectMounted) {
          setIsLoading(false);
        }
      });
      
    return () => {
      isEffectMounted = false;
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      // It's generally not recommended to directly destroy map instances created by Google's SDK
      // unless their documentation specifically guides it for this cleanup pattern.
      // Clearing the state and markers is usually sufficient.
      setMapInstance(null); 
    };
  }, [mapId]); // mapId is the primary dependency for SDK loading. Center/zoom are handled by the next effect.

  useEffect(() => {
    if (!mapInstance) return;

    // Only update if values have actually changed to prevent unnecessary map operations
    const currentMapCenter = mapInstance.getCenter();
    const currentMapZoom = mapInstance.getZoom();

    if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
        mapInstance.setCenter(center);
    }
    if (currentMapZoom !== zoom) {
        mapInstance.setZoom(zoom);
    }
    
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    if (markers && typeof google !== 'undefined' && google.maps && google.maps.Marker) {
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: mapInstance,
          title: markerData.title,
        };

        if (markerData.iconUrl && google.maps.Size) { // Check google.maps.Size
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
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={{ ...mapStyle, ...skeletonDiagnosticStyle }} aria-label="Loading map..." />;
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={{ ...mapStyle, ...errorDiagnosticStyle }}>
        <p className="font-semibold mb-2">Map Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} style={{ ...mapStyle, ...diagnosticStyle }} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

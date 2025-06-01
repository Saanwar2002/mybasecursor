
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
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;
  
  const diagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid green' } : {}; // Changed border for successful render
  const skeletonDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px dashed blue' } : {};
  const errorDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid orange' } : {};

  // Effect for loading the Google Maps SDK
  useEffect(() => {
    let isEffectMounted = true;
    console.log("GoogleMapDisplay: SDK Loading effect triggered. Current mapId:", mapId);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      if (isEffectMounted) {
        console.error("GoogleMapDisplay Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or empty.");
        setMapInitError("Google Maps API Key is missing or empty. Map cannot be loaded.");
        setIsSdkReady(false);
      }
      return;
    }
    
    // If API key is present, clear any previous key-related error
    // and ensure SDK ready state is false before attempting to load.
    setMapInitError(null);
    setIsSdkReady(false); 

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker"], 
    });

    console.log("GoogleMapDisplay: Initiating Google Maps SDK load...");
    loader.load()
      .then(() => {
        if (isEffectMounted) {
          console.log("GoogleMapDisplay: Google Maps SDK LOADED successfully.");
          setIsSdkReady(true);
        } else {
          console.log("GoogleMapDisplay: SDK loaded, but component UNMOUNTED during load.");
        }
      })
      .catch(e => {
        if (isEffectMounted) {
          console.error("GoogleMapDisplay: Failed to load Google Maps SDK:", e);
          setMapInitError("Failed to load Google Maps SDK. Check API key, network, and console.");
          setIsSdkReady(false);
        }
      });

    return () => {
      isEffectMounted = false;
      console.log("GoogleMapDisplay: SDK Loading effect CLEANUP.");
    };
  }, [mapId]); // Re-run if mapId (which is a prop for map features, not React key) changes.

  // Effect for initializing and updating the map instance & markers
  useEffect(() => {
    if (!isSdkReady) {
      console.log("GoogleMapDisplay: Map Init/Update - SDK not ready, skipping.");
      return;
    }

    if (!mapRef.current) {
      // This is the critical check now. If this happens, the div is not in the DOM.
      console.error("GoogleMapDisplay Critical: Map Init/Update - mapRef.current is NULL, but SDK is ready. This indicates the map container div is not rendered.");
      setMapInitError("Map container DOM element not found. Please refresh or check for rendering issues.");
      return;
    }

    console.log("GoogleMapDisplay: Map Init/Update - SDK is ready, mapRef.current IS available.");

    let currentMap = mapInstance;

    if (!currentMap) {
      console.log("GoogleMapDisplay: Initializing NEW map instance with center:", center, "zoom:", zoom, "mapId prop:", mapId);
      currentMap = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: mapId, 
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });
      setMapInstance(currentMap);
    } else {
      console.log("GoogleMapDisplay: UPDATING existing map instance.");
      const currentMapCenter = currentMap.getCenter();
      if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
        currentMap.setCenter(center);
      }
      if (currentMap.getZoom() !== zoom) {
        currentMap.setZoom(zoom);
      }
    }
    
    // Marker logic
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    if (markers && currentMap && typeof google !== 'undefined' && google.maps && google.maps.Marker) {
      console.log("GoogleMapDisplay: Updating/adding markers:", markers.length);
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: currentMap,
          title: markerData.title,
        };

        if (markerData.iconUrl && google.maps.Size) {
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
  }, [isSdkReady, mapInstance, center, zoom, mapId, markers]); // Dependencies for map updates

  // Effect for component unmount cleanup
  useEffect(() => {
    return () => {
      console.log("GoogleMapDisplay: Component UNMOUNTING. Cleaning up markers and map instance state.");
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      // Note: Google Maps API handles its own internal cleanup of the map object
      // when the DOM element is removed. Setting mapInstance to null is for React state.
      setMapInstance(null); 
      setIsSdkReady(false);
    };
  }, []); // Empty dependency array means this runs only on unmount

  if (mapInitError) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={{ ...mapStyle, ...errorDiagnosticStyle }}>
        <p className="font-semibold mb-2">Map Error</p>
        <p className="text-sm">{mapInitError}</p>
      </div>
    );
  }
  
  // Show skeleton if SDK is not ready OR if SDK is ready but mapInstance is not yet created (brief init phase)
  // AND there's no error.
  const showSkeleton = (!isSdkReady && !mapInitError) || (isSdkReady && !mapInstance && !mapInitError);

  if (showSkeleton) {
     console.log("GoogleMapDisplay: Rendering Skeleton. isSdkReady:", isSdkReady, "mapInstance:", !!mapInstance, "mapInitError:", mapInitError);
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={{ ...mapStyle, ...skeletonDiagnosticStyle }} aria-label="Loading map..." />;
  }

  console.log("GoogleMapDisplay: Rendering map container div. isSdkReady:", isSdkReady, "mapInstance:", !!mapInstance, "mapInitError:", mapInitError);
  return <div ref={mapRef} style={{ ...mapStyle, ...diagnosticStyle }} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

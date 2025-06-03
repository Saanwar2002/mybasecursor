
"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  mapId: mapIdProp, // Renamed to avoid conflict with internal mapId variable
}) => {
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [mapDivNode, setMapDivNode] = useState<HTMLDivElement | null>(null);

  const mapRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      console.log("GoogleMapDisplay: mapRefCallback - div node IS available.");
      setMapDivNode(node);
    } else {
      console.log("GoogleMapDisplay: mapRefCallback - div node is NULL (likely unmounting).");
    }
  }, []);

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;
  
  const diagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid green' } : {};
  const errorDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid orange' } : {};


  // Effect for loading the Google Maps SDK
  useEffect(() => {
    let isEffectMounted = true;
    console.log("GoogleMapDisplay: SDK Loading effect triggered.");

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      if (isEffectMounted) {
        console.error("GoogleMapDisplay Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or empty.");
        setMapInitError("Google Maps API Key is missing or empty. Map cannot be loaded.");
        setIsSdkReady(false);
      }
      return;
    }
    
    setMapInitError(null); // Clear previous errors if API key is present
    
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
  }, []); // Only run once on mount

  // Effect for initializing and updating the map instance & markers
  useEffect(() => {
    if (!isSdkReady || !mapDivNode) {
      if (!isSdkReady) console.log("GoogleMapDisplay: Map Init/Update - SDK not ready, skipping.");
      if (!mapDivNode) console.log("GoogleMapDisplay: Map Init/Update - mapDivNode is NULL, skipping.");
      return;
    }

    console.log("GoogleMapDisplay: Map Init/Update - SDK is ready AND mapDivNode IS available.");

    try {
        // Initialize map if it hasn't been, or if mapIdProp has changed
        if (!mapInstanceRef.current || mapInstanceRef.current.getMapTypeId() !== mapIdProp) {
          console.log("GoogleMapDisplay: Initializing NEW map instance with center:", center, "zoom:", zoom, "mapId prop:", mapIdProp);
          if (!google || !google.maps || !google.maps.Map) {
            console.error("GoogleMapDisplay Error: google.maps.Map constructor is not available! SDK might not be fully loaded or window.google is not set.");
            setMapInitError("Map library components are missing. SDK might not be fully loaded or failed initialization.");
            return;
          }
          mapInstanceRef.current = new google.maps.Map(mapDivNode, {
            center,
            zoom,
            mapId: mapIdProp, 
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          });
          console.log("GoogleMapDisplay: NEW map instance CREATED.");
        } else {
          // Update existing map
          console.log("GoogleMapDisplay: UPDATING existing map instance.");
          const currentMapCenter = mapInstanceRef.current.getCenter();
          if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
            mapInstanceRef.current.setCenter(center);
          }
          if (mapInstanceRef.current.getZoom() !== zoom) {
            mapInstanceRef.current.setZoom(zoom);
          }
        }
        
        // Marker logic
        currentMarkersRef.current.forEach(marker => marker.setMap(null)); // Clear existing markers
        currentMarkersRef.current = [];

        if (markers && mapInstanceRef.current && typeof google !== 'undefined' && google.maps && google.maps.Marker) {
          console.log("GoogleMapDisplay: Updating/adding markers:", markers.length);
          markers.forEach(markerData => {
            let markerOptions: google.maps.MarkerOptions = {
              position: markerData.position,
              map: mapInstanceRef.current,
              title: markerData.title,
            };

            if (markerData.iconUrl && google.maps.Size) { // Check for google.maps.Size
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
    } catch (e) {
      console.error("GoogleMapDisplay: CRITICAL ERROR during map initialization or update:", e);
      setMapInitError("An unexpected error occurred while initializing the map. Check browser console for details.");
    }
  }, [isSdkReady, mapDivNode, center, zoom, mapIdProp, markers]); // Dependencies for map updates

  // Effect for component unmount cleanup
  useEffect(() => {
    return () => {
      console.log("GoogleMapDisplay: Component UNMOUNTING. Cleaning up markers. Map instance is handled by Google.");
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      mapInstanceRef.current = null; 
    };
  }, []);


  if (mapInitError) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={{ ...mapStyle, ...errorDiagnosticStyle }}>
        <p className="font-semibold mb-2">Map Error</p>
        <p className="text-sm">{mapInitError}</p>
      </div>
    );
  }
  
  if (!isSdkReady || !mapDivNode) {
     console.log("GoogleMapDisplay: Rendering Skeleton (or relying on dynamic import's loader). isSdkReady:", isSdkReady, "mapDivNode:", !!mapDivNode);
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  console.log("GoogleMapDisplay: Rendering map container div for Google Maps.");
  return <div ref={mapRefCallback} style={{ ...mapStyle, ...diagnosticStyle }} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

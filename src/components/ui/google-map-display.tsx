
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
  mapId: mapIdProp,
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

  const diagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid green', backgroundColor: 'rgba(0, 255, 0, 0.05)' } : {};
  const errorDiagnosticStyle = process.env.NODE_ENV === 'development' ? { border: '2px solid orange', padding: '10px', backgroundColor: 'rgba(255, 165, 0, 0.1)' } : {};


  // Effect for loading the Google Maps SDK
  useEffect(() => {
    let isEffectMounted = true;
    console.log("GoogleMapDisplay: SDK Loading effect triggered.");

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      if (isEffectMounted) {
        const errorMsg = "Google Maps API Key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing or empty. Map cannot be loaded.";
        console.error(`GoogleMapDisplay Error: ${errorMsg}`);
        setMapInitError(errorMsg);
        setIsSdkReady(false);
      }
      return;
    }

    setMapInitError(null);

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker", "maps"], // Explicitly added "maps" library
    });

    console.log("GoogleMapDisplay: Initiating Google Maps SDK load...");
    loader.load()
      .then((googleGlobal) => { // loader.load() returns the google object
        if (isEffectMounted) {
          if (googleGlobal && googleGlobal.maps && googleGlobal.maps.Map) {
            console.log("GoogleMapDisplay: Google Maps SDK LOADED successfully. `google.maps.Map` is available.");
            setIsSdkReady(true);
          } else {
            const errorMsg = "Google Maps SDK loaded, but `google.maps.Map` is not available. This usually indicates a problem with the API key or its configuration (e.g., Maps JavaScript API not enabled).";
            console.error(`GoogleMapDisplay Error: ${errorMsg}`);
            setMapInitError(errorMsg);
            setIsSdkReady(false);
          }
        } else {
          console.log("GoogleMapDisplay: SDK loaded, but component UNMOUNTED during load.");
        }
      })
      .catch(e => {
        if (isEffectMounted) {
          const errorMsg = `Failed to load Google Maps SDK. Check API key, network, and console. Error: ${e.message || e}`;
          console.error(`GoogleMapDisplay: ${errorMsg}`, e);
          setMapInitError(errorMsg);
          setIsSdkReady(false);
        }
      });

    return () => {
      isEffectMounted = false;
      console.log("GoogleMapDisplay: SDK Loading effect CLEANUP.");
    };
  }, []);

  // Effect for initializing and updating the map instance & markers
  useEffect(() => {
    if (!isSdkReady || !mapDivNode) {
      if (!isSdkReady) console.log("GoogleMapDisplay: Map Init/Update - SDK not ready, skipping.");
      if (!mapDivNode) console.log("GoogleMapDisplay: Map Init/Update - mapDivNode is NULL, skipping.");
      return;
    }

    console.log("GoogleMapDisplay: Map Init/Update - SDK is ready AND mapDivNode IS available.");

    try {
      if (typeof google === 'undefined' || !google.maps || !google.maps.Map) {
        const errorMsg = "Map Init/Update Error: `google.maps.Map` constructor is not available even though SDK reported ready. This is unexpected. Check for multiple SDK loads or API key issues.";
        console.error(`GoogleMapDisplay Error: ${errorMsg}`);
        setMapInitError(errorMsg);
        return;
      }

      if (!mapInstanceRef.current || mapInstanceRef.current.getMapTypeId() !== mapIdProp) {
        console.log("GoogleMapDisplay: Initializing NEW map instance with center:", center, "zoom:", zoom, "mapId prop:", mapIdProp);
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
        console.log("GoogleMapDisplay: UPDATING existing map instance.");
        const currentMapCenter = mapInstanceRef.current.getCenter();
        if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
          mapInstanceRef.current.setCenter(center);
        }
        if (mapInstanceRef.current.getZoom() !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
        }
      }

      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];

      if (markers && mapInstanceRef.current && typeof google !== 'undefined' && google.maps && google.maps.Marker) {
        console.log("GoogleMapDisplay: Updating/adding markers:", markers.length);
        markers.forEach(markerData => {
          let markerOptions: google.maps.MarkerOptions = {
            position: markerData.position,
            map: mapInstanceRef.current,
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
    } catch (e: any) {
      const errorMsg = `CRITICAL ERROR during map initialization or update: ${e.message || e}`;
      console.error(`GoogleMapDisplay: ${errorMsg}`, e);
      setMapInitError(errorMsg);
    }
  }, [isSdkReady, mapDivNode, center, zoom, mapIdProp, markers]);

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
        <p className="font-semibold mb-1 text-lg">Map Display Error</p>
        <p className="text-sm whitespace-pre-wrap">{mapInitError}</p>
        <p className="text-xs mt-2">Please check the browser console (F12) for more details and verify Google Cloud Console settings.</p>
      </div>
    );
  }

  if (!isSdkReady) { // Keep showing skeleton if SDK is not ready, even if mapDivNode is available
     console.log("GoogleMapDisplay: Rendering Skeleton because SDK not ready. isSdkReady:", isSdkReady);
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  console.log("GoogleMapDisplay: Rendering map container div for Google Maps. mapDivNode status:", mapDivNode ? "Available" : "Not Available (will render Skeleton if so)");
  // The ref callback ensures mapDivNode is set before this render if it's going to be available.
  // If mapDivNode is still null here but SDK is ready, it means the div hasn't rendered yet or an error state for mapDivNode itself.
  // The Skeleton above or dynamic import's loader will handle the initial render until mapDivNode is ready.
  // If mapDivNode is null, it will fall back to Skeleton, preventing an error.
  return mapDivNode ? <div ref={mapRefCallback} style={{ ...mapStyle, ...diagnosticStyle }} className={cn("rounded-md shadow-md bg-muted/30", className)} /> : <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Initializing map container..." />;
};

export default GoogleMapDisplay;

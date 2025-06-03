
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
    label?: string | google.maps.MarkerLabel; // Added label support
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
      setMapError(null); 
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "marker", "maps"], 
    });

    loader.load().then((googleInstance) => { 
      if (isMounted) {
        if (googleInstance && googleInstance.maps && googleInstance.maps.Map) {
           setIsSdkLoaded(true);
        } else {
           setMapError("Google Maps SDK loaded, but `google.maps.Map` is not available. Check API key permissions for Maps JavaScript API in Google Cloud Console.");
           setIsSdkLoaded(false);
        }
      }
    }).catch(e => {
      if (isMounted) {
        console.error("Failed to load Google Maps SDK:", e);
        setMapError(`Failed to load Google Maps SDK. Check API key, network, and console. Error: ${e.message || String(e)}`);
        setIsSdkLoaded(false);
      }
    });
    return () => { isMounted = false; };
  }, []); 

  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current) {
      return;
    }

    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) { 
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: mapIdProp,
        disableDefaultUI: false, // Changed to false to show all default UI including zoom
        // zoomControl: true, // zoomControl is true by default if disableDefaultUI is false
        // streetViewControl: true, // streetViewControl is true by default if disableDefaultUI is false
        // mapTypeControl: true, // mapTypeControl is true by default if disableDefaultUI is false
      });
    } else if (mapInstanceRef.current) { 
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
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position,
          map: mapInstanceRef.current,
          title: markerData.title,
          label: markerData.label, 
        };

        if (markerData.iconUrl && markerData.iconScaledSize && google.maps.Size && google.maps.Point) {
          markerOptions.icon = {
            url: markerData.iconUrl,
            scaledSize: new google.maps.Size(markerData.iconScaledSize.width, markerData.iconScaledSize.height),
            anchor: new google.maps.Point(markerData.iconScaledSize.width / 2, markerData.iconScaledSize.height), 
          };
        }
        const newMarker = new google.maps.Marker(markerOptions);
        currentMarkersRef.current.push(newMarker);
      });
    }
  }, [isSdkLoaded, center, zoom, markers, mapIdProp]);

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

  if (!isSdkLoaded && !mapError) { 
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }
  
  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

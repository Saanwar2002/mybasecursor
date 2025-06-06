
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
    label?: string | google.maps.MarkerLabel;
    iconUrl?: string;
    iconScaledSize?: { width: number; height: number };
  }>;
  className?: string;
  style?: React.CSSProperties;
  mapId?: string;
  disableDefaultUI?: boolean;
  fitBoundsToMarkers?: boolean;
}

const FALLBACK_API_KEY_FOR_MAPS = "AIzaSyDZuA2S5Ia1DnKgaxQ60wzxyOsRW8WdUH8"; // Same as Firebase fallback

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  mapId: mapIdProp,
  disableDefaultUI = false,
  fitBoundsToMarkers = false,
}) => {
  // TEMPORARY DEBUG LOGS:
  console.log("GoogleMapDisplay ENV CHECK: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:", process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  console.log("GoogleMapDisplay ENV CHECK: NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [usedApiKeySource, setUsedApiKeySource] = useState<string>("unknown");

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '200px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  useEffect(() => {
    let isMounted = true;

    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    let apiKeyToUse: string | undefined = undefined;
    let apiKeySource: string = "unknown";

    if (googleMapsApiKey && googleMapsApiKey.trim() !== "") {
      apiKeyToUse = googleMapsApiKey;
      apiKeySource = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY";
    } else if (firebaseApiKey && firebaseApiKey.trim() !== "") {
      apiKeyToUse = firebaseApiKey;
      apiKeySource = "NEXT_PUBLIC_FIREBASE_API_KEY (as fallback)";
    } else {
      apiKeyToUse = FALLBACK_API_KEY_FOR_MAPS;
      apiKeySource = "Hardcoded Fallback";
    }
    
    if (isMounted) setUsedApiKeySource(apiKeySource);

    if (!apiKeyToUse) { 
      if (isMounted) {
        setMapError("Critical Error: No Google Maps API Key could be determined. Map cannot be loaded.");
      }
      return;
    }
    if (isMounted) {
        setMapError(null);
    }
    
    const loader = new Loader({
      apiKey: apiKeyToUse,
      version: "weekly",
      libraries: ["places", "marker", "maps"],
    });

    loader.load().then((googleInstance) => {
      if (isMounted) {
        if (googleInstance && googleInstance.maps && googleInstance.maps.Map) {
           setIsSdkLoaded(true);
        } else {
           setMapError(`Google Maps SDK loaded, but 'google.maps.Map' is not available. API Key used: ${apiKeySource}. Check API key permissions for Maps JavaScript API in Google Cloud Console.`);
           setIsSdkLoaded(false);
        }
      }
    }).catch(e => {
      if (isMounted) {
        console.error("Failed to load Google Maps SDK:", e);
        setMapError(`Failed to load Google Maps SDK. API Key used: ${apiKeySource}. Check API key, network, and console. Error: ${e.message || String(e)}`);
        setIsSdkLoaded(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current || !google.maps) { 
      return;
    }

    const mapOptions: google.maps.MapOptions = {
        center,
        zoom,
        mapId: mapIdProp,
        disableDefaultUI: disableDefaultUI,
        mapTypeControl: !disableDefaultUI,
        zoomControl: !disableDefaultUI,
        streetViewControl: !disableDefaultUI,
        fullscreenControl: !disableDefaultUI,
      };

    if (disableDefaultUI) {
        mapOptions.mapTypeControl = false;
        mapOptions.zoomControl = false;
        mapOptions.streetViewControl = false;
        mapOptions.fullscreenControl = false;
    }


    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, mapOptions);
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions(mapOptions); 

      if (!fitBoundsToMarkers || !markers || markers.length < 1) {
        const currentMapCenter = mapInstanceRef.current.getCenter();
        if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
          mapInstanceRef.current.setCenter(center);
        }
        if (mapInstanceRef.current.getZoom() !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
        }
      }
    }

    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    if (markers && markers.length > 0 && mapInstanceRef.current && google.maps && google.maps.Marker && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
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
        if (markerData.position) {
            bounds.extend(markerData.position);
        }
      });

      if (fitBoundsToMarkers && !bounds.isEmpty() && mapInstanceRef.current) {
        if (markers.length === 1) {
            mapInstanceRef.current.setCenter(bounds.getCenter());
            mapInstanceRef.current.setZoom(zoom); 
        } else {
            mapInstanceRef.current.fitBounds(bounds, 60); 
        }
      }
    } else if (mapInstanceRef.current && (!markers || markers.length === 0)) {
       const currentMapCenter = mapInstanceRef.current.getCenter();
        if (currentMapCenter && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
          mapInstanceRef.current.setCenter(center);
        }
        if (mapInstanceRef.current.getZoom() !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
        }
    }

  }, [isSdkLoaded, center, zoom, markers, mapIdProp, disableDefaultUI, fitBoundsToMarkers]);

  useEffect(() => {
    return () => {
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
    };
  }, []);

  if (mapError) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={mapStyle}>
        <p className="font-semibold mb-1 text-lg">Map Display Error</p>
        <p className="text-sm whitespace-pre-wrap">{mapError}</p>
        <p className="text-xs mt-2">Key source tried: {usedApiKeySource}. Ensure the API key is valid, "Maps JavaScript API" is enabled in Google Cloud Console, and check for billing/quota issues or restrictions.</p>
      </div>
    );
  }

  if (!isSdkLoaded && !mapError) {
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

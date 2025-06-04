
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
  disableDefaultUI?: boolean; // Added this prop
  fitBoundsToMarkers?: boolean; // Added this prop
}

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  mapId: mapIdProp,
  disableDefaultUI = false, // Default to false if not provided
  fitBoundsToMarkers = false, // Default to false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '200px' }), []); // Reduced minHeight for modal
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
    if (!isSdkLoaded || !mapRef.current || !google.maps) { // Added google.maps check
      return;
    }

    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: mapIdProp,
        disableDefaultUI: disableDefaultUI,
        mapTypeControl: !disableDefaultUI, // Explicitly show/hide if default UI is not disabled
        zoomControl: !disableDefaultUI,
        streetViewControl: !disableDefaultUI,
        fullscreenControl: !disableDefaultUI,
      });
    } else if (mapInstanceRef.current) {
      // Update center and zoom only if not fitting bounds or if they explicitly change
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

    // Clear existing markers
    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    // Add new markers
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

      // Fit bounds if requested and markers exist
      if (fitBoundsToMarkers && !bounds.isEmpty() && mapInstanceRef.current) {
        if (markers.length === 1) {
            mapInstanceRef.current.setCenter(bounds.getCenter());
            mapInstanceRef.current.setZoom(zoom); // Use default zoom for single marker
        } else {
            mapInstanceRef.current.fitBounds(bounds, 60); // 60px padding
        }
      }
    } else if (mapInstanceRef.current && (!markers || markers.length === 0)) {
      // No markers, just use center and zoom if not fitting bounds
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
      // mapInstanceRef.current = null; // Avoid destroying map instance on every re-render unless necessary
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

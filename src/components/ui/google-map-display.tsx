
"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { cn } from "@/lib/utils";
import { Skeleton } from './skeleton';
import { getCustomMapLabelOverlayClass, type ICustomMapLabelOverlay, type CustomMapLabelOverlayConstructor, type LabelType } from './custom-map-label-overlay';

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
  customMapLabel?: {
    position: google.maps.LatLngLiteral;
    content: string;
    type: LabelType; // Added type for styling
  } | null;
  className?: string;
  style?: React.CSSProperties;
  mapId?: string;
  disableDefaultUI?: boolean;
  fitBoundsToMarkers?: boolean;
}

const FALLBACK_API_KEY_FOR_MAPS = "AIzaSyAEnaOlXAGlkox-wpOOER7RUPhd8iWKhg4"; 

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  customMapLabel,
  className,
  style: propStyle,
  mapId: mapIdProp,
  disableDefaultUI = false,
  fitBoundsToMarkers = false,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  const customLabelOverlayRef = useRef<ICustomMapLabelOverlay | null>(null);
  const CustomMapLabelOverlayClassRef = useRef<CustomMapLabelOverlayConstructor | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [usedApiKeySource, setUsedApiKeySource] = useState<string>("unknown");

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '200px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  useEffect(() => {
    let isMounted = true;
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const firebaseApiKeyForMapsFallback = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    let apiKeyToUse: string | undefined = undefined;
    let apiKeySource: string = "unknown";

    if (googleMapsApiKey && googleMapsApiKey.trim() !== "") {
      apiKeyToUse = googleMapsApiKey;
      apiKeySource = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY";
    } else if (firebaseApiKeyForMapsFallback && firebaseApiKeyForMapsFallback.trim() !== "") {
      apiKeyToUse = firebaseApiKeyForMapsFallback;
      apiKeySource = "NEXT_PUBLIC_FIREBASE_API_KEY (as fallback for Maps)";
    } else {
      apiKeyToUse = FALLBACK_API_KEY_FOR_MAPS;
      apiKeySource = "Hardcoded Fallback (User Confirmed Key)";
    }
    
    if (isMounted) setUsedApiKeySource(apiKeySource);

    if (!apiKeyToUse) { 
      if (isMounted) setMapError("Critical Error: No Google Maps API Key could be determined.");
      return;
    }
    if (isMounted) setMapError(null);
    
    const loader = new Loader({
      apiKey: apiKeyToUse,
      version: "weekly",
      libraries: ["geocoding", "maps", "marker", "places"],
    });

    loader.load().then((loadedGoogle) => {
      if (isMounted) {
        if (loadedGoogle && loadedGoogle.maps && loadedGoogle.maps.Map) {
           CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(loadedGoogle.maps);
           setIsSdkLoaded(true);
           if (typeof window !== 'undefined' && !(window as any).google) {
             (window as any).google = loadedGoogle;
           }
        } else {
           const errorMsg = `Google Maps SDK loaded, but 'google.maps.Map' is not available. API Key used from: ${apiKeySource}. Check API key permissions for "Maps JavaScript API".`;
           setMapError(errorMsg);
           setIsSdkLoaded(false);
        }
      }
    }).catch(e => {
      if (isMounted) {
        const errorMsg = `Failed to load Google Maps SDK. API Key used from: ${apiKeySource}. Error: ${e.message || String(e)}`;
        setMapError(errorMsg);
        setIsSdkLoaded(false);
      }
    });
    return () => { isMounted = false; };
  }, []); 

  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current || typeof window.google === 'undefined' || !window.google.maps) return;

    const mapOptions: google.maps.MapOptions = {
        center, zoom, mapId: mapIdProp, disableDefaultUI,
        mapTypeControl: !disableDefaultUI, zoomControl: !disableDefaultUI,
        streetViewControl: !disableDefaultUI, fullscreenControl: !disableDefaultUI,
    };

    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
    } else if (mapInstanceRef.current) {
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

    if (markers && markers.length > 0 && mapInstanceRef.current && window.google.maps?.Marker && window.google.maps?.LatLngBounds) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position, map: mapInstanceRef.current,
          title: markerData.title, label: markerData.label,
        };
        if (markerData.iconUrl && markerData.iconScaledSize && window.google.maps.Size && window.google.maps.Point) {
          markerOptions.icon = {
            url: markerData.iconUrl,
            scaledSize: new window.google.maps.Size(markerData.iconScaledSize.width, markerData.iconScaledSize.height),
            anchor: new window.google.maps.Point(markerData.iconScaledSize.width / 2, markerData.iconScaledSize.height),
          };
        }
        const newMarker = new window.google.maps.Marker(markerOptions);
        currentMarkersRef.current.push(newMarker);
        if (markerData.position) bounds.extend(markerData.position);
      });

      if (fitBoundsToMarkers && !bounds.isEmpty() && mapInstanceRef.current) {
        if (markers.length === 1) {
            mapInstanceRef.current.setCenter(bounds.getCenter());
            mapInstanceRef.current.setZoom(15); 
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

    const CustomMapLabelOverlay = CustomMapLabelOverlayClassRef.current;
    if (mapInstanceRef.current && CustomMapLabelOverlay) {
      if (customMapLabel) {
        if (customLabelOverlayRef.current) {
            customLabelOverlayRef.current.updatePosition(customMapLabel.position);
            customLabelOverlayRef.current.updateContent(customMapLabel.content, customMapLabel.type);
            customLabelOverlayRef.current.show();
        } else {
          customLabelOverlayRef.current = new CustomMapLabelOverlay(customMapLabel.position, customMapLabel.content, customMapLabel.type);
          customLabelOverlayRef.current.setMap(mapInstanceRef.current);
        }
      } else {
        if (customLabelOverlayRef.current) {
          customLabelOverlayRef.current.setMap(null); 
          customLabelOverlayRef.current = null;
        }
      }
    }

  }, [isSdkLoaded, center, zoom, markers, mapIdProp, disableDefaultUI, fitBoundsToMarkers, customMapLabel]);

  useEffect(() => {
    return () => {
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      if (customLabelOverlayRef.current) {
        customLabelOverlayRef.current.setMap(null);
        customLabelOverlayRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center rounded-md shadow-md bg-destructive/10 text-destructive p-4", className)} style={mapStyle}>
        <p className="font-semibold mb-1 text-lg">Map Display Error</p>
        <p className="text-sm whitespace-pre-wrap">{mapError}</p>
        <p className="text-xs mt-2">Key source tried: {usedApiKeySource}.</p>
      </div>
    );
  }

  if (!isSdkLoaded && !mapError) {
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;

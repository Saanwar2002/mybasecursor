"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { cn } from "@/lib/utils";
import { Skeleton } from './skeleton';
import { getCustomMapLabelOverlayClass, type ICustomMapLabelOverlay, type CustomMapLabelOverlayConstructor, type LabelType } from './custom-map-label-overlay';

interface GoogleMapDisplayProps {
  center?: google.maps.LatLngLiteral; // Made center optional
  zoom?: number; // Made zoom optional
  markers?: Array<{
    position: google.maps.LatLngLiteral;
    title?: string;
    label?: string | google.maps.MarkerLabel;
    iconUrl?: string;
    iconScaledSize?: { width: number; height: number };
  }>;
  customMapLabels?: Array<{ 
    position: google.maps.LatLngLiteral;
    content: string;
    type: LabelType;
    variant?: 'default' | 'compact';
  }> | null;
  className?: string;
  style?: React.CSSProperties;
  mapId?: string;
  disableDefaultUI?: boolean;
  fitBoundsToMarkers?: boolean;
  onSdkLoaded?: (isLoaded: boolean) => void; 
  gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
  mapHeading?: number; 
  mapRotateControl?: boolean; 
  polylines?: Array<{ 
    path: google.maps.LatLngLiteral[];
    color: string;
    weight: number;
    opacity?: number;
  }>;
  driverIconRotation?: number; 
}

const FALLBACK_API_KEY_FOR_MAPS = "AIzaSyAEnaOlXAGlkox-wpOOER7RUPhd8iWKhg4"; 
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 }; // Huddersfield center
const DEFAULT_ZOOM = 13;


const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  center: centerProp,
  zoom: zoomProp,
  markers,
  customMapLabels, 
  className,
  style: propStyle,
  mapId: mapIdProp,
  disableDefaultUI = false,
  fitBoundsToMarkers = false,
  onSdkLoaded,
  gestureHandling = 'greedy',
  mapHeading,
  mapRotateControl,
  polylines,
  driverIconRotation, 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkersRef = useRef<google.maps.Marker[]>([]);
  const customLabelOverlaysRef = useRef<ICustomMapLabelOverlay[]>([]); 
  const CustomMapLabelOverlayClassRef = useRef<CustomMapLabelOverlayConstructor | null>(null);
  const currentPolylinesRef = useRef<google.maps.Polyline[]>([]); 
  const [isInternalSdkLoaded, setIsInternalSdkLoaded] = useState(false);
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
      libraries: ["geocoding", "maps", "marker", "places", "geometry", "routes"], 
    });

    loader.load().then((loadedGoogle) => {
      if (isMounted) {
        if (loadedGoogle && loadedGoogle.maps && loadedGoogle.maps.Map) {
           CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(loadedGoogle.maps);
           setIsInternalSdkLoaded(true);
           if(onSdkLoaded) onSdkLoaded(true);
           if (typeof window !== 'undefined' && !(window as any).google) {
             (window as any).google = loadedGoogle;
           }
        } else {
           const errorMsg = `Google Maps SDK loaded, but 'google.maps.Map' is not available. API Key used from: ${apiKeySource}. Check API key permissions for "Maps JavaScript API".`;
           setMapError(errorMsg);
           setIsInternalSdkLoaded(false);
           if(onSdkLoaded) onSdkLoaded(false);
        }
      }
    }).catch(e => {
      if (isMounted) {
        const errorMsg = `Failed to load Google Maps SDK. API Key used from: ${apiKeySource}. Error: ${e.message || String(e)}`;
        setMapError(errorMsg);
        setIsInternalSdkLoaded(false);
        if(onSdkLoaded) onSdkLoaded(false);
      }
    });
    return () => { isMounted = false; };
  }, [onSdkLoaded]); 

  useEffect(() => {
    if (!isInternalSdkLoaded || !mapRef.current || typeof window.google === 'undefined' || !window.google.maps) return;
    
    const currentCenter = centerProp !== undefined ? centerProp : DEFAULT_CENTER;
    const currentZoom = zoomProp !== undefined ? zoomProp : DEFAULT_ZOOM;

    const mapOptions: google.maps.MapOptions = {
        center: currentCenter, 
        zoom: currentZoom, 
        mapId: mapIdProp, 
        disableDefaultUI,
        mapTypeControl: !disableDefaultUI, 
        zoomControl: !disableDefaultUI,
        streetViewControl: !disableDefaultUI, 
        fullscreenControl: !disableDefaultUI,
        gestureHandling: gestureHandling,
        heading: mapHeading, 
        rotateControl: mapRotateControl, 
    };

    if (!mapInstanceRef.current || (mapIdProp && mapInstanceRef.current.getMapTypeId() !== mapIdProp)) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
    } else if (mapInstanceRef.current) {
       if (!fitBoundsToMarkers || !markers || markers.length < 1) {
        const mapInternalCenter = mapInstanceRef.current.getCenter();
        if (centerProp !== undefined && mapInternalCenter && (mapInternalCenter.lat() !== centerProp.lat || mapInternalCenter.lng() !== centerProp.lng)) {
          mapInstanceRef.current.setCenter(centerProp);
        }
        if (zoomProp !== undefined && mapInstanceRef.current.getZoom() !== zoomProp) {
          mapInstanceRef.current.setZoom(zoomProp);
        }
      }
       if (mapInstanceRef.current && typeof mapInstanceRef.current.getOptions === 'function') {
        const currentGestureHandling = mapInstanceRef.current.getOptions()?.gestureHandling;
        if (currentGestureHandling !== gestureHandling) {
          mapInstanceRef.current.setOptions({ gestureHandling });
        }
        if (mapHeading !== undefined && mapInstanceRef.current.getHeading() !== mapHeading) {
          mapInstanceRef.current.setHeading(mapHeading);
        }
        if (mapRotateControl !== undefined && mapInstanceRef.current.getOptions()?.rotateControl !== mapRotateControl) {
          mapInstanceRef.current.setOptions({ rotateControl: mapRotateControl });
        }
      }
    }

    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    if (markers && markers.length > 0 && mapInstanceRef.current && window.google.maps?.Marker && window.google.maps?.LatLngBounds) {
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
    }
    
    currentPolylinesRef.current.forEach(polyline => polyline.setMap(null));
    currentPolylinesRef.current = [];
    if (polylines && polylines.length > 0 && mapInstanceRef.current && window.google.maps.Polyline && window.google.maps.LatLng) {
      polylines.forEach(polylineData => {
        const newPolyline = new window.google.maps.Polyline({
          path: polylineData.path,
          strokeColor: polylineData.color,
          strokeOpacity: polylineData.opacity ?? 0.8,
          strokeWeight: polylineData.weight,
          map: mapInstanceRef.current,
        });
        currentPolylinesRef.current.push(newPolyline);
        if (fitBoundsToMarkers && polylineData.path && polylineData.path.length > 0) {
            polylineData.path.forEach(point => {
              bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
            });
        }
      });
    }

    if (fitBoundsToMarkers && !bounds.isEmpty() && mapInstanceRef.current) {
        if (markers && markers.length === 1 && (!polylines || polylines.every(p => !p.path || p.path.length === 0))) {
            mapInstanceRef.current.setCenter(bounds.getCenter());
            if (zoomProp !== undefined) mapInstanceRef.current.setZoom(zoomProp); // Use prop zoom if available
            else mapInstanceRef.current.setZoom(15); // Default zoom for single marker
        } else {
            mapInstanceRef.current.fitBounds(bounds, 20); 
        }
    } else if (mapInstanceRef.current) {
       const mapInternalCenter = mapInstanceRef.current.getCenter();
        if (centerProp !== undefined && mapInternalCenter && (mapInternalCenter.lat() !== centerProp.lat || mapInternalCenter.lng() !== centerProp.lng)) {
          mapInstanceRef.current.setCenter(centerProp);
        }
        if (zoomProp !== undefined && mapInstanceRef.current.getZoom() !== zoomProp) {
          mapInstanceRef.current.setZoom(zoomProp);
        }
    }

    const CustomMapLabelOverlay = CustomMapLabelOverlayClassRef.current;
    if (mapInstanceRef.current && CustomMapLabelOverlay) {
      customLabelOverlaysRef.current.forEach(overlay => overlay.setMap(null));
      customLabelOverlaysRef.current = [];

      if (customMapLabels && customMapLabels.length > 0) {
        customMapLabels.forEach(labelData => {
          const newLabelOverlay = new CustomMapLabelOverlay(labelData.position, labelData.content, labelData.type, labelData.variant || 'default'); 
          newLabelOverlay.setMap(mapInstanceRef.current);
          customLabelOverlaysRef.current.push(newLabelOverlay);
        });
      }
    }

  }, [isInternalSdkLoaded, centerProp, zoomProp, markers, mapIdProp, disableDefaultUI, fitBoundsToMarkers, customMapLabels, gestureHandling, mapHeading, mapRotateControl, polylines, driverIconRotation]);

  useEffect(() => {
    return () => {
      currentMarkersRef.current.forEach(marker => marker.setMap(null));
      currentMarkersRef.current = [];
      customLabelOverlaysRef.current.forEach(overlay => overlay.setMap(null));
      customLabelOverlaysRef.current = [];
      currentPolylinesRef.current.forEach(polyline => polyline.setMap(null));
      currentPolylinesRef.current = [];
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

  if (!isInternalSdkLoaded && !mapError) {
    return <Skeleton className={cn("rounded-md shadow-md", className)} style={mapStyle} aria-label="Loading map..." />;
  }

  return <div ref={mapRef} style={mapStyle} className={cn("rounded-md shadow-md bg-muted/30", className)} />;
};

export default GoogleMapDisplay;
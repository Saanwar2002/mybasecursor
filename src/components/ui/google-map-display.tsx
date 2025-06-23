"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useGoogleMaps } from '@/contexts/google-maps/google-maps-provider';
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
  
  const { isLoaded: isSdkLoaded, google, loadError } = useGoogleMaps();
  const [mapError, setMapError] = useState<string | null>(null);

  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '200px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  useEffect(() => {
    if (loadError) {
      setMapError(`Failed to load Google Maps SDK: ${loadError.message}`);
    }
  }, [loadError]);

  useEffect(() => {
    if (isSdkLoaded && google && !CustomMapLabelOverlayClassRef.current) {
        CustomMapLabelOverlayClassRef.current = getCustomMapLabelOverlayClass(google.maps);
    }
  }, [isSdkLoaded, google]);


  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current || !google || !google.maps) return;
    
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
      mapInstanceRef.current = new google.maps.Map(mapRef.current, mapOptions);
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
       if (mapInstanceRef.current) {
        if (mapInstanceRef.current.gestureHandling !== gestureHandling) {
          mapInstanceRef.current.setOptions({ gestureHandling });
        }
        if (mapHeading !== undefined && mapInstanceRef.current.getHeading() !== mapHeading) {
          mapInstanceRef.current.setHeading(mapHeading);
        }
        if (mapRotateControl !== undefined && mapInstanceRef.current.rotateControl !== mapRotateControl) {
          mapInstanceRef.current.setOptions({ rotateControl: mapRotateControl });
        }
      }
    }

    currentMarkersRef.current.forEach(marker => marker.setMap(null));
    currentMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    if (markers && markers.length > 0 && mapInstanceRef.current && google.maps?.Marker && google.maps?.LatLngBounds) {
      markers.forEach(markerData => {
        let markerOptions: google.maps.MarkerOptions = {
          position: markerData.position, map: mapInstanceRef.current,
          title: markerData.title, label: markerData.label,
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
        if (markerData.position) bounds.extend(markerData.position);
      });
    }
    
    currentPolylinesRef.current.forEach(polyline => polyline.setMap(null));
    currentPolylinesRef.current = [];
    if (polylines && polylines.length > 0 && mapInstanceRef.current && google.maps.Polyline && google.maps.LatLng) {
      polylines.forEach(polylineData => {
        const newPolyline = new google.maps.Polyline({
          path: polylineData.path,
          strokeColor: polylineData.color,
          strokeOpacity: polylineData.opacity ?? 0.8,
          strokeWeight: polylineData.weight,
          map: mapInstanceRef.current,
        });
        currentPolylinesRef.current.push(newPolyline);
        if (fitBoundsToMarkers && polylineData.path && polylineData.path.length > 0) {
            polylineData.path.forEach(point => {
              bounds.extend(new google.maps.LatLng(point.lat, point.lng));
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
          const overlay = new CustomMapLabelOverlay(
            labelData.position,
            labelData.content,
            { variant: labelData.variant ?? 'default' },
            mapInstanceRef.current as google.maps.Map
          );
          customLabelOverlaysRef.current.push(overlay);
        });
      }
    }

  }, [isSdkLoaded, google, centerProp, zoomProp, markers, mapIdProp, disableDefaultUI, fitBoundsToMarkers, customMapLabels, gestureHandling, mapHeading, mapRotateControl, polylines, driverIconRotation]);

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
      </div>
    );
  }

  if (!isSdkLoaded) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)} style={mapStyle}>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return <div ref={mapRef} className={className} style={mapStyle} />;
};

export default GoogleMapDisplay;

"use client";
import React, { Suspense, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from "@/lib/utils";

// Fix for default marker icon issue with Webpack.
// This needs to be done once, ideally when the module is first loaded client-side.
if (typeof window !== 'undefined') {
    // Ensure this fix runs only once
    if (!(L.Icon.Default.prototype as any)._getIconUrlFixed) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        (L.Icon.Default.prototype as any)._getIconUrlFixed = true; // Mark as fixed
    }
}

// Lazy load react-leaflet components
const LazyMapContainer = React.lazy(() => import('react-leaflet').then(module => ({ default: module.MapContainer })));
const LazyTileLayer = React.lazy(() => import('react-leaflet').then(module => ({ default: module.TileLayer })));
const LazyMarker = React.lazy(() => import('react-leaflet').then(module => ({ default: module.Marker })));
const LazyPopup = React.lazy(() => import('react-leaflet').then(module => ({ default: module.Popup })));


interface MapDisplayProps {
  center: [number, number]; // latitude, longitude
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popupText?: string;
    iconUrl?: string; // URL for a custom marker icon
    iconSize?: [number, number]; // [width, height] for custom icon
  }>;
  className?: string;
  style?: React.CSSProperties;
  scrollWheelZoom?: boolean;
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  scrollWheelZoom = true,
}) => {
  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);
  const mapStyle = propStyle || defaultStyle;

  const createCustomIcon = (iconUrl: string, iconSize: [number, number] = [25, 41]) => {
    return L.icon({
      iconUrl,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1]],
      popupAnchor: [0, -iconSize[1]],
    });
  };

  // Fallback for Suspense, though loading state is typically handled by next/dynamic
  const fallbackDiv = <div className={cn("flex items-center justify-center bg-muted rounded-md", className)} style={mapStyle}>Loading map...</div>;

  return (
    <Suspense fallback={fallbackDiv}>
      <LazyMapContainer
        center={center}
        zoom={zoom}
        style={mapStyle}
        className={cn("rounded-md shadow-md", className)}
        scrollWheelZoom={scrollWheelZoom}
      >
        <LazyTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers?.map((marker, idx) => (
          <LazyMarker
            key={idx}
            position={marker.position}
            icon={marker.iconUrl ? createCustomIcon(marker.iconUrl, marker.iconSize) : new L.Icon.Default()}
          >
            {marker.popupText && <LazyPopup>{marker.popupText}</LazyPopup>}
          </LazyMarker>
        ))}
      </LazyMapContainer>
    </Suspense>
  );
};
export default MapDisplay;


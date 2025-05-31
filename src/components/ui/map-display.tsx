
"use client";
import React, { useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// MapContainer and other react-leaflet components are commented out
// import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { cn } from "@/lib/utils";
import { Skeleton } from './skeleton'; // Keep Skeleton for consistency if needed elsewhere

// Fix for default marker icon issue with Webpack - can remain as it's not harmful
if (typeof window !== 'undefined') {
    if (!(L.Icon.Default.prototype as any)._getIconUrlFixed) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        (L.Icon.Default.prototype as any)._getIconUrlFixed = true;
    }
}

interface MapDisplayProps {
  center: [number, number]; // latitude, longitude
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popupText?: string;
    iconUrl?: string;
    iconSize?: [number, number];
  }>;
  className?: string;
  style?: React.CSSProperties;
  scrollWheelZoom?: boolean;
  placeholder?: React.ReactNode; // Kept for interface consistency, but not used by MapContainer now
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  scrollWheelZoom = true,
}) => {
  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '0.5rem', backgroundColor: '#f9f9f9' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  // Render a placeholder instead of the map
  return (
    <div
      style={mapStyle}
      className={cn("map-display-placeholder", className)}
      aria-label="Map container temporarily disabled"
    >
      <p className="text-muted-foreground text-center p-4">
        Map rendering is temporarily disabled. <br />
        Center: {center.join(', ')}, Zoom: {zoom}
      </p>
    </div>
  );

  // Original MapContainer logic is commented out:
  /*
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
     return (
      <Skeleton
        className={cn("rounded-md shadow-md w-full h-full min-h-[300px]", className)}
        style={mapStyle}
        aria-label="Loading map..."
      />
    );
  }

  const createCustomIcon = (iconUrl: string, iconSize: [number, number] = [25, 41]) => {
    return L.icon({
      iconUrl,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1]],
      popupAnchor: [0, -iconSize[1]],
    });
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={mapStyle}
      className={cn("rounded-md shadow-md", className)}
      scrollWheelZoom={scrollWheelZoom}
      placeholder={<Skeleton className={cn("w-full h-full rounded-md", className)} />}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers?.map((marker, idx) => (
        <Marker
          key={idx}
          position={marker.position}
          icon={marker.iconUrl ? createCustomIcon(marker.iconUrl, marker.iconSize) : new L.Icon.Default()}
        >
          {marker.popupText && <Popup>{marker.popupText}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
  */
};
export default MapDisplay;

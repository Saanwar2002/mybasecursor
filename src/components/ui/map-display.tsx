
"use client";
import React, { useMemo, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { cn } from "@/lib/utils";
import { Skeleton } from './skeleton';

// Fix for default marker icon issue with Webpack
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
  placeholder?: React.ReactNode;
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  center,
  zoom = 13,
  markers,
  className,
  style: propStyle,
  scrollWheelZoom = true,
}) => {
  const defaultStyle = useMemo(() => ({ height: '100%', width: '100%', minHeight: '300px' }), []);
  const mapStyle = propStyle ? { ...defaultStyle, ...propStyle } : defaultStyle;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
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
      iconAnchor: [iconSize[0] / 2, iconSize[1]], // point of the icon which will correspond to marker's location
      popupAnchor: [0, -iconSize[1]] // point from which the popup should open relative to the iconAnchor
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
};
export default MapDisplay;


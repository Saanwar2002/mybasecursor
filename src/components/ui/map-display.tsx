
"use client";
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from "@/lib/utils"; 

// Fix for default marker icon issue with Webpack.
// This needs to be done once, ideally when the module is first loaded client-side.
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
}

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
  style = { height: '100%', width: '100%' },
  scrollWheelZoom = true, // Default to true for better usability on larger maps
}) => {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Indicate that we are on the client-side
    if (typeof window !== 'undefined') {
      import('react-leaflet').then(RL => {
        setMapContainer(() => RL.MapContainer);
        setTileLayer(() => RL.TileLayer);
        setMarker(() => RL.Marker);
        setPopup(() => RL.Popup);
      }).catch(error => console.error("Failed to load react-leaflet", error));
    }
  }, []);

  if (!isClient || !MapContainer || !TileLayer || !Marker || !Popup) {
    return <div className={cn("flex items-center justify-center bg-muted rounded-md", className)} style={style}>Loading map...</div>;
  }

  const createCustomIcon = (iconUrl: string, iconSize: [number, number] = [25, 41]) => {
    return L.icon({
      iconUrl,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1]], // Point of the icon which will correspond to marker's location
      popupAnchor: [0, -iconSize[1]], // Point from which the popup should open relative to the iconAnchor
    });
  };

  return (
    <MapContainer center={center} zoom={zoom} style={style} className={cn("rounded-md shadow-md", className)} scrollWheelZoom={scrollWheelZoom}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers?.map((marker, idx) => (
        <Marker 
          key={idx} 
          position={marker.position} 
          icon={marker.iconUrl ? createCustomIcon(marker.iconUrl, marker.iconSize) : L.Icon.Default.prototype}
        >
          {marker.popupText && <Popup>{marker.popupText}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
};
export default MapDisplay;

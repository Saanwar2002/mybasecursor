import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  name?: string;
  location: { lat: number; lng: number };
  [key: string]: any;
}

// Haversine formula to calculate distance in miles between two lat/lng points
export function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useNearbyDrivers(pickupCoords?: { lat: number; lng: number }, operatorCode?: string, fallbackToAny: boolean = false) {
  const [drivers, setDrivers] = useState<DriverMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (!db) {
      setError('Firestore not initialized');
      setLoading(false);
      return;
    }
    const dbInstance = db as import('firebase/firestore').Firestore;
    setLoading(true);
    setUsedFallback(false);
    console.log('[useNearbyDrivers] pickupCoords:', pickupCoords);
    let q;
    if (operatorCode) {
      q = query(
        collection(dbInstance, 'drivers'),
        where('status', '==', 'Active'),
        where('operatorCode', '==', operatorCode)
      );
    } else {
      q = query(
        collection(dbInstance, 'drivers'),
        where('status', '==', 'Active')
      );
    }
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let driverMarkers: DriverMarker[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
              return { id: doc.id, ...data } as DriverMarker;
            }
            return null;
          })
          .filter(Boolean) as DriverMarker[];
        // Filter by proximity if pickupCoords is provided
        const NEARBY_RADIUS_MILES = 1;
        if (pickupCoords) {
          driverMarkers = driverMarkers.filter(driver => {
            const dist = getDistanceMiles(
              pickupCoords.lat,
              pickupCoords.lng,
              driver.location.lat,
              driver.location.lng
            );
            console.log(`[useNearbyDrivers] Driver ${driver.id} at (${driver.location.lat},${driver.location.lng}) distance from pickup: ${dist.toFixed(2)} miles`);
            return dist <= NEARBY_RADIUS_MILES;
          });
        }
        if (operatorCode && fallbackToAny && driverMarkers.length === 0) {
          // Fallback to any active driver
          const fallbackQ = query(
            collection(dbInstance, 'drivers'),
            where('status', '==', 'Active')
          );
          const fallbackUnsub = onSnapshot(
            fallbackQ,
            (fallbackSnap) => {
              let fallbackDrivers: DriverMarker[] = fallbackSnap.docs
                .map((doc) => {
                  const data = doc.data();
                  if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
                    return { id: doc.id, ...data } as DriverMarker;
                  }
                  return null;
                })
                .filter(Boolean) as DriverMarker[];
              if (pickupCoords) {
                fallbackDrivers = fallbackDrivers.filter(driver => {
                  const dist = getDistanceMiles(
                    pickupCoords.lat,
                    pickupCoords.lng,
                    driver.location.lat,
                    driver.location.lng
                  );
                  console.log(`[useNearbyDrivers] (Fallback) Driver ${driver.id} at (${driver.location.lat},${driver.location.lng}) distance from pickup: ${dist.toFixed(2)} miles`);
                  return dist <= NEARBY_RADIUS_MILES;
                });
              }
              setDrivers(fallbackDrivers);
              setUsedFallback(true);
              setLoading(false);
            },
            (err) => {
              setError(err.message);
              setLoading(false);
            }
          );
          return () => fallbackUnsub();
        } else {
          setDrivers(driverMarkers);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [pickupCoords, operatorCode, fallbackToAny]);

  return { drivers, loading, error, usedFallback };
} 
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
    
    // Validate pickupCoords if provided
    if (pickupCoords && (typeof pickupCoords.lat !== 'number' || typeof pickupCoords.lng !== 'number' || 
        isNaN(pickupCoords.lat) || isNaN(pickupCoords.lng))) {
      console.warn('useNearbyDrivers: Invalid pickupCoords provided:', pickupCoords);
      setError('Invalid pickup coordinates');
      setLoading(false);
      return;
    }
    
    // Validate operatorCode if provided
    if (operatorCode && (typeof operatorCode !== 'string' || operatorCode.trim() === '')) {
      console.warn('useNearbyDrivers: Invalid operatorCode provided:', operatorCode);
      setError('Invalid operator code');
      setLoading(false);
      return;
    }
    
    const dbInstance = db as import('firebase/firestore').Firestore;
    setLoading(true);
    setError(null);
    setUsedFallback(false);
    
    console.log('[useNearbyDrivers] pickupCoords:', pickupCoords);
    
    let q;
    try {
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
    } catch (queryError: any) {
      console.error('useNearbyDrivers: Error creating query:', queryError);
      setError(`Query error: ${queryError.message}`);
      setLoading(false);
      return;
    }
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            let driverMarkers: DriverMarker[] = snapshot.docs
              .map((doc) => {
                try {
                  const data = doc.data();
                  if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
                    return { id: doc.id, ...data } as DriverMarker;
                  }
                  return null;
                } catch (docError: any) {
                  console.error('useNearbyDrivers: Error processing driver doc:', docError);
                  return null;
                }
              })
              .filter(Boolean) as DriverMarker[];
            
            // Filter by proximity if pickupCoords is provided
            const NEARBY_RADIUS_MILES = 1;
            if (pickupCoords) {
              driverMarkers = driverMarkers.filter(driver => {
                try {
                  const dist = getDistanceMiles(
                    pickupCoords.lat,
                    pickupCoords.lng,
                    driver.location.lat,
                    driver.location.lng
                  );
                  console.log(`[useNearbyDrivers] Driver ${driver.id} at (${driver.location.lat},${driver.location.lng}) distance from pickup: ${dist.toFixed(2)} miles`);
                  return dist <= NEARBY_RADIUS_MILES;
                } catch (distanceError: any) {
                  console.error('useNearbyDrivers: Error calculating distance for driver:', driver.id, distanceError);
                  return false;
                }
              });
            }
            
            if (operatorCode && fallbackToAny && driverMarkers.length === 0) {
              // Fallback to any active driver
              try {
                const fallbackQ = query(
                  collection(dbInstance, 'drivers'),
                  where('status', '==', 'Active')
                );
                const fallbackUnsub = onSnapshot(
                  fallbackQ,
                  (fallbackSnap) => {
                    try {
                      let fallbackDrivers: DriverMarker[] = fallbackSnap.docs
                        .map((doc) => {
                          try {
                            const data = doc.data();
                            if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
                              return { id: doc.id, ...data } as DriverMarker;
                            }
                            return null;
                          } catch (docError: any) {
                            console.error('useNearbyDrivers: Error processing fallback driver doc:', docError);
                            return null;
                          }
                        })
                        .filter(Boolean) as DriverMarker[];
                      
                      if (pickupCoords) {
                        fallbackDrivers = fallbackDrivers.filter(driver => {
                          try {
                            const dist = getDistanceMiles(
                              pickupCoords.lat,
                              pickupCoords.lng,
                              driver.location.lat,
                              driver.location.lng
                            );
                            console.log(`[useNearbyDrivers] (Fallback) Driver ${driver.id} at (${driver.location.lat},${driver.location.lng}) distance from pickup: ${dist.toFixed(2)} miles`);
                            return dist <= NEARBY_RADIUS_MILES;
                          } catch (distanceError: any) {
                            console.error('useNearbyDrivers: Error calculating fallback distance for driver:', driver.id, distanceError);
                            return false;
                          }
                        });
                      }
                      setDrivers(fallbackDrivers);
                      setUsedFallback(true);
                      setLoading(false);
                    } catch (fallbackSnapshotError: any) {
                      console.error('useNearbyDrivers: Error processing fallback snapshot:', fallbackSnapshotError);
                      setError(`Fallback snapshot error: ${fallbackSnapshotError.message}`);
                      setLoading(false);
                    }
                  },
                  (err) => {
                    console.error('useNearbyDrivers: Fallback Firestore error:', err);
                    setError(err.message);
                    setLoading(false);
                  }
                );
                return () => fallbackUnsub();
              } catch (fallbackQueryError: any) {
                console.error('useNearbyDrivers: Error creating fallback query:', fallbackQueryError);
                setError(`Fallback query error: ${fallbackQueryError.message}`);
                setLoading(false);
              }
            } else {
              setDrivers(driverMarkers);
              setLoading(false);
            }
          } catch (snapshotError: any) {
            console.error('useNearbyDrivers: Error processing snapshot:', snapshotError);
            setError(`Snapshot processing error: ${snapshotError.message}`);
            setLoading(false);
          }
        },
        (err) => {
          console.error('useNearbyDrivers: Firestore error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    } catch (onSnapshotError: any) {
      console.error('useNearbyDrivers: Error setting up onSnapshot:', onSnapshotError);
      setError(`Snapshot setup error: ${onSnapshotError.message}`);
      setLoading(false);
    }
    
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cleanupError: any) {
          console.error('useNearbyDrivers: Error during cleanup:', cleanupError);
        }
      }
    };
  }, [pickupCoords, operatorCode, fallbackToAny]);

  return { drivers, loading, error, usedFallback };
} 
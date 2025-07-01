import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  name?: string;
  location: { lat: number; lng: number };
  [key: string]: any;
}

export function useNearbyDrivers(operatorCode?: string, fallbackToAny: boolean = false) {
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
    setLoading(true);
    setUsedFallback(false);
    let q;
    if (operatorCode) {
      q = query(
        collection(db, 'drivers'),
        where('status', '==', 'Active'),
        where('operatorCode', '==', operatorCode)
      );
    } else {
      q = query(
        collection(db, 'drivers'),
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
        if (operatorCode && fallbackToAny && driverMarkers.length === 0) {
          // Fallback to any active driver
          const fallbackQ = query(
            collection(db, 'drivers'),
            where('status', '==', 'Active')
          );
          const fallbackUnsub = onSnapshot(
            fallbackQ,
            (fallbackSnap) => {
              const fallbackDrivers: DriverMarker[] = fallbackSnap.docs
                .map((doc) => {
                  const data = doc.data();
                  if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
                    return { id: doc.id, ...data } as DriverMarker;
                  }
                  return null;
                })
                .filter(Boolean) as DriverMarker[];
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
  }, [operatorCode, fallbackToAny]);

  return { drivers, loading, error, usedFallback };
} 
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  name?: string;
  location: { lat: number; lng: number };
  [key: string]: any;
}

export function useNearbyDrivers() {
  const [drivers, setDrivers] = useState<DriverMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError('Firestore not initialized');
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'drivers'),
      where('status', '==', 'Active')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const driverMarkers: DriverMarker[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
              return { id: doc.id, ...data } as DriverMarker;
            }
            return null;
          })
          .filter(Boolean) as DriverMarker[];
        setDrivers(driverMarkers);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { drivers, loading, error };
} 
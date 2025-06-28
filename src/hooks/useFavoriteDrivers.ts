import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';

export interface FavoriteDriver {
  id: string;
  driverId: string;
  name?: string;
  avatarUrl?: string;
  vehicleInfo?: string;
}

export function useFavoriteDrivers(userId: string | undefined | null) {
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !userId) {
      setFavoriteDrivers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const favRef = collection(db, 'users', userId, 'favoriteDrivers');
    const unsubscribe = onSnapshot(
      favRef,
      async (snapshot) => {
        const favs: FavoriteDriver[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const driverId = data.driverId;
          let name = data.name;
          let avatarUrl = data.avatarUrl;
          let vehicleInfo = data.vehicleInfo;
          // Optionally fetch driver details from main users collection
          if ((!name || !avatarUrl || !vehicleInfo) && db) {
            try {
              const driverDoc = await getDoc(doc(db, 'users', driverId));
              if (driverDoc.exists()) {
                const driverData = driverDoc.data();
                name = name || driverData.name;
                avatarUrl = avatarUrl || driverData.avatarUrl;
                vehicleInfo = vehicleInfo || driverData.vehicleMakeModel + (driverData.vehicleRegistration ? ` - ${driverData.vehicleRegistration}` : '');
              }
            } catch {}
          }
          favs.push({ id: docSnap.id, driverId, name, avatarUrl, vehicleInfo });
        }
        setFavoriteDrivers(favs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  return { favoriteDrivers, loading, error };
} 
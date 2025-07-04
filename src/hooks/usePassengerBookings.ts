import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export interface Booking {
  id: string;
  passengerId: string;
  driverId?: string;
  status: string;
  bookingTimestamp: any;
  [key: string]: any;
}

export function usePassengerBookings(userId: string | undefined | null, statusFilter?: string | string[]) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Defensive checks
    if (!db || !userId) {
      setBookings([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (Array.isArray(statusFilter)) {
      if (statusFilter.length === 0) {
        console.warn('usePassengerBookings: statusFilter is an empty array, skipping query.');
        setBookings([]);
        setLoading(false);
        setError(null);
        return;
      }
      if (statusFilter.length > 10) {
        console.warn('usePassengerBookings: statusFilter has more than 10 values, skipping query.');
        setBookings([]);
        setLoading(false);
        setError('Too many status filters.');
        return;
      }
    }
    // Log parameters for debugging
    console.log('usePassengerBookings: userId', userId, 'statusFilter', statusFilter);
    setLoading(true);
    let q;
    if (Array.isArray(statusFilter) && statusFilter.length > 0) {
      q = query(
        collection(db, 'bookings'),
        where('passengerId', '==', userId),
        where('status', 'in', statusFilter),
        orderBy('bookingTimestamp', 'desc')
      );
    } else if (typeof statusFilter === 'string') {
      q = query(
        collection(db, 'bookings'),
        where('passengerId', '==', userId),
        where('status', '==', statusFilter),
        orderBy('bookingTimestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, 'bookings'),
        where('passengerId', '==', userId),
        orderBy('bookingTimestamp', 'desc')
      );
    }
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rides: Booking[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Booking));
        setBookings(rides);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId, statusFilter]);

  return { bookings, loading, error };
} 
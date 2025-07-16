import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Timestamp, SerializedTimestamp, FirebaseError } from '../types/global';

export interface Booking {
  id: string;
  passengerId: string;
  driverId?: string;
  status: string;
  bookingTimestamp: Timestamp | SerializedTimestamp;
  [key: string]: unknown;
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
    
    // Additional validation for userId
    if (typeof userId !== 'string' || userId.trim() === '') {
      console.warn('usePassengerBookings: Invalid userId provided:', userId);
      setBookings([]);
      setLoading(false);
      setError('Invalid user ID');
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
      // Validate each status filter value
      const invalidStatuses = statusFilter.filter(status => typeof status !== 'string' || status.trim() === '');
      if (invalidStatuses.length > 0) {
        console.warn('usePassengerBookings: Invalid status values found:', invalidStatuses);
        setBookings([]);
        setLoading(false);
        setError('Invalid status filter values');
        return;
      }
    } else if (typeof statusFilter === 'string' && statusFilter.trim() === '') {
      console.warn('usePassengerBookings: Empty string statusFilter provided');
      setBookings([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // Log parameters for debugging
    console.log('usePassengerBookings: userId', userId, 'statusFilter', statusFilter);
    setLoading(true);
    setError(null);
    
    let q;
    try {
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
    } catch (queryError: FirebaseError) {
      console.error('usePassengerBookings: Error creating query:', queryError);
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
            const rides: Booking[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Booking));
            setBookings(rides);
            setLoading(false);
            setError(null);
          } catch (snapshotError: FirebaseError) {
            console.error('usePassengerBookings: Error processing snapshot:', snapshotError);
            setError(`Snapshot processing error: ${snapshotError.message}`);
            setLoading(false);
          }
        },
        (err) => {
          console.error('usePassengerBookings: Firestore error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    } catch (onSnapshotError: FirebaseError) {
      console.error('usePassengerBookings: Error setting up onSnapshot:', onSnapshotError);
      setError(`Snapshot setup error: ${onSnapshotError.message}`);
      setLoading(false);
    }
    
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cleanupError: FirebaseError) {
          console.error('usePassengerBookings: Error during cleanup:', cleanupError);
        }
      }
    };
  }, [userId, statusFilter]);

  return { bookings, loading, error };
} 
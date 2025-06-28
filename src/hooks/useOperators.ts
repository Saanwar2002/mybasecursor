import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';

export interface Operator {
  id: string;
  name: string;
  status?: string;
  operatorCode?: string;
  [key: string]: any;
}

export function useOperators() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError('Firestore not initialized');
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'users'), where('role', '==', 'operator'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ops: Operator[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Operator));
        setOperators(ops);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { operators, loading, error };
} 
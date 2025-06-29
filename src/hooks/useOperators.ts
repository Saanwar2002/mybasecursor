import { useState, useEffect } from 'react';

interface Operator {
  id: string;
  operatorCode: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

export function useOperators() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/operators/list-approved');
      const data = await response.json();
      
      if (data.success) {
        setOperators(data.operators);
      } else {
        setError(data.error || 'Failed to fetch operators');
      }
    } catch (err) {
      setError('Failed to fetch operators');
      console.error('Error fetching operators:', err);
    } finally {
      setLoading(false);
    }
  };

  const getOperatorByCode = (operatorCode: string) => {
    return operators.find(op => op.operatorCode === operatorCode);
  };

  const getOperatorById = (id: string) => {
    return operators.find(op => op.id === id);
  };

  return {
    operators,
    loading,
    error,
    refetch: fetchOperators,
    getOperatorByCode,
    getOperatorById
  };
} 
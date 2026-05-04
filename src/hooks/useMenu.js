import { useState, useEffect } from 'react';
import { getMenu } from '../api/menu';

export function useMenu() {
  const tableId = localStorage.getItem('tableId');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getMenu(tableId)
      .then((data) => {
        if (!cancelled) {
          setCategories(data || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('useMenu fetch error:', err);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tableId]);

  return { categories, loading, error };
}

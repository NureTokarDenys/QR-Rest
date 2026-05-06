import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getMenu } from '../api/menu';

/**
 * Fetches and returns the full menu for the current restaurant.
 *
 * The restaurant publicId is always required in the URL path:
 *   GET /api/<publicId>/menu
 *
 * Both flows supply it:
 *   • QR-scan flow  — initSession() stores publicId as "restaurantId" in localStorage
 *   • Picker flow   — selectRestaurant() does the same
 *
 * If restaurantId is not yet known the hook returns an empty list.
 */
export function useMenu() {
  const { restaurantId } = useApp();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMenu(restaurantId)
      .then(data => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('useMenu fetch error:', err);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [restaurantId]);

  return { categories, loading, error };
}

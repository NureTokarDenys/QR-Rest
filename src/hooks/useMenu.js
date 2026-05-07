import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
 *
 * The backend now returns translated content automatically via the
 * Accept-Language header set by the API client interceptor.
 *
 * If the menu response includes a restaurant object with language metadata
 * (defaultLanguage / enabledLanguages), it is forwarded to AppContext so the
 * client language picker reflects the restaurant's configured languages.
 */
export function useMenu() {
  const { restaurantId, setRestaurantMeta } = useApp();
  const { i18n } = useTranslation();

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
        if (cancelled) return;

        // The backend may return either:
        //   A) an array of categories  (current shape)
        //   B) { categories: [...], restaurant: { name, defaultLanguage, enabledLanguages } }
        if (Array.isArray(data)) {
          setCategories(data);
        } else if (data && Array.isArray(data.categories)) {
          setCategories(data.categories);
          // Propagate restaurant metadata (translated name + language config)
          if (data.restaurant) {
            setRestaurantMeta({
              name:             data.restaurant.name,
              nameLang:         i18n.language,   // tell context which lang slot to update
              defaultLanguage:  data.restaurant.defaultLanguage,
              enabledLanguages: data.restaurant.enabledLanguages,
            });
          }
        } else {
          setCategories([]);
        }
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
  }, [restaurantId, i18n.language]); // re-fetch when language changes so backend returns fresh translations

  return { categories, loading, error };
}

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import SearchBar from '../../../components/SearchBar';
import CategoryCard from '../../../components/client/CategoryCard';
import Footer from '../../../components/client/Footer';
import MenuHeader from '../../../components/client/MenuHeader';
import { useMenu } from '../../../hooks/useMenu';
import { searchMenu } from '../../../api/menu';
import styles from './menu.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Menu() {
  const { t } = useTranslation('menu');
  const navigate = useNavigate();
  const { sessionToken, restaurantId } = useApp();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const local = useLocalField();

  const { categories, loading, error } = useMenu();

  // If the stored restaurantId is stale (e.g. old MongoDB ObjectId from before
  // the publicId migration), the backend returns RESTAURANT_NOT_FOUND.
  // Clear all stale session data and redirect to the picker.
  useEffect(() => {
    const code = error?.response?.data?.error?.code;
    if (code === 'RESTAURANT_NOT_FOUND' || (error?.response?.status === 404 && code)) {
      ['restaurantId', 'restaurantName', 'sessionToken', 'tableId', 'tableNumber'].forEach(
        k => localStorage.removeItem(k)
      );
      navigate('/restaurants', { replace: true });
    }
  }, [error, navigate]);

  // Debounced menu search — restaurantId is always in the path now
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      searchMenu(query.trim(), restaurantId)
        .then(data => setSearchResults(Array.isArray(data) ? data : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, restaurantId]);

  // Guard: no restaurant context at all → send to picker.
  // Must be AFTER all hooks to satisfy the rules of hooks.
  if (!sessionToken && !restaurantId) {
    return <Navigate to="/restaurants" replace />;
  }

  // Normalise API category to shape expected by CategoryCard
  const normalisedCategories = categories.map(cat => ({
    id:      cat._id || cat.id,
    name:    cat.name,
    name_en: cat.name_en || cat.name,
    count:   (cat.items || []).length,
    image:   cat.imageUrl || cat.image || null,
  }));

  return (
    <div className={styles.page}>
      <MenuHeader />

      <div className={styles.content}>
        <SearchBar
          placeholder={t('search_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {query.trim() ? (
          <div className={styles.searchResults}>
            {searching && <p className={styles.empty}>…</p>}
            {!searching && searchResults.length === 0 && (
              <p className={styles.empty}>{t('empty')}</p>
            )}
            {!searching && searchResults.map(dish => (
              <div
                key={dish._id || dish.id}
                className={styles.searchRow}
                onClick={() => navigate(`/dish/${dish._id || dish.id}`)}
              >
                <img
                  src={dish.imageUrl || dish.image}
                  alt={local(dish, 'name')}
                  className={styles.searchThumb}
                />
                <div>
                  <p className={styles.searchName}>{local(dish, 'name')}</p>
                  <p className={styles.searchPrice}>{dish.basePrice ?? dish.price}₴</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {loading && <p className={styles.empty}>Завантаження…</p>}
            {!loading && (
              <>
                <p className={styles.sectionTitle}>{t('categories')}</p>
                <div className={styles.grid}>
                  {normalisedCategories.map(cat => (
                    <CategoryCard key={cat.id} cat={cat} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

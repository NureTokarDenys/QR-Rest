import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import SearchBar from '../../../components/SearchBar';
import CategoryCard from '../../../components/client/CategoryCard';
import Footer from '../../../components/client/Footer';
import { categories as mockCategories, dishes as mockDishes } from '../../../data/mockData';
import { useMenu } from '../../../hooks/useMenu';
import styles from './menu.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Menu() {
  const { t } = useTranslation('menu');
  const navigate = useNavigate();
  const { tableNumber, cartCount } = useApp();
  const [query, setQuery] = useState('');
  const local = useLocalField();

  const { categories: apiCategories, loading, error } = useMenu();

  // Use API data if available, otherwise fall back to mock data
  const categories = (apiCategories && apiCategories.length > 0) ? apiCategories : mockCategories;

  // For search: flatten all items from API categories or fall back to mock
  const allDishes = (() => {
    if (apiCategories && apiCategories.length > 0) {
      return apiCategories.flatMap(cat => (cat.items || []).map(item => ({
        ...item,
        id: item._id,
        price: item.basePrice,
        image: item.imageUrl,
        category: cat._id,
      })));
    }
    return Object.values(mockDishes).flat();
  })();

  const filtered = query.trim()
    ? allDishes.filter(d =>
        (d.name || '').toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // Normalise category for CategoryCard — API shape: { _id, name, items }
  // mock shape: { id, name, name_en, count, image }
  const normalisedCategories = categories.map(cat => {
    if (cat._id) {
      return {
        id: cat._id,
        name: cat.name,
        name_en: cat.name,
        count: (cat.items || []).length,
        image: cat.image || null,
      };
    }
    return cat;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.logo}>
          <span className={styles.logoWait}>Wait</span>
          <span className={styles.logoLess}>less</span>
        </span>
        <div className={styles.headerRight}>
          <span className={styles.table}>{t('table', { number: tableNumber })}</span>
        </div>
      </div>

      <div className={styles.content}>
        <SearchBar
          placeholder={t('search_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {query.trim() ? (
          <div className={styles.searchResults}>
            {filtered.length === 0 ? (
              <p className={styles.empty}>{t('empty')}</p>
            ) : (
              filtered.map(dish => (
                <div
                  key={dish._id || dish.id}
                  className={styles.searchRow}
                  onClick={() => navigate(`/dish/${dish._id || dish.id}`)}
                >
                  <img src={dish.imageUrl || dish.image} alt={local(dish, 'name')} className={styles.searchThumb} />
                  <div>
                    <p className={styles.searchName}>{local(dish, 'name')}</p>
                    <p className={styles.searchPrice}>{dish.basePrice || dish.price}₴</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {loading && <p className={styles.empty}>Завантаження...</p>}
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

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import SearchBar from '../../../components/SearchBar';
import CategoryCard from '../../../components/client/CategoryCard';
import Footer from '../../../components/client/Footer';
import { categories, dishes } from '../../../data/mockData';
import styles from './menu.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Menu() {
  const { t } = useTranslation('menu');
  const navigate = useNavigate();
  const { tableNumber, cartCount } = useApp();
  const [query, setQuery] = useState('');
  const local = useLocalField();

  const allDishes = Object.values(dishes).flat();
  const filtered = query.trim()
    ? allDishes.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
    : [];

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
                  key={dish.id}
                  className={styles.searchRow}
                  onClick={() => navigate(`/dish/${dish.id}`)}
                >
                  <img src={dish.image} alt={local(dish, 'name')} className={styles.searchThumb} />
                  <div>
                    <p className={styles.searchName}>{local(dish, 'name')}</p>
                    <p className={styles.searchPrice}>{dish.price}₴</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <p className={styles.sectionTitle}>{t('categories')}</p>
            <div className={styles.grid}>
              {categories.map(cat => (
                <CategoryCard key={cat.id} cat={cat} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
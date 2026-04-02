import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../../components/client/Header';
import SearchBar from '../../../components/SearchBar';
import DishCard from '../../../components/client/DishCard';
import Footer from '../../../components/client/Footer';
import { getCategoryById, getDishesByCategory } from '../../../data/mockData';
import styles from './category.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Category() {
  const { t } = useTranslation('category');
  const local = useLocalField(); 
  const { id } = useParams();
  const category = getCategoryById(id);
  const allDishes = getDishesByCategory(id);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? allDishes.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
    : allDishes;

  return (
    <div className={styles.page}>
      <Header title={local(category, 'name') || t('fallback_title')} showBack />

      <div className={styles.content}>
        <SearchBar
          placeholder={t('search_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className={styles.grid}>
          {filtered.map(dish => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
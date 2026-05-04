import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../../components/client/Header';
import SearchBar from '../../../components/SearchBar';
import DishCard from '../../../components/client/DishCard';
import Footer from '../../../components/client/Footer';
import { getCategoryById, getDishesByCategory } from '../../../data/mockData';
import { useMenu } from '../../../hooks/useMenu';
import styles from './category.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Category() {
  const { t } = useTranslation('category');
  const local = useLocalField();
  const { id } = useParams();
  const [query, setQuery] = useState('');

  const { categories: apiCategories, loading } = useMenu();

  // Try to find the category + its dishes from the API response
  let category = null;
  let allDishes = [];

  if (apiCategories && apiCategories.length > 0) {
    const apiCat = apiCategories.find(c => (c._id || c.id) === id);
    if (apiCat) {
      category = {
        id: apiCat._id || apiCat.id,
        name: apiCat.name,
        name_en: apiCat.name_en || apiCat.name,
      };
      allDishes = (apiCat.items || []).map(item => ({
        id: item._id || item.id,
        _id: item._id || item.id,
        name: item.name,
        name_en: item.name_en || item.name,
        price: item.basePrice ?? item.price,
        image: item.imageUrl || item.image,
        rating: item.rating,
        reviewCount: item.reviewCount,
      }));
    }
  }

  // Fallback to mock data if API not available
  if (!category) {
    category = getCategoryById(id);
    allDishes = getDishesByCategory(id);
  }

  const filtered = query.trim()
    ? allDishes.filter(d => (d.name || '').toLowerCase().includes(query.toLowerCase()))
    : allDishes;

  return (
    <div className={styles.page}>
      <Header title={local(category, 'name') || t('fallback_title')} showBack />

      <div className={styles.content}>
        {loading && <p style={{ textAlign: 'center', padding: '1rem' }}>Завантаження...</p>}
        <SearchBar
          placeholder={t('search_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className={styles.grid}>
          {filtered.map(dish => (
            <DishCard key={dish._id || dish.id} dish={dish} />
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
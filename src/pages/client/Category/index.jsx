import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import MenuHeader from '../../../components/client/MenuHeader';
import SearchBar from '../../../components/SearchBar';
import DishCard from '../../../components/client/DishCard';
import Footer from '../../../components/client/Footer';
import { useMenu } from '../../../hooks/useMenu';
import { CategorySkeleton } from '../../../components/client/Skeleton';
import styles from './category.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function Category() {
  const { t } = useTranslation('category');
  const local = useLocalField();
  const { id } = useParams();
  const [query, setQuery] = useState('');

  const { categories, loading } = useMenu();

  const apiCat = categories.find(c => (c._id || c.id) === id);

  const category = apiCat
    ? { id: apiCat._id || apiCat.id, name: apiCat.name, name_en: apiCat.name_en || apiCat.name }
    : null;

  const allDishes = apiCat
    ? (apiCat.items || []).map(item => ({
        id:         item._id || item.id,
        name:       item.name,
        name_en:    item.name_en || item.name,
        price:      item.basePrice ?? item.price,
        image: (() => {
          const imgs = item.images?.length ? item.images : item.imageUrl ? [item.imageUrl] : [];
          return imgs[item.selectedImageIdx ?? 0] || imgs[0] || null;
        })(),
        rating:      item.rating,
        reviewCount: item.reviewCount,
      }))
    : [];

  const filtered = query.trim()
    ? allDishes.filter(d => (d.name || '').toLowerCase().includes(query.toLowerCase()))
    : allDishes;

  return (
    <div className={styles.page}>
      <MenuHeader title={local(category, 'name') || t('fallback_title')} showBack />

      <div className={styles.content}>
        {loading ? (
          <CategorySkeleton />
        ) : (
          <>
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
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

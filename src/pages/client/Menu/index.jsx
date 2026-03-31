import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import SearchBar from '../../../components/SearchBar';
import CategoryCard from '../../../components/CategoryCard';
import Footer from '../../../components/Footer';
import { categories, dishes } from '../../../data/mockData';
import styles from './menu.module.css';

export default function Menu() {
  const navigate = useNavigate();
  const { tableNumber, cartCount } = useApp();
  const [query, setQuery] = useState('');

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
          <span className={styles.table}>Стіл №{tableNumber}</span>
        </div>
      </div>

      <div className={styles.content}>
        <SearchBar
          placeholder="Пошук страв..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {query.trim() ? (
          <div className={styles.searchResults}>
            {filtered.length === 0 ? (
              <p className={styles.empty}>Нічого не знайдено</p>
            ) : (
              filtered.map(dish => (
                <div
                  key={dish.id}
                  className={styles.searchRow}
                  onClick={() => navigate(`/dish/${dish.id}`)}
                >
                  <img src={dish.image} alt={dish.name} className={styles.searchThumb} />
                  <div>
                    <p className={styles.searchName}>{dish.name}</p>
                    <p className={styles.searchPrice}>{dish.price}₴</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <p className={styles.sectionTitle}>Категорії</p>
            <div className={styles.grid}>
              {categories.map(cat => (
                <CategoryCard key={cat.id} {...cat} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
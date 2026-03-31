import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../../components/Header';
import SearchBar from '../../../components/SearchBar';
import DishCard from '../../../components/DishCard';
import Footer from '../../../components/Footer';
import { getCategoryById, getDishesByCategory } from '../../../data/mockData';
import styles from './category.module.css';

export default function Category() {
  const { id } = useParams();
  const category = getCategoryById(id);
  const allDishes = getDishesByCategory(id);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? allDishes.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
    : allDishes;

  return (
    <div className={styles.page}>
      <Header title={category?.name || 'Категорія'} showBack />

      <div className={styles.content}>
        <SearchBar
          placeholder="Пошук у категорії..."
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
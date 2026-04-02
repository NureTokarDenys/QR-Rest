import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MenuCategoryList from '../../../components/staff/MenuCategoryList';
import MenuDishRow from '../../../components/staff/MenuDishRow';
import SearchBar from '../../../components/SearchBar';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { dishes as dishesData, categories as initialCategories } from '../../../data/mockData';
import styles from './menuManagement.module.css';
import { MdOutlineRestaurant } from "react-icons/md";

const flattenDishes = (dishesObj) =>
  Object.entries(dishesObj).flatMap(([categoryId, items]) =>
    items.map(dish => ({ ...dish, category: categoryId, available: true }))
  );

export default function MenuManagement() {
  const navigate = useNavigate();
  const { t } = useTranslation('menuManagement');
  const { i18n } = useTranslation();
  const [selectedCat, setSelectedCat] = useState('all');
  const [query, setQuery] = useState('');
  const [dishes, setDishes] = useState(() => flattenDishes(dishesData));
  const [cats, setCats] = useState(initialCategories);

  const filtered = dishes.filter(d => {
    const matchCat = selectedCat === 'all' || d.category === selectedCat;
    const matchQ = !query.trim() ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.name_en.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  function handleToggle(id) {
    setDishes(prev => prev.map(d => d.id === id ? { ...d, available: !d.available } : d));
  }

  function handleDelete(id) {
    if (window.confirm(t('confirmDelete'))) {
      setDishes(prev => prev.filter(d => d.id !== id));
    }
  }

  function handleRename(id, newName) {
    const field = i18n.language === 'en' ? 'name_en' : 'name';
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: newName } : c));
  }

  return (
    <StaffShell
      title={<><MdOutlineRestaurant className={styles.headerIcon} /> {t('title')}</>}
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('generatePdf')} onClick={() => navigate('/staff/menu/pdf')} className={styles.exportBtn} />
          <PrimaryButton label={t('addDish')} onClick={() => navigate('/staff/menu/dish/new')} className={styles.addDishBtn} />
        </div>
      }
    >
      <div className={styles.layout}>
        <MenuCategoryList
          categories={cats}
          selected={selectedCat}
          onSelect={setSelectedCat}
          onAdd={() => {}}
          onRename={handleRename}
        />

        <div className={styles.right}>
          <SearchBar
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thead}>
                  <th>{t('dish')}</th>
                  <th>{t('category')}</th>
                  <th>{t('price')}</th>
                  <th>{t('available')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(dish => (
                  <MenuDishRow
                    key={dish.id}
                    dish={dish}
                    dish_category={cats.find(c => c.id === dish.category)}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
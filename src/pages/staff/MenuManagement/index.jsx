import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MenuCategoryList from '../../../components/staff/MenuCategoryList';
import MenuDishRow from '../../../components/staff/MenuDishRow';
import SearchBar from '../../../components/SearchBar';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { getCategories, getMenuItems, deleteMenuItem } from '../../../api/admin';
import styles from './menuManagement.module.css';
import { MdOutlineRestaurant } from "react-icons/md";

function normaliseApiDish(item) {
  return {
    id: item._id || item.id,
    name: item.name,
    name_en: item.name_en || item.name,
    price: item.basePrice ?? item.price,
    image: item.imageUrl || item.image,
    category: item.categoryId?._id || item.categoryId || item.category,
    available: item.isAvailable ?? item.available ?? true,
  };
}

function normaliseApiCategory(cat) {
  return {
    id: cat._id || cat.id,
    name: cat.name,
    name_en: cat.name_en || cat.name,
    count: cat.itemCount ?? (cat.items?.length) ?? 0,
    image: cat.image || null,
  };
}

export default function MenuManagement() {
  const navigate = useNavigate();
  const { t } = useTranslation('menuManagement');
  const { i18n } = useTranslation();
  const [selectedCat, setSelectedCat] = useState('all');
  const [query, setQuery] = useState('');
  const [dishes, setDishes] = useState([]);
  const [cats, setCats] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [apiCats, apiItems] = await Promise.all([getCategories(), getMenuItems()]);
        if (cancelled) return;
        if (Array.isArray(apiCats)) setCats(apiCats.map(normaliseApiCategory));
        if (Array.isArray(apiItems)) setDishes(apiItems.map(normaliseApiDish));
      } catch (err) {
        console.error('MenuManagement load error:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = dishes.filter(d => {
    const matchCat = selectedCat === 'all' || String(d.category) === String(selectedCat);
    const name = d.name || '';
    const name_en = d.name_en || '';
    const matchQ = !query.trim() ||
      name.toLowerCase().includes(query.toLowerCase()) ||
      name_en.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  function handleToggle(id) {
    setDishes(prev => prev.map(d => d.id === id ? { ...d, available: !d.available } : d));
  }

  async function handleDelete(id) {
    if (window.confirm(t('confirmDelete'))) {
      try {
        await deleteMenuItem(id);
        setDishes(prev => prev.filter(d => d.id !== id));
      } catch (err) {
        console.error('deleteMenuItem error:', err);
      }
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
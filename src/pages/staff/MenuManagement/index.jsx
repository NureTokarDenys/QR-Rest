import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import { Skel } from '../../../components/staff/Skeleton';
import MenuCategoryList, { MenuCategoryListSkeleton } from '../../../components/staff/MenuCategoryList';
import MenuDishRow, { MenuDishRowSkeleton } from '../../../components/staff/MenuDishRow';
import SearchBar from '../../../components/SearchBar';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import UpgradeModal from '../../../components/UpgradeModal';
import { deleteMenuItem } from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import { usePlan } from '../../../hooks/usePlan';
import styles from './menuManagement.module.css';
import { MdOutlineRestaurant } from "react-icons/md";

const FREE_CATEGORY_LIMIT = 5;
const FREE_ITEM_LIMIT     = 50;

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
    color: cat.color || null,
  };
}

export default function MenuManagement() {
  const navigate = useNavigate();
  const { t } = useTranslation('menuManagement');
  const { isFree } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(null); // null | 'categories' | 'items'
  const [selectedCat, setSelectedCat] = useState('all');
  const [query, setQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null);

  // Cached menu data from the shared StaffDataContext — lazy-loaded the first
  // time the user opens this page, then kept fresh via MENU_UPDATED WS events.
  const { categories: rawCats, menuItems: rawItems, ensureCategories, ensureMenuItems } = useStaffData();
  useEffect(() => { ensureCategories(); ensureMenuItems(); }, [ensureCategories, ensureMenuItems]);
  const loading = rawCats === null || rawItems === null;
  const cats   = Array.isArray(rawCats)  ? rawCats.map(normaliseApiCategory) : [];
  const dishes = Array.isArray(rawItems) ? rawItems.map(normaliseApiDish)    : [];

  const filtered = dishes.filter(d => {
    const matchCat = selectedCat === 'all' || String(d.category) === String(selectedCat);
    const name = d.name || '';
    const name_en = d.name_en || '';
    const matchQ = !query.trim() ||
      name.toLowerCase().includes(query.toLowerCase()) ||
      name_en.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const { refreshMenuItems } = useStaffData();

  function handleToggle(id) {
    // Optimistic UI is not necessary — the toggle API call below should fire
    // a MENU_UPDATED WS event that refreshes the cache. Keeping the call here.
    refreshMenuItems();
  }

  async function handleDelete(id) {
    try {
      await deleteMenuItem(id);
      // Cache will refresh via MENU_UPDATED WS event; trigger immediate refetch
      // as well so the row disappears without a perceptible delay.
      refreshMenuItems();
    } catch (err) {
      console.error('deleteMenuItem error:', err);
    }
  }


  const atCatLimit  = isFree && cats.length  >= FREE_CATEGORY_LIMIT;
  const atItemLimit = isFree && dishes.length >= FREE_ITEM_LIMIT;

  if (loading) {
    return (
      <StaffShell title={<><MdOutlineRestaurant className={styles.headerIcon} /> {t('title')}</>}>
        <div className={styles.layout}>
          <MenuCategoryListSkeleton rows={5} />
          <div className={styles.right}>
            {/* Search bar placeholder — same height as <SearchBar /> */}
            <Skel w="100%" h={44} r={10} />
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
                  {Array.from({ length: 9 }).map((_, i) => (
                    <MenuDishRowSkeleton key={i} nameWidth={110 + ((i * 23) % 70)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <>
    <UpgradeModal
      open={!!upgradeOpen}
      onClose={() => setUpgradeOpen(null)}
      ns="components"
      reason={upgradeOpen === 'categories' ? 'upgrade_limit_categories' : 'upgrade_limit_items'}
    />
    <StaffShell
      title={<><MdOutlineRestaurant className={styles.headerIcon} /> {t('title')}</>}
      rightActions={
        <div className={styles.headerActions}>
          {isFree && (
            <div className={styles.limitChips}>
              <span className={atCatLimit  ? styles.limitChipFull : styles.limitChip}>
                {t('free_limit_categories', { count: cats.length,   max: FREE_CATEGORY_LIMIT })}
              </span>
              <span className={atItemLimit ? styles.limitChipFull : styles.limitChip}>
                {t('free_limit_items',      { count: dishes.length, max: FREE_ITEM_LIMIT })}
              </span>
            </div>
          )}
          <SecondaryButton label={t('generatePdf')} onClick={() => navigate('/staff/menu/pdf')} className={styles.exportBtn} />
          <PrimaryButton
            label={t('addDish')}
            onClick={() => atItemLimit ? setUpgradeOpen('items') : navigate('/staff/menu/dish/new')}
            className={styles.addDishBtn}
          />
        </div>
      }
    >
      <div className={styles.layout}>
        <MenuCategoryList
          categories={cats}
          selected={selectedCat}
          onSelect={setSelectedCat}
          onAdd={() => atCatLimit ? setUpgradeOpen('categories') : navigate('/staff/menu/category/new')}
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
                    onDelete={(id) => {
                      const target = dishes.find(d => d.id === id);
                      setDeleteDialog({ id, name: target?.name || '' });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {deleteDialog && (
        <div className={styles.overlay} onClick={() => setDeleteDialog(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.dialogTitle}>{t('confirmDelete')}</p>
            <p className={styles.dialogSub}>{t('confirmDeleteSub', { name: deleteDialog.name })}</p>
            <div className={styles.dialogActions}>
              <button className={styles.dialogCancel} onClick={() => setDeleteDialog(null)}>
                {t('cancel')}
              </button>
              <button
                className={styles.dialogConfirm}
                onClick={async () => {
                  const id = deleteDialog.id;
                  setDeleteDialog(null);
                  await handleDelete(id);
                }}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
    </>
  );
}
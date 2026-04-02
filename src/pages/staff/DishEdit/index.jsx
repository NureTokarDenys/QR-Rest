import React, { use, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import TextareaField from '../../../components/staff/TextareaField';
import PhotoUpload from '../../../components/staff/PhotoUpload';
import DishPreview from '../../../components/staff/DishPreview';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { categories, dishes as dishesData } from '../../../data/mockData';
import styles from './dishEdit.module.css';
import { useLocalField } from '../../../i18n/useLang';

const allDishes = Object.entries(dishesData).flatMap(([categoryId, items]) =>
  items.map(dish => ({ ...dish, category: categoryId }))
);

const EMPTY_FORM = {
  name: '', name_en: '',
  description: '', description_en: '',
  ingredients: '', ingredients_en: '',
  price: '',
  category: '',
  images: [],
  available: true,
};

export default function DishEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const local = useLocalField(); 
  const { t } = useTranslation('dishEdit');
  const isNew = !id || id === 'new';

  const [form, setForm] = useState(() => {
    if (isNew) return EMPTY_FORM;
    const existing = allDishes.find(d => String(d.id) === String(id));
    if (!existing) return EMPTY_FORM;
    return {
      name:            existing.name          ?? '',
      name_en:         existing.name_en       ?? '',
      description:     existing.description   ?? '',
      description_en:  existing.description_en ?? '',
      ingredients:     existing.ingredients   ?? '',
      ingredients_en:  existing.ingredients_en ?? '',
      price:           existing.price         ?? '',
      category:        existing.category      ?? '',
      images:          existing.image ? [existing.image] : [],
      available:       existing.available     ?? true,
    };
  });

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  const catOptions = categories.map(c => ({ value: c.id, label: local(c, 'name') }));

  return (
    <StaffShell
      title={`${isNew ? t('titleAdd') : t('titleEdit')}`}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} className={styles.cancelBtn} />
          <PrimaryButton label={t('save')} onClick={() => navigate('/staff/menu')} className={styles.saveBtn} />
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('mainInfo')}</p>
            <div className={styles.grid2}>
              <InputField label={t('nameUa')} placeholder="—" value={form.name} onChange={e => set('name', e.target.value)} />
              <InputField label={t('nameEn')} placeholder="—" value={form.name_en} onChange={e => set('name_en', e.target.value)} />
              <TextareaField label={t('descUa')} placeholder="—" value={form.description} onChange={e => set('description', e.target.value)} />
              <TextareaField label={t('descEn')} placeholder="—" value={form.description_en} onChange={e => set('description_en', e.target.value)} />
              <TextareaField label={t('ingredientsUa')} placeholder="—" value={form.ingredients} onChange={e => set('ingredients', e.target.value)} />
              <TextareaField label={t('ingredientsEn')} placeholder="—" value={form.ingredients_en} onChange={e => set('ingredients_en', e.target.value)} />
              <InputField label={t('price')} placeholder={t('pricePlaceholder')} type="number" value={form.price} onChange={e => set('price', e.target.value)} />
              <Dropdown label={t('category')} options={catOptions} value={form.category} onChange={val => set('category', val)} placeholder={t('selectCategory')} />
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('photos')}</p>
            <PhotoUpload images={form.images} onChange={imgs => set('images', imgs)} />
          </div>
        </div>

        <div className={styles.previewCol}>
          <DishPreview dish={form} available={form.available} />
        </div>
      </div>
    </StaffShell>
  );
}
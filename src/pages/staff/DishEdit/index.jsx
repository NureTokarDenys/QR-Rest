import React, { useState } from 'react';
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
import { categories } from '../../../data/mockData';
import styles from './dishEdit.module.css';

export default function DishEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('dishEdit');
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({
    name: '', name_en: '',
    description: '', description_en: '',
    ingredients: '', ingredients_en: '',
    price: '',
    category: '',
    images: [],
    available: true,
  });

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  const catOptions = categories.map(c => ({ value: c.id, label: c.name }));

  return (
    <StaffShell
      title={`← ${isNew ? t('titleAdd') : t('titleEdit')}`}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} />
          <PrimaryButton label={t('save')} onClick={() => navigate('/staff/menu')} />
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
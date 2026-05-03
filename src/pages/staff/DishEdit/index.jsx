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
import { categories, dishes as dishesData } from '../../../data/mockData';
import styles from './dishEdit.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { MdAdd, MdDelete } from 'react-icons/md';

const allDishes = Object.entries(dishesData).flatMap(([categoryId, items]) =>
  items.map(dish => ({ ...dish, category: categoryId }))
);

const EMPTY_FORM = {
  name: '', name_en: '',
  description: '', description_en: '',
  price: '',
  category: '',
  images: [],
  available: true,
  ingredientsList: [],
  addons: [],
  componentGroups: [],
};

function newIngredient() {
  return { id: `ing-${Date.now()}-${Math.random()}`, name: '', name_en: '', isRemovable: false };
}

function newAddon() {
  return { id: `ao-${Date.now()}-${Math.random()}`, name: '', name_en: '', price: 0 };
}

function newComponentGroup() {
  return { id: `cg-${Date.now()}-${Math.random()}`, name: '', name_en: '', isRequired: true, options: [] };
}

function newGroupOption(groupId) {
  return { id: `cgo-${Date.now()}-${Math.random()}`, name: '', name_en: '', priceModifier: 0 };
}

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
      price:           existing.price         ?? '',
      category:        existing.category      ?? '',
      images:          existing.image ? [existing.image] : [],
      available:       existing.available     ?? true,
      ingredientsList: existing.ingredientsList ?? [],
      addons:          existing.addons         ?? [],
      componentGroups: existing.componentGroups ?? [],
    };
  });

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  // Ingredients
  function addIngredient() {
    set('ingredientsList', [...form.ingredientsList, newIngredient()]);
  }
  function updateIngredient(ingId, field, val) {
    set('ingredientsList', form.ingredientsList.map(i => i.id === ingId ? { ...i, [field]: val } : i));
  }
  function removeIngredient(ingId) {
    set('ingredientsList', form.ingredientsList.filter(i => i.id !== ingId));
  }

  // Add-ons
  function addAddon() {
    set('addons', [...form.addons, newAddon()]);
  }
  function updateAddon(aoId, field, val) {
    set('addons', form.addons.map(a => a.id === aoId ? { ...a, [field]: val } : a));
  }
  function removeAddon(aoId) {
    set('addons', form.addons.filter(a => a.id !== aoId));
  }

  // Component groups
  function addGroup() {
    set('componentGroups', [...form.componentGroups, newComponentGroup()]);
  }
  function updateGroup(gId, field, val) {
    set('componentGroups', form.componentGroups.map(g => g.id === gId ? { ...g, [field]: val } : g));
  }
  function removeGroup(gId) {
    set('componentGroups', form.componentGroups.filter(g => g.id !== gId));
  }
  function addGroupOption(gId) {
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gId ? { ...g, options: [...g.options, newGroupOption(gId)] } : g
    ));
  }
  function updateGroupOption(gId, optId, field, val) {
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gId
        ? { ...g, options: g.options.map(o => o.id === optId ? { ...o, [field]: val } : o) }
        : g
    ));
  }
  function removeGroupOption(gId, optId) {
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gId ? { ...g, options: g.options.filter(o => o.id !== optId) } : g
    ));
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
          {/* Basic info */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('mainInfo')}</p>
            <div className={styles.grid2}>
              <InputField label={t('nameUa')} placeholder="—" value={form.name} onChange={e => set('name', e.target.value)} />
              <InputField label={t('nameEn')} placeholder="—" value={form.name_en} onChange={e => set('name_en', e.target.value)} />
              <TextareaField label={t('descUa')} placeholder="—" value={form.description} onChange={e => set('description', e.target.value)} />
              <TextareaField label={t('descEn')} placeholder="—" value={form.description_en} onChange={e => set('description_en', e.target.value)} />
              <InputField label={t('price')} placeholder={t('pricePlaceholder')} type="number" value={form.price} onChange={e => set('price', e.target.value)} />
              <Dropdown label={t('category')} options={catOptions} value={form.category} onChange={val => set('category', val)} placeholder={t('selectCategory')} />
            </div>
          </div>

          {/* Structured ingredients */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('ingredientsSection')}</p>
              <button className={styles.addRowBtn} onClick={addIngredient}><MdAdd /> {t('addIngredient')}</button>
            </div>
            {form.ingredientsList.length === 0 && (
              <p className={styles.emptyHint}>{t('noIngredients')}</p>
            )}
            {form.ingredientsList.map(ing => (
              <div key={ing.id} className={styles.listRow}>
                <div className={styles.listRowFields}>
                  <InputField label={t('nameUa')} placeholder="—" value={ing.name} onChange={e => updateIngredient(ing.id, 'name', e.target.value)} />
                  <InputField label={t('nameEn')} placeholder="—" value={ing.name_en} onChange={e => updateIngredient(ing.id, 'name_en', e.target.value)} />
                </div>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={ing.isRemovable}
                    onChange={e => updateIngredient(ing.id, 'isRemovable', e.target.checked)}
                  />
                  {t('removable')}
                </label>
                <button className={styles.deleteRowBtn} onClick={() => removeIngredient(ing.id)}><MdDelete /></button>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('addonsSection')}</p>
              <button className={styles.addRowBtn} onClick={addAddon}><MdAdd /> {t('addAddon')}</button>
            </div>
            {form.addons.length === 0 && (
              <p className={styles.emptyHint}>{t('noAddons')}</p>
            )}
            {form.addons.map(ao => (
              <div key={ao.id} className={styles.listRow}>
                <div className={styles.listRowFields}>
                  <InputField label={t('nameUa')} placeholder="—" value={ao.name} onChange={e => updateAddon(ao.id, 'name', e.target.value)} />
                  <InputField label={t('nameEn')} placeholder="—" value={ao.name_en} onChange={e => updateAddon(ao.id, 'name_en', e.target.value)} />
                  <InputField label={t('addonPrice')} type="number" placeholder="0" value={ao.price} onChange={e => updateAddon(ao.id, 'price', Number(e.target.value))} />
                </div>
                <button className={styles.deleteRowBtn} onClick={() => removeAddon(ao.id)}><MdDelete /></button>
              </div>
            ))}
          </div>

          {/* Component groups */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('componentGroupsSection')}</p>
              <button className={styles.addRowBtn} onClick={addGroup}><MdAdd /> {t('addGroup')}</button>
            </div>
            {form.componentGroups.length === 0 && (
              <p className={styles.emptyHint}>{t('noGroups')}</p>
            )}
            {form.componentGroups.map(group => (
              <div key={group.id} className={styles.groupBlock}>
                <div className={styles.groupBlockHeader}>
                  <div className={styles.listRowFields}>
                    <InputField label={t('nameUa')} placeholder="—" value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value)} />
                    <InputField label={t('nameEn')} placeholder="—" value={group.name_en} onChange={e => updateGroup(group.id, 'name_en', e.target.value)} />
                  </div>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={group.isRequired}
                      onChange={e => updateGroup(group.id, 'isRequired', e.target.checked)}
                    />
                    {t('required')}
                  </label>
                  <button className={styles.deleteRowBtn} onClick={() => removeGroup(group.id)}><MdDelete /></button>
                </div>

                <div className={styles.groupOptions}>
                  {group.options.map(opt => (
                    <div key={opt.id} className={styles.optionRow}>
                      <InputField label={t('nameUa')} placeholder="—" value={opt.name} onChange={e => updateGroupOption(group.id, opt.id, 'name', e.target.value)} />
                      <InputField label={t('nameEn')} placeholder="—" value={opt.name_en} onChange={e => updateGroupOption(group.id, opt.id, 'name_en', e.target.value)} />
                      <InputField label={t('priceModifier')} type="number" placeholder="0" value={opt.priceModifier} onChange={e => updateGroupOption(group.id, opt.id, 'priceModifier', Number(e.target.value))} />
                      <button className={styles.deleteRowBtn} onClick={() => removeGroupOption(group.id, opt.id)}><MdDelete /></button>
                    </div>
                  ))}
                  <button className={styles.addOptionBtn} onClick={() => addGroupOption(group.id)}>
                    <MdAdd /> {t('addOption')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Photos */}
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

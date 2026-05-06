import React, { useState, useEffect } from 'react';
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
import { getCategories, createMenuItem, updateMenuItem } from '../../../api/admin';
import { getDishDetail } from '../../../api/menu';
import styles from './dishEdit.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { MdAdd, MdDelete } from 'react-icons/md';

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

  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load categories from API
  useEffect(() => {
    getCategories()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data.map(c => ({ id: c._id || c.id, name: c.name, name_en: c.name_en || c.name })));
        }
      })
      .catch(err => console.error('getCategories error:', err));
  }, []);

  // Load existing dish if editing
  useEffect(() => {
    if (isNew) return;
    getDishDetail(id)
      .then(raw => {
        if (!raw) return;
        setForm({
          name:            raw.name          ?? '',
          name_en:         raw.name_en       ?? '',
          description:     raw.description   ?? '',
          description_en:  raw.description_en ?? '',
          price:           raw.basePrice ?? raw.price ?? '',
          category:        raw.categoryId?._id || raw.categoryId || raw.category || '',
          images:          raw.imageUrl ? [raw.imageUrl] : raw.image ? [raw.image] : [],
          available:       raw.isAvailable ?? raw.available ?? true,
          ingredientsList: (raw.ingredients || raw.ingredientsList || []).map(i => ({
            id: i._id || i.id || `ing-${Math.random()}`,
            name: i.name || '',
            name_en: i.name_en || '',
            isRemovable: i.isRemovable ?? true,
          })),
          addons: (raw.addons || []).map(a => ({
            id: a._id || a.id || `ao-${Math.random()}`,
            name: a.name || '',
            name_en: a.name_en || '',
            price: a.price ?? 0,
          })),
          componentGroups: (raw.componentGroups || []).map(g => ({
            id: g._id || g.id || `cg-${Math.random()}`,
            name: g.name || '',
            name_en: g.name_en || '',
            isRequired: g.isRequired ?? true,
            options: (g.options || []).map(o => ({
              id: o._id || o.id || `cgo-${Math.random()}`,
              name: o.name || '',
              name_en: o.name_en || '',
              priceModifier: o.priceModifier ?? 0,
            })),
          })),
        });
      })
      .catch(err => console.error('getDishDetail error:', err));
  }, [id, isNew]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        name_en: form.name_en,
        description: form.description,
        description_en: form.description_en,
        basePrice: Number(form.price),
        categoryId: form.category,
        isAvailable: form.available,
        ingredients: form.ingredientsList,
        addons: form.addons,
        componentGroups: form.componentGroups,
      };
      if (isNew) {
        await createMenuItem(payload);
      } else {
        await updateMenuItem(id, payload);
      }
      navigate('/staff/menu');
    } catch (err) {
      console.error('Save dish error:', err);
      alert(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

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
          <PrimaryButton label={saving ? '...' : t('save')} onClick={handleSave} disabled={saving} className={styles.saveBtn} />
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

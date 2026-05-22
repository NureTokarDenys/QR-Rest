import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ClientToastContext';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import LangTabs from '../../../components/staff/LangTabs';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import {
  createIngredient, updateIngredient, setIngredientAvailability,
  createAddon,      updateAddon,
  createComponentGroup, updateComponentGroup,
  removeExtraRelation,
  translateText,
} from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import { SUPPORTED_LANGS, SOURCE_LANG } from '../../../i18n/langs';
import { usePlan } from '../../../hooks/usePlan';
import UpgradeModal from '../../../components/UpgradeModal';
import TranslateOverlay from '../../../components/staff/TranslateOverlay';
import { MdAdd, MdDelete, MdTune, MdLinkOff } from 'react-icons/md';
import styles from './extrasEdit.module.css';

const TYPE_API = {
  ingredient:     { create: createIngredient,     update: updateIngredient },
  addon:          { create: createAddon,          update: updateAddon },
  componentgroup: { create: createComponentGroup, update: updateComponentGroup },
};

const EXTRAS_KEY = {
  ingredient:     'ingredients',
  addon:          'addons',
  componentgroup: 'componentGroups',
};

function newOption() {
  return { id: `opt-${Date.now()}-${Math.random()}`, _id: null, name: '', name_en: '', priceModifier: 0, isDefault: false };
}

export default function ExtrasEdit() {
  const { type, id } = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const backTo       = new URLSearchParams(location.search).get('backTo');
  const { t }        = useTranslation('extrasManagement');
  const { showToast } = useToast();
  const isNew        = !id || id === 'new';
  const isIngredient = type === 'ingredient';
  const isAddon      = type === 'addon';
  const isCG         = type === 'componentgroup';

  const [form, setForm] = useState({
    name: '', name_en: '',
    isRemovable:  true,
    isAvailable:  true,
    price:        0,
    weight:       '',
    minQuantity:  1,
    maxQuantity:  1,
    isRequired:   false,
    sortOrder:    0,
    options:      [],
  });
  const [usedInDishes, setUsedInDishes] = useState([]);
  const [activeLang,  setActiveLang]  = useState(SOURCE_LANG);
  const [saving,      setSaving]      = useState(false);
  const [translating, setTranslating] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { isFree } = usePlan();

  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  // Extras come from the shared cache — lazy-loaded on first visit.
  const { extras: cachedExtras, ensureExtras } = useStaffData();
  useEffect(() => { ensureExtras(); }, [ensureExtras]);

  useEffect(() => {
    if (isNew) return;
    const key = EXTRAS_KEY[type];
    if (!key || !cachedExtras) return;
    const item = (cachedExtras[key] || []).find(i => String(i._id) === id);
    if (!item) return;
    setForm({
      name:        item.name || '',
      name_en:     item.translations?.en?.name?.value || item.name_en || '',
      isRemovable: item.isRemovable ?? true,
      isAvailable: item.isAvailable ?? true,
      price:       item.price ?? 0,
      weight:      item.weight ?? '',
      minQuantity: item.minQuantity ?? 1,
      maxQuantity: item.maxQuantity ?? 1,
      isRequired:  item.isRequired ?? false,
      sortOrder:   item.sortOrder ?? 0,
      options: (item.options || []).map(o => ({
        id:            String(o._id || `opt-${Math.random()}`),
        _id:           o._id || null,
        name:          o.name || '',
        name_en:       o.translations?.en?.name?.value || o.name_en || '',
        priceModifier: o.priceModifier ?? 0,
        isDefault:     o.isDefault ?? false,
      })),
    });
    setUsedInDishes(item.usedInDishes || []);
  }, [type, id, isNew, cachedExtras]);

  async function handleAutoTranslate() {
    if (activeLang === SOURCE_LANG) return;
    setTranslating(true);
    try {
      const texts = [form.name, ...form.options.map(o => o.name)];
      const result = await translateText(texts.length ? texts : [''], activeLang);
      const tr = result?.translations ?? [];
      setForm(prev => {
        let idx = 0;
        const nameT = tr[idx++] ?? '';
        const opts  = prev.options.map(o => ({ ...o, name_en: activeLang === 'en' ? (tr[idx++] ?? '') : o.name_en }));
        return { ...prev, name_en: activeLang === 'en' ? nameT : prev.name_en, options: opts };
      });
    } catch (err) {
      console.error('translate error:', err);
    } finally {
      setTranslating(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const api = TYPE_API[type];
      let payload;
      if (isIngredient) {
        payload = { name: form.name, name_en: form.name_en, isRemovable: form.isRemovable };
      } else if (isAddon) {
        payload = {
          name: form.name, name_en: form.name_en,
          price: Number(form.price),
          ...(form.weight !== '' ? { weight: Number(form.weight) } : {}),
          minQuantity: Number(form.minQuantity) || 1,
          maxQuantity: Number(form.maxQuantity) || 1,
        };
      } else {
        payload = {
          name:       form.name,
          name_en:    form.name_en,
          isRequired: form.isRequired,
          sortOrder:  Number(form.sortOrder) || 0,
          options: form.options.map(o => ({
            ...(!isNew && o._id ? { _id: o._id } : {}),
            name:          o.name,
            name_en:       o.name_en,
            priceModifier: Number(o.priceModifier) || 0,
            isDefault:     o.isDefault,
          })),
        };
      }
      let savedId = id;
      if (isNew) {
        const created = await api.create(payload);
        savedId = created?._id || created?.id;
      } else {
        await api.update(id, payload);
      }
      if (isIngredient && savedId && !isNew) {
        await setIngredientAvailability(savedId, form.isAvailable);
      }
      showToast(t(isNew ? 'savedNew' : 'savedUpdated', isNew ? 'Додано' : 'Збережено'));
      navigate(backTo ? decodeURIComponent(backTo) : '/staff/extras');
    } catch (err) {
      console.error('save extra error:', err);
      alert(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveFromDish(dish) {
    try {
      await removeExtraRelation(type, id, dish._id || dish.id);
      setUsedInDishes(prev => prev.filter(d => (d._id || d.id) !== (dish._id || dish.id)));
    } catch (err) {
      console.error('remove relation error:', err);
    }
  }

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  function setOption(idx, field, val) {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((o, i) => i === idx ? { ...o, [field]: val } : o),
    }));
  }

  function removeOption(idx) {
    setForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  }

  function getTitle() {
    if (isIngredient) return t(isNew ? 'titleNewIngredient'     : 'titleEditIngredient');
    if (isAddon)      return t(isNew ? 'titleNewAddon'          : 'titleEditAddon');
    return                   t(isNew ? 'titleNewComponentGroup' : 'titleEditComponentGroup');
  }

  const onEN = activeLang !== SOURCE_LANG;
  const nameField = onEN ? 'name_en' : 'name';
  const activeLangLabel = SUPPORTED_LANGS.find(l => l.code === activeLang)?.label ?? activeLang;

  return (
    <>
    <TranslateOverlay visible={translating} lang={activeLangLabel} />
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} ns="components" />
    <StaffShell
      title={<><MdTune /> {getTitle()}</>}
      backTo="/staff/extras"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/extras')} className={styles.cancelBtn} />
          <PrimaryButton label={saving ? '…' : t('save')} onClick={handleSave} disabled={saving} className={styles.saveBtn} />
        </div>
      }
    >
      <div className={styles.page}>

        {/* ── Left: form ── */}
        <div className={styles.formCol}>

          {/* Language tabs */}
          <div className={styles.langBar}>
            <LangTabs
              langs={SUPPORTED_LANGS}
              active={activeLang}
              onChange={setActiveLang}
              onTranslate={onEN
                ? (isFree ? () => setUpgradeOpen(true) : handleAutoTranslate)
                : null}
              translating={translating}
            />
          </div>

          {/* Main fields section */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('generalSection', 'Загальне')}</p>

            <div className={styles.basicGrid}>
              {/* Name — spans both columns */}
              <div className={`${styles.fieldWrap} ${styles.spanFull}`}>
                <InputField
                  label={t('name')}
                  placeholder="—"
                  value={form[nameField]}
                  onChange={e => set(nameField, e.target.value)}
                />
                {onEN && form.name && (
                  <span className={styles.srcHint}>{srcLang.flag} {form.name}</span>
                )}
              </div>

              {/* Ingredient checkboxes */}
              {isIngredient && (
                <div className={`${styles.checkRow} ${styles.spanFull}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={form.isRemovable} onChange={e => set('isRemovable', e.target.checked)} />
                    {t('removable')}
                  </label>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)} />
                    {t('available', 'Доступно')}
                  </label>
                </div>
              )}

              {/* Addon: price | weight, then minQty | maxQty */}
              {isAddon && (
                <>
                  <div className={styles.fieldWrap}>
                    <InputField label={t('price')} type="number" placeholder="0" value={form.price} onChange={e => set('price', e.target.value)} />
                  </div>
                  <div className={styles.fieldWrap}>
                    <InputField label={t('weight', 'Вага (г)')} type="number" placeholder="—" value={form.weight} onChange={e => set('weight', e.target.value)} />
                  </div>
                  <div className={styles.fieldWrap}>
                    <InputField label={t('minQuantity', 'Мін. к-сть')} type="number" placeholder="1" value={form.minQuantity} onChange={e => set('minQuantity', e.target.value)} />
                  </div>
                  <div className={styles.fieldWrap}>
                    <InputField label={t('maxQuantity', 'Макс. к-сть')} type="number" placeholder="1" value={form.maxQuantity} onChange={e => set('maxQuantity', e.target.value)} />
                  </div>
                </>
              )}

              {/* CG: isRequired + sortOrder */}
              {isCG && (
                <>
                  <div className={`${styles.cgSettingsRow} ${styles.spanFull}`}>
                    <label className={styles.checkLabel}>
                      <input type="checkbox" checked={form.isRequired} onChange={e => set('isRequired', e.target.checked)} />
                      {t('switchRequired')}
                    </label>
                    <div className={styles.sortOrderField}>
                      <InputField label={t('sortOrder', 'Порядок')} type="number" placeholder="0" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Options section (CG only) */}
          {isCG && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionTitle}>{t('optionsSection')}</p>
                <button className={styles.addOptBtn} onClick={() => setForm(prev => ({ ...prev, options: [...prev.options, newOption()] }))}>
                  <MdAdd /> {t('addOption')}
                </button>
              </div>

              {form.options.length === 0 && (
                <p className={styles.emptyHint}>{t('noOptions', 'Немає варіантів')}</p>
              )}

              {form.options.map((opt, idx) => {
                const optNameField = onEN ? 'name_en' : 'name';
                return (
                  <div key={opt.id} className={styles.optionRow}>
                    <div className={styles.optNameField}>
                      <InputField
                        label={t('optionName')}
                        placeholder="—"
                        value={opt[optNameField]}
                        onChange={e => setOption(idx, optNameField, e.target.value)}
                      />
                      {onEN && opt.name && (
                        <span className={styles.srcHint}>{srcLang.flag} {opt.name}</span>
                      )}
                    </div>
                    <div className={styles.fieldWrap}>
                      <InputField
                        label={t('priceModifier')}
                        type="number"
                        placeholder="0"
                        value={opt.priceModifier}
                        onChange={e => setOption(idx, 'priceModifier', Number(e.target.value) || 0)}
                      />
                    </div>
                    <label className={styles.checkLabelSmall}>
                      <input type="checkbox" checked={opt.isDefault} onChange={e => setOption(idx, 'isDefault', e.target.checked)} />
                      {t('defaultOption')}
                    </label>
                    <button className={styles.deleteOptBtn} onClick={() => removeOption(idx)}>
                      <MdDelete />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: used in dishes ── */}
        {!isNew && (
          <div className={styles.sideCol}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('usedInDishes', 'Використовується в стравах')}</p>
              {usedInDishes.length === 0 ? (
                <p className={styles.emptyHint}>{t('noUsedDishes', 'Не використовується жодною стравою')}</p>
              ) : (
                <div className={styles.dishList}>
                  {usedInDishes.map(dish => (
                    <div key={dish._id || dish.id} className={styles.dishRow}>
                      {dish.imageUrl && <img src={dish.imageUrl} alt="" className={styles.dishThumb} />}
                      <span className={styles.dishName}>{dish.name || '—'}</span>
                      <button
                        className={styles.unlinkBtn}
                        title={t('removeFromDish', "Відв'язати від страви")}
                        onClick={() => handleRemoveFromDish(dish)}
                      >
                        <MdLinkOff size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </StaffShell>
    </>
  );
}

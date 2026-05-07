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
import LangTabs from '../../../components/staff/LangTabs';
import { getCategories, createMenuItem, updateMenuItem, translateText } from '../../../api/admin';
import { getDishDetail } from '../../../api/menu';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor, emptyI18n } from '../../../i18n/langs';
import { useLocalField } from '../../../i18n/useLang';
import { MdAdd, MdDelete } from 'react-icons/md';
import styles from './dishEdit.module.css';

// ── Factory helpers ───────────────────────────────────────────────────────────
const EMPTY_FORM = {
  ...emptyI18n('name', 'description'),
  price:           '',
  category:        '',
  images:          [],
  available:       true,
  ingredientsList: [],
  addons:          [],
  componentGroups: [],
};

function newIngredient() {
  return { id: `ing-${Date.now()}-${Math.random()}`, ...emptyI18n('name'), isRemovable: false };
}
function newAddon() {
  return { id: `ao-${Date.now()}-${Math.random()}`, ...emptyI18n('name'), price: 0 };
}
function newComponentGroup() {
  return { id: `cg-${Date.now()}-${Math.random()}`, ...emptyI18n('name'), isRequired: true, options: [] };
}
function newGroupOption() {
  return { id: `cgo-${Date.now()}-${Math.random()}`, ...emptyI18n('name'), priceModifier: 0 };
}

// Normalize an object from the API: fill every expected lang field ─────────────
function normI18n(obj, ...bases) {
  const out = {};
  bases.forEach(base => {
    SUPPORTED_LANGS.forEach(l => {
      const key = fieldFor(base, l.code);
      out[key] = obj?.[key] ?? '';
    });
  });
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DishEdit() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const local      = useLocalField();
  const { t }      = useTranslation('dishEdit');
  const isNew      = !id || id === 'new';

  const [form,        setForm]        = useState(EMPTY_FORM);
  const [categories,  setCategories]  = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [activeLang,  setActiveLang]  = useState(SOURCE_LANG);
  const [translating, setTranslating] = useState(false);

  // Convenience: current-language field key + source-language hint value
  const lf       = base => fieldFor(base, activeLang);
  const srcHint  = (base, obj = form) =>
    activeLang !== SOURCE_LANG ? obj[fieldFor(base, SOURCE_LANG)] : null;
  const srcLang  = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    getCategories()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data.map(c => ({
            id: c._id || c.id,
            ...normI18n(c, 'name'),
          })));
        }
      })
      .catch(err => console.error('getCategories error:', err));
  }, []);

  useEffect(() => {
    if (isNew) return;
    getDishDetail(id)
      .then(raw => {
        if (!raw) return;
        setForm({
          ...normI18n(raw, 'name', 'description'),
          price:    raw.basePrice ?? raw.price ?? '',
          category: raw.categoryId?._id || raw.categoryId || raw.category || '',
          images:   raw.imageUrl ? [raw.imageUrl] : raw.image ? [raw.image] : [],
          available: raw.isAvailable ?? raw.available ?? true,
          ingredientsList: (raw.ingredients || raw.ingredientsList || []).map(i => ({
            id: i._id || i.id || `ing-${Math.random()}`,
            ...normI18n(i, 'name'),
            isRemovable: i.isRemovable ?? true,
          })),
          addons: (raw.addons || []).map(a => ({
            id: a._id || a.id || `ao-${Math.random()}`,
            ...normI18n(a, 'name'),
            price: a.price ?? 0,
          })),
          componentGroups: (raw.componentGroups || []).map(g => ({
            id: g._id || g.id || `cg-${Math.random()}`,
            ...normI18n(g, 'name'),
            isRequired: g.isRequired ?? true,
            options: (g.options || []).map(o => ({
              id: o._id || o.id || `cgo-${Math.random()}`,
              ...normI18n(o, 'name'),
              priceModifier: o.priceModifier ?? 0,
            })),
          })),
        });
      })
      .catch(err => console.error('getDishDetail error:', err));
  }, [id, isNew]);

  // ── Auto-translate (batch, source → activeLang) ──────────────────────────────
  async function handleAutoTranslate() {
    if (activeLang === SOURCE_LANG) return;
    setTranslating(true);
    try {
      // Build a flat ordered array of source strings
      const texts = [
        form[fieldFor('name',        SOURCE_LANG)],
        form[fieldFor('description', SOURCE_LANG)],
        ...form.ingredientsList.map(i  => i[fieldFor('name', SOURCE_LANG)]),
        ...form.addons.map(a           => a[fieldFor('name', SOURCE_LANG)]),
        ...form.componentGroups.flatMap(g => [
          g[fieldFor('name', SOURCE_LANG)],
          ...g.options.map(o => o[fieldFor('name', SOURCE_LANG)]),
        ]),
      ];

      const result = await translateText(texts, activeLang);
      const tr     = result?.translations ?? [];
      const tf     = base => fieldFor(base, activeLang);

      setForm(prev => {
        let idx = 0;
        const nameT  = tr[idx++] ?? '';
        const descT  = tr[idx++] ?? '';
        const ingTs  = prev.ingredientsList.map(() => tr[idx++] ?? '');
        const addonTs = prev.addons.map(() => tr[idx++] ?? '');
        const groupTs = prev.componentGroups.map(g => ({
          name: tr[idx++] ?? '',
          optTs: g.options.map(() => tr[idx++] ?? ''),
        }));

        return {
          ...prev,
          [tf('name')]:        nameT,
          [tf('description')]: descT,
          ingredientsList: prev.ingredientsList.map((ing, i) => ({
            ...ing, [tf('name')]: ingTs[i],
          })),
          addons: prev.addons.map((a, i) => ({
            ...a, [tf('name')]: addonTs[i],
          })),
          componentGroups: prev.componentGroups.map((g, gi) => ({
            ...g,
            [tf('name')]: groupTs[gi].name,
            options: g.options.map((o, oi) => ({
              ...o, [tf('name')]: groupTs[gi].optTs[oi],
            })),
          })),
        };
      });
    } catch (err) {
      console.error('Translate error:', err);
      alert('Помилка перекладу. Перевірте з\'єднання та спробуйте ще раз.');
    } finally {
      setTranslating(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      // Build payload; dynamically include all lang variants of name/description
      const payload = {
        basePrice:       Number(form.price),
        categoryId:      form.category,
        isAvailable:     form.available,
        ingredients:     form.ingredientsList,
        addons:          form.addons,
        componentGroups: form.componentGroups,
      };
      SUPPORTED_LANGS.forEach(l => {
        payload[fieldFor('name',        l.code)] = form[fieldFor('name',        l.code)] || '';
        payload[fieldFor('description', l.code)] = form[fieldFor('description', l.code)] || '';
      });

      if (isNew) await createMenuItem(payload);
      else       await updateMenuItem(id, payload);
      navigate('/staff/menu');
    } catch (err) {
      console.error('Save dish error:', err);
      alert(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Form helpers ────────────────────────────────────────────────────────────
  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  // Ingredients
  const addIngredient = () => set('ingredientsList', [...form.ingredientsList, newIngredient()]);
  const updateIngredient = (iid, field, val) =>
    set('ingredientsList', form.ingredientsList.map(i => i.id === iid ? { ...i, [field]: val } : i));
  const removeIngredient = iid =>
    set('ingredientsList', form.ingredientsList.filter(i => i.id !== iid));

  // Add-ons
  const addAddon = () => set('addons', [...form.addons, newAddon()]);
  const updateAddon = (aid, field, val) =>
    set('addons', form.addons.map(a => a.id === aid ? { ...a, [field]: val } : a));
  const removeAddon = aid =>
    set('addons', form.addons.filter(a => a.id !== aid));

  // Component groups
  const addGroup = () => set('componentGroups', [...form.componentGroups, newComponentGroup()]);
  const updateGroup = (gid, field, val) =>
    set('componentGroups', form.componentGroups.map(g => g.id === gid ? { ...g, [field]: val } : g));
  const removeGroup = gid =>
    set('componentGroups', form.componentGroups.filter(g => g.id !== gid));
  const addGroupOption = gid =>
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gid ? { ...g, options: [...g.options, newGroupOption()] } : g));
  const updateGroupOption = (gid, oid, field, val) =>
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gid
        ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, [field]: val } : o) }
        : g));
  const removeGroupOption = (gid, oid) =>
    set('componentGroups', form.componentGroups.map(g =>
      g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g));

  const catOptions = categories.map(c => ({ value: c.id, label: local(c, 'name') }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <StaffShell
      title={isNew ? t('titleAdd') : t('titleEdit')}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} className={styles.cancelBtn} />
          <PrimaryButton   label={saving ? '…' : t('save')}  onClick={handleSave} disabled={saving} className={styles.saveBtn} />
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.formCol}>

          {/* ── Language bar (sticky, affects all sections) ── */}
          <div className={styles.langBar}>
            <LangTabs
              langs={SUPPORTED_LANGS}
              active={activeLang}
              onChange={setActiveLang}
              onTranslate={activeLang !== SOURCE_LANG ? handleAutoTranslate : null}
              translating={translating}
            />
          </div>

          {/* ── Basic info ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('mainInfo')}</p>
            <div className={styles.basicGrid}>
              {/* Name */}
              <div className={styles.fieldWrap}>
                <InputField
                  label={t('name')}
                  placeholder="—"
                  value={form[lf('name')]}
                  onChange={e => set(lf('name'), e.target.value)}
                />
                {srcHint('name') && (
                  <span className={styles.srcHint}>{srcLang.flag} {srcHint('name')}</span>
                )}
              </div>

              {/* Price */}
              <InputField
                label={t('price')}
                placeholder={t('pricePlaceholder')}
                type="number"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />

              {/* Category */}
              <Dropdown
                label={t('category')}
                options={catOptions}
                value={form.category}
                onChange={val => set('category', val)}
                placeholder={t('selectCategory')}
              />

              {/* Description — full row */}
              <div className={`${styles.fieldWrap} ${styles.spanFull}`}>
                <TextareaField
                  label={t('desc')}
                  placeholder="—"
                  value={form[lf('description')]}
                  onChange={e => set(lf('description'), e.target.value)}
                />
                {srcHint('description') && (
                  <span className={`${styles.srcHint} ${styles.srcHintBlock}`}>
                    {srcLang.flag} {srcHint('description')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Ingredients ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('ingredientsSection')}</p>
              <button className={styles.addRowBtn} onClick={addIngredient}>
                <MdAdd /> {t('addIngredient')}
              </button>
            </div>
            {form.ingredientsList.length === 0 && (
              <p className={styles.emptyHint}>{t('noIngredients')}</p>
            )}
            {form.ingredientsList.map(ing => (
              <div key={ing.id} className={styles.listRow}>
                <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                  <InputField
                    label={t('name')}
                    placeholder="—"
                    value={ing[lf('name')]}
                    onChange={e => updateIngredient(ing.id, lf('name'), e.target.value)}
                  />
                  {srcHint('name', ing) && (
                    <span className={styles.srcHint}>{srcLang.flag} {srcHint('name', ing)}</span>
                  )}
                </div>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={ing.isRemovable}
                    onChange={e => updateIngredient(ing.id, 'isRemovable', e.target.checked)}
                  />
                  {t('removable')}
                </label>
                <button className={styles.deleteRowBtn} onClick={() => removeIngredient(ing.id)}>
                  <MdDelete />
                </button>
              </div>
            ))}
          </div>

          {/* ── Add-ons ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('addonsSection')}</p>
              <button className={styles.addRowBtn} onClick={addAddon}>
                <MdAdd /> {t('addAddon')}
              </button>
            </div>
            {form.addons.length === 0 && (
              <p className={styles.emptyHint}>{t('noAddons')}</p>
            )}
            {form.addons.map(ao => (
              <div key={ao.id} className={styles.listRow}>
                <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                  <InputField
                    label={t('name')}
                    placeholder="—"
                    value={ao[lf('name')]}
                    onChange={e => updateAddon(ao.id, lf('name'), e.target.value)}
                  />
                  {srcHint('name', ao) && (
                    <span className={styles.srcHint}>{srcLang.flag} {srcHint('name', ao)}</span>
                  )}
                </div>
                <div className={styles.addonPrice}>
                  <InputField
                    label={t('addonPrice')}
                    type="number"
                    placeholder="0"
                    value={ao.price}
                    onChange={e => updateAddon(ao.id, 'price', Number(e.target.value))}
                  />
                </div>
                <button className={styles.deleteRowBtn} onClick={() => removeAddon(ao.id)}>
                  <MdDelete />
                </button>
              </div>
            ))}
          </div>

          {/* ── Component groups ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('componentGroupsSection')}</p>
              <button className={styles.addRowBtn} onClick={addGroup}>
                <MdAdd /> {t('addGroup')}
              </button>
            </div>
            {form.componentGroups.length === 0 && (
              <p className={styles.emptyHint}>{t('noGroups')}</p>
            )}
            {form.componentGroups.map(group => (
              <div key={group.id} className={styles.groupBlock}>
                {/* Group header */}
                <div className={styles.groupBlockHeader}>
                  <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                    <InputField
                      label={t('name')}
                      placeholder="—"
                      value={group[lf('name')]}
                      onChange={e => updateGroup(group.id, lf('name'), e.target.value)}
                    />
                    {srcHint('name', group) && (
                      <span className={styles.srcHint}>{srcLang.flag} {srcHint('name', group)}</span>
                    )}
                  </div>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={group.isRequired}
                      onChange={e => updateGroup(group.id, 'isRequired', e.target.checked)}
                    />
                    {t('required')}
                  </label>
                  <button className={styles.deleteRowBtn} onClick={() => removeGroup(group.id)}>
                    <MdDelete />
                  </button>
                </div>

                {/* Group options */}
                <div className={styles.groupOptions}>
                  {group.options.map(opt => (
                    <div key={opt.id} className={styles.optionRow}>
                      <div className={styles.fieldWrap}>
                        <InputField
                          label={t('name')}
                          placeholder="—"
                          value={opt[lf('name')]}
                          onChange={e => updateGroupOption(group.id, opt.id, lf('name'), e.target.value)}
                        />
                        {srcHint('name', opt) && (
                          <span className={styles.srcHint}>{srcLang.flag} {srcHint('name', opt)}</span>
                        )}
                      </div>
                      <InputField
                        label={t('priceModifier')}
                        type="number"
                        placeholder="0"
                        value={opt.priceModifier}
                        onChange={e => updateGroupOption(group.id, opt.id, 'priceModifier', Number(e.target.value))}
                      />
                      <button className={styles.deleteRowBtn} onClick={() => removeGroupOption(group.id, opt.id)}>
                        <MdDelete />
                      </button>
                    </div>
                  ))}
                  <button className={styles.addOptionBtn} onClick={() => addGroupOption(group.id)}>
                    <MdAdd /> {t('addOption')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Photos ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('photos')}</p>
            <PhotoUpload images={form.images} onChange={imgs => set('images', imgs)} />
          </div>
        </div>

        {/* ── Preview column ── */}
        <div className={styles.previewCol}>
          <DishPreview dish={form} available={form.available} />
        </div>
      </div>
    </StaffShell>
  );
}

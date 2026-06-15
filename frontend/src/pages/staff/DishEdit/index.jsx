import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ClientToastContext';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import TextareaField from '../../../components/staff/TextareaField';
import PhotoUpload from '../../../components/staff/PhotoUpload';
import DishPreview from '../../../components/staff/DishPreview';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import LangTabs from '../../../components/staff/LangTabs';
import UpgradeModal from '../../../components/UpgradeModal';
import {
  translateText,
  getAdminMenuItem, createMenuItem, updateMenuItem, uploadMenuItemImage, setMenuItemImages,
  searchIngredients, searchAddons, searchComponentGroups,
} from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor, emptyI18n } from '../../../i18n/langs';
import { MdAdd, MdDelete, MdSearch, MdClose } from 'react-icons/md';
import { usePlan } from '../../../hooks/usePlan';
import TranslateOverlay from '../../../components/staff/TranslateOverlay';
import styles from './dishEdit.module.css';

// ── Factories ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  ...emptyI18n('name', 'description'),
  price:             '',
  weight:            '',
  weight_en:         '',
  category:          '',
  images:            [],   // Array<{ url: string, file: File | null }>
  selectedImageIdx:  0,
  available:         true,
  ingredientsList:   [],
  addons:            [],
  componentGroups:   [],
};

function newIngredientEmbed(name = '') {
  return { _id: null, tempId: `ing-${Date.now()}-${Math.random()}`, name, name_en: '', isRemovable: true, isAvailable: true, sourceId: null };
}
function newAddonEmbed(name = '', price = 0) {
  return { _id: null, tempId: `ao-${Date.now()}-${Math.random()}`, name, name_en: '', price, isAvailable: true, sourceId: null };
}
function newCgEmbed(name = '') {
  return { _id: null, tempId: `cg-${Date.now()}-${Math.random()}`, name, name_en: '', isRequired: false, isAvailable: true, sourceId: null, options: [] };
}
function newCgOption() {
  return { id: `cgo-${Date.now()}-${Math.random()}`, name: '', name_en: '', priceModifier: 0, isDefault: false, sourceId: null };
}

// ── SearchPicker ──────────────────────────────────────────────────────────────
function SearchPicker({ placeholder, results, onSearch, onSelect, onCreate, createLabel }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    onSearch(v);
    setOpen(true);
  }

  function handleSelect(item) {
    onSelect(item);
    setQuery('');
    setOpen(false);
  }

  function handleCreate() {
    onCreate(query.trim());
    setQuery('');
    setOpen(false);
  }

  return (
    <div className={styles.searchPicker} ref={ref}>
      <div className={styles.searchInputRow}>
        <MdSearch className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => { onSearch(query); setOpen(true); }}
        />
        {query && <button className={styles.clearSearchBtn} onClick={() => { setQuery(''); setOpen(false); }}><MdClose /></button>}
      </div>
      {open && (
        <div className={styles.searchDropdown}>
          {results.map(r => (
            <button key={r._id} className={styles.searchOption} onMouseDown={() => handleSelect(r)}>
              {r.name}
            </button>
          ))}
          {query.trim() && (
            <button className={styles.createOption} onMouseDown={handleCreate}>
              <MdAdd /> {createLabel}: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {!results.length && !query.trim() && (
            <div className={styles.noResults}>—</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DishEdit() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t }         = useTranslation('dishEdit');
  const { showToast } = useToast();
  const { isFree }    = usePlan();
  // Either `false` (closed) or the i18n key for the upgrade reason
  // ('upgrade_limit_images' for the photo cap, default for the auto-translate
  // upsell). Tracked as a single piece of state so the modal carries the
  // right context message.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isNew         = !id || id === 'new';

  const [form,        setForm]        = useState(EMPTY_FORM);

  // Categories from shared cache — lazy-loaded on first dish-edit visit.
  const { categories: cachedCats, ensureCategories, refreshMenuItems } = useStaffData();
  useEffect(() => { ensureCategories(); }, [ensureCategories]);
  const categories = Array.isArray(cachedCats)
    ? cachedCats.map(c => ({ id: c._id || c.id, name: c.name, name_en: c.name_en || '', color: c.color }))
    : [];
  const [saving,      setSaving]      = useState(false);
  const [activeLang,  setActiveLang]  = useState(SOURCE_LANG);
  const [translating, setTranslating] = useState(false);

  // Global template pools for pickers
  const [ingPool, setIngPool] = useState([]);
  const [addPool, setAddPool] = useState([]);
  const [cgPool,  setCgPool]  = useState([]);

  const lf      = base => fieldFor(base, activeLang);
  const srcHint = (base, obj = form) =>
    activeLang !== SOURCE_LANG ? obj[fieldFor(base, SOURCE_LANG)] : null;
  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Categories come from the shared cache — no fetch here.
    Promise.all([searchIngredients(''), searchAddons(''), searchComponentGroups('')])
      .then(([ings, ads, cgs]) => { setIngPool(ings); setAddPool(ads); setCgPool(cgs); })
      .catch(err => console.error('load pools error:', err));
  }, []);

  useEffect(() => {
    if (isNew) return;
    getAdminMenuItem(id)
      .then(raw => {
        if (!raw) return;
        setForm({
          name:        raw.name || '',
          name_en:     raw.translations?.en?.name?.value || '',
          description: raw.description || '',
          description_en: raw.translations?.en?.description?.value || '',
          price:     raw.basePrice ?? '',
          weight:    raw.weight ?? '',
          weight_en: raw.translations?.en?.weight?.value || '',
          category:  raw.categoryId?._id || raw.categoryId || '',
          images: (
            raw.images?.length
              ? raw.images
              : raw.imageUrl ? [raw.imageUrl] : []
          ).map(url => ({ url, file: null })),
          selectedImageIdx: raw.selectedImageIdx ?? 0,
          available: raw.isAvailable ?? true,
          ingredientsList: (raw.ingredients || []).map(i => ({
            _id: i._id,
            tempId: null,
            name: i.name || '',
            name_en: i.name_en || '',
            isRemovable: i.isRemovable ?? true,
            isAvailable: i.isAvailable ?? true,
            sourceId: i.sourceId || null,
          })),
          addons: (raw.addons || []).map(a => ({
            _id: a._id,
            tempId: null,
            name: a.name || '',
            name_en: a.name_en || '',
            price: a.price ?? 0,
            isAvailable: a.isAvailable ?? true,
            sourceId: a.sourceId || null,
          })),
          componentGroups: (raw.componentGroups || []).map(g => ({
            _id: g._id,
            tempId: null,
            name: g.name || '',
            name_en: g.name_en || '',
            isRequired: g.isRequired ?? false,
            isAvailable: g.isAvailable ?? true,
            sourceId: g.sourceId || null,
            options: (g.options || []).map(o => ({
              id: o._id || `cgo-${Math.random()}`,
              name: o.name || '',
              name_en: o.name_en || '',
              priceModifier: o.priceModifier ?? 0,
              isDefault: o.isDefault ?? false,
              sourceId: o.sourceId || null,
            })),
          })),
        });
      })
      .catch(err => console.error('getAdminMenuItem error:', err));
  }, [id, isNew]);

  // ── Auto-translate ────────────────────────────────────────────────────────────
  async function handleAutoTranslate() {
    if (activeLang === SOURCE_LANG) return;
    setTranslating(true);
    try {
      const texts = [
        form[fieldFor('name',        SOURCE_LANG)],
        form[fieldFor('description', SOURCE_LANG)],
        form.weight,
        ...form.ingredientsList.map(i => i.name),
        ...form.addons.map(a => a.name),
        ...form.componentGroups.flatMap(g => [
          g.name,
          ...g.options.map(o => o.name),
        ]),
      ];
      const result = await translateText(texts, activeLang);
      const tr = result?.translations ?? [];

      setForm(prev => {
        let idx = 0;
        const nameT    = tr[idx++] ?? '';
        const descT    = tr[idx++] ?? '';
        const weightT  = tr[idx++] ?? '';
        const ingTs    = prev.ingredientsList.map(() => tr[idx++] ?? '');
        const aoTs     = prev.addons.map(() => tr[idx++] ?? '');
        const groupTs  = prev.componentGroups.map(g => ({
          name: tr[idx++] ?? '',
          optTs: g.options.map(() => tr[idx++] ?? ''),
        }));
        const tf = base => fieldFor(base, activeLang);
        return {
          ...prev,
          [tf('name')]:        nameT,
          [tf('description')]: descT,
          weight_en: activeLang === 'en' ? weightT : prev.weight_en,
          ingredientsList: prev.ingredientsList.map((i, ii) => ({
            ...i,
            name_en: activeLang === 'en' ? ingTs[ii] : i.name_en,
          })),
          addons: prev.addons.map((a, ai) => ({
            ...a,
            name_en: activeLang === 'en' ? aoTs[ai] : a.name_en,
          })),
          componentGroups: prev.componentGroups.map((g, gi) => ({
            ...g,
            name_en: activeLang === 'en' ? groupTs[gi].name : g.name_en,
            options: g.options.map((o, oi) => ({
              ...o,
              name_en: activeLang === 'en' ? groupTs[gi].optTs[oi] : o.name_en,
            })),
          })),
        };
      });
    } catch (err) {
      // HttpErrorToast surfaces the api:error event globally — no inline alert needed.
      console.error('Translate error:', err);
    } finally {
      setTranslating(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name:            form.name,
        description:     form.description,
        name_en:         form.name_en        || '',
        description_en:  form.description_en || '',
        price:           Number(form.price),
        categoryId:      form.category,
        isAvailable:     form.available,
        weight:          form.weight    || null,
        weight_en:       form.weight_en || '',
        // Embedded arrays sent directly — no global creation
        ingredients: form.ingredientsList.map(i => ({
          ...(i._id ? { _id: i._id } : {}),
          name:        i.name,
          name_en:     i.name_en || '',
          isRemovable: i.isRemovable,
          isAvailable: i.isAvailable,
          sourceId:    i.sourceId || null,
        })),
        addons: form.addons.map(a => ({
          ...(a._id ? { _id: a._id } : {}),
          name:        a.name,
          name_en:     a.name_en || '',
          price:       a.price,
          isAvailable: a.isAvailable,
          sourceId:    a.sourceId || null,
        })),
        componentGroups: form.componentGroups.map(g => ({
          ...(g._id ? { _id: g._id } : {}),
          name:        g.name,
          name_en:     g.name_en || '',
          isRequired:  g.isRequired,
          isAvailable: g.isAvailable,
          sourceId:    g.sourceId || null,
          options: g.options.map(o => ({
            ...(o.id && !o.id.startsWith('cgo-') ? { _id: o.id } : {}),
            name:          o.name,
            name_en:       o.name_en || '',
            priceModifier: o.priceModifier || 0,
            isDefault:     o.isDefault || false,
            sourceId:      o.sourceId || null,
          })),
        })),
      };
      const result  = isNew ? await createMenuItem(payload) : await updateMenuItem(id, payload);
      const savedId = isNew ? (result?._id || result?.id) : id;
      if (savedId) {
        // Reset the server-side images array to just the URLs the user wants
        // to keep BEFORE uploading new files. This frees up plan-limit slots
        // and discards any orphaned images left by a previous failed save —
        // each /image POST checks `item.images.length` against the free-plan
        // cap, so stale entries would otherwise pre-block fresh uploads.
        if (!isNew) {
          const keptUrls = form.images.filter(img => !img.file).map(img => img.url);
          await setMenuItemImages(savedId, {
            images: keptUrls,
            selectedImageIdx: Math.min(form.selectedImageIdx, Math.max(0, keptUrls.length - 1)),
          });
        }

        // Upload each new file, collect final URLs in display order
        const finalUrls = [];
        for (const img of form.images) {
          if (img.file) {
            const uploaded = await uploadMenuItemImage(savedId, img.file);
            finalUrls.push(uploaded.imageUrl);
          } else {
            finalUrls.push(img.url);
          }
        }
        if (finalUrls.length > 0) {
          await setMenuItemImages(savedId, {
            images: finalUrls,
            selectedImageIdx: Math.min(form.selectedImageIdx, finalUrls.length - 1),
          });
        }
      }
      // Image endpoints (POST /image, PUT /images) don't emit MENU_UPDATED on
      // the backend, so the cached menu thumbnails would otherwise still show
      // the old `imageUrl` after navigating back. Force a refresh.
      refreshMenuItems();
      showToast(t(isNew ? 'savedNew' : 'savedUpdated', isNew ? 'Страву додано' : 'Зміни збережено'));
      navigate('/staff/menu');
    } catch (err) {
      // HttpErrorToast surfaces the api:error event globally — no inline alert needed.
      console.error('Save dish error:', err);
    } finally {
      setSaving(false);
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────────
  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  // Ingredient picker — copies template data into embedded subdoc
  const [ingSearch, setIngSearch] = useState([]);
  function handleIngSearch(q) {
    const lower = q.toLowerCase();
    const ids = new Set(form.ingredientsList.map(i => String(i.sourceId || i._id)));
    setIngSearch(ingPool.filter(i => i.name.toLowerCase().includes(lower) && !ids.has(String(i._id))));
  }
  function addExistingIng(item) {
    const ids = new Set(form.ingredientsList.map(i => String(i.sourceId || i._id)));
    if (ids.has(String(item._id))) return;
    set('ingredientsList', [...form.ingredientsList, {
      _id: null, tempId: `ing-${Date.now()}-${Math.random()}`,
      name: item.name,
      name_en: item.translations?.en?.name?.value || '',
      isRemovable: item.isRemovable ?? true,
      isAvailable: true,
      sourceId: item._id,
    }]);
  }
  function addNewIng(name) {
    if (!name) return;
    set('ingredientsList', [...form.ingredientsList, newIngredientEmbed(name)]);
  }
  function removeIng(key) {
    set('ingredientsList', form.ingredientsList.filter(i => (i._id || i.tempId) !== key));
  }
  function updateIngField(key, field, val) {
    set('ingredientsList', form.ingredientsList.map(i => (i._id || i.tempId) === key ? { ...i, [field]: val } : i));
  }

  // Addon picker — copies template data into embedded subdoc
  const [aoSearch, setAoSearch] = useState([]);
  function handleAoSearch(q) {
    const lower = q.toLowerCase();
    const ids = new Set(form.addons.map(a => String(a.sourceId || a._id)));
    setAoSearch(addPool.filter(a => a.name.toLowerCase().includes(lower) && !ids.has(String(a._id))));
  }
  function addExistingAo(item) {
    const ids = new Set(form.addons.map(a => String(a.sourceId || a._id)));
    if (ids.has(String(item._id))) return;
    set('addons', [...form.addons, {
      _id: null, tempId: `ao-${Date.now()}-${Math.random()}`,
      name: item.name,
      name_en: item.translations?.en?.name?.value || '',
      price: item.price ?? 0,
      isAvailable: true,
      sourceId: item._id,
    }]);
  }
  function addNewAo(name) {
    if (!name) return;
    set('addons', [...form.addons, newAddonEmbed(name)]);
  }
  function removeAo(key) {
    set('addons', form.addons.filter(a => (a._id || a.tempId) !== key));
  }
  function updateAoField(key, field, val) {
    set('addons', form.addons.map(a => (a._id || a.tempId) === key ? { ...a, [field]: val } : a));
  }

  // ComponentGroup picker — copies template data (deep embed of options)
  const [cgSearch, setCgSearch] = useState([]);
  function handleCgSearch(q) {
    const lower = q.toLowerCase();
    const ids = new Set(form.componentGroups.map(g => String(g.sourceId || g._id)));
    setCgSearch(cgPool.filter(g => g.name.toLowerCase().includes(lower) && !ids.has(String(g._id))));
  }
  function addExistingCg(item) {
    const ids = new Set(form.componentGroups.map(g => String(g.sourceId || g._id)));
    if (ids.has(String(item._id))) return;
    set('componentGroups', [...form.componentGroups, {
      _id: null, tempId: `cg-${Date.now()}-${Math.random()}`,
      name: item.name,
      name_en: item.translations?.en?.name?.value || '',
      isRequired: item.isRequired ?? false,
      isAvailable: true,
      sourceId: item._id,
      options: (item.options || []).map(o => ({
        id: `cgo-${Date.now()}-${Math.random()}`,
        name: o.name || '',
        name_en: o.translations?.en?.name?.value || '',
        priceModifier: o.priceModifier ?? 0,
        isDefault: o.isDefault ?? false,
        sourceId: o._id || null,
      })),
    }]);
  }
  function addNewCg(name) {
    if (!name) return;
    const ng = newCgEmbed(name);
    set('componentGroups', [...form.componentGroups, ng]);
  }
  function removeCg(key) {
    set('componentGroups', form.componentGroups.filter(g => (g._id || g.tempId) !== key));
  }
  function updateCgField(key, field, val) {
    set('componentGroups', form.componentGroups.map(g => (g._id || g.tempId) === key ? { ...g, [field]: val } : g));
  }
  function addCgOption(key) {
    set('componentGroups', form.componentGroups.map(g =>
      (g._id || g.tempId) === key ? { ...g, options: [...g.options, newCgOption()] } : g));
  }
  function updateCgOption(key, oid, field, val) {
    set('componentGroups', form.componentGroups.map(g =>
      (g._id || g.tempId) === key
        ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, [field]: val } : o) }
        : g));
  }
  function removeCgOption(key, oid) {
    set('componentGroups', form.componentGroups.map(g =>
      (g._id || g.tempId) === key ? { ...g, options: g.options.filter(o => o.id !== oid) } : g));
  }

  const activeLangLabel = SUPPORTED_LANGS.find(l => l.code === activeLang)?.label ?? activeLang;

  const catOptions = categories.map(c => ({
    value: c.id,
    label: activeLang === SOURCE_LANG ? c.name : (c.name_en || c.name),
    icon: c.color
      ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
      : null,
  }));

  // Which name field to show for the active lang
  const nameLangField  = activeLang === SOURCE_LANG ? 'name'        : 'name_en';
  const descLangField  = activeLang === SOURCE_LANG ? 'description' : 'description_en';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
    <TranslateOverlay visible={translating} lang={activeLangLabel} />
    <UpgradeModal
      open={!!upgradeOpen}
      onClose={() => setUpgradeOpen(false)}
      ns="components"
      reason={typeof upgradeOpen === 'string' ? upgradeOpen : undefined}
    />
    <StaffShell
      title={isNew ? t('titleAdd') : t('titleEdit')}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} className={styles.cancelBtn} />
          <PrimaryButton   label={saving ? '…' : t('save')} onClick={handleSave} disabled={saving} className={styles.saveBtn} />
        </div> 
      }
    >
      <div className={styles.layout}>
        <div className={styles.formCol}>

          {/* ── Language bar ── */}
          <div className={styles.langBar}>
            <LangTabs
              langs={SUPPORTED_LANGS}
              active={activeLang}
              onChange={setActiveLang}
              onTranslate={activeLang !== SOURCE_LANG
                ? (isFree ? () => setUpgradeOpen(true) : handleAutoTranslate)
                : null}
              translating={translating}
            />
          </div>

          {/* ── Basic info ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('mainInfo')}</p>
            <div className={styles.basicGrid}>
              <div className={styles.fieldWrap}>
                <InputField
                  label={t('name')}
                  placeholder="—"
                  value={form[nameLangField]}
                  onChange={e => set(nameLangField, e.target.value)}
                />
                {activeLang !== SOURCE_LANG && form.name && (
                  <span className={styles.srcHint}>{srcLang.flag} {form.name}</span>
                )}
              </div>

              <InputField
                label={t('price')}
                placeholder={t('pricePlaceholder')}
                type="number"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />

              <div className={styles.fieldWrap}>
                <InputField
                  label={t('weight')}
                  placeholder={t('weightPlaceholder')}
                  value={activeLang === SOURCE_LANG ? form.weight : form.weight_en}
                  onChange={e => set(activeLang === SOURCE_LANG ? 'weight' : 'weight_en', e.target.value)}
                />
                {activeLang !== SOURCE_LANG && form.weight && (
                  <span className={styles.srcHint}>{srcLang.flag} {form.weight}</span>
                )}
              </div>

              <Dropdown
                label={t('category')}
                options={catOptions}
                value={form.category}
                onChange={val => set('category', val)}
                placeholder={t('selectCategory')}
              />

              <div className={`${styles.fieldWrap} ${styles.spanFull}`}>
                <TextareaField
                  label={t('desc')}
                  placeholder="—"
                  value={form[descLangField]}
                  onChange={e => set(descLangField, e.target.value)}
                />
                {activeLang !== SOURCE_LANG && form.description && (
                  <span className={`${styles.srcHint} ${styles.srcHintBlock}`}>
                    {srcLang.flag} {form.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Ingredients ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('ingredientsSection')}</p>
              <button className={styles.addRowBtn} onClick={() => navigate(`/staff/extras/ingredient/new?backTo=${encodeURIComponent(location.pathname)}`)}>
                <MdAdd /> {t('createNewPage')}
              </button>
            </div>
            <SearchPicker
              placeholder={t('searchIngredients')}
              results={ingSearch}
              onSearch={handleIngSearch}
              onSelect={addExistingIng}
              onCreate={addNewIng}
              createLabel={t('createNew')}
            />
            {form.ingredientsList.length === 0 && (
              <p className={styles.emptyHint}>{t('noIngredients')}</p>
            )}
            {form.ingredientsList.map(ing => {
              const key = ing._id || ing.tempId;
              const nameField = activeLang === SOURCE_LANG ? 'name' : 'name_en';
              return (
                <div key={key} className={styles.groupBlock}>
                  <div className={styles.groupBlockRow}>
                    <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                      <InputField
                        label={t('name')}
                        placeholder="—"
                        value={ing[nameField]}
                        onChange={e => updateIngField(key, nameField, e.target.value)}
                      />
                      {activeLang !== SOURCE_LANG && ing.name && (
                        <span className={styles.srcHint}>{srcLang.flag} {ing.name}</span>
                      )}
                    </div>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={ing.isRemovable}
                        onChange={e => updateIngField(key, 'isRemovable', e.target.checked)}
                      />
                      {t('removable')}
                    </label>
                    <button className={styles.deleteRowBtn} onClick={() => removeIng(key)}>
                      <MdDelete />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Add-ons ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('addonsSection')}</p>
              <button className={styles.addRowBtn} onClick={() => navigate(`/staff/extras/addon/new?backTo=${encodeURIComponent(location.pathname)}`)}>
                <MdAdd /> {t('createNewPage')}
              </button>
            </div>
            <SearchPicker
              placeholder={t('searchAddons')}
              results={aoSearch}
              onSearch={handleAoSearch}
              onSelect={addExistingAo}
              onCreate={addNewAo}
              createLabel={t('createNew')}
            />
            {form.addons.length === 0 && (
              <p className={styles.emptyHint}>{t('noAddons')}</p>
            )}
            {form.addons.map(ao => {
              const key = ao._id || ao.tempId;
              const nameField = activeLang === SOURCE_LANG ? 'name' : 'name_en';
              return (
                <div key={key} className={styles.groupBlock}>
                  <div className={styles.groupBlockRow}>
                    <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                      <InputField
                        label={t('name')}
                        placeholder="—"
                        value={ao[nameField]}
                        onChange={e => updateAoField(key, nameField, e.target.value)}
                      />
                      {activeLang !== SOURCE_LANG && ao.name && (
                        <span className={styles.srcHint}>{srcLang.flag} {ao.name}</span>
                      )}
                    </div>
                    <div className={styles.addonPrice}>
                      <InputField
                        label={t('addonPrice')}
                        type="number"
                        placeholder="0"
                        value={ao.price}
                        onChange={e => updateAoField(key, 'price', Number(e.target.value))}
                      />
                    </div>
                    <button className={styles.deleteRowBtn} onClick={() => removeAo(key)}>
                      <MdDelete />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Component groups ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('componentGroupsSection')}</p>
              <button className={styles.addRowBtn} onClick={() => navigate(`/staff/extras/componentgroup/new?backTo=${encodeURIComponent(location.pathname)}`)}>
                <MdAdd /> {t('createNewPage')}
              </button>
            </div>
            <SearchPicker
              placeholder={t('searchComponentGroups')}
              results={cgSearch}
              onSearch={handleCgSearch}
              onSelect={addExistingCg}
              onCreate={addNewCg}
              createLabel={t('createNew')}
            />
            {form.componentGroups.length === 0 && (
              <p className={styles.emptyHint}>{t('noGroups')}</p>
            )}
            {form.componentGroups.map(group => {
              const key = group._id || group.tempId;
              const groupDisplayName = activeLang === 'en' && group.name_en ? group.name_en : group.name;
              return (
                <div key={key} className={styles.groupBlock}>
                  <div className={styles.groupBlockHeader}>
                    <div className={`${styles.fieldWrap} ${styles.rowName}`}>
                      <InputField
                        label={t('name')}
                        placeholder="—"
                        value={activeLang === 'en' ? group.name_en : group.name}
                        onChange={e => updateCgField(key, activeLang === 'en' ? 'name_en' : 'name', e.target.value)}
                      />
                      {activeLang !== SOURCE_LANG && group.name && (
                        <span className={styles.srcHint}>{srcLang.flag} {group.name}</span>
                      )}
                    </div>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={group.isRequired}
                        onChange={e => updateCgField(key, 'isRequired', e.target.checked)}
                      />
                      {t('required')}
                    </label>
                    <button className={styles.deleteRowBtn} onClick={() => removeCg(key)}>
                      <MdDelete />
                    </button>
                  </div>

                  <div className={styles.groupOptions}>
                    {group.options.map(opt => (
                      <div key={opt.id} className={styles.optionRow}>
                        <div className={styles.fieldWrap}>
                          <InputField
                            label={t('name')}
                            placeholder="—"
                            value={activeLang === 'en' ? (opt.name_en || '') : opt.name}
                            onChange={e => updateCgOption(key, opt.id, activeLang === 'en' ? 'name_en' : 'name', e.target.value)}
                          />
                          {activeLang !== SOURCE_LANG && opt.name && (
                            <span className={styles.srcHint}>{srcLang.flag} {opt.name}</span>
                          )}
                        </div>
                        <InputField
                          label={t('priceModifier')}
                          type="number"
                          placeholder="0"
                          value={opt.priceModifier}
                          onChange={e => updateCgOption(key, opt.id, 'priceModifier', Number(e.target.value))}
                        />
                        <button className={styles.deleteRowBtn} onClick={() => removeCgOption(key, opt.id)}>
                          <MdDelete />
                        </button>
                      </div>
                    ))}
                    <button className={styles.addOptionBtn} onClick={() => addCgOption(key)}>
                      <MdAdd /> {t('addOption')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Photos ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>{t('photos')}</p>
              <span className={styles.photoCount}>
                {form.images.length} / {isFree ? 3 : 20}
              </span>
            </div>
            <PhotoUpload
              images={form.images}
              selectedIdx={form.selectedImageIdx}
              onChange={(imgs, idx) => setForm(p => ({ ...p, images: imgs, selectedImageIdx: idx }))}
              maxImages={isFree ? 3 : 20}
              onAttemptBeyondLimit={() => setUpgradeOpen(isFree ? 'upgrade_limit_images' : true)}
            />
          </div>
        </div>

        <div className={styles.previewCol}>
          <DishPreview dish={form} available={form.available} />
        </div>
      </div>
    </StaffShell>
    </>
  );
}

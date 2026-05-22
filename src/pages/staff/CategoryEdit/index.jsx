import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ClientToastContext';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import LangTabs from '../../../components/staff/LangTabs';
import PhotoUpload from '../../../components/staff/PhotoUpload';
import UpgradeModal from '../../../components/UpgradeModal';
import TranslateOverlay from '../../../components/staff/TranslateOverlay';
import { createCategory, updateCategory, uploadCategoryImage, setCategoryImages, translateText, updateMenuItem } from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor, emptyI18n, toApiLang } from '../../../i18n/langs';
import { usePlan } from '../../../hooks/usePlan';
import styles from './categoryEdit.module.css';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#292524',
];

const EMPTY_NAMES = emptyI18n('name');

function CategoryPreview({ name, color, imageUrl }) {
  return (
    <div className={styles.previewCard}>
      <div className={styles.previewHeader} style={{ background: color || 'var(--separator-color)' }}>
        {imageUrl && <img src={imageUrl} alt="" className={styles.previewHeaderImg} />}
      </div>
      <div className={styles.previewBody}>
        <span className={styles.previewName}>{name || '—'}</span>
      </div>
    </div>
  );
}

export default function CategoryEdit() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { t }          = useTranslation('categoryEdit');
  const { showToast }  = useToast();
  const isNew     = !id || id === 'new';
  const { isFree } = usePlan();

  const [names,         setNames]         = useState(EMPTY_NAMES);
  const [upgradeOpen,   setUpgradeOpen]   = useState(false);
  const [color,         setColor]         = useState(null);
  const [sortOrder,     setSortOrder]     = useState(0);
  const [images,        setImages]        = useState([]);
  const [selImgIdx,     setSelImgIdx]     = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [activeLang,    setActiveLang]    = useState(SOURCE_LANG);
  const [translating,   setTranslating]   = useState(false);
  const [pendingMoves,  setPendingMoves]  = useState({});

  // Categories + menu items from shared cache — lazy-loaded on first visit.
  const { categories: cachedCats, menuItems: cachedItems, ensureCategories, ensureMenuItems } = useStaffData();
  useEffect(() => { ensureCategories(); ensureMenuItems(); }, [ensureCategories, ensureMenuItems]);
  const allCategories = cachedCats || [];
  const dishes = (cachedItems || []).filter(item => {
    const catId = item.categoryId?._id || item.categoryId || item.category;
    return String(catId) === String(id);
  });

  const lf      = base => fieldFor(base, activeLang);
  const srcHint = base => activeLang === SOURCE_LANG ? null : (names[fieldFor(base, SOURCE_LANG)] || null);
  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  // Hydrate the editable form from the cached categories list whenever it
  // arrives or the URL id changes (no API call — pure in-memory derive).
  useEffect(() => {
    if (isNew || !Array.isArray(cachedCats) || cachedCats.length === 0) return;
    const cat = cachedCats.find(c => (c._id || c.id) === id);
    if (!cat) return;
    const loaded = { ...EMPTY_NAMES };
    SUPPORTED_LANGS.forEach(l => {
      const key = fieldFor('name', l.code);
      loaded[key] = l.code === SOURCE_LANG
        ? (cat.name || '')
        : (cat.translations?.[l.apiCode]?.name?.value || '');
    });
    setNames(loaded);
    setColor(cat.color || null);
    setSortOrder(cat.sortOrder ?? 0);
    const loadedImages = cat.images?.length
      ? cat.images
      : cat.imageUrl ? [cat.imageUrl] : [];
    setImages(loadedImages.map(url => ({ url, file: null })));
    setSelImgIdx(cat.selectedImageIdx ?? 0);
  }, [id, isNew, cachedCats]);

  async function handleAutoTranslate() {
    if (activeLang === SOURCE_LANG) return;
    setTranslating(true);
    try {
      const result = await translateText([names[fieldFor('name', SOURCE_LANG)]], activeLang);
      const translated = result?.translations?.[0] ?? '';
      setNames(prev => ({ ...prev, [lf('name')]: translated }));
    } catch (err) {
      console.error('Translate error:', err);
    } finally {
      setTranslating(false);
    }
  }

  async function handleSave() {
    const sourceName = names[fieldFor('name', SOURCE_LANG)];
    if (!sourceName.trim()) return;
    setSaving(true);
    try {
      const payload = { name: names[lf('name')], lang: toApiLang(activeLang), color, sortOrder: Number(sortOrder) };
      const result  = isNew ? await createCategory(payload) : await updateCategory(id, payload);
      const savedId = isNew ? (result?._id || result?.id) : id;
      if (savedId) {
        const finalUrls = [];
        for (const img of images) {
          if (img.file) {
            const uploaded = await uploadCategoryImage(savedId, img.file);
            finalUrls.push(uploaded.imageUrl);
          } else {
            finalUrls.push(img.url);
          }
        }
        if (finalUrls.length > 0) {
          await setCategoryImages(savedId, {
            images: finalUrls,
            selectedImageIdx: Math.min(selImgIdx, finalUrls.length - 1),
          });
        }
      }
      for (const [dishId, newCatId] of Object.entries(pendingMoves)) {
        await updateMenuItem(dishId, { categoryId: newCatId });
      }
      showToast(t(isNew ? 'savedNew' : 'savedUpdated', isNew ? 'Категорію додано' : 'Зміни збережено'));
      navigate('/staff/menu');
    } catch (err) {
      console.error('CategoryEdit save error:', err);
    } finally {
      setSaving(false);
    }
  }

  const previewName  = names[fieldFor('name', SOURCE_LANG)];
  const previewImage = images[selImgIdx]?.url || null;

  const activeLangLabel = SUPPORTED_LANGS.find(l => l.code === activeLang)?.label ?? activeLang;

  return (
    <>
    <TranslateOverlay visible={translating} lang={activeLangLabel} />
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} ns="components" />
    <StaffShell
      title={isNew ? t('titleAdd') : t('titleEdit')}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} className={styles.cancelBtn} />
          <PrimaryButton label={saving ? '…' : t('save')} onClick={handleSave} disabled={saving} className={styles.saveBtn} />
        </div>
      }
    >
      <div className={styles.layout}>

        {/* ── Left: form columns ── */}
        <div className={styles.formCol}>

          {/* Language tabs */}
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

          {/* Basic info */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('basicInfo')}</p>
            <div className={styles.basicGrid}>
              <div className={styles.fieldWrap}>
                <InputField
                  label={t('name')}
                  placeholder="—"
                  value={names[lf('name')]}
                  onChange={e => setNames(prev => ({ ...prev, [lf('name')]: e.target.value }))}
                />
                {srcHint('name') && (
                  <span className={styles.srcHint}>{srcLang.flag} {srcHint('name')}</span>
                )}
              </div>
              <div className={styles.fieldWrap}>
                <InputField
                  label={t('sortOrder')}
                  type="number"
                  placeholder="0"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Color */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('colorSection')}</p>
            <div className={styles.colorPreviewRow}>
              <span className={styles.colorPreview} style={{ background: color || 'var(--separator-color)' }} />
              <span className={styles.colorHex}>{color || '—'}</span>
              {color && (
                <button className={styles.clearBtn} onClick={() => setColor(null)}>
                  {t('clearColor')}
                </button>
              )}
            </div>
            <div className={styles.palette}>
              {PALETTE.map(hex => (
                <button
                  key={hex}
                  className={`${styles.swatch} ${color === hex ? styles.swatchActive : ''}`}
                  style={{ background: hex }}
                  onClick={() => setColor(color === hex ? null : hex)}
                  aria-label={hex}
                />
              ))}
            </div>
            <div className={styles.customRow}>
              <input
                type="color"
                className={styles.customInput}
                value={color || '#3b82f6'}
                onChange={e => setColor(e.target.value)}
              />
              <span className={styles.customLabel}>{t('customColor')}</span>
            </div>
          </div>

          {/* Photo */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('photo', 'Фото')}</p>
            <PhotoUpload
              images={images}
              selectedIdx={selImgIdx}
              onChange={(imgs, idx) => { setImages(imgs.slice(0, 1)); setSelImgIdx(0); }}
              maxImages={1}
            />
          </div>

          {/* Dishes in category */}
          {!isNew && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('dishesSection', 'Страви категорії')}</p>
              {dishes.length === 0 ? (
                <p className={styles.emptyHint}>{t('noDishes', 'У цій категорії немає страв')}</p>
              ) : (
                <div className={styles.dishList}>
                  {dishes.map(dish => {
                    const pendingCatId = pendingMoves[dish._id || dish.id];
                    return (
                      <div key={dish._id || dish.id} className={`${styles.dishRow} ${pendingCatId ? styles.dishRowPending : ''}`}>
                        {dish.imageUrl && <img src={dish.imageUrl} alt="" className={styles.dishThumb} />}
                        <span className={styles.dishName}>{dish.name || '—'}</span>
                        <select
                          className={styles.catSelect}
                          value={pendingCatId || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setPendingMoves(prev => {
                              if (!val) { const next = { ...prev }; delete next[dish._id || dish.id]; return next; }
                              return { ...prev, [dish._id || dish.id]: val };
                            });
                          }}
                        >
                          <option value="">{t('keepCategory', 'Без змін')}</option>
                          {allCategories
                            .filter(c => (c._id || c.id) !== id)
                            .map(c => (
                              <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
              {Object.keys(pendingMoves).length > 0 && (
                <p className={styles.pendingHint}>
                  {t('pendingMoves', `${Object.keys(pendingMoves).length} страв буде перенесено при збереженні`)}
                </p>
              )}
            </div>
          )}

        </div>

        {/* ── Right: preview ── */}
        <div className={styles.sideCol}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('preview', 'Превʼю')}</p>
            <CategoryPreview name={previewName} color={color} imageUrl={previewImage} />
          </div>
        </div>

      </div>
    </StaffShell>
    </>
  );
}

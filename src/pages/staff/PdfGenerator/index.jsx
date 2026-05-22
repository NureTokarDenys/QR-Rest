import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SOURCE_LANG, fieldFor } from '../../../i18n/langs';
import StaffShell from '../../../components/staff/StaffShell';
import PdfSettingItem from '../../../components/staff/PdfSettingItem';
import PdfMenuDish from '../../../components/staff/PdfMenuDish';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import UpgradeModal from '../../../components/UpgradeModal';
import { useStaffData } from '../../../context/StaffDataContext';
import {
  PDF_GENERATOR_TEMPLATES,
  PDF_FONT_STACKS,
  PDF_FONT_SCALES,
} from '../../../constants/mainConstants';
import { usePlanContext } from '../../../context/PlanContext';
import { getMenu } from '../../../api/menu';
import styles from './pdfGenerator.module.css';
import { MdPictureAsPdf, MdDragIndicator } from 'react-icons/md';

// ── Small UI helpers ─────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }) => (
  <button
    className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
    onClick={() => onChange(!value)}
  >
    <span className={styles.toggleThumb} />
  </button>
);

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.sectionTitle}
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        <span className={styles.sectionChevron}>{open ? '−' : '+'}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  // Page
  format: 'A4',
  orientation: 'portrait',
  margins: 'medium',

  // Language: 'ua' | 'en' | 'bilingual'.  bilingualMode applies only when
  // language === 'bilingual'.  'stacked' = UA dish then EN dish vertically;
  // 'columns' = UA on left half of page, EN on right half.
  language: 'ua',
  bilingualMode: 'stacked',

  // Content
  showDescription: true,
  showIngredients: false,
  showAddons: false,
  showComponentGroups: false,
  showWeight: false,
  showCategoryBadge: false,
  showReviews: false,

  // Images
  showMainPhoto: true,
  showGallery: false,
  maxImages: 1,

  // Typography
  fontFamily: 'sans',
  fontSize: 'md',

  // Colours
  colorBg:        '#ffffff',
  colorHeader:    '#1d7afc',
  colorText:      '#111111',
  colorDesc:      '#555555',
  colorPrice:     '#1d7afc',
  colorSeparator: '#e5e5ea',
};

// When a page break splits in the middle of a category, prepend a "continued"
// header so the user has context on the new page. Only fires when the first
// item of the new page is a dish (not already a header).
function maybeAddContinuedHeader(slice, startIdx, all) {
  if (!slice.length || startIdx === 0) return slice;
  if (slice[0].kind === 'header') return slice;
  // Walk backwards to find the category this dish belongs to.
  for (let i = startIdx - 1; i >= 0; i--) {
    if (all[i].kind === 'header' && all[i].catId === slice[0].catId) {
      return [{ ...all[i], continued: true }, ...slice];
    }
  }
  return slice;
}

// Paper dimensions in mm — used to size each preview page accurately.
const PAPER = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
};

const MM_TO_PX = 96 / 25.4;            // ~3.78 px per mm @ 96 DPI
const MARGIN_PX = { small: 16, medium: 28, large: 44 };
const FIRST_PAGE_HEADER_PX = 90;        // approx height of doc title block
const PAGE_FOOTER_PX = 28;              // approx height of "N / N" counter

// ── Main component ──────────────────────────────────────────────────────────

export default function PdfGenerator() {
  const navigate  = useNavigate();
  const planCtx   = usePlanContext();
  const { t, i18n } = useTranslation('pdfGenerator');

  // UI labels follow the staff member's interface language, regardless of the
  // PDF output language picked below.
  const uiLocal = (obj, field) => {
    if (!obj) return '';
    const key = fieldFor(field, i18n.language);
    return obj[key] || obj[field] || '';
  };

  // Categories + dishes from staff cache.
  const { categories: cachedCats, menuItems: cachedItems, ensureCategories, ensureMenuItems } = useStaffData();
  useEffect(() => { ensureCategories(); ensureMenuItems(); }, [ensureCategories, ensureMenuItems]);

  const categories = (cachedCats || []).map(c => ({
    id:      c._id || c.id,
    name:    c.name,
    name_en: c.translations?.en?.name?.value || c.name_en || c.name,
  }));

  // MenuItem docs store English in translations.en.<field>.value; embedded
  // sub-docs (ingredients/addons/groups/options) store name_en directly.
  // Flatten both into the *_en shape PdfMenuDish expects.
  const trEn = (item, field) => item?.translations?.en?.[field]?.value || '';
  const dishes = (cachedItems || []).map(item => ({
    id:              item._id || item.id,
    name:            item.name,
    name_en:         trEn(item, 'name')        || item.name_en        || item.name,
    description:     item.description || '',
    description_en:  trEn(item, 'description') || item.description_en || item.description || '',
    weight:          item.weight || '',
    weight_en:       trEn(item, 'weight')      || item.weight_en      || item.weight || '',
    price:           item.basePrice ?? item.price ?? 0,
    image:           item.imageUrl  || item.image || '',
    images:          (item.images && item.images.length)
                       ? item.images
                       : (item.imageUrl ? [item.imageUrl] : []),
    category:        item.categoryId?._id || item.categoryId || item.category || '',
    ingredientsList: (item.ingredients || []).map(i => ({
      id: i._id || i.id, name: i.name, name_en: i.name_en || i.name,
    })),
    addonsList:      (item.addons || []).map(a => ({
      id: a._id || a.id, name: a.name, name_en: a.name_en || a.name, price: a.price ?? 0,
    })),
    componentGroupsList: (item.componentGroups || []).map(g => ({
      id: g._id || g.id, name: g.name, name_en: g.name_en || g.name,
      options: (g.options || []).map(o => ({
        id: o._id || o.id, name: o.name, name_en: o.name_en || o.name,
      })),
    })),
  }));
  const loadingMenu = cachedCats === null || cachedItems === null;

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [templateId, setTemplateId] = useState(null);

  // Apply a template = merge its preset into current settings.
  function applyTemplate(tplId) {
    const tpl = PDF_GENERATOR_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    setTemplateId(tplId);
    setSettings(s => {
      const { id, label_ua, label_en, preview, ...preset } = tpl;
      return { ...s, ...preset };
    });
  }

  // Selection is now PER-DISH: a Set of dish ids that should appear in the
  // PDF. Category-level checks are derived (all / some / none of its dishes).
  // The first time data lands every dish starts selected, and any new dishes
  // added later are auto-included so the user doesn't lose new menu items.
  const [selectedDishes, setSelectedDishes] = useState(() => new Set());
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [dishOrderByCat, setDishOrderByCat] = useState({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (loadingMenu) return;
    if (!initializedRef.current && dishes.length > 0) {
      setSelectedDishes(new Set(dishes.map(d => d.id)));
      initializedRef.current = true;
    } else if (initializedRef.current) {
      // Drop ids that no longer exist on later refreshes (deleted dishes).
      // Newly-added dishes keep their original state — we don't auto-include
      // them because we can't tell "new" from "user-unchecked".
      setSelectedDishes(prev => {
        const knownIds = new Set(dishes.map(d => d.id));
        let changed = false;
        const next = new Set(prev);
        for (const id of prev) {
          if (!knownIds.has(id)) { next.delete(id); changed = true; }
        }
        return changed ? next : prev;
      });
    }
    if (categories.length > 0) {
      setCategoryOrder(prev => {
        const known = new Set(prev);
        const additions = categories.map(c => c.id).filter(id => !known.has(id));
        return [...prev.filter(id => categories.some(c => c.id === id)), ...additions];
      });
    }
  }, [loadingMenu, dishes.length, categories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reviews fetch on toggle ────────────────────────────────────────────────
  const [reviewsByDish, setReviewsByDish] = useState({});
  const [reviewsFetched, setReviewsFetched] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);

  useEffect(() => {
    if (!settings.showReviews || reviewsFetched) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getMenu();
        if (cancelled) return;
        const map = {};
        for (const cat of data || []) {
          for (const item of cat.items || []) {
            const id = item._id || item.id;
            if (id && (item.rating != null || item.reviewCount > 0)) {
              map[id] = { rating: item.rating, reviewCount: item.reviewCount || 0 };
            }
          }
        }
        setReviewsByDish(map);
        setReviewsFetched(true);
      } catch {
        if (!cancelled) setReviewsError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [settings.showReviews, reviewsFetched]);

  // Settings helpers ────────────────────────────────────────────────────────
  const set = (key) => (v) => setSettings(s => ({ ...s, [key]: v }));

  // Helpers for the per-dish selection model.
  const dishIdsForCat = useCallback(
    (catId) => dishes.filter(d => String(d.category) === String(catId)).map(d => d.id),
    [dishes],
  );

  function toggleDish(dishId) {
    setSelectedDishes(prev => {
      const next = new Set(prev);
      if (next.has(dishId)) next.delete(dishId); else next.add(dishId);
      return next;
    });
  }

  // Category check is tri-state: 'all', 'partial', 'none'. Toggle flips
  // between 'all' and 'none' (partial → all).
  function catCheckState(catId) {
    const ids = dishIdsForCat(catId);
    if (ids.length === 0) return 'none';
    const on = ids.filter(id => selectedDishes.has(id)).length;
    if (on === 0)            return 'none';
    if (on === ids.length)   return 'all';
    return 'partial';
  }
  function toggleCategory(catId) {
    const ids = dishIdsForCat(catId);
    if (!ids.length) return;
    setSelectedDishes(prev => {
      const next = new Set(prev);
      const allOn = ids.every(id => next.has(id));
      if (allOn) ids.forEach(id => next.delete(id));
      else       ids.forEach(id => next.add(id));
      return next;
    });
  }

  const allDishesOn = dishes.length > 0 && dishes.every(d => selectedDishes.has(d.id));
  function toggleAll() {
    setSelectedDishes(allDishesOn ? new Set() : new Set(dishes.map(d => d.id)));
  }

  // A category appears in the PDF only when at least one of its dishes is on.
  const activeCats = categoryOrder
    .map(id => categories.find(c => c.id === id))
    .filter(c => c && dishIdsForCat(c.id).some(id => selectedDishes.has(id)));

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const dragRef = useRef(null);

  function onCategoryDragStart(e, catId) { dragRef.current = { kind: 'category', fromId: catId }; e.dataTransfer.effectAllowed = 'move'; }
  function onCategoryDragOver(e) { e.preventDefault(); }
  function onCategoryDrop(e, toId) {
    e.preventDefault();
    const d = dragRef.current;
    if (!d || d.kind !== 'category' || d.fromId === toId) return;
    setCategoryOrder(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(d.fromId);
      const toIdx   = arr.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return arr;
      arr.splice(toIdx, 0, arr.splice(fromIdx, 1)[0]);
      return arr;
    });
    dragRef.current = null;
  }

  function onDishDragStart(e, catId, dishId) { dragRef.current = { kind: 'dish', fromCatId: catId, fromId: dishId }; e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }
  function onDishDragOver(e) { e.preventDefault(); }
  function onDishDrop(e, catId, toDishId) {
    e.preventDefault();
    e.stopPropagation();
    const d = dragRef.current;
    if (!d || d.kind !== 'dish' || d.fromCatId !== catId || d.fromId === toDishId) return;
    setDishOrderByCat(prev => {
      const base = prev[catId] || dishes.filter(x => String(x.category) === String(catId)).map(x => x.id);
      const arr  = [...base];
      const fromIdx = arr.indexOf(d.fromId);
      const toIdx   = arr.indexOf(toDishId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      arr.splice(toIdx, 0, arr.splice(fromIdx, 1)[0]);
      return { ...prev, [catId]: arr };
    });
    dragRef.current = null;
  }

  function dishesFor(catId) {
    // Only include dishes the user explicitly opted in to. No cap — every
    // selected dish from the category flows into the PDF.
    const raw = dishes.filter(
      d => String(d.category) === String(catId) && selectedDishes.has(d.id),
    );
    const userOrder = dishOrderByCat[catId];
    if (!userOrder) return raw;
    const byId = Object.fromEntries(raw.map(d => [d.id, d]));
    const ordered = userOrder.map(id => byId[id]).filter(Boolean);
    const known = new Set(userOrder);
    return [...ordered, ...raw.filter(d => !known.has(d.id))];
  }

  // ── Flat item stream (header + dishes) ────────────────────────────────────
  // Single list of items we want to paginate. Each item is either a category
  // header or a dish belonging to a category.
  const flatItems = useMemo(() => {
    if (loadingMenu) return [];
    const items = [];
    for (const cat of activeCats) {
      const catDishes = dishesFor(cat.id);
      if (!catDishes.length) continue;
      items.push({ kind: 'header', catId: cat.id, cat });
      for (const dish of catDishes) {
        items.push({ kind: 'dish', catId: cat.id, cat, dish });
      }
    }
    return items;
  }, [activeCats, dishOrderByCat, selectedDishes, dishes, loadingMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paper dimensions in px ────────────────────────────────────────────────
  const paper = PAPER[settings.format] || PAPER.A4;
  const isLandscape = settings.orientation === 'landscape';
  const paperWidthMm  = isLandscape ? paper.h : paper.w;
  const paperHeightMm = isLandscape ? paper.w : paper.h;
  const paperWidthPx  = paperWidthMm  * MM_TO_PX;
  const paperHeightPx = paperHeightMm * MM_TO_PX;
  const marginPx      = MARGIN_PX[settings.margins] ?? MARGIN_PX.medium;
  const contentHeightPx      = paperHeightPx - 2 * marginPx - PAGE_FOOTER_PX;
  const contentHeightFirstPx = contentHeightPx - FIRST_PAGE_HEADER_PX;
  const contentWidthPx       = paperWidthPx  - 2 * marginPx;
  const isBilingualColumns   = settings.language === 'bilingual' && settings.bilingualMode === 'columns';
  // In bilingual columns mode each side is half-width minus the gap, so the
  // measurement layer must render at the per-column width to get accurate
  // heights (text wraps differently at narrower widths).
  const measureWidthPx = isBilingualColumns ? (contentWidthPx - 16) / 2 : contentWidthPx;
  const isBilingualStacked = settings.language === 'bilingual' && settings.bilingualMode === 'stacked';

  // ── Measurement-driven pagination ─────────────────────────────────────────
  // Render every item into a hidden measurement layer at the exact content
  // width, then pack into pages based on real offsetHeight values. This is
  // the only reliable way to avoid:
  //   1) underfilled pages (heuristic too conservative → 3 dishes / page)
  //   2) overflowed pages (heuristic too generous → content clipped)
  // A ResizeObserver re-runs measurement when images load and reflow heights.
  const measureRef = useRef(null);
  const [pageBreaks, setPageBreaks] = useState([]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el || flatItems.length === 0) {
      setPageBreaks(prev => (prev.length ? [] : prev));
      return;
    }

    const recompute = () => {
      const itemEls = el.querySelectorAll('[data-measure-idx]');
      const heights = Array.from(itemEls).map(e => e.offsetHeight);
      if (heights.length !== flatItems.length) return;

      const breaks = [];
      let pageIdx   = 0;
      let pageStart = 0;
      let accum     = 0;

      // Returns the effective height of an item, doubling dish heights for
      // bilingual-stacked mode (each dish renders twice on the visible page).
      const itemH = (idx) => {
        const isStackedDouble = isBilingualStacked && flatItems[idx].kind === 'dish';
        return isStackedDouble ? heights[idx] * 2 : heights[idx];
      };

      for (let i = 0; i < heights.length; i++) {
        const h = itemH(i);
        const limit = pageIdx === 0 ? contentHeightFirstPx : contentHeightPx;

        if (accum + h > limit && i > pageStart) {
          // Orphan-header fix integrated into the pagination loop:
          // if items[i-1] is a header (i.e. this page would END with an
          // orphan category title), try to push the header (and any stacked
          // headers above it) onto the next page along with `i`. Only do so
          // if the next page can actually hold them — otherwise accept the
          // orphan to avoid an overflow.
          let breakAt = i;
          let nextPageAccum = h;
          while (
            breakAt > pageStart + 1 &&
            flatItems[breakAt - 1].kind === 'header'
          ) {
            const movedH = itemH(breakAt - 1);
            if (nextPageAccum + movedH > contentHeightPx) break;
            nextPageAccum += movedH;
            breakAt -= 1;
          }

          breaks.push(breakAt);
          pageStart = breakAt;
          accum = nextPageAccum;
          pageIdx++;
        } else {
          accum += h;
        }
      }

      setPageBreaks(prev => {
        if (prev.length === breaks.length && prev.every((v, j) => v === breaks[j])) return prev;
        return breaks;
      });
    };

    recompute();

    // Re-measure when content reflows (images load, fonts swap, etc.).
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    Array.from(el.querySelectorAll('[data-measure-idx]')).forEach(child => ro.observe(child));
    return () => ro.disconnect();
  }, [flatItems, contentHeightPx, contentHeightFirstPx, isBilingualStacked, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build pages by slicing flatItems at the computed breaks.
  const pages = useMemo(() => {
    if (loadingMenu) return [];
    if (flatItems.length === 0) return [{ items: [] }];
    const result = [];
    let start = 0;
    for (const brk of pageBreaks) {
      if (brk > start) {
        const slice = flatItems.slice(start, brk);
        result.push({ items: maybeAddContinuedHeader(slice, start, flatItems) });
      }
      start = brk;
    }
    if (start < flatItems.length) {
      const slice = flatItems.slice(start);
      result.push({ items: maybeAddContinuedHeader(slice, start, flatItems) });
    }
    return result.length ? result : [{ items: [] }];
  }, [flatItems, pageBreaks, loadingMenu]);

  // ── PDF download ───────────────────────────────────────────────────────────
  // Renders each preview page via html2canvas and packs them into a jsPDF
  // document, then triggers a direct file download — no print dialog.
  const handleGenerate = useCallback(async () => {
    const root = document.getElementById('pdfPrintRoot');
    if (!root) return;
    setGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const paper      = PAPER[settings.format] || PAPER.A4;
      const isLandscape = settings.orientation === 'landscape';
      const pdfW = isLandscape ? paper.h : paper.w;
      const pdfH = isLandscape ? paper.w : paper.h;

      const doc = new jsPDF({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'mm',
        format: settings.format === 'Letter' ? 'letter' : settings.format.toLowerCase(),
      });

      const pageEls = Array.from(root.querySelectorAll('article'));
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: settings.colorBg,
          logging: false,
          ignoreElements: el => el.classList?.contains('pdf-no-print'),
        });
        if (i > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
      }

      doc.save('menu.pdf');
    } finally {
      setGenerating(false);
    }
  }, [settings]);

  if (planCtx?.planLoading) return null;

  // ── Doc CSS variables — drive colours and font scaling on the preview ───
  const docVars = {
    '--pdf-bg':        settings.colorBg,
    '--pdf-header':    settings.colorHeader,
    '--pdf-text':      settings.colorText,
    '--pdf-desc':      settings.colorDesc,
    '--pdf-price':     settings.colorPrice,
    '--pdf-separator': settings.colorSeparator,
    '--pdf-scale':     PDF_FONT_SCALES[settings.fontSize] ?? 1,
    fontFamily:        PDF_FONT_STACKS[settings.fontFamily] || PDF_FONT_STACKS.sans,
    background:        settings.colorBg,
    color:             settings.colorText,
  };

  // Paper size styles applied to each `.page` element — gives the preview the
  // correct paper aspect ratio so overflow gets clipped where it would on real
  // paper. `paper`, `isLandscape`, `isBilingualColumns` were declared above
  // alongside the measurement variables; reuse them here.
  const pageStyle = {
    aspectRatio: isLandscape ? `${paper.h} / ${paper.w}` : `${paper.w} / ${paper.h}`,
  };

  // The langs to render per page. Bilingual stacked mode duplicates dishes
  // (UA then EN); the dish-render layer reads `langs` and emits one row per.
  const renderLangs = settings.language === 'bilingual'
    ? ['ua', 'en']
    : [settings.language === 'en' ? 'en' : 'ua'];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <StaffShell title={t('title')} backTo="/staff/menu">
      <UpgradeModal
        open={!planCtx?.isPremium}
        onClose={() => navigate('/staff/menu')}
        reason="upgrade_feature_pdf"
        ns="components"
      />
      <div className={styles.layout}>
        {/* ── Settings rail ───────────────────────────────────────────────── */}
        <aside className={styles.settingsCol}>
          {/* Template presets */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>{t('template')}</span>
            </div>
            <div className={styles.templates}>
              {PDF_GENERATOR_TEMPLATES.map(item => (
                <div
                  key={item.id}
                  className={`${styles.tplCard} ${templateId === item.id ? styles.tplActive : ''}`}
                  onClick={() => applyTemplate(item.id)}
                >
                  <div className={styles.tplColor} style={{ background: item.preview }} />
                  <span className={styles.tplLabel}>{uiLocal(item, 'label')}</span>
                </div>
              ))}
            </div>
            <p className={styles.mutedHint}>{t('templates_hint')}</p>
          </div>

          {/* Page */}
          <CollapsibleSection title={t('section_page')}>
            <PdfSettingItem label={t('format')}>
              <Dropdown
                options={[
                  { value: 'A4',     label: 'A4'     },
                  { value: 'A5',     label: 'A5'     },
                  { value: 'Letter', label: 'Letter' },
                ]}
                value={settings.format}
                onChange={set('format')}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('orientation')}>
              <Dropdown
                options={[
                  { value: 'portrait',  label: t('orientation_portrait')  },
                  { value: 'landscape', label: t('orientation_landscape') },
                ]}
                value={settings.orientation}
                onChange={set('orientation')}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('margins')}>
              <Dropdown
                options={[
                  { value: 'small',  label: t('margins_small')  },
                  { value: 'medium', label: t('margins_medium') },
                  { value: 'large',  label: t('margins_large')  },
                ]}
                value={settings.margins}
                onChange={set('margins')}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('language')}>
              <Dropdown
                options={[
                  { value: 'ua',         label: t('languageOptions.ua') },
                  { value: 'en',         label: t('languageOptions.en') },
                  { value: 'bilingual',  label: t('languageOptions.bilingual') },
                ]}
                value={settings.language}
                onChange={set('language')}
              />
            </PdfSettingItem>
            {settings.language === 'bilingual' && (
              <PdfSettingItem label={t('bilingualMode')}>
                <Dropdown
                  options={[
                    { value: 'stacked', label: t('bilingual_stacked') },
                    { value: 'columns', label: t('bilingual_columns') },
                  ]}
                  value={settings.bilingualMode}
                  onChange={set('bilingualMode')}
                />
              </PdfSettingItem>
            )}
          </CollapsibleSection>

          {/* Typography */}
          <CollapsibleSection title={t('section_typography')}>
            <PdfSettingItem label={t('fontFamily')}>
              <Dropdown
                options={[
                  { value: 'sans',      label: t('font_sans')      },
                  { value: 'serif',     label: t('font_serif')     },
                  { value: 'modern',    label: t('font_modern')    },
                  { value: 'mono',      label: t('font_mono')      },
                  { value: 'condensed', label: t('font_condensed') },
                ]}
                value={settings.fontFamily}
                onChange={set('fontFamily')}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('fontSize')}>
              <Dropdown
                options={[
                  { value: 'xs', label: t('size_xs') },
                  { value: 'sm', label: t('size_sm') },
                  { value: 'md', label: t('size_md') },
                  { value: 'lg', label: t('size_lg') },
                  { value: 'xl', label: t('size_xl') },
                ]}
                value={settings.fontSize}
                onChange={set('fontSize')}
              />
            </PdfSettingItem>
          </CollapsibleSection>

          {/* Colours */}
          <CollapsibleSection title={t('section_colors')}>
            <ColorRow label={t('color_bg')}        value={settings.colorBg}        onChange={set('colorBg')}        />
            <ColorRow label={t('color_header')}    value={settings.colorHeader}    onChange={set('colorHeader')}    />
            <ColorRow label={t('color_text')}      value={settings.colorText}      onChange={set('colorText')}      />
            <ColorRow label={t('color_desc')}      value={settings.colorDesc}      onChange={set('colorDesc')}      />
            <ColorRow label={t('color_price')}     value={settings.colorPrice}     onChange={set('colorPrice')}     />
            <ColorRow label={t('color_separator')} value={settings.colorSeparator} onChange={set('colorSeparator')} />
          </CollapsibleSection>

          {/* Content */}
          <CollapsibleSection title={t('section_content')}>
            <PdfSettingItem label={t('showDescription')}>
              <Toggle value={settings.showDescription} onChange={set('showDescription')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showIngredients')}>
              <Toggle value={settings.showIngredients} onChange={set('showIngredients')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showAddons')}>
              <Toggle value={settings.showAddons} onChange={set('showAddons')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showComponentGroups')}>
              <Toggle value={settings.showComponentGroups} onChange={set('showComponentGroups')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showWeight')}>
              <Toggle value={settings.showWeight} onChange={set('showWeight')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showCategoryBadge')}>
              <Toggle value={settings.showCategoryBadge} onChange={set('showCategoryBadge')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showReviews')}>
              <Toggle value={settings.showReviews} onChange={set('showReviews')} />
            </PdfSettingItem>
            {settings.showReviews && reviewsError && (
              <p className={styles.warnText}>{t('reviewsFetchFailed')}</p>
            )}
          </CollapsibleSection>

          {/* Images */}
          <CollapsibleSection title={t('section_images')}>
            <PdfSettingItem label={t('showMainPhoto')}>
              <Toggle value={settings.showMainPhoto} onChange={set('showMainPhoto')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showGallery')}>
              <Toggle value={settings.showGallery} onChange={set('showGallery')} />
            </PdfSettingItem>
            <PdfSettingItem label={t('maxImages')}>
              <Dropdown
                options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))}
                value={settings.maxImages}
                onChange={set('maxImages')}
              />
            </PdfSettingItem>
          </CollapsibleSection>

          {/* Categories as sections, dishes as togglable items inside.
              Category check is tri-state (all / partial / none); clicking it
              toggles every dish in that category. Drag handle reorders the
              category. */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>{t('categories')}</span>
            </div>
            <p className={styles.dragHint}>{t('drag_hint')}</p>
            {loadingMenu ? (
              <p className={styles.muted}>{t('loading')}</p>
            ) : (
              <>
                <label className={styles.catCheck}>
                  <input
                    type="checkbox"
                    checked={allDishesOn}
                    onChange={toggleAll}
                    className={styles.checkbox}
                  />
                  <span className={`${styles.catName} ${styles.catAll}`}>{t('allCategories')}</span>
                </label>
                <div className={styles.catDivider} />
                {categoryOrder
                  .map(id => categories.find(c => c.id === id))
                  .filter(Boolean)
                  .map(cat => {
                    const state = catCheckState(cat.id);
                    const catDishes = dishes.filter(d => String(d.category) === String(cat.id));
                    return (
                      <div key={cat.id} className={styles.catGroup}>
                        <div
                          className={styles.catGroupHead}
                          draggable
                          onDragStart={(e) => onCategoryDragStart(e, cat.id)}
                          onDragOver={onCategoryDragOver}
                          onDrop={(e) => onCategoryDrop(e, cat.id)}
                        >
                          <MdDragIndicator className={styles.dragHandle} />
                          <label className={styles.catCheck}>
                            <input
                              type="checkbox"
                              checked={state === 'all'}
                              ref={(el) => { if (el) el.indeterminate = state === 'partial'; }}
                              onChange={() => toggleCategory(cat.id)}
                              className={styles.checkbox}
                            />
                            <span className={`${styles.catName} ${styles.catSection}`}>{uiLocal(cat, 'name')}</span>
                          </label>
                        </div>
                        {catDishes.length === 0 ? (
                          <p className={styles.dishListEmpty}>{t('no_dishes_in_category')}</p>
                        ) : (
                          <div className={styles.dishList}>
                            {catDishes.map(dish => (
                              <label key={dish.id} className={styles.dishItem}>
                                <input
                                  type="checkbox"
                                  checked={selectedDishes.has(dish.id)}
                                  onChange={() => toggleDish(dish.id)}
                                  className={styles.checkbox}
                                />
                                <span className={styles.dishItemName}>{uiLocal(dish, 'name')}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
          </div>

          <PrimaryButton
            label={generating ? t('loading') : <><MdPictureAsPdf /> {t('generate')}</>}
            onClick={handleGenerate}
            disabled={loadingMenu || activeCats.length === 0 || generating}
          />
        </aside>

        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className={styles.previewCol}>
          <p className={styles.previewTitle}>
            {t('preview')} · {pages.length} {pages.length === 1 ? t('page_singular') : t('page_plural')}
          </p>

          {/* Off-screen measurement layer — renders every item at the real
              page-content width so we can measure offsetHeight and pack them
              into pages correctly. Hidden from the user; sees the same CSS
              variables as the visible pages so font/colour scaling matches. */}
          <div
            ref={measureRef}
            className={styles.measureLayer}
            style={{ ...docVars, width: `${measureWidthPx}px` }}
            aria-hidden="true"
          >
            {flatItems.map((it, idx) => (
              <div key={idx} data-measure-idx={idx}>
                {it.kind === 'header' ? (
                  // Single-language header to match what the visible layer
                  // renders at the same width (bilingual columns: one lang per
                  // column; stacked / single-lang: same single h3).
                  <h3 className={styles.docSection}>
                    {settings.language === 'en' ? (it.cat.name_en || it.cat.name) : it.cat.name}
                  </h3>
                ) : (
                  <PdfMenuDish
                    dish={it.dish}
                    settings={settings}
                    lang={settings.language === 'en' ? 'en' : 'ua'}
                    categoryName={it.cat.name}
                    rating={reviewsByDish[it.dish.id]}
                  />
                )}
              </div>
            ))}
          </div>

          <div id="pdfPrintRoot" className={styles.pagesStack}>
            {loadingMenu && (
              <div className={styles.previewLoading}>{t('loading')}</div>
            )}

            {!loadingMenu && pages.map((page, pageIdx) => (
              <article
                key={pageIdx}
                className={`${styles.page} ${styles[`margins_${settings.margins}`]}`}
                style={{ ...docVars, ...pageStyle }}
              >
                {/* Page header only on the first page so subsequent pages
                    feel like continuations rather than restarts. */}
                {pageIdx === 0 && (
                  <header className={styles.docHeader}>
                    <h2 className={styles.docTitle}>Waitless Restaurant</h2>
                    <p  className={styles.docSub}>{t('menuYear')}</p>
                  </header>
                )}

                {isBilingualColumns ? (
                  <BilingualColumnsPage
                    items={page.items}
                    settings={settings}
                    reviewsByDish={reviewsByDish}
                  />
                ) : (
                  <SinglePage
                    items={page.items}
                    settings={settings}
                    renderLangs={renderLangs}
                    reviewsByDish={reviewsByDish}
                    onDishDragStart={onDishDragStart}
                    onDishDragOver={onDishDragOver}
                    onDishDrop={onDishDrop}
                  />
                )}

                <footer className={styles.pageFooter}>
                  {pageIdx + 1} / {pages.length}
                </footer>
              </article>
            ))}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ColorRow({ label, value, onChange }) {
  return (
    <div className={styles.colorRow}>
      <span className={styles.colorLabel}>{label}</span>
      <div className={styles.colorPickerWrap}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.colorInput}
        />
        <span className={styles.colorHex}>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function CategoryHeader({ cat, continued, settings }) {
  // Pick category label per language. When language === 'bilingual' show both
  // separated by " · " in the same header.
  const nameUa = cat.name;
  const nameEn = cat.name_en || cat.name;
  const labelMain = settings.language === 'en' ? nameEn : nameUa;
  const showBoth = settings.language === 'bilingual';
  return (
    <h3 className={styles.docSection}>
      {showBoth ? `${nameUa} · ${nameEn}` : labelMain}
      {continued && <span className={styles.continued}>{' (…)'}</span>}
    </h3>
  );
}

function SinglePage({ items, settings, renderLangs, reviewsByDish, onDishDragStart, onDishDragOver, onDishDrop }) {
  return (
    <div className={styles.pageBody}>
      {items.map((it, i) =>
        it.kind === 'header'
          ? <CategoryHeader key={`h-${i}`} cat={it.cat} continued={it.continued} settings={settings} />
          : (
            <div
              key={`d-${it.dish.id}-${i}`}
              className={styles.dishWrap}
              draggable
              onDragStart={(e) => onDishDragStart(e, it.catId || it.cat.id, it.dish.id)}
              onDragOver={onDishDragOver}
              onDrop={(e) => onDishDrop(e, it.catId || it.cat.id, it.dish.id)}
            >
              <MdDragIndicator className={`${styles.dishDragHandle} pdf-no-print`} />
              {renderLangs.map(lang => (
                <PdfMenuDish
                  key={`${it.dish.id}-${lang}`}
                  dish={it.dish}
                  settings={settings}
                  lang={lang}
                  categoryName={lang === 'en' ? (it.cat.name_en || it.cat.name) : it.cat.name}
                  rating={reviewsByDish[it.dish.id]}
                />
              ))}
            </div>
          )
      )}
    </div>
  );
}

function BilingualColumnsPage({ items, settings, reviewsByDish }) {
  return (
    <div className={styles.bilingualCols}>
      {['ua', 'en'].map(lang => (
        <div key={lang} className={styles.bilingualCol}>
          {items.map((it, i) =>
            it.kind === 'header'
              ? (
                <h3 key={`h-${lang}-${i}`} className={styles.docSection}>
                  {lang === 'en' ? (it.cat.name_en || it.cat.name) : it.cat.name}
                  {it.continued && <span className={styles.continued}>{' (…)'}</span>}
                </h3>
              )
              : (
                <PdfMenuDish
                  key={`d-${lang}-${it.dish.id}-${i}`}
                  dish={it.dish}
                  settings={settings}
                  lang={lang}
                  categoryName={lang === 'en' ? (it.cat.name_en || it.cat.name) : it.cat.name}
                  rating={reviewsByDish[it.dish.id]}
                />
              )
          )}
        </div>
      ))}
    </div>
  );
}

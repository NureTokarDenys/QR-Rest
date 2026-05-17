import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import LangTabs from '../../../components/staff/LangTabs';
import { getCategories, createCategory, updateCategory, translateText } from '../../../api/admin';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor, emptyI18n, toApiLang } from '../../../i18n/langs';
import styles from './categoryEdit.module.css';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#292524',
];

const EMPTY_NAMES = emptyI18n('name');

export default function CategoryEdit() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation('categoryEdit');
  const isNew     = !id || id === 'new';

  const [names,      setNames]      = useState(EMPTY_NAMES);
  const [color,      setColor]      = useState(null);
  const [sortOrder,  setSortOrder]  = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [activeLang, setActiveLang] = useState(SOURCE_LANG);
  const [translating, setTranslating] = useState(false);

  const lf = base => fieldFor(base, activeLang);
  const srcHint = base => {
    if (activeLang === SOURCE_LANG) return null;
    return names[fieldFor(base, SOURCE_LANG)] || null;
  };
  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  useEffect(() => {
    if (isNew) return;
    getCategories()
      .then(cats => {
        const cat = (cats || []).find(c => (c._id || c.id) === id);
        if (!cat) return;
        const loaded = { ...EMPTY_NAMES };
        SUPPORTED_LANGS.forEach(l => {
          const key = fieldFor('name', l.code);
          if (l.code === SOURCE_LANG) {
            loaded[key] = cat.name || '';
          } else {
            loaded[key] = cat.translations?.[l.apiCode]?.name?.value || '';
          }
        });
        setNames(loaded);
        setColor(cat.color || null);
        setSortOrder(cat.sortOrder ?? 0);
      })
      .catch(err => console.error('CategoryEdit load error:', err));
  }, [id, isNew]);

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
      const payload = {
        name:      names[lf('name')],
        lang:      toApiLang(activeLang),
        color,
        sortOrder: Number(sortOrder),
      };
      if (isNew) await createCategory(payload);
      else       await updateCategory(id, payload);
      navigate('/staff/menu');
    } catch (err) {
      console.error('CategoryEdit save error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
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

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('basicInfo')}</p>

          <div className={styles.langBar}>
            <LangTabs
              langs={SUPPORTED_LANGS}
              active={activeLang}
              onChange={setActiveLang}
              onTranslate={activeLang !== SOURCE_LANG ? handleAutoTranslate : null}
              translating={translating}
            />
          </div>

          <div className={styles.fields}>
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
            <div className={styles.sortField}>
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

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('colorSection')}</p>
          <div className={styles.colorPreviewRow}>
            <span
              className={styles.colorPreview}
              style={{ background: color || 'var(--separator-color)' }}
            />
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

      </div>
    </StaffShell>
  );
}

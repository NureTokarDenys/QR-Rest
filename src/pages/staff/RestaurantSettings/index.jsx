import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import ReadonlyField from '../../../components/staff/ReadonlyField';
import PrimaryButton from '../../../components/PrimaryButton';
import LangTabs from '../../../components/staff/LangTabs';
import { Dropdown } from '../../../components/Dropdown';
import { getRestaurant, updateRestaurant, uploadRestaurantLogo, translateText } from '../../../api/admin';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor, emptyI18n, toApiLang } from '../../../i18n/langs';
import styles from './restaurantSettings.module.css';
import { MdStorefront } from 'react-icons/md';

const BACKEND_LANGUAGES = [
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'English' },
];

const EMPTY_FIELDS = emptyI18n('name', 'address', 'cuisine');

export default function RestaurantSettings() {
  const { t } = useTranslation('restaurantSettings');

  const [activeLang,  setActiveLang]  = useState(SOURCE_LANG);
  const [translating, setTranslating] = useState(false);
  const [fields,      setFields]      = useState(EMPTY_FIELDS);
  const [slug,        setSlug]        = useState('');
  const [defaultLang, setDefaultLang] = useState('uk');
  const [enabledLangs,setEnabledLangs]= useState([]);
  const [logoUrl,     setLogoUrl]     = useState('');
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState('');
  const [hasLogoChanged, setHasLogoChanged] = useState(false);
  const [logoUploading,setLogoUploading] = useState(false);
  const [createdAt,   setCreatedAt]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [savedOk,     setSavedOk]     = useState(false);
  const fileRef = useRef(null);

  const lf = (base) => fieldFor(base, activeLang);
  const srcHint = (base) => {
    if (activeLang === SOURCE_LANG) return null;
    return fields[fieldFor(base, SOURCE_LANG)] || null;
  };
  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  useEffect(() => {
    getRestaurant()
      .then(r => {
        if (!r) return;
        const loaded = { ...EMPTY_FIELDS };
        SUPPORTED_LANGS.forEach(l => {
          ['name', 'address', 'cuisine'].forEach(base => {
            const key = fieldFor(base, l.code);
            if (l.code === SOURCE_LANG) {
              loaded[key] = r[base] || '';
            } else {
              loaded[key] = r.translations?.[l.apiCode]?.[base]?.value || '';
            }
          });
        });
        setFields(loaded);
        setSlug(r.slug || '');
        const allowed = new Set(BACKEND_LANGUAGES.map(l => l.code));
        setDefaultLang(allowed.has(r.defaultLanguage) ? r.defaultLanguage : 'uk');
        setEnabledLangs((r.enabledLanguages || []).filter(code => allowed.has(code)));
        setLogoUrl(r.logoUrl || '');
        setCreatedAt(r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '');
      })
      .catch(err => console.error('RestaurantSettings load error:', err));
  }, []);

  useEffect(() => {
    return () => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    };
  }, [pendingLogoPreview]);

  async function handleAutoTranslate() {
    if (activeLang === SOURCE_LANG) return;
    setTranslating(true);
    try {
      const srcTexts = ['name', 'address', 'cuisine'].map(b => fields[fieldFor(b, SOURCE_LANG)]);
      const result = await translateText(srcTexts, activeLang);
      const translated = result?.translations ?? [];
      const bases = ['name', 'address', 'cuisine'];
      setFields(prev => {
        const next = { ...prev };
        bases.forEach((b, i) => {
          if (translated[i] !== undefined) next[fieldFor(b, activeLang)] = translated[i];
        });
        return next;
      });
    } catch (err) {
      console.error('Translate error:', err);
    } finally {
      setTranslating(false);
    }
  }

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    const preview = URL.createObjectURL(file);
    setPendingLogoFile(file);
    setPendingLogoPreview(preview);
    setHasLogoChanged(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleCancelLogoChanges() {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoFile(null);
    setPendingLogoPreview('');
    setHasLogoChanged(false);
  }

  async function handleSave() {
    setSaving(true);
    setSavedOk(false);
    try {
      if (pendingLogoFile) {
        setLogoUploading(true);
        const data = await uploadRestaurantLogo(pendingLogoFile);
        if (data?.logoUrl) {
          setLogoUrl(data.logoUrl);
        }
      }
      const payload = {
        name:    fields[lf('name')],
        address: fields[lf('address')],
        cuisine: fields[lf('cuisine')],
        lang:    toApiLang(activeLang),
        slug,
        defaultLanguage: defaultLang,
        enabledLanguages: enabledLangs,
      };
      await updateRestaurant(payload);
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
      setPendingLogoFile(null);
      setPendingLogoPreview('');
      setHasLogoChanged(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      console.error('RestaurantSettings save error:', err);
    } finally {
      setSaving(false);
      setLogoUploading(false);
    }
  }

  function toggleEnabledLang(code) {
    setEnabledLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  const defaultLangOptions = BACKEND_LANGUAGES.map(l => ({ value: l.code, label: l.name }));
  const displayedLogo = pendingLogoPreview || logoUrl;

  return (
    <StaffShell
      title={<><MdStorefront /> {t('title')}</>}
      rightActions={
        <div className={styles.headerActions}>
          <PrimaryButton
            label={saving ? t('saving') : savedOk ? `✓ ${t('saved')}` : t('save')}
            onClick={handleSave}
            disabled={saving}
            className={styles.saveBtn}
          />
        </div>
      }
    >
      <div className={styles.page}>

        {/* ── Translatable fields ── */}
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

          <div className={styles.grid2}>
            <div className={styles.fieldWrap}>
              <InputField
                label={t('name')}
                placeholder={t('namePlaceholder')}
                value={fields[lf('name')]}
                onChange={e => setFields(prev => ({ ...prev, [lf('name')]: e.target.value }))}
              />
              {srcHint('name') && (
                <span className={styles.srcHint}>{srcLang.flag} {srcHint('name')}</span>
              )}
            </div>

            <div className={styles.fieldWrap}>
              <InputField
                label={t('slug')}
                placeholder={t('slugPlaceholder')}
                value={slug}
                onChange={e => setSlug(e.target.value)}
              />
              <span className={styles.fieldHint}>{t('slugHint')}</span>
            </div>

            <div className={styles.fieldWrap}>
              <InputField
                label={t('address')}
                placeholder={t('addressPlaceholder')}
                value={fields[lf('address')]}
                onChange={e => setFields(prev => ({ ...prev, [lf('address')]: e.target.value }))}
              />
              {srcHint('address') && (
                <span className={styles.srcHint}>{srcLang.flag} {srcHint('address')}</span>
              )}
            </div>

            <div className={styles.fieldWrap}>
              <InputField
                label={t('cuisine')}
                placeholder={t('cuisinePlaceholder')}
                value={fields[lf('cuisine')]}
                onChange={e => setFields(prev => ({ ...prev, [lf('cuisine')]: e.target.value }))}
              />
              {srcHint('cuisine') && (
                <span className={styles.srcHint}>{srcLang.flag} {srcHint('cuisine')}</span>
              )}
            </div>
          </div>

          {createdAt && (
            <ReadonlyField label={t('createdAt')} value={createdAt} />
          )}
        </div>

        {/* ── Logo ── */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('logo')}</p>
          <div className={styles.logoRow}>
            {displayedLogo ? (
              <div className={styles.logoPreviewWrap}>
                <img src={displayedLogo} alt="logo" className={styles.logoPreview} />
                <button
                  className={styles.removeLogoBtn}
                  onClick={() => {
                    handleCancelLogoChanges();
                    setLogoUrl('');
                    setHasLogoChanged(true);
                  }}
                >
                  {t('removeLogo')}
                </button>
              </div>
            ) : (
              <div
                className={styles.logoDropzone}
                onClick={() => fileRef.current?.click()}
              >
                <span className={styles.logoDropzoneIcon}>🖼️</span>
                <span className={styles.logoDropzoneText}>
                  {pendingLogoFile ? t('logoReadyToSave') : t('logoUploadHint')}
                </span>
                <span className={styles.logoDropzoneHint}>{t('logoFormats')}</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleLogoSelect}
            />
            <div className={styles.logoButtons}>
              <button
                className={styles.changeLogoBtn}
                onClick={() => fileRef.current?.click()}
                disabled={saving || logoUploading}
              >
                {pendingLogoFile ? t('replaceLogo') : t('uploadNewLogo')}
              </button>
              {hasLogoChanged && (
                <button
                  className={styles.cancelLogoBtn}
                  onClick={handleCancelLogoChanges}
                  disabled={saving || logoUploading}
                >
                  {t('cancel')}
                </button>
              )}
            </div>
          </div>
          {pendingLogoFile && <p className={styles.fieldHint}>{t('logoWillUploadOnSave')}</p>}
        </div>

        {/* ── Language settings ── */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('languages')}</p>

          <div className={styles.grid2}>
            <div>
              <Dropdown
                label={t('defaultLanguage')}
                options={defaultLangOptions}
                value={defaultLang}
                onChange={setDefaultLang}
              />
              <p className={styles.fieldHint}>{t('defaultLanguageHint')}</p>
            </div>

            <div>
              <p className={styles.dropLabel}>{t('enabledLanguages')}</p>
              <div className={styles.langCheckList}>
                {BACKEND_LANGUAGES.map(l => (
                  <label key={l.code} className={styles.langCheckRow}>
                    <input
                      type="checkbox"
                      className={styles.langCheckbox}
                      checked={enabledLangs.includes(l.code)}
                      onChange={() => toggleEnabledLang(l.code)}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
              <p className={styles.fieldHint}>{t('enabledLanguagesHint')}</p>
            </div>
          </div>
        </div>

      </div>
    </StaffShell>
  );
}

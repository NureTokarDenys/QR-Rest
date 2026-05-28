import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PremiumCelebrationModal from '../../../components/PremiumCelebrationModal';
import UpgradeModal from '../../../components/UpgradeModal';
import StaffShell from '../../../components/staff/StaffShell';
import PageSkeleton from '../../../components/staff/Skeleton';
import InputField from '../../../components/InputField';
import ReadonlyField from '../../../components/staff/ReadonlyField';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import LangTabs from '../../../components/staff/LangTabs';
import TranslateOverlay from '../../../components/staff/TranslateOverlay';
import { Dropdown } from '../../../components/Dropdown';
import { updateRestaurant, uploadRestaurantLogo, translateText, saveLiqpayKeys } from '../../../api/admin';
import { usePlan } from '../../../hooks/usePlan';
import { useStaffData } from '../../../context/StaffDataContext';
import { MdPayment, MdCheckCircle, MdLock } from 'react-icons/md';
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
  const { isPremium } = usePlan();
  const isFree = !isPremium;
  const [searchParams, setSearchParams] = useSearchParams();
  // Restaurant is already in the cache (loaded eagerly for PlanContext).
  // LiqPay is lazy — only requested when an admin opens this page.
  const { restaurant: cachedRestaurant, liqpay: cachedLiqpay, refreshRestaurant, refreshLiqpay, ensureLiqpay } = useStaffData();
  useEffect(() => { if (isPremium) ensureLiqpay(); }, [isPremium, ensureLiqpay]);

  // ── Subscription upgrade flow ─────────────────────────────────────────────
  const [upgradeModalOpen,    setUpgradeModalOpen]    = useState(false);
  const [celebrationOpen,     setCelebrationOpen]     = useState(false);
  const [verifying,           setVerifying]           = useState(false);
  const [verifyTimeout,       setVerifyTimeout]       = useState(false);
  const pollingRef = useRef(null);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  // LiqPay redirects back with ?subscribed=1 on success or ?payment_failed=1 on failure.
  // Poll refreshRestaurant() every 2 s for up to 30 s waiting for the webhook to fire.
  useEffect(() => {
    // Check both the legacy URL param and the sessionStorage flag set by UpgradeModal.
    // sessionStorage is used because localhost result_urls are rejected by LiqPay,
    // so we can't rely on LiqPay appending ?payment_return=1 to the redirect URL.
    const fromUrl     = searchParams.get('payment_return') === '1';
    const fromStorage = sessionStorage.getItem('payment_pending') === '1';
    setSearchParams({}, { replace: true });
    sessionStorage.removeItem('payment_pending');

    if (!fromUrl && !fromStorage) return;

    // Webhook may have already fired before the redirect arrived — check immediately.
    refreshRestaurant().then(() => {});

    setVerifying(true);
    const start = Date.now();
    pollingRef.current = setInterval(async () => {
      await refreshRestaurant();
      if (Date.now() - start >= 30_000) {
        stopPolling();
        setVerifying(false);
        setVerifyTimeout(true);
      }
    }, 2000);

    return stopPolling;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When plan becomes premium while we're verifying — show celebration.
  // Also fires if plan was already premium on the first refresh.
  useEffect(() => {
    if (!verifying) return;
    if (cachedRestaurant?.plan === 'premium') {
      stopPolling();
      setVerifying(false);
      setVerifyTimeout(false);
      setCelebrationOpen(true);
    }
  }, [cachedRestaurant?.plan, verifying]);

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
  const [loading,     setLoading]     = useState(true);
  const fileRef = useRef(null);

  // LiqPay keys state
  const [lqPublicKey,    setLqPublicKey]    = useState('');
  const [lqPrivateKey,   setLqPrivateKey]   = useState('');
  const [lqHasPrivate,   setLqHasPrivate]   = useState(false);
  const [lqSaving,       setLqSaving]       = useState(false);
  const [lqSavedOk,      setLqSavedOk]      = useState(false);
  const [lqError,        setLqError]        = useState('');

  const lf = (base) => fieldFor(base, activeLang);
  const srcHint = (base) => {
    if (activeLang === SOURCE_LANG) return null;
    return fields[fieldFor(base, SOURCE_LANG)] || null;
  };
  const srcLang = SUPPORTED_LANGS.find(l => l.code === SOURCE_LANG);

  // LiqPay — read from shared cache (loaded once for the admin session)
  useEffect(() => {
    if (!isPremium || !cachedLiqpay) return;
    setLqPublicKey(cachedLiqpay.publicKey || '');
    setLqHasPrivate(!!cachedLiqpay.hasPrivateKey);
  }, [isPremium, cachedLiqpay]);

  // Restaurant fields — hydrate the editable form from the shared cache.
  // Re-runs when the cache refreshes (e.g. after another admin saves changes).
  useEffect(() => {
    if (!cachedRestaurant) return;
    const r = cachedRestaurant;
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
    setLoading(false);
  }, [cachedRestaurant]);

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

  async function handleSaveLiqpay() {
    if (!lqPublicKey.trim() || !lqPrivateKey.trim()) {
      setLqError(t('liqpayBothRequired'));
      return;
    }
    setLqSaving(true);
    setLqError('');
    setLqSavedOk(false);
    try {
      await saveLiqpayKeys(lqPublicKey.trim(), lqPrivateKey.trim());
      setLqHasPrivate(true);
      setLqPrivateKey('');
      setLqSavedOk(true);
      setTimeout(() => setLqSavedOk(false), 3000);
    } catch (err) {
      setLqError(t('liqpaySaveError'));
    } finally {
      setLqSaving(false);
    }
  }

  function handleCancel() {
    if (!cachedRestaurant) return;
    const r = cachedRestaurant;
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
    const allowed = new Set(BACKEND_LANGUAGES.map(lc => lc.code));
    setDefaultLang(allowed.has(r.defaultLanguage) ? r.defaultLanguage : 'uk');
    setEnabledLangs((r.enabledLanguages || []).filter(code => allowed.has(code)));
    handleCancelLogoChanges();
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

  if (loading) {
    return (
      <StaffShell title={<><MdStorefront /> {t('title')}</>}>
        <PageSkeleton variant="settings" sections={3} />
      </StaffShell>
    );
  }

  const activeLangLabel = SUPPORTED_LANGS.find(l => l.code === activeLang)?.label ?? activeLang;

  return (
    <>
    <TranslateOverlay visible={translating} lang={activeLangLabel} />
    <StaffShell
      title={<><MdStorefront /> {t('title')}</>}
      titleHideBelow={340}
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton
            label={t('cancel')}
            onClick={handleCancel}
            disabled={saving}
            className={styles.cancelBtn}
          />
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

        <PremiumCelebrationModal open={celebrationOpen} onClose={() => setCelebrationOpen(false)} />
        <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />

        {verifying && (
          <div className={styles.verifyingBanner}>
            <span className={styles.verifyingSpinner} />
            {t('subscriptionVerifying')}
          </div>
        )}

        {verifyTimeout && (
          <div className={styles.timeoutBanner}>
            <span>{t('subscriptionTimeout')}</span>
            <button className={styles.bannerAction} onClick={() => window.location.reload()}>
              {t('subscriptionTimeoutRetry')}
            </button>
          </div>
        )}

        {verifyTimeout && (
          <div className={styles.timeoutBanner}>
            <span>{t('subscriptionTimeout')}</span>
            <button className={styles.bannerAction} onClick={() => { setVerifyTimeout(false); setUpgradeModalOpen(true); }}>
              {t('paymentFailedRetry')}
            </button>
          </div>
        )}

        {/* ── Translatable fields ── */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t('basicInfo')}</p>

          <div className={styles.langBar}>
            <LangTabs
              langs={SUPPORTED_LANGS}
              active={activeLang}
              onChange={setActiveLang}
              onTranslate={activeLang !== SOURCE_LANG
                ? (isFree ? () => setUpgradeModalOpen(true) : handleAutoTranslate)
                : null}
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

        {/* ── LiqPay integration (premium only) ── */}
        {isPremium && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              <MdPayment style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t('liqpayTitle')}
            </p>
            <p className={styles.fieldHint}>
              {t('liqpayHint')}
            </p>

            {lqHasPrivate && (
              <div className={styles.liqpayStatus}>
                <MdCheckCircle className={styles.liqpayStatusIcon} />
                {t('liqpayConnected')}
              </div>
            )}

            <div className={styles.grid2}>
              <div className={styles.fieldWrap}>
                <label className={styles.dropLabel}>
                  {t('liqpayPublicKey')}
                </label>
                <input
                  className={styles.liqpayInput}
                  type="text"
                  value={lqPublicKey}
                  onChange={e => setLqPublicKey(e.target.value)}
                  placeholder="sandbox_i..."
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldWrap}>
                <label className={styles.dropLabel}>
                  {t('liqpayPrivateKey')}
                  {lqHasPrivate && (
                    <span className={styles.liqpayStoredBadge}>
                      <MdLock size={11} /> {t('liqpayStored')}
                    </span>
                  )}
                </label>
                <input
                  className={styles.liqpayInput}
                  type="password"
                  value={lqPrivateKey}
                  onChange={e => setLqPrivateKey(e.target.value)}
                  placeholder={lqHasPrivate ? '••••••••••••' : 'sandbox_...'}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {lqError && <p className={styles.liqpayError}>{lqError}</p>}

            <button
              className={styles.liqpaySaveBtn}
              onClick={handleSaveLiqpay}
              disabled={lqSaving}
            >
              {lqSaving
                ? t('saving')
                : lqSavedOk
                ? `✓ ${t('saved')}`
                : t('liqpaySave')}
            </button>
          </div>
        )}

      </div>
    </StaffShell>
    </>
  );
}

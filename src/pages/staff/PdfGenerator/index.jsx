import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import PdfSettingItem from '../../../components/staff/PdfSettingItem';
import PdfMenuDish from '../../../components/staff/PdfMenuDish';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { getCategories, getMenuItems } from '../../../api/admin';
import { PDF_GENERATOR_TEMPLATES } from '../../../constants/mainConstants';
import styles from './pdfGenerator.module.css';
import { MdPictureAsPdf } from "react-icons/md";

const Toggle = ({ value, onChange }) => (
  <button
    className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
    onClick={() => onChange(!value)}
  >
    <span className={styles.toggleThumb} />
  </button>
);

export default function PdfGenerator() {
  const { t, i18n } = useTranslation('pdfGenerator');
  const local = (obj, field) => {
    if (!obj) return '';
    return i18n.language === 'en' ? (obj[`${field}_en`] || obj[field] || '') : (obj[field] || '');
  };

  const [templateId, setTemplateId]           = useState('classic');
  const [format, setFormat]                   = useState('A4');
  const [pdfLang, setPdfLang]                 = useState(i18n.language === 'en' ? 'en' : 'ua');
  const [showMainPhoto, setShowMainPhoto]     = useState(true);
  const [showIngredients, setShowIngredients] = useState(false);

  const [categories, setCategories] = useState([]);
  const [dishes, setDishes]         = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  const [loadingMenu, setLoadingMenu]   = useState(true);

  useEffect(() => {
    setLoadingMenu(true);
    Promise.all([getCategories(), getMenuItems()])
      .then(([cats, items]) => {
        const normCats = (Array.isArray(cats) ? cats : []).map(c => ({
          id:      c._id || c.id,
          name:    c.name,
          name_en: c.name_en || c.name,
        }));
        const normDishes = (Array.isArray(items) ? items : []).map(item => ({
          id:              item._id || item.id,
          name:            item.name,
          name_en:         item.name_en || item.name,
          price:           item.basePrice ?? item.price ?? 0,
          image:           item.imageUrl  || item.image || '',
          category:        item.categoryId?._id || item.categoryId || item.category || '',
          ingredientsList: (item.ingredients || []).map(i => ({
            id:      i._id || i.id,
            name:    i.name,
            name_en: i.name_en || i.name,
          })),
        }));
        setCategories(normCats);
        setDishes(normDishes);
        setSelectedCats(normCats.map(c => c.id)); // select all by default
      })
      .catch(err => console.error('PdfGenerator load error:', err))
      .finally(() => setLoadingMenu(false));
  }, []);

  const tpl = PDF_GENERATOR_TEMPLATES.find(t => t.id === templateId) || PDF_GENERATOR_TEMPLATES[0];

  const allSelected = selectedCats.length === categories.length && categories.length > 0;

  function toggleAll() {
    setSelectedCats(allSelected ? [] : categories.map(c => c.id));
  }

  function toggleCat(id) {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  const activeCats = categories.filter(c => selectedCats.includes(c.id));

  return (
    <StaffShell title={t('title')} backTo="/staff/menu">
      <div className={styles.layout}>
        <div className={styles.settingsCol}>
          {/* Template picker */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('template')}</p>
            <div className={styles.templates}>
              {PDF_GENERATOR_TEMPLATES.map(item => (
                <div
                  key={item.id}
                  className={`${styles.tplCard} ${templateId === item.id ? styles.tplActive : ''}`}
                  onClick={() => setTemplateId(item.id)}
                >
                  <div className={styles.tplColor} style={{ background: item.preview }} />
                  <span className={styles.tplLabel}>{local(item, 'label')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('settings')}</p>
            <PdfSettingItem label={t('format')}>
              <Dropdown
                options={[{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }]}
                value={format}
                onChange={setFormat}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('language')}>
              <Dropdown
                options={[
                  { value: 'ua', label: t('languageOptions.ua') },
                  { value: 'en', label: t('languageOptions.en') },
                ]}
                value={pdfLang}
                onChange={setPdfLang}
              />
            </PdfSettingItem>
            <PdfSettingItem label={t('showMainPhoto')}>
              <Toggle value={showMainPhoto} onChange={setShowMainPhoto} />
            </PdfSettingItem>
            <PdfSettingItem label={t('showIngredients')}>
              <Toggle value={showIngredients} onChange={setShowIngredients} />
            </PdfSettingItem>
          </div>

          {/* Category filter */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('categories')}</p>
            {loadingMenu ? (
              <p style={{ fontSize: 13, color: 'var(--secondary-text)' }}>Завантаження…</p>
            ) : (
              <>
                <label className={styles.catCheck}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className={styles.checkbox}
                  />
                  <span className={`${styles.catName} ${styles.catAll}`}>{t('allCategories')}</span>
                </label>
                <div className={styles.catDivider} />
                {categories.map(cat => (
                  <label key={cat.id} className={styles.catCheck}>
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(cat.id)}
                      onChange={() => toggleCat(cat.id)}
                      className={styles.checkbox}
                    />
                    <span className={styles.catName}>{local(cat, 'name')}</span>
                  </label>
                ))}
              </>
            )}
          </div>

          <PrimaryButton label={<><MdPictureAsPdf /> {t('generate')}</>} onClick={() => {}} />
        </div>

        {/* Preview */}
        <div className={styles.previewCol}>
          <p className={styles.previewTitle}>{t('preview')}</p>
          <div
            className={styles.previewDoc}
            style={{ background: tpl.docBg, fontFamily: tpl.fontFamily }}
          >
            <div className={styles.docHeader} style={{ borderBottomColor: tpl.headerColor }}>
              <h2 className={styles.docTitle}  style={{ color: tpl.titleColor }}>Waitless Restaurant</h2>
              <p  className={styles.docSub}    style={{ color: tpl.descColor }}>{t('menuYear')}</p>
            </div>

            {loadingMenu && (
              <p style={{ padding: '1rem', fontSize: 13, color: 'var(--secondary-text)' }}>Завантаження…</p>
            )}

            {!loadingMenu && activeCats.map(cat => {
              const catDishes = dishes.filter(d => String(d.category) === String(cat.id));
              if (!catDishes.length) return null;
              return (
                <div key={cat.id}>
                  <h3
                    className={styles.docSection}
                    style={{ color: tpl.sectionColor, borderBottomColor: tpl.sectionBorder }}
                  >
                    {local(cat, 'name')}
                  </h3>
                  {catDishes.slice(0, 2).map(dish => (
                    <PdfMenuDish
                      key={dish.id}
                      dish={dish}
                      showPhoto={showMainPhoto}
                      showIngredients={showIngredients}
                      tpl={tpl}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

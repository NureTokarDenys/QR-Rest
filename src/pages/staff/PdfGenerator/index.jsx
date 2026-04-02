import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import PdfSettingItem from '../../../components/staff/PdfSettingItem';
import PdfMenuDish from '../../../components/staff/PdfMenuDish';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { categories, dishes as dishesData } from '../../../data/mockData';
import { PDF_GENERATOR_TEMPLATES } from '../../../constants/mainConstants';
import styles from './pdfGenerator.module.css';
import { MdPictureAsPdf } from "react-icons/md";

const allDishes = Object.entries(dishesData).flatMap(([categoryId, items]) =>
  items.map(dish => ({ ...dish, category: categoryId }))
);

const Toggle = ({ value, onChange }) => (
  <button
    className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
    onClick={() => onChange(!value)}
  >
    <span className={styles.toggleThumb} />
  </button>
);

export default function PdfGenerator() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('pdfGenerator');
  const local = (obj, field) => i18n.language === 'en' ? obj[`${field}_en`] : obj[field];

  const [templateId, setTemplateId] = useState('classic');
  const [format, setFormat] = useState('A4');
  const [pdfLang, setPdfLang] = useState(i18n.language === 'en' ? 'en' : 'ua');
  const [showMainPhoto, setShowMainPhoto] = useState(true);
  const [showIngredients, setShowIngredients] = useState(false);
  const [selectedCats, setSelectedCats] = useState(categories.map(c => c.id));

  const tpl = PDF_GENERATOR_TEMPLATES.find(t => t.id === templateId) || PDF_GENERATOR_TEMPLATES[0];

  const allSelected = selectedCats.length === categories.length;

  function toggleAll() {
    setSelectedCats(allSelected ? [] : categories.map(c => c.id));
  }

  function toggleCat(id) {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  const activeCats = categories.filter(c => selectedCats.includes(c.id));

  const docStyle = {
    background: tpl.docBg,
    fontFamily: tpl.fontFamily,
  };

  const docHeaderStyle = {
    borderBottomColor: tpl.headerColor,
  };

  const docTitleStyle = {
    color: tpl.titleColor,
  };

  const docSubStyle = {
    color: tpl.descColor,
  };

  const docSectionStyle = {
    color: tpl.sectionColor,
    borderBottomColor: tpl.sectionBorder,
  };

  return (
    <StaffShell
      title={`${t('title')}`}
      backTo="/staff/menu"
    >
      <div className={styles.layout}>
        <div className={styles.settingsCol}>
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

          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('categories')}</p>
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
          </div>

          <PrimaryButton label={<><MdPictureAsPdf /> {t('generate')}</>} onClick={() => {}} />
        </div>

        <div className={styles.previewCol}>
          <p className={styles.previewTitle}>{t('preview')}</p>
          <div className={styles.previewDoc} style={docStyle}>
            <div className={styles.docHeader} style={docHeaderStyle}>
              <h2 className={styles.docTitle} style={docTitleStyle}>Waitless Restaurant</h2>
              <p className={styles.docSub} style={docSubStyle}>{t('menuYear')}</p>
            </div>
            {activeCats.map(cat => {
              const catDishes = allDishes.filter(d => d.category === cat.id);
              if (!catDishes.length) return null;
              return (
                <div key={cat.id}>
                  <h3 className={styles.docSection} style={docSectionStyle}>{local(cat, 'name')}</h3>
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
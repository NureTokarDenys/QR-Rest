import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import PdfSettingItem from '../../../components/staff/PdfSettingItem';
import PdfMenuDish from '../../../components/staff/PdfMenuDish';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { categories } from '../../../data/mockData';
import { MENU_DISHES_FLAT } from '../../../data/mockData';
import styles from './pdfGenerator.module.css';

const TEMPLATES = [
  { id: 'classic', label_ua: 'Класичний', label_en: 'Classic', color: '#1d7afc' },
  { id: 'dark',    label_ua: 'Темний',    label_en: 'Dark',    color: '#1a1a2e' },
  { id: 'minimal', label_ua: 'Мінімал',   label_en: 'Minimal', color: '#374151' },
  { id: 'light',   label_ua: 'Світлий',   label_en: 'Light',   color: '#f2f2f7' },
];

export default function PdfGenerator() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('pdfGenerator');
  const lang = i18n.language === 'en' ? 'en' : 'ua';

  const [template, setTemplate] = useState('classic');
  const [format, setFormat] = useState('A4');
  const [pdfLang, setPdfLang] = useState('ua');
  const [showMainPhoto, setShowMainPhoto] = useState(true);
  const [showIngredients, setShowIngredients] = useState(false);
  const [selectedCats, setSelectedCats] = useState([]);

  function toggleCat(id) {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  const Toggle = ({ value, onChange }) => (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );

  const previewDishes = MENU_DISHES_FLAT.slice(0, 3);

  return (
    <StaffShell
      title={`← ${t('title')}`}
      backTo="/staff/menu"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('cancel')} onClick={() => navigate('/staff/menu')} />
          <PrimaryButton label={t('save')} onClick={() => {}} />
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.settingsCol}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('template')}</p>
            <div className={styles.templates}>
              {TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  className={`${styles.tplCard} ${template === tpl.id ? styles.tplActive : ''}`}
                  onClick={() => setTemplate(tpl.id)}
                >
                  <div className={styles.tplColor} style={{ background: tpl.color }} />
                  <span className={styles.tplLabel}>{lang === 'en' ? tpl.label_en : tpl.label_ua}</span>
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
                options={[{ value: 'ua', label: 'Українська' }, { value: 'en', label: 'English' }]}
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
            {categories.map(cat => (
              <label key={cat.id} className={styles.catCheck}>
                <input
                  type="checkbox"
                  checked={selectedCats.includes(cat.id)}
                  onChange={() => toggleCat(cat.id)}
                  className={styles.checkbox}
                />
                <span className={styles.catName}>{cat.name}</span>
              </label>
            ))}
          </div>

          <PrimaryButton label={`📄 ${t('generate')}`} onClick={() => {}} />
        </div>

        <div className={styles.previewCol}>
          <p className={styles.previewTitle}>{t('preview')}</p>
          <div className={styles.previewDoc}>
            <div className={styles.docHeader}>
              <h2 className={styles.docTitle}>Waitless Restaurant</h2>
              <p className={styles.docSub}>{t('menuYear')}</p>
            </div>
            <h3 className={styles.docSection}>Основні страви</h3>
            {previewDishes.map(dish => (
              <PdfMenuDish
                key={dish.id}
                dish={dish}
                showPhoto={showMainPhoto}
                showIngredients={showIngredients}
              />
            ))}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
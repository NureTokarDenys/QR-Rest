import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './pdfMenuDish.module.css';

export default function PdfMenuDish({ dish, showPhoto, showIngredients, tpl }) {
  const local = useLocalField();
  const { t } = useTranslation('components');

  const rowStyle = {
    borderBottomColor: tpl.rowBorder,
    fontFamily: tpl.fontFamily,
  };

  const placeholderStyle = {
    background: tpl.docBg === '#ffffff' ? '#f2f2f7' : 'rgba(255,255,255,0.08)',
    borderRadius: tpl.imgRadius,
  };

  const imgStyle = {
    borderRadius: tpl.imgRadius,
  };

  return (
    <div className={styles.row} style={rowStyle}>
      {showPhoto && dish.image && (
        <img src={dish.image} alt="" className={styles.img} style={imgStyle} />
      )}
      {showPhoto && !dish.image && (
        <div className={styles.imgPlaceholder} style={placeholderStyle}>🍽</div>
      )}
      <div className={styles.info}>
        <div className={styles.top}>
          <span className={styles.name} style={{ color: tpl.nameColor }}>{local(dish, 'name')}</span>
          <span className={styles.price} style={{ color: tpl.priceColor }}>{dish.price} {t('currency_symbol', '₴')}</span>
        </div>
        {showIngredients && dish.ingredients && (
          <p className={styles.desc} style={{ color: tpl.descColor }}>{local(dish, 'ingredients')}</p>
        )}
      </div>
    </div>
  );
}
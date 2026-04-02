import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './pdfMenuDish.module.css';

export default function PdfMenuDish({ dish, showPhoto, showIngredients }) {
  const local = useLocalField();
  const { t } = useTranslation('components');

  return (
    <div className={styles.row}>
      {showPhoto && dish.image && (
        <img src={dish.image} alt="" className={styles.img} />
      )}
      {showPhoto && !dish.image && (
        <div className={styles.imgPlaceholder}>🍽</div>
      )}
      <div className={styles.info}>
        <div className={styles.top}>
          <span className={styles.name}>{local(dish, 'name')}</span>
          <span className={styles.price}>{dish.price} {t('currency_symbol', '₴')}</span>
        </div>
        {showIngredients && dish.ingredients && (
          <p className={styles.desc}>{local(dish, 'ingredients')}</p>
        )}
      </div>
    </div>
  );
}
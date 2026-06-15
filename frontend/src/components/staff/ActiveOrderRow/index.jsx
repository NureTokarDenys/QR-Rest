import React from 'react';
import { useTranslation } from 'react-i18next';
import { fieldFor } from '../../../i18n/langs';
import { Dropdown } from '../../Dropdown';
import styles from './activeOrderRow.module.css';

import { STATUS_STYLES, STATUS_KEYS } from '../../../constants/mainConstants'; 

export default function ActiveOrderRow({ item, onStatusChange }) {
  const { t, i18n } = useTranslation('components');
  
  const s = STATUS_STYLES[item.status] || STATUS_STYLES.waiting;
  const statusKey = item.status || 'waiting';

  const statusOptions = STATUS_KEYS.map(key => ({
    value: key,
    label: t(`status_${key}`)
  }));

  return (
    <tr className={styles.row}>
      <td className={styles.name}>{item[fieldFor('name', i18n.language)] || item.name}</td>
      <td className={styles.cell}>{item.qty}</td>
      <td className={`${styles.cell} ${styles.price}`}>
        {item.price} {t('currency_symbol', '₴')}
      </td>
      <td className={styles.cell}>
        <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
          {s.icon} {t(`status_${statusKey}`)}
        </span>
      </td>
      <td className={styles.cell}>
        <Dropdown
          options={statusOptions}
          value={item.status}
          onChange={val => onStatusChange && onStatusChange(item.id, val)}
          placeholder={t('change')}
        />
      </td>
    </tr>
  );
}
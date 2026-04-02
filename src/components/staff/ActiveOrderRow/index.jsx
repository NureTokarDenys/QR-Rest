import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '../../Dropdown';
import styles from './activeOrderRow.module.css';

const STATUS_STYLES = {
  waiting: { bg: '#e8f4ff', color: '#1d7afc', icon: '⏳' },
  cooking: { bg: '#fff3e0', color: '#f57c00', icon: '🔥' },
  ready:   { bg: '#e8f5e9', color: '#2e7d32', icon: '✅' },
  served:  { bg: '#e8f5e9', color: '#2e7d32', icon: '✓' },
};

export default function ActiveOrderRow({ item, onStatusChange }) {
  const { t } = useTranslation('orderDetail');
  const s = STATUS_STYLES[item.status] || STATUS_STYLES.waiting;

  const statusOptions = [
    { value: 'waiting', label: t('waiting') },
    { value: 'cooking', label: t('cooking') },
    { value: 'ready',   label: t('ready') },
    { value: 'served',  label: t('served') },
  ];

  return (
    <tr className={styles.row}>
      <td className={styles.name}>{item.name}</td>
      <td className={styles.cell}>{item.qty}</td>
      <td className={`${styles.cell} ${styles.price}`}>{item.price}₴</td>
      <td className={styles.cell}>
        <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
          {s.icon} {t(item.status)}
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
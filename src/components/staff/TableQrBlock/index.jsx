import React from 'react';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../../PrimaryButton';
import SecondaryButton from '../../SecondaryButton';
import styles from './tableQrBlock.module.css';

export default function TableQrBlock({ tableId }) {
  const { t } = useTranslation('tableDetail');

  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('qrCode')}</p>
      <div className={styles.qrPlaceholder}>
        <div className={styles.qrGrid} />
      </div>
      <p className={styles.url}>waitless.app/{tableId}</p>
      <PrimaryButton label={`↓ ${t('downloadPng')}`} onClick={() => {}} />
      <div style={{ height: 8 }} />
      <SecondaryButton label={`🖨 ${t('print')}`} onClick={() => {}} />
    </div>
  );
}
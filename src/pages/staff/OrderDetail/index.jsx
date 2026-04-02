import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import ActiveOrderRow from '../../../components/staff/ActiveOrderRow';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { ORDER_DETAIL } from '../../../data/mockData';
import styles from './orderDetail.module.css';

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useTranslation('orderDetail');
  const [items, setItems] = useState(ORDER_DETAIL.items);

  function handleStatusChange(itemId, newStatus) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it));
  }

  return (
    <StaffShell
      title={`${t('title')} #${id || ORDER_DETAIL.id}`}
      backTo="/staff/cooking"
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={`🖨 ${t('printCheck')}`} onClick={() => {}} />
          <PrimaryButton label={t('updateStatus')} onClick={() => {}} />
        </div>
      }
    >
      <div className={styles.page}>
        <div className={styles.statsRow}>
          <MicroStat label={t('order')} value={`#${ORDER_DETAIL.id}`} />
          <MicroStat label={t('table')} value={`№ ${ORDER_DETAIL.tableId}`} />
          <MicroStat label={t('time')} value={ORDER_DETAIL.time} />
          <MicroStat label={t('status')} value={t('waiterCall')} highlight />
        </div>

        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th>{t('dish')}</th>
                <th>{t('qty')}</th>
                <th>{t('price')}</th>
                <th>{t('dishStatus')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <ActiveOrderRow
                  key={item.id}
                  item={item}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
          <div className={styles.addRow}>
            <button className={styles.addBtn}>+ {t('addDish')}</button>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.commentBox}>
            <p className={styles.commentLabel}>{t('clientComment')}</p>
            <p className={styles.commentVal}>{ORDER_DETAIL.comment || t('noComment')}</p>
          </div>
          <div className={styles.totalBox}>
            <p className={styles.totalLabel}>{t('totalSum')}</p>
            <p className={styles.totalVal}>{ORDER_DETAIL.total}₴</p>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
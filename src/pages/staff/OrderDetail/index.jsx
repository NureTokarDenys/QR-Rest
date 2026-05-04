import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import ActiveOrderRow from '../../../components/staff/ActiveOrderRow';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { ORDER_DETAIL } from '../../../data/mockData';
import { getOrder } from '../../../api/orders';
import { updateItemStatus } from '../../../api/kitchen';
import styles from './orderDetail.module.css';

function normaliseOrder(raw) {
  if (!raw) return null;
  return {
    id: raw._id || raw.id,
    tableId: raw.table?.number ?? raw.tableNumber ?? raw.tableId,
    time: raw.createdAt ? new Date(raw.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '—',
    status: raw.status,
    comment: raw.comment || '',
    total: raw.totalAmount ?? raw.total ?? 0,
    items: (raw.items || []).map(i => ({
      id: i._id || i.id,
      orderId: raw._id || raw.id,
      name: (typeof i.menuItemId === 'object' ? i.menuItemId?.name : null) || i.name || '—',
      qty: i.qty ?? i.quantity ?? 1,
      price: i.totalPrice ?? i.price ?? 0,
      status: i.dishStatus || i.status || 'waiting',
    })),
  };
}

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useTranslation('orderDetail');
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState(ORDER_DETAIL.items);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getOrder(id)
      .then(raw => {
        const norm = normaliseOrder(raw);
        if (norm) { setOrder(norm); setItems(norm.items); }
      })
      .catch(err => console.error('getOrder error:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const displayOrder = order || { id: ORDER_DETAIL.id, tableId: ORDER_DETAIL.tableId, time: ORDER_DETAIL.time, status: 'in_progress', comment: ORDER_DETAIL.comment, total: ORDER_DETAIL.total };

  async function handleStatusChange(itemId, newStatus) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it));
    const item = items.find(it => it.id === itemId);
    if (item?.orderId || displayOrder?.id) {
      try {
        await updateItemStatus(item?.orderId || displayOrder.id, itemId, newStatus);
      } catch (err) {
        console.error('updateItemStatus error:', err);
      }
    }
  }

  if (loading) return <StaffShell title={t('title')} backTo="/staff/cooking"><p style={{ padding: '2rem' }}>Завантаження...</p></StaffShell>;

  return (
    <StaffShell
      title={`${t('title')} #${displayOrder.id}`}
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
          <MicroStat label={t('order')} value={`#${displayOrder.id}`} />
          <MicroStat label={t('table')} value={`№ ${displayOrder.tableId}`} />
          <MicroStat label={t('time')} value={displayOrder.time} />
          <MicroStat label={t('status')} value={displayOrder.status} highlight />
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
            <p className={styles.commentVal}>{displayOrder.comment || t('noComment')}</p>
          </div>
          <div className={styles.totalBox}>
            <p className={styles.totalLabel}>{t('totalSum')}</p>
            <p className={styles.totalVal}>{displayOrder.total}₴</p>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
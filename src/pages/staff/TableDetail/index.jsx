import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import ActiveOrderRow from '../../../components/staff/ActiveOrderRow';
import TableQrBlock from '../../../components/staff/TableQrBlock';
import TableHistoryBlock from '../../../components/staff/TableHistoryBlock';
import PrimaryButton from '../../../components/PrimaryButton';
import { TABLES, TABLE_HISTORY } from '../../../data/mockData';
import styles from './tableDetail.module.css';

export default function TableDetail() {
  const { id } = useParams();
  const table = TABLES.find(t => t.id === Number(id)) || TABLES[1];
  const { t } = useTranslation('tableDetail');

  return (
    <StaffShell
      title={`${t('title')} ${table.id}${table.status === 'waiter' ? ` — ${t('waiterCall')}` : ''}`}
      backTo="/staff/map"
    >
      <div className={styles.page}>
        <div className={styles.top}>
          <div className={styles.titleBlock}>
            <h2 className={styles.tableTitle}>Стіл № {table.id}</h2>
            <p className={styles.tableSub}>{t('hall')} А · {table.seats} {t('seats')}</p>
          </div>
          {table.status === 'waiter' && (
            <PrimaryButton label={t('acceptCall')} onClick={() => {}} />
          )}
        </div>

        <div className={styles.statsRow}>
          <MicroStat label={t('status')} value={table.status === 'waiter' ? t('waiterCall') : t('busy')} highlight={table.status === 'waiter'} />
          <MicroStat label={t('timeAtTable')} value={table.timeAtTable || '—'} />
          <MicroStat label={t('currentOrder')} value={table.orderId ? `#${table.orderId}` : '—'} highlight />
        </div>

        {table.dishes && table.dishes.length > 0 ? (
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <p className={styles.orderTitle}>{t('activeOrder')} #{table.orderId}</p>
              <button className={styles.editBtn}>{t('editOrder')}</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>{t('dish')}</th>
                  <th>{t('qty')}</th>
                  <th>{t('sum')}</th>
                  <th>{t('statusCol')}</th>
                </tr>
              </thead>
              <tbody>
                {table.dishes.map((d, i) => (
                  <tr key={i} className={styles.tableRow}>
                    <td className={styles.td}>{d.name}</td>
                    <td className={styles.td}>{d.qty}</td>
                    <td className={`${styles.td} ${styles.priceCell}`}>{d.price}₴</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${styles[d.status]}`}>
                        {d.status === 'waiting' ? '⏳ Очікує' : d.status === 'cooking' ? '🔥 Готується' : '✅ Готово'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.total}>
              <span>{t('total')}</span>
              <span className={styles.totalVal}>
                {table.dishes.reduce((s, d) => s + d.price, 0)}₴
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.noOrder}>{t('noOrder')}</div>
        )}

        <div className={styles.bottomRow}>
          <TableQrBlock tableId={table.id} />
          <TableHistoryBlock history={TABLE_HISTORY} />
        </div>
      </div>
    </StaffShell>
  );
}
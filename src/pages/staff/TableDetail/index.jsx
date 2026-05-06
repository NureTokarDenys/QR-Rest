import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import ActiveOrderRow from '../../../components/staff/ActiveOrderRow';
import TableQrBlock from '../../../components/staff/TableQrBlock';
import TableHistoryBlock from '../../../components/staff/TableHistoryBlock';
import PrimaryButton from '../../../components/PrimaryButton';
import { getTables } from '../../../api/admin';
import { getOrder, voidOrder } from '../../../api/orders';
import styles from './tableDetail.module.css';

function mapStatus(s) {
  if (!s) return 'free';
  if (s === 'occupied') return 'busy';
  if (s === 'waiter_call') return 'waiter';
  return s;
}

export default function TableDetail() {
  const { id } = useParams();
  const { t } = useTranslation('tableDetail');
  const [voidMode, setVoidMode] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isWalkout, setIsWalkout] = useState(false);
  const [paid, setPaid] = useState(false);
  const [table, setTable] = useState({ id: id, status: 'busy', seats: 4, name: `Стіл ${id}` });
  const [orderId, setOrderId] = useState(null);
  const [dishes, setDishes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadTable() {
      try {
        const allTables = await getTables();
        if (cancelled || !Array.isArray(allTables)) return;
        // match by number (URL param `id` is the table number)
        const apiTable = allTables.find(t => String(t.number) === String(id) || String(t._id) === String(id));
        if (!apiTable) return;
        const normTable = {
          id: apiTable.number ?? apiTable._id,
          status: mapStatus(apiTable.status),
          seats: apiTable.capacity ?? 4,
          name: apiTable.name || `Стіл ${apiTable.number}`,
          orderId: apiTable.currentOrder?._id || apiTable.currentOrderId,
        };
        if (!cancelled) setTable(normTable);

        const currentOrderId = apiTable.currentOrder?._id || apiTable.currentOrderId;
        if (currentOrderId) {
          setOrderId(currentOrderId);
          try {
            const orderData = await getOrder(currentOrderId);
            if (cancelled) return;
            // orderData shape: { order, servingGroups, items }
          const items = (orderData?.items || []).map(i => ({
              id: i._id || i.id,
              name: (typeof i.menuItemId === 'object' ? i.menuItemId?.name : null) || i.name || '—',
              qty: i.qty ?? i.quantity ?? 1,
              price: i.totalPrice ?? i.price ?? 0,
              status: i.dishStatus || 'waiting',
            }));
            setDishes(items);
          } catch (e) {
            console.error('getOrder error:', e);
          }
        }
      } catch (err) {
        console.error('getTables error:', err);
      }
    }
    loadTable();
    return () => { cancelled = true; };
  }, [id]);

  async function handleVoidConfirm() {
    if (orderId) {
      try {
        await voidOrder(orderId, isWalkout ? 'walkout' : voidReason);
      } catch (err) {
        console.error('voidOrder error:', err);
      }
    }
    setPaid(true);
  }

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
          <MicroStat label={t('currentOrder')} value={orderId ? `#${String(orderId).slice(-6)}` : '—'} highlight />
        </div>

        {dishes.length > 0 ? (
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <p className={styles.orderTitle}>{t('activeOrder')} #{orderId ? String(orderId).slice(-6) : '—'}</p>
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
                {dishes.map((d, i) => (
                  <tr key={d.id || i} className={styles.tableRow}>
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
                {dishes.reduce((s, d) => s + (d.price * (d.qty || 1)), 0)}₴
              </span>
            </div>

            {!paid && (
              <div className={styles.paymentRow}>
                {!voidMode ? (
                  <>
                    <button
                      className={styles.cashBtn}
                      onClick={() => setPaid(true)}
                    >
                      💵 {t('payCash')}
                    </button>
                    <button
                      className={styles.voidBtn}
                      onClick={() => setVoidMode(true)}
                    >
                      🚫 {t('voidOrder')}
                    </button>
                  </>
                ) : (
                  <div className={styles.voidPanel}>
                    <label className={styles.walkoutLabel}>
                      <input
                        type="checkbox"
                        checked={isWalkout}
                        onChange={e => {
                          setIsWalkout(e.target.checked);
                          if (e.target.checked) setVoidReason(t('walkoutReason'));
                        }}
                      />
                      {t('markWalkout')}
                    </label>
                    <textarea
                      className={styles.voidReasonInput}
                      placeholder={t('voidReasonPlaceholder')}
                      value={voidReason}
                      rows={2}
                      onChange={e => setVoidReason(e.target.value)}
                    />
                    <p className={styles.voidReasonHint}>
                      {voidReason.length}/10 {t('minChars')}
                    </p>
                    <div className={styles.voidActions}>
                      <button
                        className={styles.voidConfirmBtn}
                        disabled={voidReason.trim().length < 10}
                        onClick={handleVoidConfirm}
                      >
                        {t('confirmVoid')}
                      </button>
                      <button
                        className={styles.voidCancelBtn}
                        onClick={() => { setVoidMode(false); setVoidReason(''); setIsWalkout(false); }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {paid && (
              <div className={styles.paidBanner}>
                ✅ {t('orderClosed')}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.noOrder}>{t('noOrder')}</div>
        )}

        <div className={styles.bottomRow}>
          <TableQrBlock tableId={table.id} />
          <TableHistoryBlock history={[]} />
        </div>
      </div>
    </StaffShell>
  );
}
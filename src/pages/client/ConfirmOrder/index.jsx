import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import ConfirmOrderItem from '../../../components/client/ConfirmOrderItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './confirmOrder.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

import { MdTableRestaurant, MdEdit, MdCheck, MdErrorOutline, MdLock } from "react-icons/md";

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const local = useLocalField();
  const {
    cart,
    cartTotal,
    tableId,
    tableNumber,
    addOrderToHistory,
    orderComment,
    submitOrder,
    editingOrder,
  } = useApp();

  const canOrder = Boolean(tableId);
  const { t } = useTranslation('orderConfirmation');

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(false);
  // When TABLE_ORDER_LOCKED: backend returns the existing order id
  const [lockedOrderId, setLockedOrderId] = useState(null);

  // Capture before submit so we can navigate after editingOrder is cleared
  const editingOrderId = editingOrder?.id ?? null;

  async function handleConfirm() {
    if (loading) return;
    setError(false);
    setLockedOrderId(null);
    setLoading(true);
    try {
      const normalized = await submitOrder();
      if (normalized) addOrderToHistory(normalized);
      navigate(editingOrderId ? `/order-status/${editingOrderId}` : '/order-status');
    } catch (err) {
      console.error('Failed to place order:', err);
      const code      = err?.response?.data?.error?.code;
      const orderId   = err?.response?.data?.error?.activeOrderId;
      if (code === 'TABLE_ORDER_LOCKED' && orderId) {
        setLockedOrderId(orderId);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header title={t('confirmation_header')} showBack />

      <div className={styles.content}>
        <div className={styles.tableSection}>
          <span className={styles.tableIcon}><MdTableRestaurant /></span>
          <p className={styles.tableLabel}>{t('table_number')}</p>
          <p className={styles.tableNumber}>{t('order_number_info')} {tableNumber}</p>
        </div>

        {editingOrder && (
          <div className={styles.lockedBox}>
            <p className={styles.lockedBoxTitle}>
              <MdLock style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t('locked_section_label')}
            </p>
            {(editingOrder.servingGroups || []).map(group => {
              const groupItems = (editingOrder.items || []).filter(i => i.groupId === group.id);
              return (
                <div key={group.id} className={styles.lockedGroup}>
                  <p className={styles.lockedGroupName}>{local(group, 'name')}</p>
                  {groupItems.map(item => (
                    <div key={item.orderItemId || item.id} className={styles.lockedItem}>
                      <span className={styles.lockedItemName}>{local(item, 'name')}</span>
                      <span className={styles.lockedItemQty}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.orderBox}>
          <p className={styles.boxTitle}>{t('your_order')}</p>
          {cart.map(item => (
            <ConfirmOrderItem key={item.cartItemId || item.id} item={item} />
          ))}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>{t('total_label')}</span>
            <span className={styles.totalValue}>{cartTotal}₴</span>
          </div>
        </div>

        <div className={styles.commentBox}>
          <p className={styles.commentTitle}>{t('comment')}</p>
          <p className={styles.commentValue}>{orderComment || t('abcent')}</p>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}><MdCheck /></span>
          <span className={styles.noticeText}>{t('snipet')}</span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <MdErrorOutline />
            <span>{t('submit_error') || 'Failed to place order. Please try again.'}</span>
          </div>
        )}

        {lockedOrderId && (
          <div className={styles.errorBanner} style={{ background: '#fff3cd', borderColor: '#f0ad00', color: '#7a4f00' }}>
            <MdLock />
            <span>
              {t('order_locked_msg') || 'Інший гість вже зробив замовлення за цим столиком.'}{' '}
              <button
                style={{ background: 'none', border: 'none', color: '#1d7afc', cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline' }}
                onClick={() => navigate(`/order-status/${lockedOrderId}`, { replace: true })}
              >
                {t('view_order') || 'Переглянути замовлення'}
              </button>
            </span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <PrimaryButton
          label={loading ? '…' : <><MdCheck /> {editingOrder ? t('confirm_add') : t('confirm_and_sent')}</>}
          onClick={handleConfirm}
          disabled={loading || !canOrder}
        />
        {!canOrder && (
          <p className={styles.noTableHint}>
            📍 {t('no_table_hint') || 'Відскануйте QR-код на вашому столику, щоб зробити замовлення'}
          </p>
        )}
        <SecondaryButton
          label={<><MdEdit /> {t('edit_order')}</>}
          onClick={() => navigate(-1)}
          disabled={loading}
        />
      </div>
    </div>
  );
}

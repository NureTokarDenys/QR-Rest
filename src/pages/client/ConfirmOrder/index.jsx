import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useMenuContext } from '../../../context/MenuContext';
import { useToast } from '../../../context/ClientToastContext';
import { diffCartItem } from '../../../utils/menuDiff';
import Header from '../../../components/client/Header';
import ConfirmOrderItem from '../../../components/client/ConfirmOrderItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './confirmOrder.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

import {
  MdTableRestaurant, MdEdit, MdCheck,
  MdErrorOutline, MdLock, MdWarning,
} from 'react-icons/md';

// ── Change row rendering ──────────────────────────────────────────────────────

function ChangeRow({ ch, local, t }) {
  switch (ch.kind) {
    case 'base_price':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowYellow}`}>
          <span className={styles.changeRowDot} />
          <span>
            {local(ch, 'label') || t('base_price')}:{' '}
            <s className={styles.oldVal}>{ch.oldPrice}₴</s>
            {' → '}
            <strong>{ch.newPrice}₴</strong>
          </span>
        </li>
      );
    case 'addon_price':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowYellow}`}>
          <span className={styles.changeRowDot} />
          <span>
            {local(ch, 'name')}:{' '}
            <s className={styles.oldVal}>{ch.oldPrice}₴</s>
            {' → '}
            <strong>{ch.newPrice}₴</strong>
          </span>
        </li>
      );
    case 'addon_removed':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowRed}`}>
          <span className={styles.changeRowDot} />
          <span>
            {local(ch, 'name')} — <em>{t('addon_removed')}</em>
          </span>
        </li>
      );
    case 'option_price':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowYellow}`}>
          <span className={styles.changeRowDot} />
          <span>
            {local(ch, 'groupName')} › {local(ch, 'name')}:{' '}
            <s className={styles.oldVal}>{ch.oldPrice > 0 ? `+${ch.oldPrice}₴` : `${ch.oldPrice}₴`}</s>
            {' → '}
            <strong>{ch.newPrice > 0 ? `+${ch.newPrice}₴` : `${ch.newPrice}₴`}</strong>
          </span>
        </li>
      );
    case 'option_removed':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowRed}`}>
          <span className={styles.changeRowDot} />
          <span>
            {local(ch, 'groupName')} › {local(ch, 'name')} — <em>{t('option_removed')}</em>
            {ch.fallbackName && (
              <> {t('replaced_with')} <strong>{local(ch, 'fallbackName')}</strong></>
            )}
          </span>
        </li>
      );
    case 'group_removed':
      return (
        <li className={`${styles.changeRow} ${styles.changeRowRed}`}>
          <span className={styles.changeRowDot} />
          <span>{local(ch, 'name')} — <em>{t('group_removed')}</em></span>
        </li>
      );
    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const local    = useLocalField();
  const {
    cart, cartTotal, tableId, tableNumber,
    addOrderToHistory, orderComment, submitOrder, editingOrder,
    replaceCart,
  } = useApp();
  const { fetchFreshDish } = useMenuContext();
  const { showToast } = useToast();

  const { t } = useTranslation('orderConfirmation');
  const { t: tToast } = useTranslation('clientToast');

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(false);
  const [lockedOrderId, setLockedOrderId] = useState(null);

  // ── Change detection ──────────────────────────────────────────────────────
  // diffs: { cartItemId, itemName, type, changes, adjustedItem }[]
  const [checking, setChecking] = useState(true);
  const [diffs, setDiffs]       = useState([]);   // only items with type !== 'ok'

  // Redirect to menu if the cart is empty when the page first loads
  useEffect(() => {
    if (cart.length === 0) navigate('/menu', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch fresh dish data, diff against cart, and auto-adjust cart.
  // Called on mount and again if the backend rejects the order with MENU_CHANGED.
  async function triggerFreshCheck() {
    if (!cart.length) { setChecking(false); return; }
    setChecking(true);
    setDiffs([]);

    const uniqueIds = [...new Set(cart.map(i => String(i.id)))];
    try {
      const results = await Promise.all(
        uniqueIds.map(id => fetchFreshDish(id).catch(() => ({ old: null, fresh: null })))
      );

      const dishMap = {};
      uniqueIds.forEach((id, idx) => { dishMap[id] = results[idx]; });

      const itemDiffs    = [];
      const adjustedCart = [];

      for (const cartItem of cart) {
        const id = String(cartItem.id);
        const { old: oldDish, fresh: freshDish } = dishMap[id] ?? { old: null, fresh: null };
        const result = diffCartItem(cartItem, freshDish, oldDish);

        if (result.type !== 'ok') {
          itemDiffs.push({
            cartItemId:  cartItem.cartItemId,
            itemName:    cartItem.name,
            itemName_en: cartItem.name_en,
            ...result,
          });
        }
        if (!result.blocking) {
          adjustedCart.push(result.adjustedItem);
        }
      }

      if (itemDiffs.length > 0) replaceCart(adjustedCart);
      setDiffs(itemDiffs.filter(d => d.type !== 'ok'));
    } catch {}
    finally { setChecking(false); }
  }

  useEffect(() => {
    triggerFreshCheck();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const blockingDiffs   = diffs.filter(d => d.blocking);
  const modifiedDiffs   = diffs.filter(d => !d.blocking && d.changes.length > 0);
  const canOrder        = Boolean(tableId);
  const cartAfterAdjust = cart; // replaceCart already updated AppContext

  const editingOrderId  = editingOrder?.id ?? null;

  async function handleConfirm() {
    if (loading) return;
    setError(false);
    setLockedOrderId(null);
    setLoading(true);
    try {
      const normalized = await submitOrder();
      if (normalized) addOrderToHistory(normalized);
      // Offline path: submitOrder returns null and the payload sits in the
      // localStorage queue. Tell the user and bail — once we reconnect the
      // flush will set currentOrder and the FAB will appear.
      if (!normalized && !editingOrderId && navigator.onLine === false) {
        showToast(tToast('offline_order_queued'));
        navigate('/menu');
        return;
      }
      const targetId = editingOrderId ?? normalized?.id;
      navigate(targetId ? `/order-status/${targetId}` : '/order-status');
    } catch (err) {
      console.error('Failed to place order:', err);
      const code    = err?.response?.data?.error?.code;
      const orderId = err?.response?.data?.error?.activeOrderId;
      if (code === 'MENU_CHANGED') {
        // Menu changed between our frontend check and the API call — re-run the
        // check with truly fresh data so the user sees the updated diff banner.
        triggerFreshCheck();
      } else if ((code === 'ACTIVE_ORDER_EXISTS' || code === 'TABLE_ORDER_LOCKED') && orderId) {
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

        {/* ── Change banner ── */}
        {!checking && diffs.length > 0 && (
          <div className={styles.changesBanner}>
            <div className={styles.changesBannerHeader}>
              <MdWarning className={styles.changesHeaderIcon} />
              <span className={styles.changesBannerTitle}>
                {t('changes_banner_title')}
              </span>
            </div>
            <p className={styles.changesBannerSub}>
              {t('changes_banner_sub')}
            </p>

            {/* Removed / unavailable dishes */}
            {blockingDiffs.map(d => (
              <div key={d.cartItemId} className={styles.diffItem}>
                <div className={styles.diffItemHeader}>
                  <span className={styles.diffItemName}>
                    {local(d, 'itemName')}
                  </span>
                  <span className={`${styles.diffTag} ${styles.diffTagRed}`}>
                    {d.type === 'dish_removed' ? t('tag_removed') : t('tag_unavailable')}
                  </span>
                </div>
                <p className={styles.diffItemHint}>{t('diff_item_removed')}</p>
              </div>
            ))}

            {/* Modified dishes */}
            {modifiedDiffs.map(d => {
              const priceChanges   = d.changes.filter(c => c.kind.includes('price'));
              const removedChanges = d.changes.filter(c => c.kind.includes('removed'));
              return (
                <div key={d.cartItemId} className={styles.diffItem}>
                  <div className={styles.diffItemHeader}>
                    <span className={styles.diffItemName}>
                      {local(d, 'itemName')}
                    </span>
                    <div className={styles.diffItemTags}>
                      {removedChanges.length > 0 && (
                        <span className={`${styles.diffTag} ${styles.diffTagRed}`}>
                          {t('tag_adjusted')}
                        </span>
                      )}
                      {priceChanges.length > 0 && (
                        <span className={`${styles.diffTag} ${styles.diffTagYellow}`}>
                          {t('tag_price_changed')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className={styles.changeList}>
                    {d.changes.map((ch, i) => (
                      <ChangeRow key={i} ch={ch} local={local} t={t} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Order items ── */}
        <div className={styles.orderBox}>
          <p className={styles.boxTitle}>{t('your_order')}</p>
          {cartAfterAdjust.map(item => (
            <ConfirmOrderItem key={item.cartItemId || item.id} item={item} />
          ))}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>{t('total_label')}</span>
            <span className={styles.totalValue}>{cartTotal}₴</span>
          </div>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}><MdCheck /></span>
          <span className={styles.noticeText}>{t('snipet')}</span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <MdErrorOutline />
            <span>{t('submit_error')}</span>
          </div>
        )}

        {lockedOrderId && (
          <div className={styles.lockedBanner}>
            <MdLock />
            <span>
              {t('order_locked_msg')}{' '}
              <button
                className={styles.lockedBannerLink}
                onClick={() => navigate(`/order-status/${lockedOrderId}`, { replace: true })}
              >
                {t('view_order')}
              </button>
            </span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <PrimaryButton
          label={
            checking ? '…' :
            loading   ? '…' :
            <><MdCheck /> {editingOrder ? t('confirm_add') : t('confirm_and_sent')}</>
          }
          onClick={handleConfirm}
          disabled={loading || checking || !canOrder || cart.length === 0}
        />
        {!canOrder && (
          <p className={styles.noTableHint}>
            📍 {t('no_table_hint')}
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

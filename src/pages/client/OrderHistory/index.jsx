import React, { useState, useEffect } from 'react';
import Header from '../../../components/client/Header';
import OrderHistoryCard from '../../../components/client/OrderHistoryCard';
import Footer from '../../../components/client/Footer';
import { useApp } from '../../../context/AppContext';
import { normalizeApiOrder } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { getMyOrders } from '../../../api/orders';
import styles from './orderHistory.module.css';
import { useTranslation } from 'react-i18next';

export default function OrderHistory() {
  const { orderHistory } = useApp();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation('myOrders');

  const [apiOrders, setApiOrders] = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    getMyOrders()
      .then(data => setApiOrders(Array.isArray(data) ? data : []))
      .catch(() => setApiOrders([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const CANCELLED = new Set(['void', 'voided', 'cancelled']);

  // Merge API orders (normalized) with any local orders not yet synced
  const normalized = apiOrders.map(normalizeApiOrder);
  const apiIds     = new Set(normalized.map(o => o.id));
  const localOnly  = orderHistory.filter(o => !apiIds.has(o.id));
  const allOrders  = [...normalized, ...localOnly]
    .filter(o => !CANCELLED.has(o.status))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // For guests show only local history (also filtered)
  const guestOrders = orderHistory.filter(o => !CANCELLED.has(o.status));
  const displayed   = isAuthenticated ? allOrders : guestOrders;

  return (
    <div className={styles.page}>
      <Header title={t('header')} showBack />
      <div className={styles.content}>
        {loading && <p className={styles.loading}>{t('loading')}</p>}
        {!loading && displayed.length === 0 && (
          <p className={styles.empty}>{t('empty')}</p>
        )}
        {displayed.map((order, i) => (
          <OrderHistoryCard key={order.id || i} order={order} />
        ))}
      </div>
      <Footer />
    </div>
  );
}

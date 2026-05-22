import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';
import { useNotificationSound } from '../hooks/useNotificationSound';
import { useTranslation } from 'react-i18next';

const Ctx = createContext(null);

// Ordered list of types cycled through by fireTestNotification
const TEST_TYPES = [
  'ORDER_NEW',
  'WAITER_CALL',
  'WAITER_CALL_CASH',
  'PAYMENT_COMPLETED',
  'ORDER_VOID',
  'ORDER_CANCELLED',
];

const MOCK_PAYLOAD = {
  tableNumber: 7,
  tableId:     'mock-table-7',
  orderId:     'mock-order-42',
  callId:      'mock-call-1',
};

const ROLE_EVENTS = {
  cook:        ['ORDER_NEW'],
  waiter:      ['ORDER_NEW', 'WAITER_CALL', 'WAITER_CALL_CASH'],
  waiter_cook: ['ORDER_NEW', 'WAITER_CALL', 'WAITER_CALL_CASH'],
  admin:       ['ORDER_NEW', 'WAITER_CALL', 'WAITER_CALL_CASH',
                'ORDER_VOID', 'ORDER_CANCELLED', 'PAYMENT_COMPLETED'],
};

function buildNotif(event, payload, t) {
  const table   = payload.tableNumber ?? payload.tableNum ?? payload.table ?? '?';
  const orderId = payload.orderId ?? '?';
  const titleMap = {
    ORDER_NEW:         t('notif_order_new',        { table }),
    WAITER_CALL:       t('notif_waiter_call',       { table }),
    WAITER_CALL_CASH:  t('notif_waiter_call_cash',  { table }),
    ORDER_VOID:        t('notif_order_void',        { order: orderId }),
    ORDER_CANCELLED:   t('notif_order_cancelled'),
    PAYMENT_COMPLETED: t('notif_payment_done',      { table }),
  };
  return {
    id:        `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:      event,
    title:     titleMap[event] ?? event,
    tableNum:  table,
    tableId:   payload.tableId ?? null,
    callId:    payload.callId ?? null,
    orderId:   payload.orderId ?? null,
    createdAt: new Date().toISOString(),
    readAt:    null,
  };
}

export function StaffNotificationsProvider({ children }) {
  const { user }   = useAuth();
  const { t }      = useTranslation('components');
  const playSound  = useNotificationSound();
  const [notifications, setNotifications] = useState([]); // oldest first (append)

  const handleMessage = useCallback((msg) => {
    const allowed = ROLE_EVENTS[user?.role] ?? [];
    if (!allowed.includes(msg.event)) return;
    const notif = buildNotif(msg.event, msg.payload ?? {}, t);
    setNotifications(prev => [...prev, notif]);
    playSound();
  }, [user?.role, playSound, t]);

  const isStaff = user && ['cook', 'waiter', 'waiter_cook', 'admin'].includes(user.role);
  useWebSocket({ onMessage: handleMessage, enabled: !!isStaff });

  // ── Dev-only: inject a mock notification and play the sound ──────────────
  const testTypeIndexRef = useRef(0);
  const fireTestNotification = useCallback(() => {
    const type = TEST_TYPES[testTypeIndexRef.current % TEST_TYPES.length];
    testTypeIndexRef.current += 1;
    const notif = buildNotif(type, MOCK_PAYLOAD, t);
    setNotifications(prev => [...prev, notif]);
    playSound();
  }, [playSound, t]);

  const markRead = useCallback((id) =>
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n
    )), []);

  const markAllRead = useCallback(() =>
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))),
  []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markRead, markAllRead, clearAll, fireTestNotification }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStaffNotifications() {
  return useContext(Ctx) ?? {
    notifications: [], unreadCount: 0,
    markRead: () => {}, markAllRead: () => {}, clearAll: () => {},
    fireTestNotification: () => {},
  };
}

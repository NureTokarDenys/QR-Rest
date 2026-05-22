import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { scanQR } from '../api/qr';
import { createOrder, getOrder, addGuestOrderItems, getMyOrders, getOrderNotifications, markNotificationsRead } from '../api/orders';
import { getRestaurantInfo } from '../api/restaurants';
import { useAuth } from './AuthContext';
import { SUPPORTED_LANGS, SOURCE_LANG, fromApiLang } from '../i18n/langs';
import { useNotificationSound } from '../hooks/useNotificationSound';
import { enqueueOrder, dequeueOrder, readQueue } from '../utils/offlineOrderQueue';

// ─── Global WS constants ──────────────────────────────────────────────────────
const WS_MAX_RETRIES    = 5;
const WS_RETRY_DELAY_MS = 3000;
const WS_PING_INTERVAL  = 25000;

function buildWsUrl() {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) return wsUrl;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/^http(s?):\/\/([^/]*).*$/, (_, s, host) => `ws${s}://${host}/ws`);
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

const AppContext = createContext(null);

const DEFAULT_GROUP_ID  = 'main';
const DEFAULT_MAIN_GROUP = { id: DEFAULT_GROUP_ID, name: 'Основна група', name_en: 'Main group' };

// ─── localStorage cart persistence ──────────────────────────────────────────
// Cart is stored as { restaurantId, items, groups } so we can discard stale
// data when the user switches to a different restaurant.

function loadCartState() {
  try {
    const raw = localStorage.getItem('cartState');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const currentRid = localStorage.getItem('restaurantId');
    // Discard if it belongs to a different restaurant
    if (parsed.restaurantId !== currentRid) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCartState(restaurantId, items, groups) {
  try {
    if (items.length === 0) {
      localStorage.removeItem('cartState');
    } else {
      localStorage.setItem('cartState', JSON.stringify({ restaurantId, items, groups }));
    }
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a raw API order object to the internal shape used by OrderStatus
 * and the floating FAB.
 *
 * The API returns two shapes:
 *   • GET /orders/:id  and  POST /orders  → { order, servingGroups, items }
 *   • GET /user/orders list entries       → plain Order object (no items)
 */
export function normalizeApiOrder(raw) {
  if (!raw) return null;

  // Detect nested shape { order, servingGroups, items }
  const isNested = raw.order && typeof raw.order === 'object';
  const orderData  = isNested ? raw.order        : raw;
  const rawItems   = isNested ? (raw.items  || []) : (raw.items  || []);
  const rawGroups  = isNested ? (raw.servingGroups || []) : (raw.servingGroups || []);

  const items = rawItems.map(item => {
    // menuItemId may be a populated object or just an ID string
    const dish = (item.menuItemId && typeof item.menuItemId === 'object')
      ? item.menuItemId
      : {};
    return {
      id:          dish._id  || dish.id  || (typeof item.menuItemId === 'string' ? item.menuItemId : '') || item._id,
      // orderItemId is the OrderItem document _id — used to match DISH_STATUS_UPDATED WS events
      orderItemId: String(item._id || item.id || ''),
      // menuItemName is included in create-order response (snapshot stored on OrderItem)
      name:        dish.name || item.menuItemName || item.name || '',
      name_en:     dish.name_en || item.name_en || dish.name || item.menuItemName || '',
      price:       dish.basePrice ?? dish.price ?? item.totalPrice ?? item.price ?? 0,
      image:       dish.imageUrl  || dish.image  || item.image || '',
      quantity:    item.quantity ?? item.qty ?? 1,
      groupId:     item.servingGroupId || 'main',
      // Domain model field is `dishStatus`; fall back to `status` for local mock orders
      status:      item.dishStatus || item.status || 'waiting',
    };
  });

  const servingGroups =
    rawGroups.length > 0
      ? rawGroups.map(g => ({
          id:      g._id || g.id || 'main',
          name:    g.name    || 'Основна група',
          name_en: g.name_en || g.name || 'Main group',
        }))
      : [{ id: 'main', name: 'Основна група', name_en: 'Main group' }];

  const computedTotal = items.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);

  return {
    id:               orderData._id || orderData.id,
    publicId:         orderData.publicId || null,
    tableId:          orderData.tableId   || null,
    tableNumber:      orderData.tableNumber ?? orderData.table?.number,
    restaurantId:     orderData.restaurantId || null,
    restaurantName:   orderData.restaurantName    || '',
    restaurantName_en: orderData.restaurantName_en || orderData.restaurantName || '',
    // Plan of the order's restaurant — drives whether the review UI shows.
    // Free-plan restaurants don't offer reviews; the backend rejects the
    // POST anyway via requirePlan('premium'), but knowing the plan up front
    // lets us hide the entry point.
    restaurantPlan:   orderData.restaurantPlan || null,
    servingGroups,
    items,
    total:  orderData.totalAmount ?? orderData.total ?? computedTotal,
    status: orderData.status,
    date:   orderData.createdAt || null,
  };
}

/**
 * An order is considered active (worth showing the FAB) when it exists,
 * is not in a terminal state, and has at least one item that isn't served.
 *
 * Handles both the nested API shape { order, servingGroups, items }
 * and a plain Order object (from the list endpoint — no items embedded).
 *
 * Real API status flow: waiting → cooking → ready → completed
 *                                        ↘ void  (from waiting or cooking)
 */
function isOrderActive(raw) {
  if (!raw) return false;

  const isNested  = raw.order && typeof raw.order === 'object';
  const orderData = isNested ? raw.order : raw;
  const items     = isNested
    ? (raw.items || [])
    : (raw.items || orderData.items || []);

  // Order-level terminal statuses
  const DONE_ORDER = new Set([
    'cancelled', 'completed_cash', 'completed_epay',
    // legacy values that may exist in old data
    'completed', 'void', 'voided', 'paid', 'closed', 'rejected',
  ]);
  if (orderData.status && DONE_ORDER.has(orderData.status)) return false;

  // Full-order endpoint (nested shape) always includes an items array.
  // If it's empty the order has no real work — treat as inactive to prevent
  // phantom orders from showing up after a restore.
  if (isNested && items.length === 0) return false;

  if (items.length === 0) {
    // List endpoint only — no items embedded; trust order-level status.
    const ACTIVE_ORDER = new Set(['waiting', 'cooking', 'ready']);
    return orderData.status ? ACTIVE_ORDER.has(orderData.status) : false;
  }

  const DONE_ITEM = new Set(['served', 'completed', 'cancelled', 'delivered']);
  return items.some(i => !DONE_ITEM.has(i.status));
}

// ─── provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  // AppProvider is rendered inside AuthProvider so useAuth() is safe here.
  const { accessToken, user } = useAuth();
  const playSound    = useNotificationSound();
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  // True while the async order-restore effect is running after login.
  // Consumers (RootRedirect) wait for this to be false before deciding where to navigate.
  const [restoringOrder, setRestoringOrder] = useState(() => !!accessToken);

  const [orderHistory, setOrderHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('orderHistory');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Hydrate cart + serving groups from localStorage on first render.
  // If the stored entry belongs to a different restaurant it is discarded.
  const [cart, setCart] = useState(() => {
    const saved = loadCartState();
    return saved?.items?.length ? saved.items : [];
  });

  const [currentOrder, setCurrentOrder]   = useState(null);
  const [orderComment, setOrderComment]   = useState('');
  // When set, the user is adding dishes to an existing order (not creating a new one)
  const [editingOrder, setEditingOrder]   = useState(null);

  const [servingGroups, setServingGroups] = useState(() => {
    const saved = loadCartState();
    return saved?.groups?.length ? saved.groups : [DEFAULT_MAIN_GROUP];
  });

  // Session / table state (read from localStorage, kept in sync)
  const [sessionToken, setSessionToken]           = useState(() => localStorage.getItem('sessionToken'));
  const [tableId, setTableId]                     = useState(() => localStorage.getItem('tableId'));
  const [tableNumber, setTableNumber]             = useState(() => localStorage.getItem('tableNumber') || '');
  const [tableHasActiveOrder, setTableHasActiveOrder] = useState(false);
  const [restaurantId, setRestaurantId] = useState(() => localStorage.getItem('restaurantId'));
  // restaurantName holds the source-language (ua) display name.
  // Additional variants are stored as restaurantName_<langCode>, e.g. restaurantName_en.
  const [restaurantName, setRestaurantName] = useState(() => localStorage.getItem('restaurantName') || '');
  const [restaurantName_en, setRestaurantName_en] = useState(() => localStorage.getItem('restaurantName_en') || '');
  const [restaurantPlan, setRestaurantPlan] = useState(() => localStorage.getItem('restaurantPlan') || 'free');

  // ── Restaurant language metadata ──────────────────────────────────────────
  // Populated whenever the restaurant object is available (QR scan, picker,
  // or menu load). Stored as i18n codes ('ua', 'en') — not backend API codes.
  //   restaurantLangs        — enabled language codes; empty = all SUPPORTED_LANGS
  //   restaurantDefaultLang  — default language i18n code (e.g. 'ua')
  const [restaurantLangs, setRestaurantLangs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('restaurantLangs') || '[]'); } catch { return []; }
  });
  const [restaurantDefaultLang, setRestaurantDefaultLang] = useState(
    () => localStorage.getItem('restaurantDefaultLang') || SOURCE_LANG
  );

  /**
   * Store restaurant metadata received from the backend.
   * @param {{
   *   defaultLanguage?:  string,    backend API code e.g. 'uk'
   *   enabledLanguages?: string[],  backend API codes e.g. ['uk','en']
   *   name?:             string,    translated restaurant display name
   *   nameLang?:         string,    i18n code for `name` (e.g. 'ua', 'en')
   *                                 defaults to SOURCE_LANG when omitted
   *   nameEn?:           string,    explicit EN name (convenience shortcut)
   * }} meta
   */
  function setRestaurantMeta({ defaultLanguage, enabledLanguages, name, nameLang, nameEn } = {}) {
    if (name) {
      // Store the name in the correct language slot
      const lang = nameLang || SOURCE_LANG;
      if (lang === SOURCE_LANG) {
        setRestaurantName(name);
        localStorage.setItem('restaurantName', name);
      } else if (lang === 'en') {
        setRestaurantName_en(name);
        localStorage.setItem('restaurantName_en', name);
      }
      // For additional future languages, extend here
    }
    if (nameEn) {
      setRestaurantName_en(nameEn);
      localStorage.setItem('restaurantName_en', nameEn);
    }
    if (defaultLanguage) {
      const i18nCode = fromApiLang(defaultLanguage);
      setRestaurantDefaultLang(i18nCode);
      localStorage.setItem('restaurantDefaultLang', i18nCode);
    }
    if (Array.isArray(enabledLanguages)) {
      // Convert API codes → i18n codes, keep only those we have a frontend
      // definition for (ignore future backend codes we haven't set up yet).
      const known = new Set(SUPPORTED_LANGS.map(l => l.code));
      const codes = enabledLanguages.map(fromApiLang).filter(c => known.has(c));
      setRestaurantLangs(codes);
      localStorage.setItem('restaurantLangs', JSON.stringify(codes));
    }
  }

  // ── Global WebSocket (persists across page navigation) ────────────────────
  const [wsStatus, setWsStatus]       = useState('idle');
  const [wsLatency, setWsLatency]     = useState(null);
  const globalWsRef                   = useRef(null);
  const wsRetriesRef                  = useRef(0);
  const wsRetryTimerRef               = useRef(null);
  const wsPingTimerRef                = useRef(null);
  const wsPingTsRef                   = useRef(null);
  const wsLastEventIdRef              = useRef(null);
  const wsRoomsRef                    = useRef(new Set());
  const wsListenersRef                = useRef(new Set());
  const wsEnabledRef                  = useRef(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.readAt).length;

  // ── Persist cart to localStorage on every change ─────────────────────────
  useEffect(() => {
    saveCartState(restaurantId, cart, servingGroups);
  }, [cart, servingGroups, restaurantId]);

  // ── Persist currentOrder to localStorage so it survives refresh / re-login ─
  //
  // Stored as { userId, order } so we can safely ignore an entry that belongs
  // to a different user (e.g. after logout → login as someone else).
  useEffect(() => {
    if (currentOrder && user?.id) {
      localStorage.setItem('activeOrder', JSON.stringify({
        userId: user.id,
        order:  currentOrder,
      }));
    } else {
      localStorage.removeItem('activeOrder');
    }
  }, [currentOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore active order whenever auth state changes ──────────────────────
  //
  // Strategy 0: user-scoped localStorage cache (fastest — no API call)
  // Strategy 1: GET /orders/:orderId stored after the last checkout
  // Strategy 2: GET /user/orders → find first non-terminal order → GET /orders/:id
  const STAFF_ROLES = new Set(['admin', 'root_admin', 'cook', 'waiter', 'waiter_cook']);
  useEffect(() => {
    if (!accessToken || STAFF_ROLES.has(user?.role)) {
      setCurrentOrder(null);
      setRestoringOrder(false);
      localStorage.removeItem('orderId');
      return;
    }

    setRestoringOrder(true);
    let cancelled = false;

    async function restore() {
      const storedId = localStorage.getItem('orderId');
      let raw = null;

      // ── Strategy 0: user-scoped localStorage cache ───────────────────────
      try {
        const cached = localStorage.getItem('activeOrder');
        if (cached) {
          const { userId: savedUserId, order: savedOrder } = JSON.parse(cached);
          // Only match when we have a real user id — never share cache between
          // different users who both happen to have no id ('guest' fallback).
          const currentUserId = user?.id;
          if (currentUserId && savedUserId === currentUserId) {
            const DONE_ITEM = ['served', 'completed', 'void', 'cancelled', 'delivered'];
            const stillActive = savedOrder?.items?.some(i => !DONE_ITEM.includes(i.status));
            if (stillActive) {
              if (!cancelled) {
                setCurrentOrder(savedOrder);
                // Sync standalone context states that components read directly
                if (savedOrder.tableNumber != null) {
                  setTableNumber(String(savedOrder.tableNumber));
                  localStorage.setItem('tableNumber', String(savedOrder.tableNumber));
                }
                if (savedOrder.tableId) {
                  setTableId(savedOrder.tableId);
                  localStorage.setItem('tableId', String(savedOrder.tableId));
                }
                if (savedOrder.restaurantId) {
                  setRestaurantId(savedOrder.restaurantId);
                  localStorage.setItem('restaurantId', savedOrder.restaurantId);
                }
              }
              return; // done — no API call needed
            } else {
              localStorage.removeItem('activeOrder'); // stale, clean up
            }
          }
        }
      } catch {
        localStorage.removeItem('activeOrder');
      }

      // ── Strategy 1: fetch by stored orderId ──────────────────────────────
      // Only attempt if we also have a restaurantId — without it the URL
      // becomes `//orders/:id` which can accidentally match unscoped routes.
      const storedRestaurantId = localStorage.getItem('restaurantId');
      if (storedId && storedRestaurantId) {
        try {
          const fetched = await getOrder(storedId, storedRestaurantId);
          if (isOrderActive(fetched)) raw = fetched;
          else localStorage.removeItem('orderId'); // stale — clean up
        } catch {
          localStorage.removeItem('orderId');
        }
      }

      // ── Strategy 2: scan /user/orders for a non-terminal active order ───────
      // Only runs when Strategies 0 and 1 both failed to find an active order.
      // Scoped to non-terminal statuses so intentionally cleared cookies never
      // re-surface completed/cancelled orders.
      if (!raw) {
        try {
          const recentOrders = await getMyOrders();
          const DONE = new Set(['completed', 'completed_cash', 'completed_epay', 'void', 'voided', 'cancelled', 'paid', 'closed']);
          const active = Array.isArray(recentOrders)
            ? recentOrders.find(o => !DONE.has(o.status))
            : null;
          if (active) {
            const rid = active.restaurantId || localStorage.getItem('restaurantId');
            if (rid) {
              const full = await getOrder(active._id, rid);
              if (full && isOrderActive(full)) raw = full;
            }
          }
        } catch { /* fail silently */ }
      }

      if (cancelled) return;

      if (raw && isOrderActive(raw)) {
        const normalized = normalizeApiOrder(raw);
        setCurrentOrder(normalized);
        const id = raw.order?._id || raw.order?.id || raw._id || raw.id;
        if (id) localStorage.setItem('orderId', String(id));
        // Restore table + restaurant context so the order is fully usable
        if (normalized.restaurantId) {
          setRestaurantId(normalized.restaurantId);
          localStorage.setItem('restaurantId', normalized.restaurantId);
          getRestaurantInfo(normalized.restaurantId).then(info => {
            if (info?.name && !localStorage.getItem('restaurantName')) { setRestaurantName(info.name); localStorage.setItem('restaurantName', info.name); }
            if (info?.name_en && !localStorage.getItem('restaurantName_en')) { setRestaurantName_en(info.name_en); localStorage.setItem('restaurantName_en', info.name_en); }
            if (info?.plan) { setRestaurantPlan(info.plan); localStorage.setItem('restaurantPlan', info.plan); }
          }).catch(() => {});
        }
        if (normalized.tableId) {
          setTableId(normalized.tableId);
          localStorage.setItem('tableId', String(normalized.tableId));
        }
        if (normalized.tableNumber != null) {
          setTableNumber(String(normalized.tableNumber));
          localStorage.setItem('tableNumber', String(normalized.tableNumber));
        }
      }
      // If nothing found, leave currentOrder as-is —
      // it may have been set by submitOrder() in this session already.
    }

    restore().finally(() => { if (!cancelled) setRestoringOrder(false); });
    return () => { cancelled = true; };
  }, [accessToken, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore active order for guests (sessionToken only, no account) ───────
  useEffect(() => {
    if (accessToken || !sessionToken || currentOrder) return;
    const storedId = localStorage.getItem('orderId');
    const storedRestaurantId = localStorage.getItem('restaurantId');
    if (!storedId || !storedRestaurantId) return;
    getOrder(storedId, storedRestaurantId)
      .then(raw => {
        if (raw && isOrderActive(raw)) {
          setCurrentOrder(normalizeApiOrder(raw));
        } else {
          localStorage.removeItem('orderId');
        }
      })
      .catch(() => {});
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global WS connect ─────────────────────────────────────────────────────
  const wsConnect = useCallback(() => {
    if (!wsEnabledRef.current) return;

    const token        = localStorage.getItem('accessToken');
    const st           = localStorage.getItem('sessionToken');
    if (!token && !st) return;

    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (st)    params.set('session_token', st);

    setWsStatus(wsRetriesRef.current > 0 ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(`${buildWsUrl()}?${params}`);
    globalWsRef.current = ws;

    ws.onopen = () => {
      if (!wsEnabledRef.current) { ws.close(); return; }
      wsRetriesRef.current = 0;
      setWsStatus('connected');

      wsRoomsRef.current.forEach(room => {
        ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room } }));
      });
      if (wsLastEventIdRef.current) {
        ws.send(JSON.stringify({ event: 'REPLAY_REQUEST', payload: { last_event_id: wsLastEventIdRef.current } }));
      }

      clearInterval(wsPingTimerRef.current);
      wsPingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          wsPingTsRef.current = Date.now();
          ws.send(JSON.stringify({ event: 'PING' }));
        }
      }, WS_PING_INTERVAL);
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.event_id) wsLastEventIdRef.current = msg.event_id;
        if (msg.event === 'PONG') {
          if (wsPingTsRef.current !== null) {
            setWsLatency(Date.now() - wsPingTsRef.current);
            wsPingTsRef.current = null;
          }
          return;
        }

        if (msg.event === 'NOTIFICATION_NEW' && msg.payload?.notification) {
          const incoming = msg.payload.notification;
          setNotifications(prev => {
            if (prev.some(n => n._id === incoming._id)) return prev;
            const merged = [incoming, ...prev];
            merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return merged;
          });
          playSoundRef.current?.();
        }

        wsListenersRef.current.forEach(fn => { try { fn(msg); } catch {} });
      } catch {}
    };

    ws.onclose = () => {
      clearInterval(wsPingTimerRef.current);
      if (!wsEnabledRef.current) return;
      if (wsRetriesRef.current < WS_MAX_RETRIES) {
        wsRetriesRef.current += 1;
        setWsStatus('reconnecting');
        wsRetryTimerRef.current = setTimeout(wsConnect, WS_RETRY_DELAY_MS);
      } else {
        setWsStatus('failed');
      }
    };

    ws.onerror = () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect / disconnect global WS — fires for both guest (sessionToken) and staff (accessToken)
  useEffect(() => {
    const hasAuth = sessionToken || accessToken;
    if (!hasAuth) {
      wsEnabledRef.current = false;
      clearTimeout(wsRetryTimerRef.current);
      clearInterval(wsPingTimerRef.current);
      if (globalWsRef.current) {
        globalWsRef.current.onclose = null;
        globalWsRef.current.close();
        globalWsRef.current = null;
      }
      setWsStatus('idle');
      wsRoomsRef.current.clear();
      return;
    }

    wsEnabledRef.current  = true;
    wsRetriesRef.current  = 0;

    if (sessionToken) wsRoomsRef.current.add(`session:${sessionToken}`);
    wsConnect();

    return () => {
      wsEnabledRef.current = false;
      clearTimeout(wsRetryTimerRef.current);
      clearInterval(wsPingTimerRef.current);
      if (globalWsRef.current) {
        globalWsRef.current.onclose = null;
        globalWsRef.current.close();
        globalWsRef.current = null;
      }
    };
  }, [sessionToken, accessToken, wsConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to table room when tableId is available
  useEffect(() => {
    if (!tableId) return;
    const room = `table:${tableId}`;
    wsRoomsRef.current.add(room);
    const ws = globalWsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room } }));
    }
  }, [tableId]);

  // Load notifications when active order is set
  useEffect(() => {
    if (!currentOrder?.id || !sessionToken || !restaurantId) return;
    getOrderNotifications(currentOrder.id, restaurantId).then(data => {
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotifications(sorted);
      }
    }).catch(() => {});
  }, [currentOrder?.id, sessionToken, restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  function wsSubscribe(room) {
    wsRoomsRef.current.add(room);
    const ws = globalWsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room } }));
    }
  }

  function addWsListener(fn)    { wsListenersRef.current.add(fn); }
  function removeWsListener(fn) { wsListenersRef.current.delete(fn); }

  async function refreshNotifications(orderId, rid) {
    if (!orderId) return;
    const resolvedRid = rid || restaurantId || undefined;
    try {
      const data = await getOrderNotifications(orderId, resolvedRid);
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotifications(sorted);
      }
    } catch {}
  }

  async function markAllRead(orderId) {
    const id = orderId || currentOrder?.id;
    if (!id) return;
    try {
      await markNotificationsRead(id);
    } catch (err) {
      console.warn('markAllRead failed:', err?.response?.status, err?.message);
    }
    // Update local state regardless so the badge clears immediately.
    setNotifications(prev => prev.map(n => n.readAt ? n : { ...n, readAt: new Date().toISOString() }));
  }

  // ─── session ─────────────────────────────────────────────────────────────

  async function initSession(shortCode) {
    try {
      const data = await scanQR(shortCode);
      // restaurantId in the QR response is now the 8-char publicId (e.g. "BR5CH3OK")
      const {
        sessionToken: st,
        tableId:      tid,
        tableNumber:  tn,
        restaurantId: rid,          // publicId
        restaurantName: rname = '',
        restaurantPlan: rplan = 'free',
        tableHasActiveOrder: occupied = false,
        // Language meta (may be nested under restaurant object or at top level)
        restaurant:   restaurantObj,
        defaultLanguage,
        enabledLanguages,
      } = data;
      localStorage.setItem('sessionToken',   st);
      localStorage.setItem('tableId',        String(tid));
      localStorage.setItem('tableNumber',    String(tn));
      localStorage.setItem('restaurantId',   String(rid));   // publicId
      localStorage.setItem('restaurantPlan', rplan);
      if (rname) localStorage.setItem('restaurantName', rname);
      setSessionToken(st);
      setTableId(String(tid));
      setTableNumber(String(tn));
      setRestaurantId(String(rid));
      setRestaurantPlan(rplan);
      if (rname) setRestaurantName(rname);
      setTableHasActiveOrder(occupied);
      // Extract language meta from QR response (may be top-level or in restaurant sub-object)
      const meta = restaurantObj || {};
      setRestaurantMeta({
        defaultLanguage:  defaultLanguage  || meta.defaultLanguage,
        enabledLanguages: enabledLanguages || meta.enabledLanguages,
      });

      // Restore the active order if the backend reports one on this table.
      // On a recovery scan the same session token is handed back, so the
      // ownership check on GET /orders/:id passes and the FAB will appear.
      const activeOrderId = data.activeOrderId;
      if (activeOrderId) {
        localStorage.setItem('orderId', String(activeOrderId));
        try {
          const raw = await getOrder(String(activeOrderId), String(rid));
          if (raw && isOrderActive(raw)) setCurrentOrder(normalizeApiOrder(raw));
        } catch {}
      }

      return data;
    } catch (err) {
      console.error('initSession error:', err);
      throw err;
    }
  }

  /**
   * Restaurant-picker flow: client chose a restaurant without scanning a QR.
   * Stores the restaurant's publicId (e.g. "BR5CH3OK") and optional display
   * name; clears any leftover table session so the menu loads in browse mode.
   */
  /**
   * @param {string} id                      Restaurant publicId
   * @param {string} [name]                  Display name
   * @param {{ defaultLanguage?: string, enabledLanguages?: string[] }} [meta]
   *   Language metadata from the restaurant object (uses backend API codes).
   */
  function selectRestaurant(id, name = '', meta = {}) {
    if (!id) {
      console.warn('selectRestaurant called with falsy id — ignoring');
      return;
    }
    // Clear any stale table session — we're just browsing, not at a table
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('tableId');
    localStorage.removeItem('tableNumber');
    localStorage.setItem('restaurantId', String(id));
    if (name) localStorage.setItem('restaurantName', name);
    localStorage.removeItem('restaurantPlan');
    setSessionToken(null);
    setTableId(null);
    setTableNumber('');
    setRestaurantId(String(id));
    setRestaurantName(name);
    if (meta?.plan) { setRestaurantPlan(meta.plan); localStorage.setItem('restaurantPlan', meta.plan); }
    // Store language metadata when available (including nameEn if provided)
    setRestaurantMeta(meta);
    // Clear any cart items that belonged to a previously selected restaurant
    setCart([]);
    setServingGroups([DEFAULT_MAIN_GROUP]);
    localStorage.removeItem('cartState');
  }

  // ─── cart ─────────────────────────────────────────────────────────────────

  // cartItem shape: { cartItemId, id, name, name_en, price, image,
  //   quantity, groupId,
  //   excludedIngredients: [ingredientId],
  //   selectedAddons: [addonId],
  //   componentGroupSelections: { [groupId]: optionId },
  //   comment: '' }

  function addToCart(dish, options = {}) {
    const {
      excludedIngredients      = [],
      selectedAddons           = [],
      componentGroupSelections = {},
      comment                  = '',
      groupId                  = DEFAULT_GROUP_ID,
    } = options;

    const addonPrice = (dish.addons || [])
      .filter(a => selectedAddons.includes(a.id))
      .reduce((s, a) => s + a.price, 0);

    const groupPrice = Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
      const group = (dish.componentGroups || []).find(g => g.id === gid);
      if (!group) return s;
      const opt = group.options.find(o => o.id === optId);
      return s + (opt ? opt.priceModifier : 0);
    }, 0);

    const unitPrice = dish.price + addonPrice + groupPrice;

    setCart(prev => {
      const cartItemId = `${dish.id}-${Date.now()}-${Math.random()}`;
      return [...prev, {
        cartItemId,
        id:   dish.id,
        name: dish.name,
        name_en: dish.name_en,
        price: unitPrice,
        image: dish.image,
        quantity: 1,
        groupId,
        excludedIngredients,
        selectedAddons,
        componentGroupSelections,
        comment,
      }];
    });
  }

  function updateCartItem(cartItemId, dish, options = {}) {
    const {
      excludedIngredients      = [],
      selectedAddons           = [],
      componentGroupSelections = {},
      comment                  = '',
    } = options;

    const addonPrice = (dish.addons || [])
      .filter(a => selectedAddons.includes(a.id))
      .reduce((s, a) => s + a.price, 0);

    const groupPrice = Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
      const group = (dish.componentGroups || []).find(g => g.id === gid);
      if (!group) return s;
      const opt = group.options.find(o => o.id === optId);
      return s + (opt ? opt.priceModifier : 0);
    }, 0);

    const unitPrice = dish.price + addonPrice + groupPrice;

    setCart(prev => prev.map(item =>
      item.cartItemId !== cartItemId ? item : {
        ...item,
        price: unitPrice,
        excludedIngredients,
        selectedAddons,
        componentGroupSelections,
        comment,
      }
    ));
  }

  function removeFromCart(cartItemId) {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  }

  // Replaces the entire cart with a pre-computed adjusted array.
  // Used by ConfirmOrder change detection to apply auto-fixes in one shot.
  function replaceCart(items) {
    setCart(items);
  }

  function updateQuantity(cartItemId, delta) {
    setCart(prev =>
      prev
        .map(item => item.cartItemId === cartItemId
          ? { ...item, quantity: item.quantity + delta }
          : item
        )
        .filter(item => item.quantity > 0)
    );
  }

  function duplicateCartItem(cartItemId) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.cartItemId === cartItemId);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...original,
        cartItemId: `${original.id}-${Date.now()}-${Math.random()}`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }

  function updateItemComment(cartItemId, comment) {
    setCart(prev => prev.map(item =>
      item.cartItemId === cartItemId ? { ...item, comment } : item
    ));
  }

  function moveToGroup(cartItemId, groupId) {
    setCart(prev => prev.map(item =>
      item.cartItemId === cartItemId ? { ...item, groupId } : item
    ));
  }

  function clearCart() {
    setCart([]);
    setServingGroups([DEFAULT_MAIN_GROUP]);
    localStorage.removeItem('cartState');
  }

  // ─── serving groups ───────────────────────────────────────────────────────

  function addServingGroup() {
    const id = `group-${Date.now()}`;
    // Count existing non-main groups to produce a stable auto-increment index.
    // Using a callback to read the latest state.
    setServingGroups(prev => {
      const genericIndex = prev.filter(g => g.id !== DEFAULT_GROUP_ID).length + 1;
      return [...prev, { id, isGeneric: true, genericIndex }];
    });
    return id;
  }

  function removeServingGroup(groupId) {
    if (groupId === DEFAULT_GROUP_ID) return;
    setServingGroups(prev => prev.filter(g => g.id !== groupId));
    setCart(prev => prev.map(item =>
      item.groupId === groupId ? { ...item, groupId: DEFAULT_GROUP_ID } : item
    ));
  }

  function renameServingGroup(groupId, name) {
    // User explicitly chose a name — store it literally in both fields and
    // clear the generic flag so the name no longer tracks language changes.
    setServingGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, isGeneric: false, name, name_en: name }
        : g
    ));
  }

  // ─── order history ────────────────────────────────────────────────────────

  const addOrderToHistory = (newOrder) => {
    setOrderHistory(prev => {
      const next = [newOrder, ...prev].slice(0, 50); // keep last 50
      try { localStorage.setItem('orderHistory', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ─── editing an existing order (guest adds dishes) ───────────────────────

  function startEditingOrder(order) {
    setEditingOrder(order);
    // Preserve the existing cart — items the user already added should be
    // submitted to the active order, not discarded.
    setOrderComment('');

    // Restore table + restaurant context so canOrder passes and new items can be submitted
    if (order.tableId) {
      setTableId(order.tableId);
      localStorage.setItem('tableId', String(order.tableId));
    }
    if (order.tableNumber != null) {
      setTableNumber(String(order.tableNumber));
      localStorage.setItem('tableNumber', String(order.tableNumber));
    }
    if (order.restaurantId) {
      setRestaurantId(order.restaurantId);
      localStorage.setItem('restaurantId', order.restaurantId);
      // Fetch restaurant display name if not already cached for this restaurant
      const cachedName = localStorage.getItem('restaurantName');
      if (!cachedName) {
        getRestaurantInfo(order.restaurantId).then(info => {
          if (info?.name) {
            setRestaurantName(info.name);
            localStorage.setItem('restaurantName', info.name);
          }
          if (info?.name_en) {
            setRestaurantName_en(info.name_en);
            localStorage.setItem('restaurantName_en', info.name_en);
          }
        }).catch(() => {});
      }
    }
  }

  function cancelEditingOrder() {
    setEditingOrder(null);
    setCart([]);
    setServingGroups([DEFAULT_MAIN_GROUP]);
    localStorage.removeItem('cartState');
  }

  // ─── submit order ─────────────────────────────────────────────────────────
  //
  // Payload shape required by POST /orders:
  //   {
  //     tableId,
  //     sessionToken,
  //     servingGroups: [{ name, sortOrder }],
  //     items: [{
  //       menuItemId,
  //       qty,
  //       servingGroupId, // matches servingGroups[].name
  //       excludedIngredients,
  //       addons: [{ addOnId, quantity }],
  //       componentGroupChoices: [{ groupId, optionId }],
  //       comment,
  //     }]
  //   }
  //
  // After success the function normalises the response, sets currentOrder, and
  // persists orderId to localStorage — so the FAB appears immediately.

  async function submitOrder() {
    const currentTableId      = tableId      || localStorage.getItem('tableId');
    const currentSessionToken = sessionToken || localStorage.getItem('sessionToken');

    // ── Add dishes to an existing order ────────────────────────────────────
    // Prefer the explicit editing target; if it's been lost (e.g. page reload
    // on /confirm-order), fall back to currentOrder when it's still active.
    // Without this, submitOrder would try to createOrder for a table that
    // already has an active order and crash with 400 / 409.
    const ACTIVE_STATUSES = new Set(['open', 'open_paid']);
    const addToOrder = editingOrder
      || (currentOrder && ACTIVE_STATUSES.has(currentOrder.status) ? currentOrder : null);

    if (addToOrder) {
      const apiItems = cart.map(item => {
        const groupChoices = Object.entries(item.componentGroupSelections || {}).map(([groupId, optionId]) => ({ groupId, optionId }));
        return {
          menuItemId: item.id,
          qty: item.quantity,
          expectedUnitPrice: item.price,
          excludedIngredients: (item.excludedIngredients || []).map(i => typeof i === 'object' ? i.id : i),
          addons: (item.selectedAddons || []).map(a => ({ addOnId: typeof a === 'object' ? a.id : a, quantity: 1 })),
          componentGroupChoices: groupChoices,
          comment: item.comment || '',
        };
      });

      try {
        await addGuestOrderItems(addToOrder.id, apiItems, currentSessionToken);
        const fresh = await getOrder(addToOrder.id);
        const normalized = fresh ? normalizeApiOrder(fresh) : null;
        if (normalized) {
          normalized.restaurantId      = restaurantId      || normalized.restaurantId || null;
          normalized.restaurantName    = restaurantName    || '';
          normalized.restaurantName_en = restaurantName_en || '';
          setCurrentOrder(normalized);
        }
        setEditingOrder(null);
        clearCart();
        return normalized;
      } catch (err) {
        console.error('addGuestOrderItems error:', err);
        throw err;
      }
    }

    // Build named serving groups (default/main group is implicit on backend)
    const servingGroupNameById = {};
    const apiServingGroups = [];
    let sortOrder = 1;
    for (const g of servingGroups) {
      if (!g || g.id === DEFAULT_GROUP_ID) continue;
      const name = g.isGeneric
        ? `Serving group ${g.genericIndex}`
        : (g.name || `Serving group ${g.genericIndex || sortOrder}`);
      servingGroupNameById[g.id] = name;
      apiServingGroups.push({ name, sortOrder: sortOrder++ });
    }

    // Flatten cart items for the new order API
    const apiItems = cart.map(item => {
      const groupChoices = Object.entries(item.componentGroupSelections || {}).map(([groupId, optionId]) => ({
        groupId,
        optionId,
      }));
      return {
        menuItemId: item.id,
        qty: item.quantity,
        expectedUnitPrice: item.price,
        servingGroupId: item.groupId && item.groupId !== DEFAULT_GROUP_ID
          ? servingGroupNameById[item.groupId]
          : undefined,
        excludedIngredients: (item.excludedIngredients || []).map(i =>
          typeof i === 'object' ? i.id : i
        ),
        addons: (item.selectedAddons || []).map(a => ({
          addOnId:  typeof a === 'object' ? a.id : a,
          quantity: 1,
        })),
        componentGroupChoices: groupChoices,
        comment: item.comment || '',
      };
    });

    const payload = {
      tableId:      currentTableId,
      sessionToken: currentSessionToken,
      servingGroups: apiServingGroups,
      items: apiItems,
    };

    // ── Offline path ───────────────────────────────────────────────────────
    // navigator.onLine is the only platform-level signal; it can return false
    // positives on captive portals but that's acceptable here — the queue is
    // resilient to immediate online retries.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueOrder({ restaurantId, payload });
      clearCart();
      // Returning null tells the caller "no normalized order yet" — the order
      // will appear via the WS flow once the queue flushes on reconnect.
      return null;
    }

    try {
      const result = await createOrder(payload, restaurantId);
      // result shape: { order, servingGroups, items }
      const orderId = result?.order?._id || result?.order?.id || result?._id || result?.id;
      if (orderId) localStorage.setItem('orderId', String(orderId));

      const normalized = normalizeApiOrder(result);
      // Enrich with restaurant display names — not available in the API response
      if (normalized) {
        normalized.restaurantId       = restaurantId       || normalized.restaurantId || null;
        normalized.restaurantName     = restaurantName     || '';
        normalized.restaurantName_en  = restaurantName_en  || '';
      }
      setCurrentOrder(normalized);
      setTableHasActiveOrder(false); // we placed the order — table is ours now
      clearCart();
      return normalized;
    } catch (err) {
      // Network-level failure (axios with no response) — queue the order so
      // the user doesn't lose work just because the request died in flight.
      if (!err?.response) {
        enqueueOrder({ restaurantId, payload });
        clearCart();
        return null;
      }
      console.error('submitOrder error:', err);
      throw err;
    }
  }

  // ── Offline queue auto-flush ───────────────────────────────────────────────
  // When the browser reports we're back online, drain the queue one entry at a
  // time. We deliberately POST sequentially (not in parallel) so the server
  // never sees duplicate-table races for the same offline-submitted order.
  const flushingRef = useRef(false);
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const items = readQueue();
    if (!items.length) return;
    flushingRef.current = true;
    try {
      for (const entry of items) {
        try {
          const result = await createOrder(entry.payload, entry.restaurantId);
          const orderId = result?.order?._id || result?.order?.id || result?._id || result?.id;
          if (orderId) localStorage.setItem('orderId', String(orderId));
          const normalized = normalizeApiOrder(result);
          if (normalized) {
            normalized.restaurantId      = entry.restaurantId || normalized.restaurantId || null;
            normalized.restaurantName    = restaurantName     || '';
            normalized.restaurantName_en = restaurantName_en  || '';
            setCurrentOrder(normalized);
            setTableHasActiveOrder(false);
          }
          dequeueOrder(entry.id);
        } catch (err) {
          // If this entry fails with a server error (4xx/5xx), drop it — the
          // payload is bad and retrying won't help. If it's a network failure,
          // bail out of the whole flush and try again on the next `online`
          // event.
          if (err?.response) {
            console.warn('[offline-queue] dropping bad entry', entry.id, err.response.status);
            dequeueOrder(entry.id);
            continue;
          }
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [restaurantName, restaurantName_en]);

  useEffect(() => {
    // Try once on mount (a tab opened back up after the user closed it while
    // offline might already be online).
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  // ─── derived ──────────────────────────────────────────────────────────────

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppContext.Provider value={{
      cart, addToCart, updateCartItem, removeFromCart, updateQuantity, duplicateCartItem, updateItemComment, clearCart, moveToGroup, replaceCart,
      cartTotal, cartCount,
      tableNumber,
      sessionToken, tableId, restaurantId, restaurantName, restaurantName_en, restaurantPlan,
      tableHasActiveOrder, setTableHasActiveOrder,
      restoringOrder,
      restaurantLangs, restaurantDefaultLang, setRestaurantMeta,
      initSession, selectRestaurant,
      submitOrder,
      currentOrder, setCurrentOrder,
      orderHistory, addOrderToHistory,
      orderComment, setOrderComment,
      editingOrder, startEditingOrder, cancelEditingOrder,
      servingGroups, addServingGroup, removeServingGroup, renameServingGroup,
      wsStatus, wsLatency, wsSubscribe, addWsListener, removeWsListener,
      notifications, unreadCount, markAllRead, refreshNotifications,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

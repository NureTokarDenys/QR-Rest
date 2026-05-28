import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import {
  getTables,
  getCategories,
  getMenuItems,
  getStaff,
  getRestaurant,
  getExtras,
  getLiqpayStatus,
} from '../api/admin';
import { getKitchenOrders } from '../api/kitchen';

const StaffDataContext = createContext(null);

const STAFF_ROLES = new Set(['admin', 'root_admin', 'waiter', 'cook', 'waiter_cook']);

/**
 * Resource → which WS events should trigger a refresh.
 * Only resources that have been requested at least once get refreshed.
 */
const INVALIDATION_MAP = {
  tables: new Set([
    'TABLE_CREATED', 'TABLE_UPDATED', 'TABLE_DELETED', 'TABLES_REORDERED',
    'TABLE_STATUS_UPDATED',
    'ORDER_NEW', 'ORDER_CANCELLED', 'ORDER_COMPLETED',
    'WAITER_CALL', 'WAITER_CALL_CASH', 'WAITER_CALL_RESOLVED',
  ]),
  categories: new Set(['MENU_UPDATED']),
  menuItems:  new Set(['MENU_UPDATED']),
  staff:      new Set(['STAFF_CREATED', 'STAFF_UPDATED']),
  restaurant: new Set(['RESTAURANT_UPDATED']),
  extras:     new Set(['EXTRAS_UPDATED']),
  liqpay:     new Set(['RESTAURANT_UPDATED']),
  kitchenOrders: new Set([
    'ORDER_NEW', 'ORDER_UPDATED', 'ORDER_VOID', 'ORDER_CANCELLED',
    'ORDER_ITEMS_ADDED', 'ORDER_COMPLETED', 'PAYMENT_COMPLETED',
  ]),
};

export function StaffDataProvider({ children }) {
  const { user, accessToken } = useAuth();
  const { addWsListener, removeWsListener } = useApp();

  const isStaff = STAFF_ROLES.has(user?.role);

  const [tables,         setTables]         = useState(null);
  const [categories,     setCategories]     = useState(null);
  const [menuItems,      setMenuItems]      = useState(null);
  const [staff,          setStaff]          = useState(null);
  const [restaurant,     setRestaurant]     = useState(null);
  const [extras,         setExtras]         = useState(null);
  const [liqpay,         setLiqpay]         = useState(null);
  const [kitchenOrders,  setKitchenOrders]  = useState(null);

  // Tracks which resources have been requested (= will be kept fresh via WS).
  // Resources are loaded LAZILY on first call to the corresponding ensure*()
  // function — typically from a page's mount effect.
  const requestedRef = useRef(new Set());
  // In-flight promise per resource so a burst of ensure() / refresh() calls
  // coalesces into a single network round-trip.
  const inflightRef = useRef({});

  function makeRefresher(key, fetcher, setter) {
    return async () => {
      if (inflightRef.current[key]) {
        // Another fetch is running; schedule one more after it completes so
        // WS events that arrive mid-flight are never silently dropped.
        inflightRef.current[`${key}:queued`] = true;
        return inflightRef.current[key];
      }
      const run = async () => {
        try {
          const data = await fetcher();
          setter(data);
        } catch (err) {
          console.warn(`[StaffData] refresh ${key} failed:`, err?.message);
        } finally {
          inflightRef.current[key] = null;
          if (inflightRef.current[`${key}:queued`]) {
            inflightRef.current[`${key}:queued`] = false;
            inflightRef.current[key] = run();
          }
        }
      };
      inflightRef.current[key] = run();
      return inflightRef.current[key];
    };
  }

  const refreshTables        = useCallback(makeRefresher('tables',     getTables,     setTables),     []);
  const refreshCategories    = useCallback(makeRefresher('categories', getCategories, setCategories), []);
  const refreshMenuItems     = useCallback(makeRefresher('menuItems',  () => getMenuItems(), setMenuItems), []);
  const refreshStaff         = useCallback(makeRefresher('staff',      () => getStaff({ limit: 100 }).then(r => Array.isArray(r) ? r : r?.data || []), setStaff), []);
  const refreshRestaurant    = useCallback(makeRefresher('restaurant', getRestaurant, setRestaurant), []);
  const refreshExtras        = useCallback(makeRefresher('extras',     getExtras,     setExtras),     []);
  const refreshLiqpay        = useCallback(makeRefresher('liqpay',     getLiqpayStatus, setLiqpay),   []);
  const refreshKitchenOrders = useCallback(makeRefresher('kitchenOrders', () => getKitchenOrders('order'), setKitchenOrders), []);

  // ── Lazy-load helpers ─────────────────────────────────────────────────────
  // ensure*() = fetch only if this resource has never been requested in the
  // current session. Once requested, the resource is kept fresh by WS events
  // forever (until logout clears the cache).
  function makeEnsure(key, refresher) {
    return () => {
      if (requestedRef.current.has(key)) return;
      requestedRef.current.add(key);
      refresher();
    };
  }
  const ensureTables        = useCallback(makeEnsure('tables',        refreshTables),        [refreshTables]);
  const ensureCategories    = useCallback(makeEnsure('categories',    refreshCategories),    [refreshCategories]);
  const ensureMenuItems     = useCallback(makeEnsure('menuItems',     refreshMenuItems),     [refreshMenuItems]);
  const ensureStaff         = useCallback(makeEnsure('staff',         refreshStaff),         [refreshStaff]);
  const ensureRestaurant    = useCallback(makeEnsure('restaurant',    refreshRestaurant),    [refreshRestaurant]);
  const ensureExtras        = useCallback(makeEnsure('extras',        refreshExtras),        [refreshExtras]);
  const ensureLiqpay        = useCallback(makeEnsure('liqpay',        refreshLiqpay),        [refreshLiqpay]);
  const ensureKitchenOrders = useCallback(makeEnsure('kitchenOrders', refreshKitchenOrders), [refreshKitchenOrders]);

  // ── Session lifecycle: only the restaurant document loads eagerly, because
  // PlanContext + the sidebar need `restaurant.plan` to decide locked nav items.
  // Everything else loads when the user visits the corresponding page.
  const userId = user?.id;
  useEffect(() => {
    // Always clear the stale cache: covers both logout and account-switch
    // (dev toolbar or same-tab re-login to a different staff account).
    setTables(null); setCategories(null); setMenuItems(null);
    setStaff(null);  setRestaurant(null); setExtras(null); setLiqpay(null);
    setKitchenOrders(null);
    requestedRef.current.clear();
    if (!isStaff || !accessToken) return;
    ensureRestaurant();
  }, [isStaff, accessToken, userId, ensureRestaurant]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WS-driven invalidation: only refresh resources that have been requested.
  useEffect(() => {
    if (!isStaff) return;
    const handler = (msg) => {
      const ev = msg?.event;
      if (!ev) return;
      if (requestedRef.current.has('tables')         && INVALIDATION_MAP.tables.has(ev))         refreshTables();
      if (requestedRef.current.has('categories')     && INVALIDATION_MAP.categories.has(ev))     refreshCategories();
      if (requestedRef.current.has('menuItems')      && INVALIDATION_MAP.menuItems.has(ev))      refreshMenuItems();
      if (requestedRef.current.has('staff')          && INVALIDATION_MAP.staff.has(ev))          refreshStaff();
      if (requestedRef.current.has('restaurant')     && INVALIDATION_MAP.restaurant.has(ev))     refreshRestaurant();
      if (requestedRef.current.has('extras')         && INVALIDATION_MAP.extras.has(ev))         refreshExtras();
      if (requestedRef.current.has('liqpay')         && INVALIDATION_MAP.liqpay.has(ev))         refreshLiqpay();
      if (requestedRef.current.has('kitchenOrders')  && INVALIDATION_MAP.kitchenOrders.has(ev))  refreshKitchenOrders();
    };
    addWsListener(handler);
    return () => removeWsListener(handler);
  }, [isStaff, addWsListener, removeWsListener, refreshTables, refreshCategories, refreshMenuItems, refreshStaff, refreshRestaurant, refreshExtras, refreshLiqpay, refreshKitchenOrders]);

  const value = {
    // Data
    tables, categories, menuItems, staff, restaurant, extras, liqpay, kitchenOrders, setKitchenOrders,
    // Lazy loaders — call from a page's mount effect
    ensureTables, ensureCategories, ensureMenuItems, ensureStaff, ensureRestaurant, ensureExtras, ensureLiqpay, ensureKitchenOrders,
    // Force refresh — call after a mutation to bypass the request gate
    refreshTables, refreshCategories, refreshMenuItems, refreshStaff, refreshRestaurant, refreshExtras, refreshLiqpay, refreshKitchenOrders,
  };

  return (
    <StaffDataContext.Provider value={value}>
      {children}
    </StaffDataContext.Provider>
  );
}

export function useStaffData() {
  const ctx = useContext(StaffDataContext);
  if (!ctx) throw new Error('useStaffData must be used inside <StaffDataProvider>');
  return ctx;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { scanQR } from '../api/qr';
import { createOrder, getOrder } from '../api/orders';
import { useAuth } from './AuthContext';
import { SUPPORTED_LANGS, SOURCE_LANG, fromApiLang } from '../i18n/langs';

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
function normalizeApiOrder(raw) {
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
      id:       dish._id  || dish.id  || (typeof item.menuItemId === 'string' ? item.menuItemId : '') || item._id,
      name:     dish.name || item.name || '',
      name_en:  dish.name_en || item.name_en || dish.name || '',
      price:    dish.basePrice ?? dish.price ?? item.price ?? 0,
      image:    dish.imageUrl  || dish.image  || item.image || '',
      quantity: item.quantity ?? item.qty ?? 1,
      groupId:  item.servingGroupId || 'main',
      // Domain model field is `dishStatus`; fall back to `status` for local mock orders
      status:   item.dishStatus || item.status || 'waiting',
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

  return {
    id:           orderData._id || orderData.id,
    publicId:     orderData.publicId || null,   // human-readable order number e.g. "K4X9B2MR"
    tableNumber:  orderData.tableNumber ?? orderData.table?.number,
    servingGroups,
    items,
    total:  orderData.totalAmount ?? orderData.total ?? 0,
    status: orderData.status,
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
    'completed', 'void', 'voided', 'cancelled', 'paid', 'closed', 'rejected',
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

  const [orderHistory, setOrderHistory]   = useState([]);

  // Hydrate cart + serving groups from localStorage on first render.
  // If the stored entry belongs to a different restaurant it is discarded.
  const [cart, setCart] = useState(() => {
    const saved = loadCartState();
    return saved?.items?.length ? saved.items : [];
  });

  const [currentOrder, setCurrentOrder]   = useState(null);
  const [orderComment, setOrderComment]   = useState('');

  const [servingGroups, setServingGroups] = useState(() => {
    const saved = loadCartState();
    return saved?.groups?.length ? saved.groups : [DEFAULT_MAIN_GROUP];
  });

  // Session / table state (read from localStorage, kept in sync)
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('sessionToken'));
  const [tableId, setTableId]           = useState(() => localStorage.getItem('tableId'));
  const [tableNumber, setTableNumber]   = useState(
    () => localStorage.getItem('tableNumber') || ''
  );
  const [restaurantId, setRestaurantId] = useState(() => localStorage.getItem('restaurantId'));
  // restaurantName holds the source-language (ua) display name.
  // Additional variants are stored as restaurantName_<langCode>, e.g. restaurantName_en.
  const [restaurantName, setRestaurantName] = useState(() => localStorage.getItem('restaurantName') || '');
  const [restaurantName_en, setRestaurantName_en] = useState(() => localStorage.getItem('restaurantName_en') || '');

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
  useEffect(() => {
    if (!accessToken) {
      setCurrentOrder(null);
      localStorage.removeItem('orderId');
      return;
    }

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
              if (!cancelled) setCurrentOrder(savedOrder);
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

      // Strategy 2 (scan /user/orders) was removed.
      // It caused "ghost orders" — after clearing browser data the strategy
      // would re-discover any non-terminal order from history and silently
      // re-write orderId to localStorage, making the order reappear.
      // orderId is written to localStorage by submitOrder() at checkout time,
      // so Strategy 1 is sufficient for all normal re-visit flows.

      if (cancelled) return;

      if (raw && isOrderActive(raw)) {
        setCurrentOrder(normalizeApiOrder(raw));
        const id = raw.order?._id || raw.order?.id || raw._id || raw.id;
        if (id) localStorage.setItem('orderId', String(id));
      }
      // If nothing found, leave currentOrder as-is —
      // it may have been set by submitOrder() in this session already.
    }

    restore();
    return () => { cancelled = true; };
  }, [accessToken, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Language meta (may be nested under restaurant object or at top level)
        restaurant:   restaurantObj,
        defaultLanguage,
        enabledLanguages,
      } = data;
      localStorage.setItem('sessionToken',   st);
      localStorage.setItem('tableId',        String(tid));
      localStorage.setItem('tableNumber',    String(tn));
      localStorage.setItem('restaurantId',   String(rid));   // publicId
      if (rname) localStorage.setItem('restaurantName', rname);
      setSessionToken(st);
      setTableId(String(tid));
      setTableNumber(String(tn));
      setRestaurantId(String(rid));
      if (rname) setRestaurantName(rname);
      // Extract language meta from QR response (may be top-level or in restaurant sub-object)
      const meta = restaurantObj || {};
      setRestaurantMeta({
        defaultLanguage:  defaultLanguage  || meta.defaultLanguage,
        enabledLanguages: enabledLanguages || meta.enabledLanguages,
      });
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
    setSessionToken(null);
    setTableId(null);
    setTableNumber('');
    setRestaurantId(String(id));
    setRestaurantName(name);
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
    setOrderHistory(prev => [newOrder, ...prev]);
  };

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

    try {
      const result = await createOrder(payload, restaurantId);
      // result shape: { order, servingGroups, items }
      const orderId = result?.order?._id || result?.order?.id || result?._id || result?.id;
      if (orderId) localStorage.setItem('orderId', String(orderId));

      const normalized = normalizeApiOrder(result);
      setCurrentOrder(normalized);
      clearCart();
      return normalized;
    } catch (err) {
      console.error('submitOrder error:', err);
      throw err;
    }
  }

  // ─── derived ──────────────────────────────────────────────────────────────

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppContext.Provider value={{
      cart, addToCart, updateCartItem, removeFromCart, updateQuantity, clearCart, moveToGroup,
      cartTotal, cartCount,
      tableNumber,
      sessionToken, tableId, restaurantId, restaurantName, restaurantName_en,
      restaurantLangs, restaurantDefaultLang, setRestaurantMeta,
      initSession, selectRestaurant,
      submitOrder,
      currentOrder, setCurrentOrder,
      orderHistory, addOrderToHistory,
      orderComment, setOrderComment,
      servingGroups, addServingGroup, removeServingGroup, renameServingGroup,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getMenu, getDishDetail } from '../api/menu';
import { useApp } from './AppContext';

const MenuContext = createContext(null);

const MENU_KEY      = 'menuCache_v1';
const DISH_KEY      = 'menuDishCache_v1';
const MENU_STALE_MS = 5 * 60 * 1000;
const DISH_STALE_MS = 3 * 60 * 1000;
const PREFETCH_CONCURRENCY = 4;

// ── Menu cache (categories + items list) ───────────────────────────────────

function readCache(restaurantId, lang) {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.restaurantId !== restaurantId || c.lang !== lang) return null;
    if (Date.now() - c.at > MENU_STALE_MS) return null;
    return c.categories;
  } catch { return null; }
}

/** Stale-cache read — ignores TTL. Used as an offline fallback when the
 *  network fetch fails, so the user can still browse the last-seen menu. */
function readStaleCache(restaurantId, lang) {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.restaurantId !== restaurantId || c.lang !== lang) return null;
    return c.categories;
  } catch { return null; }
}

function writeCache(restaurantId, lang, categories) {
  try {
    localStorage.setItem(MENU_KEY, JSON.stringify({
      restaurantId, lang, categories, at: Date.now(),
    }));
  } catch {}
}

// ── Per-dish cache (full ingredients/addons/componentGroups) ───────────────
// Layout: { restaurantId, lang, dishes: { [dishId]: { data, at } } }
// Persisted so dish details remain available offline even after a browser
// restart. Keyed by (restaurantId, lang) so a language switch invalidates.

function readDishStore(restaurantId, lang) {
  try {
    const raw = localStorage.getItem(DISH_KEY);
    if (!raw) return { dishes: {} };
    const c = JSON.parse(raw);
    if (c.restaurantId !== restaurantId || c.lang !== lang) return { dishes: {} };
    return { dishes: c.dishes || {} };
  } catch { return { dishes: {} }; }
}

function writeDishStore(restaurantId, lang, dishes) {
  try {
    localStorage.setItem(DISH_KEY, JSON.stringify({ restaurantId, lang, dishes }));
  } catch { /* quota — drop silently, in-memory cache still works */ }
}

function flatItemIds(categories) {
  const ids = [];
  for (const c of categories || []) {
    for (const it of c.items || []) {
      const id = it._id || it.id;
      if (id) ids.push(String(id));
    }
  }
  return ids;
}

// Small concurrency-limited runner so prefetching 50+ dishes doesn't open 50
// parallel sockets. Resolves once every task settles (success or failure).
async function runPool(tasks, limit) {
  const queue = tasks.slice();
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const t = queue.shift();
      try { await t(); } catch { /* per-task errors are non-fatal */ }
    }
  });
  await Promise.all(workers);
}

export function MenuProvider({ children }) {
  const { restaurantId, setRestaurantMeta } = useApp();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // In-memory dish cache — hydrated from localStorage on (restaurantId, lang)
  // change so a fresh tab open doesn't need to hit the network for already-
  // seen dishes.
  const dishCacheRef = useRef(new Map());

  // Track whether we've kicked off a prefetch pass for the current
  // (restaurantId, lang) so we don't re-fire on every render.
  const prefetchedKeyRef = useRef(null);

  // Persist the in-memory cache to localStorage on a debounced schedule so
  // bursts of updates (e.g. after a prefetch pass) collapse into one write.
  const persistTimerRef = useRef(null);
  const schedulePersist = useCallback(() => {
    if (!restaurantId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const dishes = {};
      for (const [id, entry] of dishCacheRef.current.entries()) {
        dishes[id] = entry;
      }
      writeDishStore(restaurantId, lang, dishes);
    }, 250);
  }, [restaurantId, lang]);

  function cacheDish(id, data) {
    dishCacheRef.current.set(String(id), { data, at: Date.now() });
    schedulePersist();
  }

  // ── Menu fetch + prefetch all dish details ───────────────────────────────
  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    // Hydrate the in-memory dish cache from the persistent store so dish
    // detail pages render instantly (and work offline) from the start.
    dishCacheRef.current.clear();
    const stored = readDishStore(restaurantId, lang);
    for (const [id, entry] of Object.entries(stored.dishes)) {
      dishCacheRef.current.set(id, entry);
    }

    const cached = readCache(restaurantId, lang);
    if (cached) {
      setCategories(cached);
      setLoading(false);
      maybePrefetchDishes(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMenu(restaurantId)
      .then(data => {
        if (cancelled) return;
        let cats = [];
        if (Array.isArray(data)) {
          cats = data;
        } else if (data?.categories) {
          cats = data.categories;
          if (data.restaurant) {
            setRestaurantMeta({
              name:             data.restaurant.name,
              nameLang:         lang,
              defaultLanguage:  data.restaurant.defaultLanguage,
              enabledLanguages: data.restaurant.enabledLanguages,
            });
          }
        }
        setCategories(cats);
        writeCache(restaurantId, lang, cats);
        maybePrefetchDishes(cats);
      })
      .catch(err => {
        if (cancelled) return;
        // Offline fallback: serve the stale cache so the user can keep
        // browsing the last-seen menu. Only surface the error if we have
        // nothing cached at all.
        const stale = readStaleCache(restaurantId, lang);
        if (stale) setCategories(stale);
        else       setError(err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, lang]);

  // Background prefetch: fetch every dish detail in (restaurantId, lang) and
  // hydrate both the in-memory map and the persistent localStorage store. This
  // is what makes the dish detail page work offline — the lightweight `/menu`
  // payload doesn't include ingredients/addons/componentGroups.
  function maybePrefetchDishes(cats) {
    if (!restaurantId) return;
    const key = `${restaurantId}:${lang}`;
    if (prefetchedKeyRef.current === key) return;
    prefetchedKeyRef.current = key;

    // Skip prefetch when offline — the SW would just return errors and we
    // can rely on whatever's already in the persistent store.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const ids = flatItemIds(cats);
    const now = Date.now();
    const stale = ids.filter(id => {
      const hit = dishCacheRef.current.get(id);
      return !hit || (now - hit.at) > DISH_STALE_MS;
    });
    if (!stale.length) return;

    const tasks = stale.map(id => async () => {
      try {
        const data = await getDishDetail(id);
        if (data) cacheDish(id, data);
      } catch { /* per-dish failure is non-fatal */ }
    });
    runPool(tasks, PREFETCH_CONCURRENCY);
  }

  // Re-attempt prefetch when the connection comes back so a user who first
  // opened the menu offline picks up the full details once online.
  useEffect(() => {
    function onOnline() {
      if (categories?.length) {
        // Force a re-run by clearing the gate; the next call evaluates which
        // dishes are still stale and only fetches those.
        prefetchedKeyRef.current = null;
        maybePrefetchDishes(categories);
      }
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Flush any pending persist before unmount so we don't lose the last write.
  useEffect(() => () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      const dishes = {};
      for (const [id, entry] of dishCacheRef.current.entries()) dishes[id] = entry;
      if (restaurantId) writeDishStore(restaurantId, lang, dishes);
    }
  }, [restaurantId, lang]);

  // Returns cached dish or fetches it. Offline: returns whatever is cached
  // (even if stale) instead of throwing — the dish detail page should always
  // render something useful once the menu has been seen at least once.
  const fetchDish = useCallback(async (id) => {
    const key = String(id);
    const hit = dishCacheRef.current.get(key);
    if (hit && Date.now() - hit.at < DISH_STALE_MS) return hit.data;

    try {
      const data = await getDishDetail(id);
      if (data) cacheDish(key, data);
      return data;
    } catch (err) {
      if (hit) return hit.data;       // stale-cache fallback
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force-fetches fresh dish detail from network regardless of cache.
  // Returns { old, fresh } where old is whatever was cached before (may be null).
  // Updates the cache with the fresh data.
  const fetchFreshDish = useCallback(async (id) => {
    const key = String(id);
    const old = dishCacheRef.current.get(key)?.data ?? null;
    const fresh = await getDishDetail(id);
    if (fresh) cacheDish(key, fresh);
    return { old, fresh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forces a network fetch regardless of cache — used by ConfirmOrder to
  // detect price/availability changes before the user submits.
  // Returns the fresh categories array, or null on failure.
  const refresh = useCallback(async () => {
    if (!restaurantId) return null;
    try {
      localStorage.removeItem(MENU_KEY);
      const data = await getMenu(restaurantId);
      const cats = Array.isArray(data) ? data : (data?.categories ?? []);
      setCategories(cats);
      writeCache(restaurantId, lang, cats);
      // Refresh dish details too so the next dish-detail render is fresh.
      prefetchedKeyRef.current = null;
      maybePrefetchDishes(cats);
      return cats;
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, lang]);

  return (
    <MenuContext.Provider value={{ categories, loading, error, fetchDish, fetchFreshDish, refresh }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenuContext() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenuContext must be used within MenuProvider');
  return ctx;
}

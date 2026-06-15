/* Waitless service worker.
 * — Pre-caches the app shell on install.
 * — Cache-first for static assets (JS/CSS/fonts/icons).
 * — Network-first with cache fallback for GET menu requests, so the user can
 *   browse the last-seen menu while offline.
 * — Everything else (mutations, auth, WS) bypasses the SW.
 */

const VERSION       = 'v1';
const SHELL_CACHE   = `waitless-shell-${VERSION}`;
const ASSET_CACHE   = `waitless-assets-${VERSION}`;
const MENU_CACHE    = `waitless-menu-${VERSION}`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![SHELL_CACHE, ASSET_CACHE, MENU_CACHE].includes(k))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Match GET requests against the public menu endpoints: `/api/{restId}/menu`,
// `/api/{restId}/menu/items/...`, `/api/{restId}/menu/search`. We DO NOT cache
// admin/staff variants — those carry tokens and should always be fresh.
function isMenuRequest(url) {
  return url.origin === self.location.origin
      && /^\/api\/[^/]+\/menu(?:\/|$)/.test(url.pathname);
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) {
    // Google Fonts CSS + woff2 — cache them so the app looks right offline.
    return /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host);
  }
  return /\/(assets|favicon)/.test(url.pathname)
      || /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline-no-cache');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

// Navigation requests: serve the cached index so SPA routing works offline.
async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept mutations

  const url = new URL(req.url);

  // WebSocket upgrade is ws://, not http — never goes through fetch handlers,
  // but be defensive against any /ws path lookups.
  if (url.pathname.startsWith('/ws')) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigationFallback(req));
    return;
  }
  if (isMenuRequest(url)) {
    event.respondWith(networkFirst(req, MENU_CACHE));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
  // Default: pass-through. Lets the app's own axios/HttpErrorToast handle
  // failures for API mutations rather than masking them at the SW layer.
});

// Allow the page to force-activate a freshly installed SW (used after a
// deploy notification, if/when we wire one up).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* sw.js - Go Around repeat-visit cache (perf/service-worker, 11 Nov 2026).
   Safe by design:
   - Pages (HTML), /api/*, /admin*, *-data, POSTs, other sites and Range requests are NOT touched: they go to the
     network exactly as without a service worker (visitor beacon, auth, admin and live weather unchanged).
   - Only same-origin .js/.css with ?v=<10 hex> are kept, and only after the downloaded bytes are checked:
     sha256(body) must start with that ?v=. A stale ?v= (old hash, new file) is never kept, so a new deploy can
     never be hidden by this cache. Kept files are served from the cache on the next visit (no network).
   - Update: the browser re-checks this file on every page load (registered with updateViaCache:'none').
     A changed sw.js installs at once (skipWaiting) and deletes old caches; it never changes what a page shows.
   - Kill switch: set KILL = true below and deploy. Every browser then removes this worker and its cache on its
     next visit. Or in a console: localStorage.setItem('wm-sw-off','1') stops registering it on that browser. */
const VERSION = 'ga-sw-1';
const KILL = false;
const MAX = 400; // files kept; oldest dropped first
const SKIP = /^\/(api|admin|admin-x|dashboard-data|sitestatus-data|visitor-log-data)(\/|$|-)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // CacheStorage is shared with every app on this origin. Only clear our own caches.
  try {
    for (const k of await caches.keys()) if (k.startsWith('ga-sw-') && (k !== VERSION || KILL)) await caches.delete(k);
  } catch (x) {} // An unavailable cache must not prevent normal network loading.
  if (KILL) { await self.registration.unregister(); return; }
  await self.clients.claim();
})()));

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function trim(cache) { const keys = await cache.keys(); for (let i = 0; i < keys.length - MAX; i++) await cache.delete(keys[i]); }

// After registering, the page sends the ?v= files it already downloaded (still in the HTTP cache), so the
// very next visit is served from here. Same checks as below: only same-origin .js/.css whose bytes match ?v=.
async function keep(cache, req, res, v) {
  if (!res.ok || res.type !== 'basic') return;
  const body = await res.clone().arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256', body)).slice(0, 10) !== v) return; // stale ?v=: never kept
  await cache.put(req, new Response(body, { status: 200, headers: res.headers }));
}
const want = (u) => { try { const url = new URL(u, self.location.href); const v = url.searchParams.get('v');
  return url.origin === self.location.origin && !SKIP.test(url.pathname) && /\.(js|css)$/.test(url.pathname) && v && /^[0-9a-f]{10}$/.test(v) ? v : null; } catch (x) { return null; } };
self.addEventListener('message', (e) => {
  if (KILL || !e.data || !Array.isArray(e.data.warm)) return;
  e.waitUntil((async () => { const cache = await caches.open(VERSION);
    for (const u of e.data.warm.slice(0, MAX)) { const v = want(u); if (!v) continue; const req = new Request(u);
      if (await cache.match(req, { ignoreVary: true })) continue; try { await keep(cache, req, await fetch(req), v); } catch (x) {} }
    await trim(cache); })());
});

self.addEventListener('fetch', (e) => {
  if (KILL) return;
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const v = want(req.url); if (!v) return;                        // pages, data, images, fonts: browser default
  e.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreVary: true }); if (hit) return hit;
    } catch (x) {} // Storage failures must never turn a working network resource into an error.
    const res = await fetch(req);
    if (cache) e.waitUntil(keep(cache, req, res, v).then(() => trim(cache)).catch(() => {}));
    return res;
  })());
});

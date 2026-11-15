// Perf guard (perf/service-worker, 11 Nov 2026): the repeat-visit cache must be safe.
//  - registered from index.html with a current ?v=; sw.js never touches pages, /api, /admin or other sites;
//  - visit 2 gets the ?v= scripts/styles from the worker (no network), but pages and /api still hit the server;
//  - a file whose ?v= does not match its bytes (stale) is never kept; the kill switch exists.
// Browser part needs puppeteer-core + Chrome; skipped, not failed, without them.
import { readFileSync, existsSync, statSync } from 'node:fs'; import { createHash } from 'node:crypto'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
let fail = 0; const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } else console.log('ok - ' + m); };
const rd = (f) => readFileSync(path.join(site, f), 'utf8'); const h10 = (f) => createHash('sha256').update(readFileSync(path.join(site, f))).digest('hex').slice(0, 10);
const sw = rd('sw.js'), reg = rd('wm-sw.js');
ok(rd('index.html').includes("s.src='/wm-sw.js?v=" + h10('wm-sw.js') + "'"), 'index.html loads wm-sw.js with its current ?v=');
ok(/const KILL = false;/.test(sw) && /registration\.unregister\(\)/.test(sw), 'kill switch present (KILL flag unregisters and clears caches)');
ok(/updateViaCache: 'none'/.test(reg) && /window\.top !== window/.test(reg) && /wm-sw-off/.test(reg), 'registration: top window only, no HTTP cache for sw.js, per-browser off switch');
ok(/digest\('SHA-256'/.test(sw) && /!== v\) return; \/\/ stale/.test(sw), 'worker keeps a file only if its bytes match ?v=');
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let pptr = null; try { pptr = (await import('puppeteer-core')).default; } catch {}
if (!pptr || !existsSync(chrome)) console.log('service-worker: browser part skipped (no puppeteer-core/Chrome)');
else {
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
  let hits = [];
  const srv = http.createServer((q, r) => { hits.push(q.url); let u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/api/')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{}'); } if (u.endsWith('/')) u += 'index.html'; let f = path.join(site, u); if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    if (!f.startsWith(site) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(readFileSync(f)); });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await pptr.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setRequestInterception(true); p.on('request', (q) => { const u = q.url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) q.continue(); else q.abort(); });
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 6000));
  const n1 = hits.filter((u) => /\.(js|css)\?v=[0-9a-f]{10}$/.test(u)).length;
  hits = [];
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 }); await new Promise((r) => setTimeout(r, 6000));
  const v2 = hits.filter((u) => /\.(js|css)\?v=[0-9a-f]{10}$/.test(u));
  const fresh = v2.filter((u) => { const [pth, v] = u.split('?v='); const f = path.join(site, decodeURIComponent(pth)); return existsSync(f) && h10(path.relative(site, f)) === v; });
  ok(n1 > 20, 'visit 1 downloaded ' + n1 + ' ?v= files');
  ok(fresh.length <= 2, 'visit 2: current-?v= files from the worker, not the network (' + fresh.length + ' still fetched: ' + fresh.slice(0, 5).join(' ') + ')');
  ok(hits.some((u) => u === '/' || u.startsWith('/index.html')) && hits.some((u) => u.startsWith('/main.html')), 'visit 2: pages still come from the server');
  ok(hits.some((u) => u.startsWith('/api/')), 'visit 2: /api still goes to the server');
  // stale ?v= is never kept
  hits = [];
  await p.evaluate(async () => { await fetch('/wst/phase.js?v=0123456789'); await new Promise((r) => setTimeout(r, 800)); await fetch('/wst/phase.js?v=0123456789'); });
  ok(hits.filter((u) => u === '/wst/phase.js?v=0123456789').length === 2, 'a stale ?v= is fetched from the server every time');
  const keys = await p.evaluate(async () => { const c = await caches.open('ga-sw-1'); return (await c.keys()).map((r) => new URL(r.url).pathname); });
  ok(keys.length > 20 && keys.every((k) => /\.(js|css)$/.test(k)), 'cache holds only scripts/styles (' + keys.length + ')');
  await b.close(); srv.close();
}
if (fail) process.exit(1);
console.log('service-worker: ok');

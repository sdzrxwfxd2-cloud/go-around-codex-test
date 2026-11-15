// Perf guard (fix/perf-home-hidden-pages, 11 Nov 2026):
//  - Home must NOT load the hidden Weather map (c/app.html + 1.9 MB c/appdata) or Pilot on its own; they load when opened.
//  - wst/wq.js never prefetches /app.html (wrong page; the shell uses c/app.html) and prefetches the map only on a chart press.
//  - JetBrains Mono 600 uses the 500 file (the two files are byte-identical), so one font download instead of two.
// Browser part needs puppeteer-core + Chrome (CHROME_PATH or /usr/bin/google-chrome); it is skipped, not failed, without them.
import { readFileSync, existsSync, statSync } from 'node:fs'; import { createHash } from 'node:crypto'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
let fail = 0; const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } };
const rd = (f) => readFileSync(path.join(site, f), 'utf8'); const h10 = (f) => createHash('sha256').update(readFileSync(path.join(site, f))).digest('hex').slice(0, 10);
// static
const idx = rd('index.html');
ok(!/var Q=\['map','pilot'\]/.test(idx), 'index.html has no idle pre-mount queue for map/pilot');
ok(/perf 11nov \(was instant_30oct pre-mount\)/.test(idx) && /addEventListener\('pointerdown',intent/.test(idx), 'index.html mounts Weather/Pilot on intent');
for (const f of ['wst/wq.js', 'c/wst/wq.js']) { const s = rd(f); ok(!/add\('prefetch',up\+'app\.html','document'\);if\(window\.WQCFG/.test(s) || f.startsWith('c/'), f + ': no idle /app.html prefetch');
  ok(/const warmApp=/.test(s) && /if\(a\)warmApp\(\)/.test(s), f + ': map prefetch only on a chart press'); }
ok(/warmApp=\(\)=>\{warm\(\);add\('prefetch',up\+'c\/app\.html'/.test(rd('wst/wq.js')), 'root wq.js prefetches c/app.html (the page the shell really uses)');
const fcss = rd('fonts/wm-fonts.css');
ok(/font-family:'JetBrains Mono';src:url\('jetbrains-mono-500\.woff2'\) format\('woff2'\);font-weight:600/.test(fcss) && !/jetbrains-mono-600\.woff2/.test(fcss), 'JetBrains Mono 600 uses the 500 file');
ok(h10('fonts/jetbrains-mono-500.woff2') === h10('fonts/jetbrains-mono-600.woff2'), '500 and 600 font files are identical (safe swap)');
for (const [ref, f] of [['wst/wq.js', 'main.html'], ['fonts/wm-fonts.css', 'index.html']]) { const m = rd(f).match(new RegExp(ref.replace(/[./]/g, '\\$&') + '\\?v=([0-9a-f]{10})')); ok(m && m[1] === h10(ref), f + ' -> ' + ref + ' ?v= is current'); }
// browser
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let pptr = null; try { pptr = (await import('puppeteer-core')).default; } catch {}
if (!pptr || !existsSync(chrome)) console.log('home-hidden-pages: browser part skipped (no puppeteer-core/Chrome)');
else {
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
  const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.startsWith('/api/')) { r.writeHead(503); return r.end(); } if (u.endsWith('/')) u += 'index.html'; let f = path.join(site, u); if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    if (!f.startsWith(site) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await pptr.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const seen = []; p.on('request', (q) => { const u = new URL(q.url()); if (u.origin === base) seen.push(u.pathname); });
  await p.setRequestInterception(true); p.on('request', (q) => { const u = q.url(); if (/^https?:\/\/127\.0\.0\.1/.test(u) || u.startsWith('data:')) q.continue(); else q.abort(); });
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 }); await new Promise((r) => setTimeout(r, 9000));
  const hit = (re) => seen.filter((u) => re.test(u));
  ok(hit(/^\/c\/app\.html$/).length === 0, 'Home did not load c/app.html (got ' + hit(/^\/c\/app\.html$/).length + ')');
  ok(hit(/appdata\/app-data/).length === 0, 'Home did not load the 1.9 MB map data');
  ok(hit(/^\/pilot\.html$/).length === 0, 'Home did not load pilot.html');
  ok(hit(/^\/app\.html$/).length === 0, 'Home did not prefetch /app.html');
  ok(hit(/jetbrains-mono-600/).length === 0, 'jetbrains-mono-600.woff2 not downloaded');
  ok(hit(/^\/main\.html$/).length === 1, 'Aerodromes page still loads once');
  // opening Weather still works: press + click the Weather tab
  const t0 = seen.length;
  await p.evaluate(() => { const a = document.querySelector('nav.tabbar a[href="app.html?tab=map"]'); a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); a.click(); });
  await p.waitForFunction(() => { const f = document.getElementById('wmF-c'); return f && f.style.display !== 'none' && f.contentDocument && f.contentDocument.readyState !== 'loading'; }, { timeout: 30000 }).catch(() => {});
  const vis = await p.evaluate(() => { const f = document.getElementById('wmF-c'); return !!f && f.style.display !== 'none'; });
  ok(vis && seen.slice(t0).includes('/c/app.html'), 'Weather opens on demand (c/app.html loaded and shown)');
  await b.close(); srv.close();
}
if (fail) process.exit(1);
console.log('home-hidden-pages: ok');

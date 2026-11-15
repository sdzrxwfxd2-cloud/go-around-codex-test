#!/usr/bin/env node
// tests/perf/routes-json.mjs (fix/perf-routes-json): site/_routes.json lets static files skip Pages Functions
// (free plan: 100k Function calls/day; Home alone made ~200 calls per view). It must never skip anything that
// functions/_middleware.js or a Function needs:
//  - every HTML page (beacon injection, Accept-CH, the .html "keep" that stops the pretty-URL 308),
//  - /api/*, /admin*, /dashboard-data, /sitestatus-data, /visitor-log-data (Functions + admin password),
//  - the protected app data (/appdata/*, /c/appdata/*) stays as it was (optional step, needs MT's yes).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); const site = path.join(root, 'site');
const R = JSON.parse(fs.readFileSync(path.join(site, '_routes.json'), 'utf8'));
const ok = (m) => console.log('ok - ' + m);
assert.equal(R.version, 1); assert.deepEqual(Object.keys(R).sort(), ['exclude', 'include', 'version'], 'only version/include/exclude');
assert.deepEqual(R.include, ['/*'], 'include stays /* so every page and Function still runs the middleware');
assert.ok(R.include.length + R.exclude.length <= 100, 'Pages limit: 100 rules'); for (const r of [...R.include, ...R.exclude]) assert.ok(r.length <= 100 && r.startsWith('/'), 'bad rule ' + r);
ok((R.include.length + R.exclude.length) + ' rules, within Pages limits');
// Cloudflare: "*" matches any number of path segments; exclude wins over include.
const rx = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const EX = R.exclude.map(rx); const skipped = (u) => EX.some((r) => r.test(u));
// every page (with and without .html, and directory index) keeps the middleware
const html = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(p); } else if (e.name.endsWith('.html')) html.push('/' + path.relative(site, p).split(path.sep).join('/')); } })(site);
const pages = new Set(['/']); for (const h of html) { pages.add(h); pages.add(h.replace(/\.html$/, '')); if (h.endsWith('/index.html')) pages.add(h.slice(0, -'index.html'.length)); }
const bad = [...pages].filter(skipped); assert.deepEqual(bad, [], 'pages that would lose the middleware: ' + bad.slice(0, 20).join(', '));
ok(pages.size + ' page URLs (' + html.length + ' .html files) still run the middleware');
// every Function route stays
const fnRoutes = ['/api/flights', '/api/metar', '/api/taf', '/api/wx-now', '/api/model-weather', '/api/visit-beacon', '/api/ops', '/api/admin/x', '/api/ato-reviews', '/api/weather-snapshot',
  '/admin', '/admin/', '/admin/index.html', '/admin/x.js', '/admin-x/ax.js', '/admin-dashboard.html', '/dashboard-data', '/sitestatus-data', '/visitor-log-data', '/dashboard'];
(function walk(d, pre) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, pre + '/' + e.name); else if (/\.(js|ts|mjs)$/.test(e.name) && !e.name.startsWith('_')) fnRoutes.push(pre + '/' + e.name.replace(/\.(js|ts|mjs)$/, '')); } })(path.join(root, 'cloudflare', 'functions'), '');
const badFn = fnRoutes.filter(skipped); assert.deepEqual(badFn, [], 'Function / admin routes skipped: ' + badFn.join(', '));
ok(fnRoutes.length + ' Function, API and admin routes still run Functions');
for (const u of ['/appdata/app-data.js', '/c/appdata/x.js']) assert.ok(!skipped(u), u + ' is protected: leave it as it was');
ok('protected app data unchanged (still through the middleware, as on live)');
// the excludes really cover the heavy static paths (so the PR does something)
for (const u of ['/wst/phase.js', '/c/wst/wq.js', '/fs/fs.js', '/rwy/rwy.js', '/fonts/wm-fonts.css', '/vendor/leaflet/leaflet.js', '/wm-model.js', '/wm-beacon.js', '/ga-nav-pill.css', '/fv3.js', '/aip/FACT.png', '/sat/x.webp', '/favicon.ico'])
  assert.ok(skipped(u), u + ' should skip Functions');
// and no excluded pattern matches a file the middleware would rewrite (HTML) or an admin path
for (const p of R.exclude) assert.ok(!/^\/admin/.test(p) && !/\.html/.test(p) && p !== '/*', 'unsafe exclude ' + p);
ok('static code, fonts, images and charts skip Functions');
console.log('routes-json: all passed');

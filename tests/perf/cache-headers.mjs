#!/usr/bin/env node
// tests/perf/cache-headers.mjs (fix/perf-cache-headers): the 1-year immutable cache is only safe if
//  1. each path has one _headers block (on Cloudflare Pages a second block for the same path REPLACES the first
//     block's Cache-Control - that is how /wst/*, /fs/*, /rwy/* lost their cache before this fix),
//  2. every ?v= in the site is the file's current content hash (tools/vbump.mjs --check),
//  3. no JS/CSS file under an immutable rule is referenced WITHOUT ?v= (a browser would keep that copy for a year),
//  4. Pages limits (100 rules) hold, and the beacon that _middleware.js injects without ?v= revalidates.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); const site = path.join(root, 'site');
const rules = []; let cur = null;
for (const line of fs.readFileSync(path.join(site, '_headers'), 'utf8').split('\n')) {
  if (/^\s*#/.test(line) || !line.trim()) continue;
  if (!/^\s/.test(line)) { cur = { path: line.trim(), h: [] }; rules.push(cur); } else cur.h.push(line.trim());
}
const ok = (m) => console.log('ok - ' + m);
// 1 + 4
assert.ok(rules.length <= 100, 'Pages allows at most 100 header rules, got ' + rules.length);
const seen = {}; for (const r of rules) seen[r.path] = (seen[r.path] || 0) + 1;
const dups = Object.keys(seen).filter((p) => seen[p] > 1);
assert.ok(dups.length === 0 || (dups.length === 1 && dups[0] === '/appdata/*'), 'one block per path (only the old /appdata/* pair may repeat until #64 merges it), got ' + dups.join(','));
ok(rules.length + ' rules, one block per path' + (dups.length ? ' (except the /appdata/* pair, merged by #64)' : ''));
const re = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const cc = (url) => { let v = []; for (const r of rules) if (re(r.path).test(url)) for (const h of r.h) { if (/^! Cache-Control$/i.test(h)) v = []; else if (/^Cache-Control:/i.test(h)) v.push(h.split(':')[1].trim()); } return v.join(', '); };
assert.match(cc('/wm-beacon.js'), /^no-cache/, '/wm-beacon.js must revalidate');
for (const u of ['/wst/phase.js', '/fs/fs.js', '/rwy/rwy.js', '/c/wst/wq.js', '/engine/ga-core-v2.js', '/wm-model.js', '/ga-nav-pill.css', '/fv3.js'])
  assert.match(cc(u), /immutable/, u + ' should be immutable, got ' + cc(u));
for (const u of ['/', '/index.html', '/ad/FACT.html', '/ad/FAOR', '/ad/FACT', '/c/ad/FAOR', '/c/app.html', '/calculator_v5/assets/ta.js', '/flight-computer/js/app.js', '/admin/index.html'])
  assert.doesNotMatch(cc(u) || 'default', /immutable/, u + ' must not be immutable');
for (const u of ['/ad/FAOR', '/ad/FACT', '/ad/FAOR.html', '/c/ad/FAOR', '/c/ad/FAOR.html'])
  assert.match(cc(u), /no-cache/, u + ' must revalidate, got ' + cc(u));
ok('cache rules resolve as intended (beacon revalidates, versioned code immutable, pages and unversioned code not)');
// Directory and extension rules must not duplicate max-age on images or shared fonts.
for (const u of ['/photos/faor.webp', '/aip/FAOR/p-349.jpg', '/fonts/nunito-600.woff2', '/fonts/ga-wm-engrave.fd215507b090.woff'])
  assert.equal(cc(u), 'public, max-age=31536000, immutable', u + ' must have one unchanged immutable cache policy');
ok('overlapping image/font rules retain one 1-year immutable policy');
// 2
execFileSync(process.execPath, [path.join(root, 'tools', 'vbump.mjs'), '--check'], { stdio: 'inherit' });
ok('every ?v= is the current content hash');
// 3
const immutable = (rel) => /\.(js|css)$/.test(rel) && /immutable/.test(cc('/' + rel)) && rel !== 'wm-beacon.js' && !/^vendor\//.test(rel) && !/\.[0-9a-f]{8,}\.(js|css)$/.test(rel); // content-hashed file names (c/appdata, #64) need no ?v=
const names = new Map(); const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(aip|aipx|aipcharts|aipcharts_t|sat|photos|node_modules|\.git)$/.test(e.name)) walk(p); } else { const rel = path.relative(site, p).split(path.sep).join('/'); if (immutable(rel)) names.set(path.basename(rel), rel); if (/\.(html|js|css)$/.test(e.name)) files.push(rel); } } })(site);
const alt = [...names.keys()].map((n) => n.replace(/[.]/g, '\\.')).join('|');
const REF = new RegExp(`(?:["'/=]|url\\()((?:[\\w./-]*/)?(?:${alt}))(?=["')\\s>]|\\?(?!v=))`, 'g');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}])\/\/[^\n]*/g, '$1');
const bad = [];
for (const rel of files) {
  if (/^(vendor|flight-computer|admin|admin-x|wx-check)\//.test(rel) || /^admin-/.test(rel)) continue; // no-store / not ours (wx-check: admin page, no-cache, loads its own engine-copy/)
  const s = strip(fs.readFileSync(path.join(site, rel), 'utf8')); let m;
  while ((m = REF.exec(s))) {
    const ctx = s.slice(Math.max(0, m.index - 40), m.index); if (/currentScript/.test(ctx)) continue; // base-path fallback, not a load
    bad.push(rel + ' -> ' + m[1]);
  }
}
assert.deepEqual(bad, [], 'immutable files referenced without ?v=:\n  ' + bad.slice(0, 30).join('\n  '));
ok('no immutable JS/CSS (' + names.size + ' files) is referenced without ?v=');
console.log('cache-headers: all passed');

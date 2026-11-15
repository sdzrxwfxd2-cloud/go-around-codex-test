#!/usr/bin/env node
// tools/perf-budget.mjs (perf/ci-budget, 11 Nov 2026): fast, deterministic speed budget for every PR. No browser needed.
//   node tools/perf-budget.mjs            check against tools/perf-budget.json (exit 1 if over)
//   node tools/perf-budget.mjs --report   print the numbers only
//   node tools/perf-budget.mjs --write    write current numbers + 10% headroom as the new budget (needs MT's yes in the PR)
// What it measures (brotli quality 5, close to what Cloudflare sends for these files):
//  - key pages: HTML size, and the same-origin JS/CSS they load directly (count + size)
//  - the biggest JS/CSS file and the biggest aerodrome page
//  - whole-page watchers: MutationObserver on body/documentElement/document with subtree (each one re-scans the page
//    on every change; the ATO/aerodrome generators must not add more)
//  - hygiene: every ?v= equals the file's content hash; one _headers block per path; _routes.json valid if present
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const site = path.join(root, 'site');
const args = new Set(process.argv.slice(2)); const budgetFile = path.join(root, 'tools', 'perf-budget.json');
const br = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
const BR = new Map(); const brOf = (f) => { if (!BR.has(f)) BR.set(f, br(fs.readFileSync(f))); return BR.get(f); };
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
const SKIPDIR = /^(aip|aipx|aipcharts|aipcharts_t|sat|photos|node_modules|\.git|ARCHIVE_DO_NOT_TOUCH|archive)$/;
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!SKIPDIR.test(e.name)) walk(p); } else files.push(p); } })(site);
const rel = (f) => path.relative(site, f).split(path.sep).join('/');
const resolveRef = (from, ref) => { const s = ref.split(/[?#]/)[0]; let t = s.startsWith('/') ? path.join(site, s) : path.resolve(path.dirname(from), s); if (!fs.existsSync(t) && !s.startsWith('.') && !s.startsWith('/')) t = path.join(site, s); return fs.existsSync(t) && fs.statSync(t).isFile() ? t : null; };
const m = {};
// key pages
const PAGES = ['index.html', 'main.html', 'c/main.html', 'c/app.html', 'calculator.html', 'pilot.html', 'library.html', 'ad/FAOR.html', 'c/ad/FAOR.html'];
for (const pg of PAGES) { const f = path.join(site, pg); if (!fs.existsSync(f)) continue; const s = fs.readFileSync(f, 'utf8'); const seen = new Set(); let n = 0, size = 0;
  for (const mm of s.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)) { if (/^(https?:)?\/\//.test(mm[1])) continue; const t = resolveRef(f, mm[1]); if (!t || seen.has(t)) continue; seen.add(t); n++; size += brOf(t); }
  m['page:' + pg + ':html_br'] = brOf(f); m['page:' + pg + ':assets'] = n; m['page:' + pg + ':assets_br'] = size; }
// biggest files (protected app data is reported, not budgeted)
let bigJs = 0, bigJsName = '', bigAd = 0, bigAdName = '';
for (const f of files) { const r = rel(f);
  if (/\.(js|css)$/.test(r) && !/(^|\/)appdata\//.test(r) && !/^(vendor|flight-computer)\//.test(r)) { const b = brOf(f); if (b > bigJs) { bigJs = b; bigJsName = r; } }
  if (/^(c\/)?ad\/[^/]+\.html$/.test(r)) { const b = fs.statSync(f).size; if (b > bigAd) { bigAd = b; bigAdName = r; } } }
m['max_js_css_br'] = bigJs; m['max_ad_page_raw'] = bigAd;
// whole-page watchers
let watchers = 0; const watcherFiles = {};
for (const f of files) { const r = rel(f); if (!/\.(js|html)$/.test(r) || /^(vendor|flight-computer)\//.test(r) || /^(c\/)?ad\//.test(r)) continue; const s = fs.readFileSync(f, 'utf8');
  const k = (s.match(/\.observe\(\s*(?:document\.body|document\.documentElement|document|d\.body|d\.documentElement|document\.querySelector\(['"]body['"]\))\s*,\s*\{[^}]*subtree\s*:\s*(?:true|!0|1)/g) || []).length; if (k) { watchers += k; watcherFiles[r] = k; } }
// the aerodrome pages are generated: count watchers on one of each kind, not 1,278 times
for (const r of ['ad/FAOR.html', 'c/ad/FAOR.html']) { const f = path.join(site, r); if (!fs.existsSync(f)) continue; const k = (fs.readFileSync(f, 'utf8').match(/\.observe\(\s*(?:document\.body|document\.documentElement|document)\s*,\s*\{[^}]*subtree\s*:\s*(?:true|!0|1)/g) || []).length; if (k) { watchers += k; watcherFiles[r] = k; } }
m['whole_page_watchers'] = watchers;
// hygiene
let stale = 0; const staleEx = [];
for (const f of files) { const r = rel(f); if (!/\.(html|js|css)$/.test(r) || /^(vendor|flight-computer|admin|admin-x)\//.test(r) || /^admin-/.test(r)) continue; const s = fs.readFileSync(f, 'utf8');
  for (const mm of s.matchAll(/((?:src|href)=["']|url\(["']?|["'(])([^"'()\s<>]+?\.(?:js|css))\?v=([0-9a-f]{10})\b/g)) { if (/^(https?:)?\/\//.test(mm[2])) continue; const t = resolveRef(f, mm[2]); if (t && hash(t) !== mm[3]) { stale++; if (staleEx.length < 5) staleEx.push(r + ' -> ' + mm[2] + '?v=' + mm[3]); } } }
m['stale_v_refs'] = stale;
const hdr = fs.readFileSync(path.join(site, '_headers'), 'utf8').split('\n').filter((l) => l && !/^\s/.test(l) && !l.startsWith('#')).map((l) => l.trim());
const cnt = {}; hdr.forEach((p) => { cnt[p] = (cnt[p] || 0) + 1; }); m['headers_duplicate_paths'] = Object.keys(cnt).filter((p) => cnt[p] > 1 && p !== '/appdata/*').length;
m['headers_rules'] = hdr.length;
let routesOk = 1; const rf = path.join(site, '_routes.json'); if (fs.existsSync(rf)) { try { const R = JSON.parse(fs.readFileSync(rf, 'utf8')); routesOk = R.version === 1 && Array.isArray(R.include) && R.include.length > 0 && (R.include.length + (R.exclude || []).length) <= 100 && [...R.include, ...(R.exclude || [])].every((x) => typeof x === 'string' && x.length <= 100 && x.startsWith('/')) ? 1 : 0; } catch { routesOk = 0; } }
m['routes_json_valid'] = routesOk;
// report / write / check
const show = () => { for (const [k, v] of Object.entries(m)) console.log(k.padEnd(40), v); console.log('biggest js/css:', bigJsName, '| biggest aerodrome page:', bigAdName); if (watchers) console.log('whole-page watchers in:', JSON.stringify(watcherFiles)); if (staleEx.length) console.log('stale ?v= e.g.:', staleEx.join(' | ')); };
if (args.has('--report')) { show(); process.exit(0); }
const EXACT = { headers_duplicate_paths: 1, routes_json_valid: 1 };
if (args.has('--write')) { const out = {}; try { const old = JSON.parse(fs.readFileSync(budgetFile, 'utf8')); if (old._note) out._note = old._note; } catch {} for (const [k, v] of Object.entries(m)) out[k] = k in EXACT || k === 'stale_v_refs' || k === 'whole_page_watchers' ? v : k === 'headers_rules' ? 100 : Math.ceil(v * 1.1); fs.writeFileSync(budgetFile, JSON.stringify(out, null, 2) + '\n'); console.log('wrote', path.relative(root, budgetFile)); process.exit(0); }
const B = JSON.parse(fs.readFileSync(budgetFile, 'utf8')); const over = [];
for (const [k, lim] of Object.entries(B)) { if (k.startsWith('_')) continue; const v = m[k]; if (v === undefined) continue;
  if (k === 'routes_json_valid') { if (v !== 1) over.push(k + ': site/_routes.json is not valid (Pages limits: version 1, include, <=100 rules, <=100 chars)'); continue; }
  if (v > lim) over.push(k + ': ' + v + ' > budget ' + lim); }
show();
if (over.length) { console.error('\nPERF BUDGET FAILED:\n  ' + over.join('\n  ') + '\nIf the growth is wanted, run node tools/perf-budget.mjs --write and say why in the PR (needs MT\'s yes).'); process.exit(1); }
console.log('\nperf budget: ok (' + Object.keys(B).filter((k) => !k.startsWith('_')).length + ' limits)');

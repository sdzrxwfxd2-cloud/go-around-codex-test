#!/usr/bin/env node
// tools/vbump.mjs (perf, 11 Nov 2026): set every ?v= on a local .js/.css reference to that file's content hash
// (sha256, first 10 hex). The 1-year "immutable" cache rules in site/_headers are only safe when every ?v= is current.
//   node tools/vbump.mjs          rewrite stale ?v= in place (never writes protected files)
//   node tools/vbump.mjs --check  list stale ?v= and exit 1 if any (tests/perf/cache-headers.mjs runs this)
// Run it after editing any JS/CSS, and after merging branches that both bumped ?v=: a ?v=-only merge conflict is
// resolved by taking either side and running this.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const check = process.argv.includes('--check');
const PROTECTED = /(^|\/)(appdata|ARCHIVE_DO_NOT_TOUCH)(\/|$)|(^|\/)wm-pin\.js$|^wm-core\.js$/;
// Not ours to rewrite: vendor libraries, the flight-computer copy (own repo, date versions), admin pages (no-store anyway).
const SKIPDIR = /^(aip|aipx|aipcharts|aipcharts_t|sat|photos|node_modules|\.git|vendor|flight-computer|admin|admin-x)$/;
const SKIPFILE = /^admin-|\.min\.js$/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!SKIPDIR.test(e.name)) walk(p); } else if (/\.(html|js|css)$/.test(e.name) && !SKIPFILE.test(e.name)) files.push(p); } })(site);
const H = new Map(); const hash = (f) => { if (!H.has(f)) H.set(f, fs.existsSync(f) && fs.statSync(f).isFile() ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10) : null); return H.get(f); };
const RE = /((?:src|href)=["']|url\(["']?|["'(])([^"'()\s<>]+?\.(?:js|css))\?v=([0-9A-Za-z_-]+)/g;
let stale = [], changedFiles = 0, pass = 0, total = 0;
// A JS/CSS file that references another changes its own hash when rewritten, so repeat until nothing changes.
for (;;) { stale = []; let changed = 0; H.clear(); pass++;
for (const f of files) {
  const rel = path.relative(site, f); const s = fs.readFileSync(f, 'utf8'); const rootBase = /<base href="\/">/.test(s);
  const out = s.replace(RE, (m, pre, ref, v) => {
    if (/^(https?:)?\/\//.test(ref)) return m;
    let t = ref.startsWith('/') ? path.join(site, ref) : path.resolve(rootBase ? site : path.dirname(f), ref);
    if (!fs.existsSync(t) && !ref.startsWith('/') && !ref.startsWith('.')) t = path.join(site, ref);
    const cur = hash(t); if (!cur || cur === v) return m;
    stale.push(rel + ' -> ' + path.relative(site, t) + ' ?v=' + v + ' (now ' + cur + ')' + (PROTECTED.test(rel) ? ' [protected file, not rewritten]' : ''));
    return (check || PROTECTED.test(rel)) ? m : pre + ref + '?v=' + cur;
  });
  if (out !== s) { fs.writeFileSync(f, out); changedFiles++; changed++; }
}
total += stale.length; if (check || !changed) break; if (pass > 20) { console.error('vbump: ?v= did not settle (a reference cycle?)'); process.exit(2); } }
if (check) { if (stale.length) { console.error(stale.length + ' stale ?v=:\n  ' + stale.slice(0, 40).join('\n  ') + (stale.length > 40 ? '\n  ...' : '')); process.exit(1); } console.log('vbump --check: every ?v= is current'); }
else console.log('vbump: ' + total + ' stale ?v= fixed in ' + changedFiles + ' file writes over ' + pass + ' passes' + (stale.some((x) => x.includes('[protected')) ? ' (some in protected files were left)' : ''));

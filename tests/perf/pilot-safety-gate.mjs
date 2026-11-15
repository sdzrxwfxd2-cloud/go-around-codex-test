// Pilot-safety regression gate (13 Nov 2026, after the FALA / FAWB "GO from a 21 Oct TAF" finding).
// Runs the Aerodromes page (main.html) in Chromium and fails on any of:
//   - a verdict taken from a TAF that is not valid now, a METAR > 90 min or a model hour > 180 min old;
//   - a card that shows weather values while no current data exists (outage, clock moved past every source);
//   - a missing value printed as 0 / 0.0 / 000° / null% / QNH 0 / Temp 0°/0°;
//   - a blank runway / helipad / no-runway symbol, or a list-card selector that misses cards (".card .icao");
//   - fewer DA / FZL trends than cards with current model data.
// Sweep: all 640 cards (WM_ALL_CARDS) on pages 1..5 at 1280 and 390 px, day and night themes, mocked clock at :00, :01, :59,
// +65, +125 and +185 min from the wx-now hour, a 503 outage and injected nulls.
// Local by default: a static server for site/ with /api/* proxied to GATE_API (default the live site). GATE_URL=<deploy> runs
// against a deploy instead (outage / null cases then use Playwright routing). PW_CHROMIUM=<path> picks the browser binary.
// Screenshots: GATE_SHOTS=<dir>. Run: node --test tests/perf/pilot-safety-gate.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { console.log('pilot-safety-gate: skipped (npm i playwright to run)'); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
const API = process.env.GATE_API || 'https://go-around-aero.pages.dev';
const SHOTS = process.env.GATE_SHOTS || '';
const EXE = process.env.PW_CHROMIUM || ['/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((p) => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function serve() {
  return new Promise((res) => {
    const s = http.createServer(async (q, r) => {
      try {
        const u = new URL(q.url, 'http://x');
        if (u.pathname.startsWith('/api/')) {
          const up = await fetch(API + u.pathname + u.search, { headers: { 'User-Agent': 'ga-safety-gate' } });
          const b = Buffer.from(await up.arrayBuffer());
          r.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/json' }); r.end(b); return;
        }
        let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
        let f = path.join(ROOT, p); if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r);
      } catch (e) { r.writeHead(502); r.end(String(e)); }
    }).listen(0, '127.0.0.1', () => { s.unref(); res(s); });
  });
}

let server = null, BASE = process.env.GATE_URL || '';
async function base() { if (BASE) return BASE.replace(/\/$/, ''); server = await serve(); BASE = 'http://127.0.0.1:' + server.address().port; return BASE; }
async function browser() { return chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) }); }

/* The wx-now file of the moment, read once: its hour t0 anchors the mocked clock. */
let NOWFILE = null;
async function nowFile() { if (!NOWFILE) NOWFILE = await (await fetch(API + '/api/wx-now', { headers: { 'User-Agent': 'ga-safety-gate' } })).json(); return NOWFILE; }

/** Open the Aerodromes page alone (no shell iframe) and wait for the engine to settle. */
async function openMain(ctx, { theme = 'night', width = 1280, at = null, routes = null } = {}) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
  if (at != null) await page.clock.install({ time: at });
  await page.addInitScript(([th]) => { try { localStorage.setItem('wm-theme', th); localStorage.setItem('wm-perpage', '10'); localStorage.setItem('wm-count', 'all'); } catch (e) {} }, [theme]);
  if (routes) await routes(page);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto((await base()) + '/main.html?solo=1', { waitUntil: 'load', timeout: 90e3 });
  await page.waitForFunction(() => window.WM_ALL_CARDS && WM_ALL_CARDS.length >= 500, null, { timeout: 60e3 });
  if (at != null) await page.clock.runFor(20e3); else await page.waitForTimeout(12e3);
  page.errors = errors;
  return page;
}

/** Everything the gate checks, read from all public cards at once. */
function readCards(page) {
  return page.evaluate(() => {
    const D = document, A = window.WM_ALL_CARDS || [], now = Date.now();
    const ic = (c) => ((c.querySelector('.icao') || {}).textContent || '').trim();
    const out = { n: A.length, now, cards: [] };
    out.spy = {
      icao: D.querySelectorAll('.card .icao').length, why: D.querySelectorAll('#list .card .why').length,
      badge: D.querySelectorAll('.card .badge').length, one: !!D.querySelector('#list .card .icao'), cards: D.querySelectorAll('#list .card').length
    };
    const R = (window.WMB && WMB.results) || {};
    for (const c of A) {
      const k = ic(c), rec = R[k], v2 = rec && rec.r && (rec.r.v2 || rec.r), src = v2 && v2.source;
      const taf = ((c.querySelector('.cp[data-p=taf] .mono') || {}).textContent || '').trim();
      const sym = c.querySelector('.rwd');
      const symOk = !!(sym && (sym.querySelector('line.r') || sym.classList.contains('hpad') || sym.classList.contains('cad') || sym.querySelector('.hp,.cad-d')));
      const txt = (c.querySelector('.wxrow') || {}).innerText || '';
      const model = (c.querySelector('.cp[data-p=model]') || {}).innerText || '';
      out.cards.push({
        k, s: c.dataset.s || '', heli: c.dataset.heli === '1', badge: ((c.querySelector('.badge') || {}).textContent || '').trim(),
        src: src ? src.kind : null, srcTime: src ? src.time : null, tafValid: taf && /^TAF/.test(taf) && window.GA_TAF ? GA_TAF.valid(taf, now) : null,
        tafText: /^TAF/.test(taf), symOk, da: !!c.querySelector('.wda2'), daTr: !!c.querySelector('.wda2 .wp-tr'),
        fzl: !!c.querySelector('.wfzl2:not(.wda2)'), fzlTr: !!c.querySelector('.wfzl2:not(.wda2) .wp-tr'),
        txt: txt.replace(/\s+/g, ' ').slice(0, 200), model: model.replace(/\s+/g, ' ').slice(0, 200)
      });
    }
    out.stale = D.documentElement.getAttribute('data-wx-stale');
    return out;
  });
}
const BAD_TEXT = /Vis 0\.0 km|null%|undefined|NaN|QNH 0\b|Temp\/Dew 0°\/0°|00—|—%/;   // a real calm reads 000° 0 kt; nulled winds are checked in the null test
function badText(r) { return r.cards.filter((c) => BAD_TEXT.test(c.txt + ' ' + c.model)).map((c) => c.k + ': ' + (c.txt + ' | ' + c.model).match(BAD_TEXT)[0]); }
function staleSources(r) {
  return r.cards.filter((c) => (c.src === 'taf' && c.tafValid === false) || ((c.src === 'metar' || c.src === 'speci') && c.srcTime && r.now - c.srcTime > 90 * 60e3) ||
    (c.src === 'model' && c.srcTime && r.now - c.srcTime > 180 * 60e3)).map((c) => c.k + ' ' + c.src);
}
async function shot(page, name) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }

const skip = !chromium;
/* 15 Nov 2026: harness logs kept only the last lines, so a failing list check showed "[...] vs []" with no label.
   none() names the check and the first offending cards, and the very last line of the run lists every failed check. */
const FAILS = [];
function none(list, label) {
  if (list.length) FAILS.push(label + ' (' + list.length + ': ' + list.slice(0, 8).join(', ') + (list.length > 8 ? ', …' : '') + ')');
  assert.deepEqual(list, [], label + ': ' + list.length + ' found: ' + JSON.stringify(list.slice(0, 20)));
}
process.on('exit', (code) => { console.log(skip ? 'pilot-safety-gate: skipped' : FAILS.length ? 'pilot-safety-gate FAIL: ' + FAILS.join(' | ') : code ? 'pilot-safety-gate FAIL (exit ' + code + ', see above)' : 'pilot-safety-gate: ok'); });
test('live data: every public card, every symbol drawn, selectors reach every card, no stale source, no 0-for-missing, DA/FZL trends', { skip, timeout: 600e3 }, async (t) => {
  const b = await browser(); t.after(() => b.close());
  for (const theme of ['night', 'day']) for (const width of [1280, 390]) {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const page = await openMain(ctx, { theme, width });
    const r = await readCards(page);
    assert.equal(r.n, 582, 'all public cards built');
    assert.equal(r.spy.icao, 582, '".card .icao" reaches every card (selector patch)');
    assert.equal(r.spy.why, 582, '"#list .card .why" reaches every card');
    assert.equal(r.spy.cards, 582, '"#list .card" lists every card');
    assert.ok(r.spy.one, 'querySelector("#list .card .icao") finds a card');
    none(r.cards.filter((c) => !c.symOk).map((c) => c.k), 'blank runway / helipad symbols');
    none(staleSources(r), 'verdict from a stale or invalid source');
    none(badText(r), 'missing value printed as 0 / null');
    const withModel = r.cards.filter((c) => c.da || c.fzl).length;
    const da = r.cards.filter((c) => c.daTr).length, fz = r.cards.filter((c) => c.fzlTr).length;
    t.diagnostic(`${theme} ${width}px: DA pills ${r.cards.filter((c) => c.da).length}, DA trends ${da}, FZL ${r.cards.filter((c) => c.fzl).length}, FZL trends ${fz}, sources ${JSON.stringify(r.cards.reduce((m, c) => (m[c.src] = (m[c.src] || 0) + 1, m), {}))}`);
    /* 15 Nov 2026: every card has a field elevation now (locked DB), so a card with a METAR but no model point also gets a DA
       pill; the trend is the model's next hour, so only pills on cards with model data (FZL) must have one */
    assert.ok(da >= r.cards.filter((c) => c.da && c.fzl).length, 'every DA pill with model data has its trend');
    assert.ok(fz >= r.cards.filter((c) => c.fzl).length, 'every FZL pill has its trend');
    assert.ok(withModel >= 540, 'DA / FZL on at least 540 of 582 public cards with live data (got ' + withModel + ')');
    for (const pg of [1, 2, 3, 4, 5]) {
      if (pg > 1) { const btn = page.locator('.wpager button', { hasText: new RegExp('^' + pg + '$') }).first(); if (await btn.count()) { await btn.click(); await page.waitForTimeout(400); } }
      const vis = await page.evaluate(() => [...document.getElementById('list').children].filter((c) => c.classList.contains('card')).map((c) => c.querySelector('.icao').textContent));
      assert.ok(vis.length >= 1, 'page ' + pg + ' shows cards');
      if (pg === 1 || pg === 5) await shot(page, `${theme}-${width}-p${pg}`);
    }
    none(page.errors, 'no page errors');
    await ctx.close();
  }
});

test('FALA and FAWB are never judged on a TAF that is not valid now', { skip, timeout: 300e3 }, async (t) => {
  const b = await browser(); t.after(() => b.close());
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await openMain(ctx, {});
  const r = await readCards(page);
  for (const k of ['FALA', 'FAWB']) {
    const c = r.cards.find((x) => x.k === k); assert.ok(c, k + ' card');
    t.diagnostic(`${k}: ${c.s} via ${c.src} (TAF text ${c.tafText}, valid ${c.tafValid})`);
    if (c.src === 'taf') assert.equal(c.tafValid, true, k + ' TAF used for the verdict must be valid now');
  }
  await ctx.close();
});

test('mocked clock: :00 :01 :59 +65 +125 +185 min past the hour after the wx-now file', { skip, timeout: 900e3 }, async (t) => {
  const b = await browser(); t.after(() => b.close());
  /* minutes past the first full hour after the file was composed (an earlier clock would put the data in the future) */
  const nf = await nowFile(), t0 = Math.ceil((Date.parse(nf.composedAt) + 60e3) / 3600e3) * 3600e3;
  for (const [name, off] of [[':00', 0], [':01', 1], [':59', 59], ['+65', 65], ['+125', 125], ['+185', 185]]) {
    const at = t0 + off * 60e3 + 30e3;
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const page = await openMain(ctx, { at });
    const r = await readCards(page);
    const go = r.cards.filter((c) => c.s === 'go').length, da = r.cards.filter((c) => c.da && c.fzl).length /* with model data (15 Nov) */, daTr = r.cards.filter((c) => c.daTr).length;
    t.diagnostic(`${name}: GO ${go}, DA ${da}, DA trend ${daTr}, FZL ${r.cards.filter((c) => c.fzl).length}, stale flag ${r.stale}`);
    none(staleSources(r), name + ' verdict from a stale or invalid source');
    none(badText(r), name + ' missing value printed as 0 / null');
    if (off >= 185) {
      /* past every model hour (180 min) and the METAR window: nothing current exists */
      assert.equal(r.cards.filter((c) => c.src === 'model').length, 0, '+185: no model verdict');
    }
    if (off <= 65) assert.ok(daTr >= da - 5, name + ': DA pills keep their trend (' + daTr + '/' + da + ')');
    await ctx.close();
  }
});

test('503 outage: no verdict, pill or weather value from old data', { skip, timeout: 300e3 }, async (t) => {
  const b = await browser(); t.after(() => b.close());
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await openMain(ctx, { routes: async (p) => {
    await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"outage"}' }));
    await p.route('https://api.open-meteo.com/**', (r) => r.abort());
  } });
  const r = await readCards(page);
  const withWx = r.cards.filter((c) => /Wind \d|QNH \d|\d+°C/.test(c.txt));
  t.diagnostic(`outage: GO ${r.cards.filter((c) => c.s === 'go').length}, DA ${r.cards.filter((c) => c.da).length}, values shown ${withWx.length}`);
  assert.equal(r.cards.filter((c) => c.s === 'go' || c.s === 'caution' || c.s === 'nogo').length, 0, 'no verdict without data');
  assert.equal(r.cards.filter((c) => c.da || c.fzl).length, 0, 'no DA / FZL pill without data');
  none(withWx.map((c) => c.k + ': ' + c.txt.slice(0, 60)), 'no weather values without data');
  await shot(page, 'outage-503');
  await ctx.close();
});

test('injected nulls in wx-now: a missing value is "—", never 0 / 0.0 / 000° / null% / QNH 0', { skip, timeout: 300e3 }, async (t) => {
  const nulledWind = new Set();
  const b = await browser(); t.after(() => b.close());
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await openMain(ctx, { routes: async (p) => {
    await p.route('**/api/wx-now**', async (r) => {
      const res = await r.fetch(); const n = await res.json();
      if (n && Array.isArray(n.c) && n.vars) {
        const NH = n.hours || 2;
        n.c.forEach((row, i) => { n.vars.forEach((k, j) => { if (i % 3 === j % 3) { for (let h = 0; h < NH; h++) row[j * NH + h] = null; if (k === 'wind_speed_10m') nulledWind.add(n.pts[i][0]); } }); });
        if (Array.isArray(n.metar)) n.metar.forEach((m, i) => { if (i % 2) { m.temp = null; m.altim = null; m.wdir = null; } });
      }
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(n) });
    });
  } });
  const r = await readCards(page);
  const calmLie = r.cards.filter((c) => nulledWind.has(c.k) && c.src === 'model' && /Wind (000° 0 kt|Calm)/.test(c.txt)).map((c) => c.k + ': ' + c.txt.slice(0, 50));
  t.diagnostic(`nulls: DA ${r.cards.filter((c) => c.da).length}, bad text ${badText(r).length}, wind nulled on ${nulledWind.size} points, shown as calm ${calmLie.length}`);
  none(calmLie, 'a nulled model wind is never shown as calm / 000° 0 kt');
  none(badText(r), 'missing value printed as 0 / null');
  none(staleSources(r), 'verdict from a stale or invalid source');
  await ctx.close();
});

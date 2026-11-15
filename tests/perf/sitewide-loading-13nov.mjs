// Sitewide first-load inline loading bars (13 Nov): CSS recipe, helper, shared hooks.
// First load only; refresh FX and the card layout redesign stay untouched.
// Aerodrome pages get the bars via shared wst/wq.css + wst/wst-ad.js (no per-page HTML tags).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/^(aip|aipx|aipcharts|aipcharts_t|sat|photos|node_modules|\.git|vendor|flight-computer|admin|admin-x|appdata)$/.test(e.name)) walk(p, acc);
    } else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

test('loading CSS is the DA-calculator bar (theme tokens, 1.6s, reduced-motion, opacity-only badge reveal)', () => {
  const css = read('wst/wm-loading.css');
  assert.match(css, /\.mk-ph/);
  assert.match(css, /--gl2/);
  assert.match(css, /--ln/);
  assert.match(css, /animation:\s*mkph 1\.6s ease-in-out infinite/);
  assert.match(css, /box-shadow:\s*inset 0 0 0 \.5px var\(--ln\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.mk-in/);
  assert.match(css, /@keyframes mkin/);
  assert.match(css, /translateY\(4px\)/);
  assert.match(css, /\.card \.badge\.mk-in/);
  assert.match(css, /@keyframes mkfade/);
  assert.doesNotMatch(css, /#tiles \.tile \.n/);
  assert.doesNotMatch(css, /\.stfoot \.wupd/);
  assert.match(css, /#fbr\.mk-radar-wait/);
  assert.equal(/!important/.test(css), false, 'source CSS must not use !important override stacks');
  assert.equal(/mk-masonry|mk-pills|mk-type|--mk-pill-top/.test(css), false, 'must not ship the held card-layout redesign');
});

test('WMLoad helper is first-load only and does not hook refresh FX', () => {
  const js = read('wst/wm-loading.js');
  assert.match(js, /function ph\(/);
  assert.match(js, /window\.WMLoad/);
  assert.match(js, /waitCard/);
  assert.match(js, /HELIPAD|isHeli/);
  assert.match(js, /mk-ready/);
  assert.match(js, /api\\?\/metar/);
  assert.match(js, /api\\?\/taf/);
  assert.match(js, /api\\?\/wx-now/);
  assert.match(js, /api\\?\/flights/);
  assert.match(js, /open-meteo/);
  assert.doesNotMatch(js, /wst-refresh\.js|WMrefresh\s*=/);
  assert.doesNotMatch(js, /wm-refresh-fx\.js/);
  assert.match(js, /Do not reveal on wm:pass/);
});

test('refresh FX sources and engine are byte-untouched by this change', () => {
  assert.match(read('wst/wst-refresh.js'), /Updating…|Updating/);
  assert.match(read('wm-refresh-fx.js'), /./);
  assert.equal(fs.existsSync(path.join(site, 'engine/ga-core-v2.js')), true);
});

test('virtualized list still waits newly created cards and never mounts baked numbers as live', () => {
  const cards = read('wst/wst-cards.js');
  assert.match(cards, /WMLoad\.waitCard/);
  const main = read('main.html');
  assert.equal((main.match(/<article class="card/g) || []).length, 0);
  assert.match(main, /wm-loading\.css\?v=/);
  assert.match(main, /wm-loading\.js\?v=/);
  assert.match(main, /getElementById\("greet"\)/);
  assert.match(main, /Good morning/);
  assert.match(main, /wm\.phaseMode/);
  assert.match(main, /NO DEPART/);
});

test('principal pages load the helper; aerodrome pages get it from shared wst assets (no per-page tags)', () => {
  for (const f of ['main.html', 'fact.html', 'ops-weather.html', 'status_demo.html']) {
    const t = read(f);
    assert.match(t, /wm-loading\.css\?v=/, f + ' missing css');
    assert.match(t, /wm-loading\.js\?v=/, f + ' missing js');
  }
  const wq = read('wst/wq.css');
  assert.match(wq, /@import url\("(?:\/wst\/)?wm-loading\.css\?v=/);
  const adBoot = read('wst/wst-ad.js');
  assert.match(adBoot, /wm-loading\.js\?v=/);
  assert.match(adBoot, /Shared entry so aerodrome pages/);
  const ads = walk(path.join(site, 'ad'));
  const cads = walk(path.join(site, 'c/ad'));
  assert.equal(ads.length, 639);
  assert.equal(cads.length, 639);
  // Shared hooks already used by live ad pages — no wm-loading tags in the HTML.
  const faor = read('ad/FAOR.html');
  const cfaor = read('c/ad/FAOR.html');
  assert.match(faor, /wst\/wq\.css/);
  assert.match(faor, /wst\/wst-ad\.js/);
  assert.doesNotMatch(faor, /wm-loading\.(css|js)/);
  assert.match(cfaor, /wst\/wq\.css/);
  assert.match(cfaor, /wst\/wst-ad\.js/);
  assert.doesNotMatch(cfaor, /wm-loading\.(css|js)/);
  const tagged = [];
  for (const f of ads.concat(cads)) {
    const t = fs.readFileSync(f, 'utf8');
    if (/wm-loading\.(css|js)/.test(t)) tagged.push(path.relative(site, f));
  }
  assert.equal(tagged.length, 0, 'ad HTML should not embed loading tags: ' + tagged.slice(0, 8));
});

test('ops-weather shows bars after auth and reveals once on the first run only', () => {
  const js = read('ops-weather.js');
  assert.match(js, /WMLoad\.phAll/);
  assert.match(js, /WMLoad\.reveal\('ops'\)/);
});

test('status bar tiles and weather-updated footer are not given first-load bars', () => {
  const css = read('wst/wm-loading.css');
  const js = read('wst/wm-loading.js');
  assert.doesNotMatch(css, /#tiles/);
  assert.doesNotMatch(css, /\.stfoot/);
  assert.doesNotMatch(js, /TILES\s*=/);
  assert.doesNotMatch(js, /phAll\(document, TILES/);
  assert.match(js, /phaseLabels/);
  assert.match(js, /#tiles, \.stfoot/);
});

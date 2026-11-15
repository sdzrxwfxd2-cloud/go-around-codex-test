// Speed + theme-switch 13 Nov: fonts, no 800ms body fade, virtualized list,
// tap-to-load embeds, shared status-tile CSS, and theme-lock coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/^(aip|aipx|aipcharts|aipcharts_t|sat|photos|node_modules|\.git|vendor|flight-computer|admin|admin-x|appdata)$/.test(e.name)) walk(p, acc);
    } else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

test('shared ga-* fonts replace inline data: fonts on principal and aerodrome pages', () => {
  const index = read('index.html');
  assert.equal((index.match(/src:url\(data:font\//g) || []).length, 0);
  assert.match(index, /src:url\(\/fonts\/ga-wm-engrave\.fd215507b090\.woff\)/);
  assert.match(index, /src:url\(\/fonts\/ga-nunito-600\.45f437de32ff\.woff2\)/);
  assert.match(index, /rel="preload"[^>]+ga-wm-engrave/);
  const faor = read('ad/FAOR.html');
  assert.equal((faor.match(/src:url\(data:font\//g) || []).length, 0);
  assert.match(faor, /src:url\(\/fonts\/ga-wm-engrave\.fd215507b090\.woff\)/);
  for (const f of ['fonts/ga-wm-engrave.fd215507b090.woff', 'fonts/ga-wm-name.6062bc84dc0d.woff', 'fonts/ga-nippo.7e56d2e80637.woff2', 'fonts/ga-nunito-600.45f437de32ff.woff2', 'fonts/ga-bebas-neue.441b026df205.woff2']) {
    assert.ok(fs.existsSync(path.join(site, f)), f);
  }
});

test('body background 800ms transition is gone; wm-notx covers body and every aerodrome page', () => {
  const notx = read('wm-notx.js');
  assert.match(notx, /body\.no-tx,/);
  assert.match(notx, /queueMicrotask/);
  const htmls = walk(path.join(site, 'ad')).concat(walk(path.join(site, 'c/ad')));
  assert.equal(htmls.length, 1162); // public pages only; 116 closed ad pages moved to docs/closed-aerodromes-15nov/pages on 15 Nov
  let body = 0, missingNotx = [];
  for (const f of htmls) {
    const t = fs.readFileSync(f, 'utf8');
    if (/transition:background \.8s/.test(t)) body++;
    if (!/wm-notx\.js/.test(t)) missingNotx.push(path.relative(site, f));
  }
  assert.equal(body, 0, 'aerodrome pages still have the 800ms body fade');
  assert.equal(missingNotx.length, 0, 'missing wm-notx: ' + missingNotx.slice(0, 8));
  assert.equal(/transition:background \.8s/.test(read('index.html')), false);
  assert.equal(/transition:background \.8s/.test(read('main.html')), false);
});

test('aerodrome list is virtualized: public cards live in wst-cards-data.js, not in main.html', () => {
  const main = read('main.html');
  assert.equal((main.match(/<article class="card/g) || []).length, 0);
  assert.match(main, /wst-cards-data\.js\?v=/);
  assert.match(main, /wst-cards\.js\?v=/);
  const data = read('wst/wst-cards-data.js');
  const json = data.replace(/^window\.WM_CARD_HTML=/, '').replace(/;\s*$/, '');
  const cards = JSON.parse(json);
  assert.equal(cards.length, 582);
  const icaos = cards.map((c) => {
    const m = c.match(/class="icao">([^<]+)/);
    assert.ok(m, 'card missing icao');
    assert.match(c, /class="card glass"/);
    return m[1];
  });
  assert.ok(icaos.includes('FAOR') && icaos.includes('FACT') && icaos.includes('FABL'));
  assert.equal(new Set(icaos).size, 582);
  const list = read('wst/wst-list.js');
  assert.match(list, /WM_ALL_CARDS/);
  assert.match(list, /WMCards\.mount/);
});

test('Windy, ADS-B and OSM aerodrome embeds are tap-to-load placeholders', () => {
  const faor = read('ad/FAOR.html');
  assert.equal((faor.match(/<iframe class="emb"/g) || []).length, 0);
  assert.equal((faor.match(/class="emb-tap"/g) || []).length, 3);
  assert.match(faor, /data-emb-src="https:\/\/embed\.windy\.com\//);
  assert.match(faor, /data-emb-src="https:\/\/globe\.adsbexchange\.com\//);
  assert.match(faor, /data-emb-src="https:\/\/www\.openstreetmap\.org\/export\/embed/);
  assert.match(faor, /wm-embed-tap\.js/);
  const tap = read('wm-embed-tap.js');
  assert.match(tap, /el\.replaceWith\(f\)/);
});

test('status-v2 loads shared status-tiles.css and does not fetch main.html', () => {
  const js = read('status-v2.js');
  assert.equal(js.includes("fetch('main.html'"), false);
  assert.match(js, /\/wst\/status-tiles\.css\?v=/);
  const css = read('wst/status-tiles.css');
  assert.match(css, /\.tiles\{/);
  assert.match(css, /\.tile\{/);
  assert.match(css, /\.stfoot\{/);
  assert.match(css, /#tiles/);
});

test('shell sync skips hidden iframes, does not read computed style, and does not preload main.html on /ad/', () => {
  const index = read('index.html');
  const sync = index.slice(index.indexOf('function sync('), index.indexOf('function size('));
  assert.match(sync, /function sync\(f,force\)/);
  assert.match(sync, /f\.style\.display==='none'/);
  assert.equal(sync.includes('getComputedStyle'), false);
  assert.match(sync, /var\(--bg\)/);
  const early = index.slice(index.indexOf('wm-merge-early'), index.indexOf('wm-merge-early') + 600);
  assert.match(early, /ad\\\/\[A-Za-z0-9-\]+/);
});

test('live night-pill engine logic is kept; only the textContent compare was ported', () => {
  const wq = read('wst/wq.js');
  assert.match(wq, /POL-NIGHT-UNSELECTED/);
  assert.match(wq, /POL-NIGHT-ARRIVAL/);
  assert.match(wq, /if\(n\.textContent!==label\)n\.innerHTML=ic\+label/);
  assert.equal(wq.includes('if(n.innerHTML!==tx)n.innerHTML=tx'), false);
});

test('list sort by name reorders WM_ALL_CARDS instead of appending every card into the DOM', () => {
  const main = read('main.html');
  assert.match(main, /WM_ALL_CARDS&&WM_ALL_CARDS\.length\?WM_ALL_CARDS/);
  assert.match(main, /WMLIST&&WMLIST\.apply/);
  assert.equal(main.includes("cs.sort(st.sort==='near'&&!pos?(a,b)=>a._wi-b._wi:CMP[st.sort]).forEach(c=>list.append(c))"), false);
});

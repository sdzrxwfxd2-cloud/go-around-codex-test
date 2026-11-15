// Refresh FX glints on boxes (fix/refresh-fx-boxes-13nov):
// PR #79 wst-cards.js intercepted any document.querySelectorAll starting with
// ".card", so the phone Refresh FX selector
// ".card:not(.wpg-off),.tile,.badge,.tile .d" returned cards only and dropped
// verdict pills (.badge) and status tiles (.tile). Fix the patch, not the FX.
// wm-refresh-fx.js / wst-refresh.js / Engine v2 stay byte-untouched.
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const site = process.env.SITE_DIR || path.join(root, 'site');
const shots = process.env.SHOT_DIR || '/tmp/ga-refresh-fx-shots';
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');

// 15 Nov 2026: Engine v2 is no longer listed here; it changes through its own tests (tests/engine-v2), not this FX fix.
test('wm-refresh-fx.js and wst-refresh.js are byte-untouched', () => {
  const out = execSync(
    'git diff --name-only origin/live/model-3h-11nov -- site/wm-refresh-fx.js site/wst/wst-refresh.js site/c/wst/wst-refresh.js',
    { cwd: root, encoding: 'utf8' }
  ).trim();
  assert.equal(out, '', 'protected refresh / engine files changed:\n' + out);
  assert.match(read('wm-refresh-fx.js'), /function glints\(/);
  assert.match(read('wm-refresh-fx.js'), /\.card:not\(\.wpg-off\),\s*\.tile,\s*\.badge,\s*\.tile \.d/);
  assert.match(read('wst/wst-refresh.js'), /Updating…|Updating/);
});

test('wst-cards.js splits compound Refresh FX selectors instead of treating them as cards-only', () => {
  const t = read('wst/wst-cards.js');
  assert.match(t, /function splitComma\(/);
  assert.match(t, /function queryAll\(/);
  assert.match(t, /plans\.push\(plan\(parts\[i\]\)\)/);
  assert.match(t, /WMLoad\.waitCard/);
  assert.match(t, /Refresh FX/);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

function waitHttp(url, ms = 60000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const once = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry(new Error('status ' + res.statusCode));
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry(new Error('timeout'));
      });
    };
    const retry = (err) => {
      if (Date.now() - t0 > ms) return reject(err || new Error('waitHttp timed out for ' + url));
      setTimeout(once, 200);
    };
    once();
  });
}

describe('wst-cards querySelectorAll compound selectors', () => {
  let server, base, browser, page;
  before(async () => {
    const port = await freePort();
    server = http.createServer((req, res) => {
      if (req.url === '/wst-cards.js') {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        res.end(fs.readFileSync(path.join(site, 'wst/wst-cards.js')));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((r) => server.listen(port, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({ args: ['--disable-gpu'] });
    page = await browser.newPage();
  });
  after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
  });

  test('phone Refresh FX selector returns cards, tiles, badges, and lights', async () => {
    await page.setContent(`<!doctype html><html><body>
      <section id="list">
        <article class="card" id="c1"><span class="badge">GO</span></article>
        <article class="card wpg-off" id="c2"><span class="badge">NO</span></article>
        <article class="card" id="c3"><span class="badge">CAUTION</span></article>
      </section>
      <nav class="tiles">
        <div class="tile" id="t1" data-s="go"><i class="d"></i><b class="n">1</b></div>
        <div class="tile" id="t2" data-s="caution"><i class="d"></i><b class="n">2</b></div>
      </nav>
    </body></html>`);
    await page.addScriptTag({ url: base + '/wst-cards.js' });
    const beforeMount = await page.evaluate(() => {
      const sel = '.card:not(.wpg-off),.tile,.badge,.tile .d';
      return {
        allCards: document.querySelectorAll('.card').length,
        compound: [...document.querySelectorAll(sel)].map((el) => (el.id || el.className)),
        listKids: document.getElementById('list').children.length
      };
    });
    assert.equal(beforeMount.allCards, 3, 'pure .card queries still see the full index, including unmounted cards');
    assert.equal(beforeMount.listKids, 0, 'cards start in the store, not in #list');
    // Unmounted badges are not in the document; tiles and lights still must appear.
    assert.ok(beforeMount.compound.includes('c1'));
    assert.ok(beforeMount.compound.includes('c3'));
    assert.ok(!beforeMount.compound.includes('c2'), 'wpg-off cards are excluded from the FX selector');
    assert.ok(beforeMount.compound.includes('t1') && beforeMount.compound.includes('t2'));
    assert.equal(beforeMount.compound.filter((x) => x === 'd').length, 2);

    await page.evaluate(() => window.WMCards.mount(window.WM_ALL_CARDS.slice(0, 2)));
    const after = await page.evaluate(() => {
      const sel = '.card:not(.wpg-off),.tile,.badge,.tile .d';
      return [...document.querySelectorAll(sel)].map((el) => el.id || el.className);
    });
    assert.ok(after.includes('c1'));
    assert.ok(!after.includes('c2'));
    assert.ok(after.includes('t1') && after.includes('t2'));
    assert.equal(after.filter((x) => x === 'badge').length, 2, 'badges on mounted cards are included');
    assert.equal(after.filter((x) => x === 'd').length, 2);
  });
});

async function startWrangler() {
  const port = await freePort();
  const persist = path.join('/tmp', 'ga-refresh-fx-wrangler-' + port);
  const child = spawn(
    'npx',
    ['--yes', 'wrangler@4', 'pages', 'dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', persist],
    {
      cwd: path.join(root, 'cloudflare'),
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    }
  );
  let out = '';
  const onData = (buf) => { out += buf.toString(); };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  const base = 'http://127.0.0.1:' + port;
  try {
    await waitHttp(base + '/', 90000);
  } catch (e) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    throw new Error('wrangler pages dev failed to start: ' + e.message + '\n' + out.slice(-4000));
  }
  const stop = async () => {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await new Promise((r) => setTimeout(r, 400));
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  };
  return { base, stop, out: () => out };
}

async function waitAero(page, timeout = 45000) {
  await page.waitForFunction(() => {
    const f = document.getElementById('wmF-aero') || document.querySelector('iframe.wmsec.on, iframe.wmsec');
    try {
      const d = f && f.contentDocument;
      return !!(d && d.querySelector('#list article.card, #list .card'));
    } catch (e) { return false; }
  }, null, { timeout });
}

async function armProbe(page) {
  await page.evaluate(() => {
    const probe = window.__wfxProbe = { badge: 0, tile: 0, card: 0, dot: 0, wfn: 0, events: [] };
    const rec = (root, label) => {
      if (!root) return;
      new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!n || !n.classList || !n.classList.contains('wfn')) continue;
            const host = n.parentElement;
            const kind = host && host.classList.contains('badge') ? 'badge'
              : host && host.classList.contains('tile') ? 'tile' : 'other';
            probe.wfn++;
            probe[kind] = (probe[kind] || 0) + 1;
            probe.events.push({ kind, label, t: performance.now() });
          }
        }
      }).observe(root, { childList: true, subtree: true });
    };
    const hookAnim = (win) => {
      if (!win || win.__wfxAnimHook) return;
      win.__wfxAnimHook = 1;
      const orig = win.Element.prototype.animate;
      win.Element.prototype.animate = function (kf, opts) {
        const a = orig.apply(this, arguments);
        if (this.classList.contains('card')) probe.card++;
        if (this.classList.contains('d')) probe.dot++;
        return a;
      };
    };
    rec(document, 'parent');
    hookAnim(window);
    const pin = document.getElementById('wmPin');
    if (pin && pin.shadowRoot) rec(pin.shadowRoot, 'pin');
    document.querySelectorAll('iframe').forEach((f, i) => {
      try {
        if (f.contentDocument) rec(f.contentDocument, 'iframe' + i);
        hookAnim(f.contentWindow);
      } catch (e) {}
    });
  });
}

async function probe(page) {
  return page.evaluate(() => window.__wfxProbe || {});
}

describe('Home refresh glints on boxes', () => {
  let wr, browser;
  before(async () => {
    fs.mkdirSync(shots, { recursive: true });
    wr = await startWrangler();
    browser = await chromium.launch({ args: ['--disable-gpu'] });
  });
  after(async () => {
    if (browser) await browser.close();
    if (wr) await wr.stop();
  });

  async function runAt(name, size) {
    const page = await browser.newPage({
      viewport: size,
      reducedMotion: 'no-preference'
    });
    try {
      await page.goto(wr.base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitAero(page);
      // Let first-load bars and pin settle so we are testing refresh, not first paint.
      await page.waitForTimeout(2500);
      await armProbe(page);
      const btn = page.locator('header.topbar .wrf, .topbar .wrf').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await page.screenshot({ path: path.join(shots, name + '-before.png'), fullPage: false });
      await btn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(shots, name + '-during-spin.png'), fullPage: false });
      // boom is at least MIN=1000ms after start, then glints run; cleanup ~1.7s later
      const t0 = Date.now();
      let seen = await probe(page);
      while (Date.now() - t0 < 8000) {
        seen = await probe(page);
        if (seen.wfn > 0 || seen.card > 0 || seen.dot > 0) break;
        await page.waitForTimeout(120);
      }
      // Peak of the 520–620ms glint (delay is distance-based); wait a beat so the still shows it.
      await page.waitForTimeout(280);
      await page.screenshot({ path: path.join(shots, name + '-during-glint.png'), fullPage: false });
      seen = await probe(page);
      console.log('refresh-fx probe ' + name + ':', JSON.stringify(seen));
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(shots, name + '-after.png'), fullPage: false });
      seen = await probe(page);
      const classes = await page.evaluate(() => {
        const out = { card: [], tile: [], badge: [] };
        const take = (root, win) => {
          if (!root) return;
          const view = win || root.defaultView || window;
          root.querySelectorAll('.card, .tile, .badge').forEach((el) => {
            const k = el.classList.contains('card') ? 'card' : el.classList.contains('tile') ? 'tile' : 'badge';
            const cs = view.getComputedStyle(el);
            out[k].push({
              cls: el.className,
              anim: cs.animationName,
              transform: cs.transform,
              wfn: !!el.querySelector('.wfn')
            });
          });
        };
        take(document, window);
        const pin = document.getElementById('wmPin');
        if (pin && pin.shadowRoot) take(pin.shadowRoot, window);
        document.querySelectorAll('iframe').forEach((f) => { try { take(f.contentDocument, f.contentWindow); } catch (e) {} });
        return {
          cards: out.card.length,
          tiles: out.tile.length,
          badges: out.badge.length,
          remainingWfn: out.card.concat(out.tile, out.badge).filter((x) => x.wfn).length
        };
      });
      return { seen, classes };
    } finally {
      await page.close();
    }
  }

  test('phone width: verdict pills and tiles glint; cards still nudge', async () => {
    const { seen, classes } = await runAt('phone', { width: 390, height: 844 });
    assert.ok(classes.cards > 0, 'expected visible cards');
    assert.ok(seen.badge > 0, 'expected verdict-pill (.badge) glints on phone, got ' + JSON.stringify(seen));
    assert.ok(seen.tile > 0 || seen.dot > 0, 'expected status-tile glints on phone, got ' + JSON.stringify(seen));
    assert.ok(seen.card > 0, 'expected card nudge on phone, got ' + JSON.stringify(seen));
    assert.equal(classes.remainingWfn, 0, 'wfn nodes should clean up after the FX');
  });

  test('desktop width: verdict pills and tiles glint (cards are not nudged at >=1024)', async () => {
    const { seen, classes } = await runAt('desktop', { width: 1280, height: 800 });
    assert.ok(classes.cards > 0, 'expected visible cards');
    assert.ok(seen.badge > 0, 'expected verdict-pill (.badge) glints on desktop, got ' + JSON.stringify(seen));
    assert.ok(seen.tile > 0 || seen.dot > 0, 'expected status-tile glints on desktop, got ' + JSON.stringify(seen));
    assert.equal(seen.card, 0, 'desktop must not nudge cards (wm-refresh-fx.js width split)');
  });
});

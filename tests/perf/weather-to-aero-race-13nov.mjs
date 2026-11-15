// Weather -> Aerodromes mid-load race (fix/weather-to-aero-race-13nov):
// when cur is still 'aero' because place() has not run, a quick tap back to
// Aerodromes must call show('aero'), bump show.n, clear stale _cWant, and
// never let a late c/app.html load hijack cur / URL / the visible frame.
// Pill look, motion, and normal click behaviour stay unchanged.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const site = process.env.SITE_DIR || path.join(root, 'site');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');
const DELAY_MS = Number(process.env.APP_DELAY_MS || 2000);
const AFTER_LOAD_MS = Number(process.env.AFTER_LOAD_MS || 3000);

test('index.html tracks targetCur, compares #wmC clicks to it, and clears _cWant on non-c tabs', () => {
  const t = read('index.html');
  assert.match(t, /targetCur=null/);
  assert.match(t, /get target\(\)\{return targetCur\|\|cur\}/);
  assert.match(t, /var seq=\+\+show\.n;targetCur=k;if\(SEC\[k\]\.c\)\{show\._cWant=k;if\(FR\.c\)FR\.c\._want=k\}else\{show\._cWant=null;if\(FR\.c\)FR\.c\._want=null\}/);
  assert.match(t, /if\(k&&k!==\(targetCur\|\|cur\)\)\{if\(!ready\[key\(k\)\]&&k!=='status'\)ldOn\(n\|\|SEC\[k\]\.t\);show\(k,true\)\}/);
  assert.match(t, /now=targetCur\|\|cur/);
  assert.match(t, /want=\(now&&SEC\[now\]&&SEC\[now\]\.c\)\?now:\(f\._want\|\|show\._cWant\)/);
  assert.match(t, /if\(now&&!SEC\[now\]\.c\)return/);
  // Pill click / look / motion path is unchanged (wmCsel / sixth still driven by show()->pill(k)).
  assert.match(t, /function pill\(k\)\{var s=SEC\[k\];if\(!window\.wmCsel\)return;/);
  assert.doesNotMatch(t, /c\/appdata\//);
  assert.doesNotMatch(t, /ARCHIVE_DO_NOT_TOUCH/);
});

test('c/app.html WMShellTab / ens / WMShellSyncTab prefer WMMERGE.target over lagging cur', () => {
  const t = read('c/app.html');
  assert.match(t, /var k=window\.parent\.WMMERGE\.target\|\|window\.parent\.WMMERGE\.cur;/);
  assert.match(t, /inShell=true;parentCur=window\.parent\.WMMERGE\.target\|\|window\.parent\.WMMERGE\.cur/);
  assert.match(t, /if\(\/\^\(chart\|map\|ato\|dfe\)\$\/\.test\(parentCur\|\|''\)\)want=parentCur;else return/);
  assert.match(t, /if\(!\/\^\(chart\|map\|ato\|dfe\)\$\/\.test\(k\|\|''\)\) return null;/);
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

async function startWrangler() {
  const port = await freePort();
  const persist = path.join('/tmp', 'ga-aero-race-wrangler-' + port);
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
  const onData = (buf) => {
    out += buf.toString();
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  const base = 'http://127.0.0.1:' + port;
  try {
    await waitHttp(base + '/', 90000);
  } catch (e) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    throw new Error('wrangler pages dev failed to start: ' + e.message + '\n' + out.slice(-4000));
  }
  const stop = async () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  };
  return { base, stop, out: () => out };
}

async function delayPaths(page, patterns, ms) {
  const loaded = {};
  for (const pat of patterns) {
    loaded[pat] = { at: 0 };
    await page.route(pat, async (route) => {
      const res = await route.fetch();
      const body = await res.body();
      await new Promise((r) => setTimeout(r, ms));
      await route.fulfill({ status: res.status(), headers: res.headers(), body });
      loaded[pat].at = Date.now();
    });
  }
  return loaded;
}

async function clickShellTab(page, name) {
  const tab = page.locator('#wmC .wctab', { hasText: name }).first();
  await tab.click();
}

async function shellState(page) {
  return page.evaluate(() => {
    const cur = window.WMMERGE && WMMERGE.cur;
    const target = window.WMMERGE && WMMERGE.target;
    const path = location.pathname + location.search;
    const pill = [...document.querySelectorAll('#wmC .wctab')].find(
      (a) => a.classList.contains('on') || a.getAttribute('aria-current') === 'page'
    );
    const pillText = pill ? (pill.getAttribute('data-n') || pill.textContent || '').trim() : '';
    const frames = (window.WMMERGE && WMMERGE.frames) || {};
    const vis = (f) => {
      if (!f) return 'missing';
      const d = f.style && f.style.display;
      return d === 'none' ? 'hidden' : 'visible';
    };
    let cWant = null;
    try {
      cWant = frames.c && frames.c._want;
    } catch (e) {}
    return {
      cur,
      target,
      path,
      pillText,
      aero: vis(frames.aero),
      c: vis(frames.c),
      cWant: cWant == null ? null : String(cWant)
    };
  });
}

async function waitPastLoad(loaded, key, extra = AFTER_LOAD_MS) {
  const t0 = Date.now();
  while (!loaded[key].at) {
    if (Date.now() - t0 > 30000) throw new Error(key + ' did not finish loading');
    await new Promise((r) => setTimeout(r, 50));
  }
  const remain = extra - (Date.now() - loaded[key].at);
  if (remain > 0) await new Promise((r) => setTimeout(r, remain));
}

describe('Playwright: mid-load tab race against local wrangler pages dev', () => {
  let base, stop, browser;

  before(async () => {
    const srv = await startWrangler();
    base = srv.base;
    stop = srv.stop;
  });

  after(async () => {
    try {
      if (browser) await browser.close();
    } catch {}
    if (stop) await stop();
  });

  async function openPage(delay) {
    if (!browser) browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block'
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const loaded = await delayPaths(page, delay.patterns, DELAY_MS);
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!(window.WMMERGE && document.querySelector('#wmC .wctab')), null, {
      timeout: 30000
    });
    return { context, page, pageErrors, loaded };
  }

  test('Weather then Aerodromes mid-load stays on Aerodromes after c/app.html finishes', { timeout: 120000 }, async () => {
    const { context, page, pageErrors, loaded } = await openPage({ patterns: ['**/c/app.html**'] });
    try {
      await clickShellTab(page, 'Weather');
      await clickShellTab(page, 'Aerodromes');
      await waitPastLoad(loaded, '**/c/app.html**');
      const st = await shellState(page);
      assert.equal(st.cur, 'aero', 'WMMERGE.cur should be aero, got ' + JSON.stringify(st));
      assert.equal(st.target, 'aero', 'WMMERGE.target should be aero, got ' + JSON.stringify(st));
      assert.equal(st.path === '/' || st.path === '', true, 'path should be /, got ' + st.path);
      assert.equal(st.aero, 'visible', 'FR.aero should be visible, got ' + JSON.stringify(st));
      assert.equal(st.c === 'hidden' || st.c === 'missing', true, 'FR.c should be hidden, got ' + JSON.stringify(st));
      assert.match(st.pillText, /Aerodrome/i);
      assert.equal(st.cWant, null, 'FR.c._want should be cleared, got ' + JSON.stringify(st));
      assert.equal(pageErrors.length, 0, 'pageerrors: ' + pageErrors.join(' | '));
    } finally {
      await context.close();
    }
  });

  test('Weather then ATOs mid-load stays on ATOs after c/app.html finishes', { timeout: 120000 }, async () => {
    const { context, page, pageErrors, loaded } = await openPage({ patterns: ['**/c/app.html**'] });
    try {
      await clickShellTab(page, 'Weather');
      await clickShellTab(page, 'ATOs');
      await waitPastLoad(loaded, '**/c/app.html**');
      const st = await shellState(page);
      assert.equal(st.cur, 'ato', 'WMMERGE.cur should be ato, got ' + JSON.stringify(st));
      assert.match(st.path, /\/ato/);
      assert.match(st.pillText, /ATO/i);
      assert.equal(st.c, 'visible', 'FR.c should be visible, got ' + JSON.stringify(st));
      assert.equal(pageErrors.length, 0, 'pageerrors: ' + pageErrors.join(' | '));
    } finally {
      await context.close();
    }
  });

  test('Weather then ATOs mid-load stays on ATOs, then Aerodromes wins if tapped next', { timeout: 120000 }, async () => {
    const { context, page, pageErrors, loaded } = await openPage({ patterns: ['**/c/app.html**'] });
    try {
      await clickShellTab(page, 'Weather');
      await clickShellTab(page, 'ATOs');
      // Mid-load: leave for Aerodromes before c/app.html finishes.
      await clickShellTab(page, 'Aerodromes');
      await waitPastLoad(loaded, '**/c/app.html**');
      const st = await shellState(page);
      assert.equal(st.cur, 'aero', 'should end on aero, got ' + JSON.stringify(st));
      assert.equal(st.path === '/' || st.path === '', true, 'path should be /, got ' + st.path);
      assert.equal(st.aero, 'visible', 'FR.aero should be visible, got ' + JSON.stringify(st));
      assert.equal(st.c === 'hidden' || st.c === 'missing', true, 'FR.c should be hidden, got ' + JSON.stringify(st));
      assert.match(st.pillText, /Aerodrome/i);
      assert.equal(pageErrors.length, 0, 'pageerrors: ' + pageErrors.join(' | '));
    } finally {
      await context.close();
    }
  });

  test('Weather then Pilot mid-load stays on Pilot after c/app.html finishes', { timeout: 120000 }, async () => {
    const { context, page, pageErrors, loaded } = await openPage({ patterns: ['**/c/app.html**'] });
    try {
      await clickShellTab(page, 'Weather');
      await clickShellTab(page, 'Pilot');
      await waitPastLoad(loaded, '**/c/app.html**');
      const st = await shellState(page);
      assert.equal(st.cur, 'pilot', 'should stay on pilot, got ' + JSON.stringify(st));
      assert.match(st.path, /pilot/i);
      assert.match(st.pillText, /Pilot/i);
      assert.equal(st.c === 'hidden' || st.c === 'missing', true, 'FR.c should be hidden, got ' + JSON.stringify(st));
      assert.equal(pageErrors.length, 0, 'pageerrors: ' + pageErrors.join(' | '));
    } finally {
      await context.close();
    }
  });

  test('Pilot then Aerodromes mid-load stays on Aerodromes after pilot.html finishes', { timeout: 120000 }, async () => {
    const { context, page, pageErrors, loaded } = await openPage({ patterns: ['**/pilot.html**'] });
    try {
      await clickShellTab(page, 'Pilot');
      await clickShellTab(page, 'Aerodromes');
      await waitPastLoad(loaded, '**/pilot.html**');
      const st = await shellState(page);
      assert.equal(st.cur, 'aero', 'should stay on aero, got ' + JSON.stringify(st));
      assert.equal(st.path === '/' || st.path === '', true, 'path should be /, got ' + st.path);
      assert.equal(st.aero, 'visible', 'FR.aero should be visible, got ' + JSON.stringify(st));
      assert.match(st.pillText, /Aerodrome/i);
      assert.equal(pageErrors.length, 0, 'pageerrors: ' + pageErrors.join(' | '));
    } finally {
      await context.close();
    }
  });
});

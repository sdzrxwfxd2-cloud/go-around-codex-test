// Playwright checks against the preview-only Pages deploy.
// 1) Home status bar has no first-load bars while cards do.
// 2) Weather -> ATOs (and Weather -> Aerodromes / Pilot) mid-load stays on the later page.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

const PREVIEW = process.env.PREVIEW_URL || '';
const HOLD_MS = Number(process.env.HOLD_MS || 8000);
const skipRemote = !PREVIEW;
if (skipRemote) {
  console.log('preview-tab-race-13nov: skipped (set PREVIEW_URL to run against a preview deploy)');
}

async function launch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  return { browser, context, page };
}

async function clickShellTab(page, name) {
  const tab = page.locator('#wmC .wctab', { hasText: name }).first();
  await tab.click();
}


async function delayAppHtml(page, ms) {
  await page.route('**/c/app.html**', async (route) => {
    const res = await route.fetch();
    const body = await res.body();
    await new Promise((r) => setTimeout(r, ms));
    await route.fulfill({
      status: res.status(),
      headers: res.headers(),
      body
    });
  });
}

async function shellState(page) {
  return page.evaluate(() => {
    const cur = window.WMMERGE && WMMERGE.cur;
    const path = location.pathname + location.search;
    const pill = [...document.querySelectorAll('#wmC .wctab')].find((a) => a.classList.contains('on') || a.getAttribute('aria-current') === 'page');
    const pillText = pill ? (pill.getAttribute('data-n') || pill.textContent || '').trim() : '';
    let inner = null;
    try {
      const f = window.WMMERGE && WMMERGE.frames && WMMERGE.frames.c;
      const d = f && f.contentDocument;
      const on = d && d.querySelector('nav button[data-t].on');
      inner = on && on.getAttribute('data-t');
    } catch (e) {}
    return { cur, path, pillText, inner };
  });
}

test('Home status bar has no loading bars while /api/wx-now is held; cards do', { skip: skipRemote }, async (t) => {
  const { browser, page } = await launch();
  t.after(() => browser.close());
  const hold = async (route) => {
    await new Promise((r) => setTimeout(r, HOLD_MS));
    await route.continue();
  };
  await page.route('**/api/wx-now**', hold);
  await page.route('**/api/metar**', hold);
  await page.route('**/api/taf**', hold);
  await page.goto(PREVIEW + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // #tiles lives in the Aerodromes iframe (and may be mirrored on #wmPin).
  // Wait until the iframe has finished starting WMLoad so visible cards have bars
  // while obs APIs are still held. The status bar must stay bar-free the whole time.
  await page.waitForFunction(() => {
    try {
      const d = window.WMMERGE && WMMERGE.doc && WMMERGE.doc('aero');
      const list = d && d.getElementById('list');
      return !!(d && d.readyState === 'complete' && list && list.querySelector('.mk-ph, .mk-wait'));
    } catch (e) { return false; }
  }, null, { timeout: 20000 });
  const shot = await page.evaluate(() => {
    const empty = { tileCount: 0, tilesWithMkPh: 0, listPh: 0, listWait: 0, listCards: 0 };
    try {
      const d = window.WMMERGE && WMMERGE.doc && WMMERGE.doc('aero');
      if (!d) return empty;
      const tiles = [...d.querySelectorAll('#tiles .tile .n, .stfoot .wupd')];
      const pin = document.querySelectorAll('#wmPin .n, #wmPin .wupd');
      const list = d.getElementById('list');
      return {
        tileCount: tiles.length + pin.length,
        tilesWithMkPh: tiles.filter((el) => el.classList.contains('mk-ph')).length
          + [...pin].filter((el) => el.classList.contains('mk-ph')).length,
        listPh: list ? list.querySelectorAll('.mk-ph').length : 0,
        listWait: list ? list.querySelectorAll('.mk-wait').length : 0,
        listCards: list ? list.querySelectorAll('.card').length : 0
      };
    } catch (e) { return Object.assign({ err: String(e) }, empty); }
  });
  assert.ok(shot.tileCount > 0, 'status bar tiles should be present: ' + JSON.stringify(shot));
  assert.equal(shot.tilesWithMkPh, 0, 'status bar must not have .mk-ph loading bars: ' + JSON.stringify(shot));
  assert.ok(shot.listPh > 0, 'aerodrome cards should show .mk-ph bars while obs APIs are held: ' + JSON.stringify(shot));
});

test('Weather then ATOs mid-load stays on ATOs after c/app.html finishes', { skip: skipRemote }, async (t) => {
  const { browser, page } = await launch();
  t.after(() => browser.close());
  await delayAppHtml(page, 1800);
  await page.goto(PREVIEW + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#wmC', { timeout: 30000 });
  await clickShellTab(page, 'Weather');
  await page.waitForTimeout(120);
  await clickShellTab(page, 'ATOs');
  // Wait well past the delayed iframe load + ens(4) window (~1.15s after load).
  await page.waitForTimeout(1800 + 3000);
  const st = await shellState(page);
  assert.equal(st.cur, 'ato', `WMMERGE.cur should be ato, got ${JSON.stringify(st)}`);
  assert.match(st.path, /\/ato/);
  assert.match(st.pillText, /ATO/i);
  assert.equal(st.inner, 'ato', `FR.c should show #ato, got ${JSON.stringify(st)}`);
});

test('Weather then Aerodromes mid-load stays on Aerodromes', { skip: skipRemote }, async (t) => {
  const { browser, page } = await launch();
  t.after(() => browser.close());
  await delayAppHtml(page, 1800);
  await page.goto(PREVIEW + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#wmC', { timeout: 30000 });
  await clickShellTab(page, 'Weather');
  await page.waitForTimeout(120);
  await clickShellTab(page, 'Aerodromes');
  await page.waitForTimeout(1800 + 3000);
  const st = await shellState(page);
  assert.equal(st.cur, 'aero', `should stay on aero, got ${JSON.stringify(st)}`);
  assert.equal(st.path === '/' || st.path === '', true, `path should be /, got ${st.path}`);
});

test('Weather then Pilot mid-load stays on Pilot', { skip: skipRemote }, async (t) => {
  const { browser, page } = await launch();
  t.after(() => browser.close());
  await delayAppHtml(page, 1800);
  await page.goto(PREVIEW + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#wmC', { timeout: 30000 });
  await clickShellTab(page, 'Weather');
  await page.waitForTimeout(120);
  await clickShellTab(page, 'Pilot');
  await page.waitForTimeout(1800 + 3000);
  const st = await shellState(page);
  assert.equal(st.cur, 'pilot', `should stay on pilot, got ${JSON.stringify(st)}`);
  assert.match(st.path, /pilot/i);
});

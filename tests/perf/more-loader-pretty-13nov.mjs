// More-sheet first-visit loader + pretty-URL shell rewrite (feat/more-loader-and-pretty-rewrite-13nov).
// Pill look/motion stays unchanged. openAd() and the initial home load stay free of ldOn().
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const site = process.env.SITE_DIR || path.join(root, 'site');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');
const mw = fs.readFileSync(path.join(root, 'cloudflare/functions/_middleware.js'), 'utf8');

test('More-sheet rows call ldOn when the iframe is not ready, with targetCur lock; logo and openAd do not', () => {
  const t = read('index.html');
  assert.match(t, /closest\('\.sheet a\[href\], \.topbar a\.logo'\)/);
  assert.match(
    t,
    /e\.preventDefault\(\);var k=r\.k;if\(k&&k!==\(targetCur\|\|cur\)\)\{if\(a\.classList\.contains\('mrow'\)&&!ready\[key\(k\)\]\)ldOn\(SEC\[k\]\.x\|\|SEC\[k\]\.t\);show\(k,true\)\}/
  );
  // Main navbar tabs still skip Status and still compare to targetCur.
  assert.match(t, /if\(k&&k!==\(targetCur\|\|cur\)\)\{if\(!ready\[key\(k\)\]&&k!=='status'\)ldOn\(n\|\|SEC\[k\]\.t\);show\(k,true\)\}/);
  const oa = t.slice(t.indexOf('function openAd(ic,push)'), t.indexOf('function openAd(ic,push)') + 500);
  assert.match(oa, /show\('ad',push\)/);
  assert.doesNotMatch(oa, /ldOn\(/);
  assert.match(t, /Logo clicks, the initial home load, and openAd\(\) do not show it/);
  assert.match(t, /function pill\(k\)\{var s=SEC\[k\];if\(!window\.wmCsel\)return;/);
});

test('parseStart maps pretty section URLs, including /app without ?tab= and /status_demo', () => {
  const t = read('index.html');
  assert.match(t, /'status_demo':'status','status_demo\.html':'status','main':'aero','main\.html':'aero'/);
  assert.match(t, /if\(file==='app'\|\|file==='app\.html'\)k=\(q&&SEC\[q\]\)\?q:'ato'/);
});

test('middleware serves the shell on section document visits and leaves iframes / ?solo=1 / /c/* alone', () => {
  assert.match(mw, /const SECTION_PATH = \/\^\\\/\(pilot\|library\|logbook\|brief\|calculator\|app\|main\|status\|status_demo\)\(\?:\\\.html\)\?\$\/i/);
  assert.match(mw, /function isSectionDocument/);
  assert.match(mw, /function serveShell/);
  assert.match(mw, /if \(isSectionDocument\(context\.request, url\)\)/);
  assert.doesNotMatch(mw, /sectionBounce/);
  assert.doesNotMatch(mw, /serveAdShell/);
  assert.match(mw, /request\.headers\.get\("Sec-Fetch-Dest"\) !== "document" \|\| \/\[\?&\]solo=1\/\.test\(url\.search\)/);
  assert.doesNotMatch(mw, /c\/app\.html|c\/main\.html/);
});

const PREVIEW = (process.env.PREVIEW_URL || '').replace(/\/$/, '');
const skipRemote = !PREVIEW;
if (skipRemote) {
  console.log('more-loader-pretty-13nov preview checks: skipped (set PREVIEW_URL to run against a preview deploy)');
}

async function launch() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  return { browser, context, page };
}

async function delayPath(page, pat, ms) {
  await page.route(pat, async (route) => {
    const res = await route.fetch();
    const body = await res.body();
    await new Promise((r) => setTimeout(r, ms));
    await route.fulfill({ status: res.status(), headers: res.headers(), body });
  });
}

async function openMore(page) {
  const btn = page.locator('#tb-theme, button.more, .topbar .more, [aria-label="More"]').first();
  await btn.click();
  await page.waitForSelector('.sheet.on, .sheet.mp.on, .sheet.glass.on', { timeout: 10000 });
}

test('preview: More-sheet Library shows ldOn and a mid-load switch stays on the later tab', { skip: skipRemote }, async (t) => {
  const { browser, page } = await launch();
  t.after(() => browser.close());
  await delayPath(page, '**/library.html**', 1800);
  await page.goto(PREVIEW + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#wmC', { timeout: 30000 });
  await openMore(page);
  await page.locator('.sheet a.mrow', { hasText: 'Library' }).first().click();
  await page.waitForFunction(() => {
    const el = document.getElementById('wmLd');
    return !!(el && /Library/i.test(el.textContent || ''));
  }, null, { timeout: 8000 });
  await page.locator('#wmC .wctab', { hasText: 'Pilot' }).first().click();
  await page.waitForTimeout(1800 + 2500);
  const st = await page.evaluate(() => ({
    cur: window.WMMERGE && WMMERGE.cur,
    target: window.WMMERGE && WMMERGE.target,
    path: location.pathname
  }));
  assert.equal(st.cur, 'pilot', 'should stay on Pilot after mid-load switch, got ' + JSON.stringify(st));
  assert.match(st.path, /pilot/i);
});

async function fetchDest(url, dest) {
  const r = await fetch(url, { headers: dest ? { 'Sec-Fetch-Dest': dest } : {}, redirect: 'manual' });
  const text = (r.status === 200 && (r.headers.get('content-type') || '').includes('html')) ? await r.text() : '';
  return {
    status: r.status,
    location: r.headers.get('location') || '',
    cache: r.headers.get('cache-control') || '',
    etag: r.headers.get('etag') || '',
    hasMerge: /id="wm-merge-js"/.test(text),
    hasRedirect: /id="wm-merge-redirect"/.test(text),
    title: (text.match(/<title>[^<]+/) || [''])[0]
  };
}

test('preview: /pilot /library /calculator /app?tab=map documents are the shell; iframes stay inner pages', { skip: skipRemote }, async () => {
  for (const p of ['/pilot', '/library', '/calculator', '/app?tab=map']) {
    const doc = await fetchDest(PREVIEW + p, 'document');
    assert.equal(doc.status, 200, p + ' document status ' + doc.status + ' loc=' + doc.location);
    assert.equal(doc.hasMerge, true, p + ' document must be the shell: ' + doc.title);
    assert.equal(doc.hasRedirect, false, p + ' document must not be the standalone bounce page: ' + doc.title);
    assert.match(doc.cache, /no-cache/);
    assert.match(doc.cache, /no-transform/);
    assert.ok(doc.etag, p + ' should have an ETag');

    const iframe = await fetchDest(PREVIEW + p, 'iframe');
    assert.equal(iframe.status, 200, p + ' iframe status');
    assert.equal(iframe.hasMerge, false, p + ' iframe must not be the shell: ' + iframe.title);
    assert.equal(iframe.hasRedirect, true, p + ' iframe should keep the inner page bounce script: ' + iframe.title);

    const q = p.includes('?') ? p.replace('?', '?solo=1&') : p + '?solo=1';
    const solo = await fetchDest(PREVIEW + q, 'document');
    assert.equal(solo.status, 200, q + ' solo status');
    assert.equal(solo.hasMerge, false, q + ' must stay the inner page');
    assert.equal(solo.hasRedirect, true, q + ' must stay the inner page');
  }
});

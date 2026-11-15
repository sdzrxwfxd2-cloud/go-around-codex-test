import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const { chromium, webkit } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/ad-filter-15nov";
mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".jpg": "image/jpeg" };

const root = process.argv[2];
const tag = process.argv[3] || "before";
const engine = process.argv[4] || "chromium";

async function start(siteRoot) {
  const s = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      if (req.method !== "GET") { res.writeHead(204); return res.end(); }
      try {
        const r = await fetch("https://go-around-aero.pages.dev" + req.url);
        res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
        return res.end(Buffer.from(await r.arrayBuffer()));
      } catch { res.writeHead(502); return res.end(); }
    }
    let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const cand of [rel, rel + ".html"]) {
      const f = join(siteRoot, cand);
      try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {}
    }
    res.writeHead(404); res.end("");
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${s.address().port}`, close: () => new Promise((r) => s.close(r)) };
}

const srv = await start(root);
const R = { tag, engine, at: new Date().toString(), url: srv.url, root, errors: [], longTasks: [], notes: [] };
let browser;
try {
  if (engine === "webkit") browser = await webkit.launch({ args: [] });
  else browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
} catch (e) {
  R.notes.push("launch failed: " + String(e).slice(0, 300));
  writeFileSync(join(OUT, `${tag}-${engine}.json`), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
  await srv.close();
  process.exit(2);
}

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  serviceWorkers: "block",
  userAgent: engine === "webkit"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    : undefined
});
await ctx.addInitScript(() => {
  const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": "10", "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm.phaseMode": "depart", "wm-heli-hide": "0", "wm-da-verdict": "0" };
  for (const k in d) localStorage.setItem(k, d[k]);
  window.__wmLT = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__wmLT.push({ n: e.name, start: Math.round(e.startTime), dur: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) {}
});

const page = await ctx.newPage();
page.on("pageerror", (x) => R.errors.push("pageerror " + String(x).slice(0, 240)));
page.on("console", (m) => { if (m.type() === "error") R.errors.push("console " + m.text().slice(0, 240)); });
page.on("crash", () => { R.crashed = true; R.notes.push("page crash event"); });

async function snap(name) {
  const p = join(OUT, name);
  try { await page.screenshot({ path: p, fullPage: false }); R.notes.push("shot " + name); }
  catch (e) { R.notes.push("shot fail " + name + " " + String(e).slice(0, 120)); }
}

function mountedInfo() {
  return page.evaluate(() => {
    const L = document.getElementById("list");
    const mounted = L ? [...L.children].filter((c) => c.classList && c.classList.contains("card")).length : 0;
    const spacers = L ? [...L.children].filter((c) => c.classList && c.classList.contains("wm-vsp")).map((s) => s.getBoundingClientRect().height) : [];
    const all = window.WM_ALL_CARDS ? WM_ALL_CARDS.length : 0;
    const first = L && [...L.children].find((c) => c.classList && c.classList.contains("card"));
    const icao = first && first.querySelector(".icao") ? first.querySelector(".icao").textContent.trim() : "";
    const mem = performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null;
    const lt = window.__wmLT ? window.__wmLT.slice() : [];
    const per = localStorage.getItem("wm-perpage");
    const lbl = document.querySelector(".wpager .lbl");
    return { mounted, spacers, all, icao, mem, lt, per, pager: lbl ? lbl.textContent : "" };
  });
}

try {
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    R.cpuThrottle = 4;
    page._cdp = cdp;
  } else {
    R.cpuThrottle = "webkit: no CDP throttle (iOS-like UA only)";
  }

  const t0 = Date.now();
  await page.goto(srv.url + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#list, .wflt-row", { timeout: 30000 });
  await page.waitForFunction(() => {
    const L = document.getElementById("list");
    const n = L ? [...L.children].filter((c) => c.classList && c.classList.contains("card")).length : 0;
    return n >= 1;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  R.loadMs = Date.now() - t0;
  R.beforeClick = await mountedInfo();
  await snap(`${tag}-amethyst-390-default.png`);

  // Open the aerodrome filter
  const btn = page.locator(".wflt-row .wflt-b, .icb.wflt-b, .wflt-b").first();
  await btn.click({ timeout: 10000 });
  await page.waitForTimeout(800);
  await snap(`${tag}-amethyst-390-filter-open.png`);

  // Open the How many / Per page row (not Count, whose value is also 'All' when wm-count=all)
  const tBeforeClick = Date.now();
  const clicked = await page.evaluate(() => {
    const row = document.querySelector('.gr[data-g="per"], .gr[data-g="n"]')
      || [...document.querySelectorAll('.wmf .gr, .wmf [data-g]')].find((el) => /^(How many|Per page)$/i.test((el.querySelector('span') || el).textContent.trim()));
    if (row) {
      const hdr = row.querySelector('.gv, button, .gr') || row;
      hdr.click();
    }
    const chipsRoot = row && (row.nextElementSibling || row.parentElement);
    const chip = (chipsRoot && [...chipsRoot.querySelectorAll('button, .c')].find((el) => {
      const t = (el.textContent || '').trim();
      return t === 'All' || el.getAttribute('data-wp') === 'all' || el.getAttribute('data-pp') === 'all';
    })) || document.querySelector('[data-wp="all"]');
    if (!chip) return { ok: false, row: !!(row), hasHidden: !!document.querySelector('[data-wp="all"]') };
    chip.click();
    return { ok: true, text: (chip.textContent || '').trim().slice(0, 40), tag: chip.tagName, wp: chip.getAttribute('data-wp') || chip.getAttribute('data-pp'), per: localStorage.getItem('wm-perpage') };
  });
  R.click = clicked;
  R.clickEvalMs = Date.now() - tBeforeClick;
  const tClick0 = tBeforeClick;
  // Confirm (or force) the same event the How many control uses
  const perNow = await page.evaluate(() => localStorage.getItem('wm-perpage'));
  if (perNow !== 'all') {
    await page.evaluate(() => {
      const b = document.querySelector('[data-wp="all"]');
      if (b) b.click();
      else { localStorage.setItem('wm-perpage', 'all'); document.dispatchEvent(new Event('wm:perpage')); }
    });
    R.notes.push('forced [data-wp=all] / wm:perpage after UI click, was ' + perNow);
  }

  const tClick = tClick0;
  // Time to first paint of All: wait until either many cards, or spacers exist, or per=all and list still has cards
  let firstShow = null, done = null, timedOut = false;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    let info;
    try { info = await mountedInfo(); }
    catch (e) { R.notes.push("evaluate failed: " + String(e).slice(0, 200)); R.crashed = true; break; }
    if (!firstShow && (info.per === "all") && (info.mounted >= 1 || info.spacers.length)) {
      firstShow = { ms: Date.now() - tClick, ...info };
    }
    // "show all" complete: virtualizer has spacers covering the rest, or all cards mounted, and no long task currently > 200ms starting after click
    if (info.per === "all" && firstShow) {
      const maxMounted = info.mounted;
      const hasSp = info.spacers && info.spacers.some((h) => h > 0);
      if (hasSp || maxMounted >= Math.min(info.all, 50) || info.pager) {
        // wait a couple frames for the first window to settle
        done = { ms: Date.now() - tClick, ...info };
        break;
      }
    }
    await page.waitForTimeout(100);
  }
  if (!done && !R.crashed) {
    timedOut = true;
    try { done = { ms: Date.now() - tClick, ...(await mountedInfo()) }; } catch (e) { done = { ms: Date.now() - tClick, error: String(e).slice(0, 200) }; }
  }
  R.firstShow = firstShow;
  R.afterClick = done;
  R.timedOut = timedOut;
  R.clickToShowMs = firstShow ? firstShow.ms : (done && done.ms);
  if (done && done.lt) {
    R.longTasks = done.lt.filter((t) => firstShow ? t.start >= 0 : true);
    const after = done.lt.filter((t) => firstShow && t.start >= 0);
    R.longestTaskMs = after.reduce((m, t) => Math.max(m, t.dur), 0);
    R.longTasksOver50 = after.filter((t) => t.dur >= 50).length;
    R.longTasksOver200 = after.filter((t) => t.dur >= 200).length;
    R.longTasksOver1000 = after.filter((t) => t.dur >= 1000).length;
  }

  // Memory after
  if (page._cdp) {
    try {
      const m = await page._cdp.send("Performance.getMetrics");
      R.cdpMetrics = Object.fromEntries((m.metrics || []).map((x) => [x.name, x.value]));
    } catch (e) {}
  }

  // Close the filter so the card list is visible
  await page.evaluate(() => {
    const close = document.querySelector('.wmf .fvc, .fv5-box .fvc, .wmf [aria-label="Close"], .wmf .wmf-x');
    if (close) close.click();
    else { const b = document.querySelector('.wflt-row .wflt-b, .icb.wflt-b'); if (b) b.click(); }
  });
  await page.waitForTimeout(600);
  await snap(`${tag}-amethyst-390-all.png`);


  // Scroll test: can we scroll without freeze / crash
  const tScroll = Date.now();
  try {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollBy(0, 4000));
    await page.waitForTimeout(800);
    R.scroll = { ms: Date.now() - tScroll, ...(await mountedInfo()), y: await page.evaluate(() => scrollY) };
    await snap(`${tag}-amethyst-390-all-scrolled.png`);
    // scroll back to top for a clean mid-list? also mid-page shot of a card
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await snap(`${tag}-amethyst-390-all-top.png`);
  } catch (e) {
    R.scroll = { error: String(e).slice(0, 240), ms: Date.now() - tScroll };
    R.notes.push("scroll failed");
  }

  // Interaction probe: can the filter still be closed / page still respond within 2s
  const tInt = Date.now();
  try {
    const ok = await Promise.race([
      page.evaluate(() => { document.body.getBoundingClientRect(); return true; }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("interactive timeout")), 8000))
    ]);
    R.interactiveMs = Date.now() - tInt;
    R.interactive = !!ok;
  } catch (e) {
    R.interactive = false;
    R.interactiveMs = Date.now() - tInt;
    R.notes.push(String(e));
  }
} catch (e) {
  R.fatal = String(e).slice(0, 400);
  try { await snap(`${tag}-amethyst-390-error.png`); } catch (x) {}
}

writeFileSync(join(OUT, `${tag}-${engine}.json`), JSON.stringify(R, null, 2));
console.log(JSON.stringify({ tag, engine, crashed: !!R.crashed, fatal: R.fatal || null, clickToShowMs: R.clickToShowMs, firstShow: R.firstShow, after: R.afterClick && { mounted: R.afterClick.mounted, all: R.afterClick.all, per: R.afterClick.per, pager: R.afterClick.pager, mem: R.afterClick.mem, spacers: R.afterClick.spacers }, longestTaskMs: R.longestTaskMs, longTasksOver200: R.longTasksOver200, longTasksOver1000: R.longTasksOver1000, interactive: R.interactive, errors: R.errors.length, notes: R.notes, click: R.click, scroll: R.scroll && { mounted: R.scroll.mounted, y: R.scroll.y, error: R.scroll.error } }, null, 2));

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
await srv.close();

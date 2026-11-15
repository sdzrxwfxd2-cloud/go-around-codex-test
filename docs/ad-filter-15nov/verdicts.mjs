import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/ad-filter-15nov";
const ROOT = "/workspace/wt-ad-filter-15nov/site";
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".jpg": "image/jpeg" };
const cache = {};
const s = http.createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith("/api/")) {
    if (req.method !== "GET") { res.writeHead(204); return res.end(); }
    const key = p === "/api/wx-now" || p === "/api/metar" || p === "/api/taf" ? p : req.url;
    try {
      if (!cache[key]) cache[key] = fetch("https://go-around-aero.pages.dev" + req.url).then(async (r) => ({ st: r.status, ct: r.headers.get("content-type") || "application/json", b: Buffer.from(await r.arrayBuffer()) }));
      const c = await cache[key]; res.writeHead(c.st, { "content-type": c.ct }); return res.end(c.b);
    } catch { res.writeHead(502); return res.end(); }
  }
  let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
  for (const cand of [rel, rel + ".html"]) {
    const f = join(ROOT, cand);
    try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {}
  }
  res.writeHead(404); res.end("");
});
await new Promise((r) => s.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${s.address().port}`;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const R = { at: new Date().toString(), modes: {}, diffs: {}, errs: {}, status: {} };

async function ctxFor(mode, off, per) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  await ctx.addInitScript(([mode, off, per]) => {
    const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": per, "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": mode, "wm-da-verdict": "0" };
    for (const k in d) localStorage.setItem(k, d[k]);
    if (off != null) localStorage.setItem("wm.arriveAt", JSON.stringify({ off, at: null, t: Date.now() }));
    else localStorage.removeItem("wm.arriveAt");
  }, [mode, off, per]);
  return ctx;
}
const watch = (p, tag) => { const e = (R.errs[tag] = R.errs[tag] || []); p.on("console", (m) => { if (m.type() === "error") e.push(m.text().slice(0, 200)); }); p.on("pageerror", (x) => e.push("pageerror " + String(x).slice(0, 200))); };

async function waitCards(page, min) {
  await page.waitForFunction((min) => {
    const all = window.WM_ALL_CARDS || [];
    return all.length >= min && all.filter((c) => c.dataset && c.dataset.s).length >= Math.min(min - 20, all.length - 10);
  }, min, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(8000);
}

const dump = (page) => page.evaluate(() => {
  const all = window.WM_ALL_CARDS ? WM_ALL_CARDS.slice() : [...document.querySelectorAll(".card")];
  const seen = new Set(), out = [];
  const X = (e) => (e ? (e.textContent || "").replace(/\s+/g, " ").trim() : "");
  for (const c of all) {
    const id = X(c.querySelector(".icao")); if (!id || seen.has(id)) continue; seen.add(id);
    const w = c.__wm || {}, v2 = w.v2 || {}, u = w.weatherUsed || v2.weatherUsed || null;
    out.push({
      id, s: c.dataset.s || "", badge: X(c.querySelector(".badge")), why: X(c.querySelector(".why")).slice(0, 160),
      src: u ? u.src : null, rules: (v2.findings || []).filter((f) => f.lv === "caution" || f.lv === "nogo").map((f) => f.lv + ":" + f.ruleId)
    });
  }
  const L = document.getElementById("list");
  const mounted = L ? [...L.children].filter((c) => c.classList && c.classList.contains("card")).length : 0;
  return { cards: out, counts: window.WM_COUNTS ? WM_COUNTS() : null, n: out.length, mounted, window: window.WMCards && WMCards.window ? WMCards.window() : null };
});

const MODES = [["depart", null], ["land0", 0], ["land1", 1], ["land2", 2], ["land3", 3]];
for (const [name, off] of MODES) {
  R.modes[name] = {};
  for (const per of ["10", "all"]) {
    const ctx = await ctxFor(off == null ? "depart" : "land", off, per);
    const p = await ctx.newPage();
    watch(p, name + "-" + per);
    await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitCards(p, 560);
    // wm-filters-reset clears wm-perpage on load; apply All the same way the How many control does
    if (per === "all") {
      await p.evaluate(() => {
        const b = document.querySelector('[data-wp="all"]');
        if (b) b.click();
        else { localStorage.setItem("wm-perpage", "all"); document.dispatchEvent(new Event("wm:perpage")); }
      });
      await p.waitForTimeout(2000);
    }
    const d = await dump(p);
    R.modes[name][per] = d;
    const cnt = {}; d.cards.forEach((c) => (cnt[c.s] = (cnt[c.s] || 0) + 1));
    console.log(name, "per="+per, "n="+d.n, "mounted="+d.mounted, "win="+JSON.stringify(d.window), JSON.stringify(cnt));
    await ctx.close();
  }
  const a = new Map(R.modes[name]["10"].cards.map((c) => [c.id, c]));
  const diffs = [];
  for (const c of R.modes[name].all.cards) {
    const o = a.get(c.id);
    if (!o) { diffs.push({ id: c.id, reason: "missing on per=10" }); continue; }
    if (c.s !== o.s || c.badge !== o.badge) diffs.push({ id: c.id, page10: { s: o.s, badge: o.badge, why: o.why }, all: { s: c.s, badge: c.badge, why: c.why } });
  }
  for (const c of R.modes[name]["10"].cards) if (!R.modes[name].all.cards.some((x) => x.id === c.id)) diffs.push({ id: c.id, reason: "missing on per=all" });
  R.diffs[name] = diffs;
  console.log(name, "verdict diffs", diffs.length);
}

{
  const ctx = await ctxFor("depart", null, "10");
  const a = await ctx.newPage(); watch(a, "status-aero");
  await a.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitCards(a, 560);
  const s = await ctx.newPage(); watch(s, "status");
  await s.goto(base + "/status_demo.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await s.waitForTimeout(15000);
  const S = await s.evaluate(() => { const v = {}; document.querySelectorAll(".v4 .cnt>div[data-s]").forEach((el) => (v[el.dataset.s] = parseInt((el.querySelector("b") || {}).textContent, 10))); return v; });
  const A = await a.evaluate(() => (window.WM_COUNTS ? WM_COUNTS() : null));
  R.status = { aerodromes: A, statusBar: S };
  const diff = A && S && typeof S.go === "number" ? Math.abs((A.go || 0) - (S.go || 0)) + Math.abs((A.caution || 0) - (S.caution || 0)) + Math.abs((A.nogo || 0) - (S.nogo || 0)) : "na";
  R.status.diff = diff;
  console.log("status-vs-aero", JSON.stringify(R.status), "diff", diff);
  await ctx.close();
}

R.summary = {
  n10: R.modes.depart["10"].n,
  nAll: R.modes.depart.all.n,
  mountedAll: R.modes.depart.all.mounted,
  verdictDiffs: Object.fromEntries(Object.entries(R.diffs).map(([k, v]) => [k, v.length])),
  totalDiffs: Object.values(R.diffs).reduce((n, a) => n + a.length, 0),
  statusDiff: R.status.diff,
  jsErrors: Object.fromEntries(Object.entries(R.errs).map(([k, v]) => [k, v.length]))
};
writeFileSync(OUT + "/verdict-harness.json", JSON.stringify(R, null, 2));
console.log("SUMMARY", JSON.stringify(R.summary, null, 2));
if (R.summary.totalDiffs) process.exitCode = 1;
await b.close();
await new Promise((r) => s.close(r));

// Before (b0496a909 = live code) vs after (fix/engine-gaps-15nov), same frozen /api data, 390 px Amethyst (purple) night.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import http from "node:http"; import { readFile, stat } from "node:fs/promises"; import { join, extname, normalize } from "node:path";
const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/fix-engine-gaps-15nov/round2";
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };
const cache = {};
async function start(root, port) {
  const s = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      if (req.method !== "GET") { res.writeHead(204); return res.end(); }
      const key = p === "/api/wx-now" || p === "/api/metar" || p === "/api/taf" ? p : req.url;
      try { if (!cache[key]) cache[key] = fetch("https://go-around-aero.pages.dev" + req.url).then(async (r) => ({ st: r.status, ct: r.headers.get("content-type") || "application/json", b: Buffer.from(await r.arrayBuffer()) }));
        const c = await cache[key]; res.writeHead(c.st, { "content-type": c.ct }); return res.end(c.b); } catch (e) { res.writeHead(502); return res.end(); }
    }
    let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const cand of [rel, rel + ".html"]) { const f = join(root, cand); try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {} }
    res.writeHead(404); res.end("");
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r)); return `http://127.0.0.1:${port}`;
}

const base = await start("/workspace/wt-engine-gaps-15nov/site", 8875);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const R = { errs: {} };
const watch = (p, tag) => { const e = (R.errs[tag] = R.errs[tag] || []); p.on("console", (m) => { if (m.type() === "error") e.push(m.text().slice(0, 200)); }); p.on("pageerror", (x) => e.push("pageerror " + String(x).slice(0, 200))); };
async function waitCards(page) {
  await page.waitForFunction(() => { const all = [...document.querySelectorAll(".card"), ...(window.WM_CARD_STORE ? WM_CARD_STORE.querySelectorAll(".card") : [])]; return all.length > 600 && all.filter((c) => c.dataset.s).length > 580; }, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(8000);
}
const dump = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll(".card"), ...(window.WM_CARD_STORE ? WM_CARD_STORE.querySelectorAll(".card") : [])];
  const seen = new Set(), out = []; const X = (e) => (e ? (e.textContent || "").replace(/\s+/g, " ").trim() : "");
  for (const c of all) { const id = X(c.querySelector(".icao")); if (!id || seen.has(id)) continue; seen.add(id);
    const w = c.__wm || {}, v2 = w.v2 || {}, u = w.weatherUsed || v2.weatherUsed || null;
    out.push({ id, s: c.dataset.s || "", badge: X(c.querySelector(".badge")), why: X(c.querySelector(".why")).slice(0, 160), src: u ? u.src : null, early: u ? u.tafEarly || null : null,
      label: v2.source ? v2.source.label : null, rules: (v2.findings || []).filter((f) => f.lv === "caution" || f.lv === "nogo").map((f) => f.lv + ":" + f.ruleId), da: v2.da != null ? v2.da : null, chips: [...c.querySelectorAll(".fcb2 .fbadge")].map(X).join("·") });
  }
  return { now: Date.now(), cards: out, counts: window.WM_COUNTS ? WM_COUNTS() : null };
});

const T0 = Date.now() + 5000;   // both pages run on the same frozen clock
async function open(hold, mode, off, da) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await ctx.addInitScript(([mode, off, da, T0]) => { const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm.phaseMode": mode, "wm-da-verdict": da ? "1" : "0" };
    for (const k in d) localStorage.setItem(k, d[k]); if (off != null) localStorage.setItem("wm.arriveAt", JSON.stringify({ off, at: null, t: T0 })); else localStorage.removeItem("wm.arriveAt"); }, [mode, off, da, T0]);
  await ctx.clock.install({ time: T0 });
  let held = 0; if (hold) await ctx.route(/ad-rwy-db\.[0-9a-f]+\.json/, async (route) => { held++; await new Promise((r) => setTimeout(r, hold)); await route.continue(); });
  const p = await ctx.newPage(); watch(p, (hold ? "held-" : "normal-") + mode + off + da);
  await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  return { ctx, p, held: () => held };
}
const out = [];
for (const [mode, off, da] of [["depart", null, 0], ["land", 3, 1]]) {
  const A = await open(0, mode, off, da), B = await open(7000, mode, off, da);
  await B.p.waitForTimeout(3500); const early = await dump(B.p);
  await Promise.all([waitCards(A.p), waitCards(B.p)]); await B.p.waitForTimeout(4000);
  const a = await dump(A.p), bb = await dump(B.p);
  const key = (c) => [c.s, c.badge, c.why, c.rules.join(","), c.da, c.chips].join(" | ");
  const M = new Map(a.cards.map((c) => [c.id, key(c)])); const diffs = bb.cards.filter((c) => M.get(c.id) !== key(c)).map((c) => ({ id: c.id, normal: M.get(c.id), held: key(c) }));
  const r = { mode, off, da, held: B.held(), cards: bb.cards.length, earlyCards: early.cards.length, earlyPending: early.cards.filter((c) => /Loading runway data/.test(c.why)).length,
    earlyJudged: early.cards.filter((c) => /^(go|caution|nogo)$/.test(c.s)).length, diffs: diffs.length, sample: diffs.slice(0, 10) };
  console.log(JSON.stringify(r)); out.push(r);
  await A.ctx.close(); await B.ctx.close();
}
writeFileSync(`${OUT}/lazy-db-check.json`, JSON.stringify({ out, errs: R.errs }, null, 1));
await b.close(); process.exit(0);

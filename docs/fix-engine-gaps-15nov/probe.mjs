// Before (b0496a909 = live code) vs after (fix/engine-gaps-15nov), same frozen /api data, 390 px Amethyst (purple) night.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import http from "node:http"; import { readFile, stat } from "node:fs/promises"; import { join, extname, normalize } from "node:path";
const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/fix-engine-gaps-15nov";
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
const TREES = { after: await start("/workspace/wt-engine-gaps-15nov/site", 8873), before: await start("/workspace/wt-merge-cardchain-15nov/site", 8874) };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const out = {};
for (const [tree, base] of Object.entries(TREES)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  await ctx.addInitScript(() => { if (sessionStorage.getItem("seeded")) return; const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": "10", "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": "depart" }; for (const k in d) localStorage.setItem(k, d[k]); sessionStorage.setItem("seeded", "1"); });
  const get = (p) => p.evaluate(() => { const all = [...document.querySelectorAll(".card"), ...(window.WM_CARD_STORE ? WM_CARD_STORE.querySelectorAll(".card") : [])]; const m = {};
    for (const c of all) { const id = ((c.querySelector(".icao") || {}).textContent || "").trim(); if (!id || m[id]) continue; const v2 = (c.__wm && c.__wm.v2) || {}; m[id] = { s: c.dataset.s, why: (v2.why || "").slice(0, 120), src: v2.source && v2.source.kind, rules: (v2.findings || []).filter((f) => f.lv !== "note").map((f) => f.lv + ":" + f.ruleId).join(",") }; } return m; });
  const a = await ctx.newPage(); await a.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded" });
  await a.waitForFunction(() => { const all = [...document.querySelectorAll(".card"), ...(window.WM_CARD_STORE ? WM_CARD_STORE.querySelectorAll(".card") : [])]; return all.length > 600 && all.filter((c) => c.dataset.s).length > 580; }, { timeout: 90000 }).catch(() => {}); await a.waitForTimeout(8000);
  const s = await ctx.newPage(); await s.goto(base + "/status_demo.html?solo=1", { waitUntil: "domcontentloaded" }); await s.waitForTimeout(20000);
  const A = await get(a), S = await get(s);
  const diff = Object.keys(A).filter((k) => S[k] && A[k].s !== S[k].s).map((k) => ({ id: k, aero: A[k], status: S[k] }));
  out[tree] = { nA: Object.keys(A).length, nS: Object.keys(S).length, diff };
  console.log(tree, Object.keys(A).length, Object.keys(S).length, JSON.stringify(diff, null, 1));
  await ctx.close();
}
writeFileSync(OUT + "/status-vs-aero-percard.json", JSON.stringify(out, null, 1)); await b.close(); process.exit(0);

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
const TREES = { after: await start("/workspace/wt-engine-gaps-15nov/site", 8941), before: await start("/workspace/wt-merge-cardchain-15nov/site", 8942) };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const base = TREES.after;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
for (const path of ["/main.html?solo=1", "/status_demo.html?solo=1"]) {
  const p = await ctx.newPage(); await p.goto(base + path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(25000);
  const r = await p.evaluate(() => { const S = window.WMST || {}; const all = [...document.querySelectorAll(".card"), ...(window.WM_CARD_STORE ? WM_CARD_STORE.querySelectorAll(".card") : [])];
    const c = all.find((x) => ((x.querySelector(".icao") || {}).textContent || "").trim() === "FAVV"); const v2 = c && c.__wm && c.__wm.v2;
    return { metar: S.metar && S.metar.FAVV ? (S.metar.FAVV.rawOb || S.metar.FAVV.raw || JSON.stringify(S.metar.FAVV)).slice(0, 120) : null, hasCard: !!c, s: c && c.dataset.s,
      used: v2 && v2.weatherUsed ? { src: v2.weatherUsed.src, vis: v2.weatherUsed.vis, visSrc: v2.weatherUsed.visSrc, raw: String(v2.weatherUsed.raw || "").slice(0, 90) } : null, label: v2 && v2.source && v2.source.label,
      findings: v2 && (v2.findings || []).map((f) => f.lv + ":" + f.ruleId + ":" + f.txt.slice(0, 70)), cardHtml: c ? c.outerHTML.length : 0, inList: c ? !!c.closest("#list") : null }; });
  console.log(path, JSON.stringify(r, null, 1));
}
await b.close(); process.exit(0);

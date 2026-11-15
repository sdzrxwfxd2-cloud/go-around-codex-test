import { createRequire } from "node:module";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/eye-icon-15nov";
const ROOT = "/workspace/wt-eye-icon-15nov/site";
const PORT = 8895;
const LIVE = "https://go-around-aero.pages.dev";
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };
const cache = {};
async function start(root, port) {
  const s = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      if (req.method !== "GET") { res.writeHead(204); return res.end(); }
      const key = p === "/api/wx-now" || p === "/api/metar" || p === "/api/taf" ? p : req.url;
      try {
        if (!cache[key]) cache[key] = fetch(LIVE + req.url).then(async (r) => ({ st: r.status, ct: r.headers.get("content-type") || "application/json", b: Buffer.from(await r.arrayBuffer()) }));
        const c = await cache[key]; res.writeHead(c.st, { "content-type": c.ct }); return res.end(c.b);
      } catch (e) { res.writeHead(502); return res.end(); }
    }
    let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const cand of [rel, rel + ".html"]) {
      const f = join(root, cand);
      try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {}
    }
    res.writeHead(404); res.end("");
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r));
  return `http://127.0.0.1:${port}`;
}

const base = await start(ROOT, PORT);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
await ctx.addInitScript(() => {
  const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": "10", "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": "depart", "wm-da-verdict": "0" };
  for (const k in d) localStorage.setItem(k, d[k]);
});
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (x) => errs.push(String(x).slice(0, 200)));
await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForFunction(() => {
  const all = [...document.querySelectorAll("#list .card"), ...(window.WM_CARD_STORE ? [...WM_CARD_STORE.querySelectorAll(".card")] : [])];
  return all.length > 600;
}, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(8000);

async function showCard(id) {
  await p.evaluate((id) => {
    const box = document.querySelector("#q, .wsch input, input[type=search], input[placeholder], .wflt input");
    if (box) {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      proto.set.call(box, id);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, id);
  await p.waitForTimeout(1500);
  const h = await p.evaluateHandle((id) => {
    return [...document.querySelectorAll(".card")].find((c) => ((c.querySelector(".icao") || {}).textContent || "").trim() === id && getComputedStyle(c).display !== "none") || null;
  }, id);
  return h.asElement();
}

async function openEye(el) {
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await el.evaluate((c) => { const b = c.querySelector(".inote"); if (b) b.click(); });
  await p.waitForTimeout(700);
}

function inspect() {
  return p.evaluate(() => {
    const pop = document.querySelector(".ipop.on, .ipop.wm-imod.on");
    if (!pop) return { open: false };
    const r = pop.getBoundingClientRect();
    const rows = [...pop.querySelectorAll(".ad-in-c")].map((e) => {
      const b = e.getBoundingClientRect();
      return { t: (e.textContent || "").replace(/\s+/g, " ").trim(), w: Math.round(b.width), h: Math.round(b.height), vis: b.height > 0 && b.bottom > 0 && b.top < innerHeight, clip: e.scrollWidth > e.clientWidth + 2 };
    });
    const issues = [];
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) issues.push("outside viewport");
    if (rows.some((x) => !x.vis)) issues.push("row not visible: " + rows.filter((x) => !x.vis).map((x) => x.t).join(" | "));
    if (rows.some((x) => x.clip)) issues.push("row clipped");
    return { open: true, size: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }, scroll: { sh: pop.scrollHeight, ch: pop.clientHeight }, rows, issues, hasLow: rows.some((x) => /LOW CLOUD/.test(x.t)) };
  });
}

mkdirSync(OUT, { recursive: true });
const report = {};
for (const id of ["FAAR", "FACT"]) {
  const el = await showCard(id);
  if (!el) { console.log("missing", id); continue; }
  await openEye(el);
  const info = await inspect();
  report[id] = info;
  const pop = await p.$(".ipop.on, .ipop.wm-imod.on");
  if (pop) {
    await pop.screenshot({ path: `${OUT}/legend-lowcloud-${id}-panel-390.png` });
    const legend = await p.$(".ipop.on .ad-in-x");
    if (legend) await legend.screenshot({ path: `${OUT}/legend-lowcloud-${id}-key-390.png` });
  }
  await p.screenshot({ path: `${OUT}/legend-lowcloud-${id}-page-390.png` });
  console.log(id, JSON.stringify(info));
  await p.evaluate(() => { const x = document.querySelector(".ipop.on .wm-ix, .wm-ibk"); if (x) x.click(); else { const p = document.querySelector(".ipop.on"); if (p) p.classList.remove("on"); } });
  await p.waitForTimeout(250);
}
writeFileSync(`${OUT}/legend-lowcloud-layout.json`, JSON.stringify({ report, errs }, null, 2));
await b.close();
process.exit(0);

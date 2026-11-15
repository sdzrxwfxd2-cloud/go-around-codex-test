import { createRequire } from "node:module";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/eye-icon-15nov";
const LIVE_ROOT = "/tmp/live-eye-15nov/site";
const BRANCH_ROOT = "/workspace/wt-eye-icon-15nov/site";
const LIVE_ORIGIN = "https://go-around-aero.pages.dev";
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };

const cache = {};
async function start(root, port) {
  const s = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      if (req.method !== "GET") { res.writeHead(204); return res.end(); }
      const key = p === "/api/wx-now" || p === "/api/metar" || p === "/api/taf" ? p : req.url;
      try {
        if (!cache[key]) cache[key] = fetch(LIVE_ORIGIN + req.url).then(async (r) => ({ st: r.status, ct: r.headers.get("content-type") || "application/json", b: Buffer.from(await r.arrayBuffer()) }));
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
  return { url: `http://127.0.0.1:${port}`, close: () => s.close() };
}

function rect(r, origin) {
  const o = origin || { left: 0, top: 0 };
  return { x: Math.round(r.left - o.left), y: Math.round(r.top - o.top), w: Math.round(r.width), h: Math.round(r.height) };
}

async function boot(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
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
  return { ctx, p, errs };
}

async function showCard(p, id) {
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

async function ensureOpen(p, el, inject) {
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await el.evaluate((c, inject) => {
    const fc = c.querySelector(".crow .fcb2, .fcb2");
    if (!fc) return "no-fcb2";
    let b = fc.querySelector(".inote");
    if (!b && inject) {
      b = document.createElement("button");
      b.className = "inote";
      b.textContent = "i";
      fc.appendChild(b);
      if (window.WMADCARD && typeof WMADCARD.pass === "function") WMADCARD.pass();
    }
    if (!b) return "no-inote";
    b.click();
    return "clicked";
  }, inject);
  await p.waitForTimeout(800);
}

function inspect(p) {
  return p.evaluate(() => {
    const pop = document.querySelector(".ipop.on, .ipop.wm-imod.on");
    if (!pop) return { open: false };
    const pr = pop.getBoundingClientRect();
    const key = pop.querySelector(".ad-in-x");
    const kr = key ? key.getBoundingClientRect() : null;
    const cs = getComputedStyle(pop.querySelector(".ad-in-c") || document.documentElement);
    const rows = [...pop.querySelectorAll(".ad-in-c")].map((e) => {
      const lab = e.querySelector(".wfc") || e.children[0];
      const txt = e.children[1];
      const er = e.getBoundingClientRect();
      return {
        label: ((lab && lab.textContent) || "").replace(/\s+/g, " ").trim(),
        text: ((txt && txt.textContent) || "").replace(/\s+/g, " ").trim(),
        row: { w: Math.round(er.width), h: Math.round(er.height) },
        lab: lab ? { x: Math.round(lab.getBoundingClientRect().left - er.left), w: Math.round(lab.getBoundingClientRect().width), h: Math.round(lab.getBoundingClientRect().height) } : null,
        txt: txt ? { x: Math.round(txt.getBoundingClientRect().left - er.left), y: Math.round(txt.getBoundingClientRect().top - er.top), w: Math.round(txt.getBoundingClientRect().width), h: Math.round(txt.getBoundingClientRect().height) } : null,
        gap: (lab && txt) ? Math.round(txt.getBoundingClientRect().left - lab.getBoundingClientRect().right) : null
      };
    });
    const now = (pop.querySelector(".ad-in-r small") || {}).textContent || "";
    return {
      open: true,
      now,
      grid: { cols: cs.gridTemplateColumns, gap: cs.columnGap, pad: cs.padding, align: cs.alignItems },
      pop: { w: Math.round(pr.width), h: Math.round(pr.height) },
      key: kr ? { w: Math.round(kr.width), h: Math.round(kr.height) } : null,
      rows
    };
  });
}

async function closeEye(p) {
  await p.evaluate(() => {
    const x = document.querySelector(".ipop.on .wm-ix, .wm-ibk");
    if (x) x.click();
    else { const pop = document.querySelector(".ipop.on"); if (pop) pop.classList.remove("on"); }
  });
  await p.waitForTimeout(250);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const report = {};

for (const [tag, root, port, inject] of [
  ["before-live", LIVE_ROOT, 8896, true],
  ["after", BRANCH_ROOT, 8897, false]
]) {
  const srv = await start(root, port);
  const { ctx, p, errs } = await boot(browser, srv.url);
  report[tag] = { errs };
  for (const id of ["FAAR", "FACT"]) {
    const el = await showCard(p, id);
    if (!el) { console.log(tag, id, "missing"); continue; }
    await ensureOpen(p, el, inject);
    const info = await inspect(p);
    report[tag][id] = info;
    const pop = await p.$(".ipop.on, .ipop.wm-imod.on");
    const key = await p.$(".ipop.on .ad-in-x");
    if (pop) await pop.screenshot({ path: `${OUT}/key-${tag}-${id}-panel-390.png` });
    if (key) await key.screenshot({ path: `${OUT}/key-${tag}-${id}-key-390.png` });
    await p.screenshot({ path: `${OUT}/key-${tag}-${id}-page-390.png` });
    console.log(tag, id, JSON.stringify(info));
    await closeEye(p);
  }
  await ctx.close();
  srv.close();
}

// compare VFR–LIFR row metrics live vs branch
const cmp = {};
for (const id of ["FAAR", "FACT"]) {
  const a = report["before-live"] && report["before-live"][id];
  const b = report["after"] && report["after"][id];
  if (!a || !b) { cmp[id] = "missing"; continue; }
  const rows = [];
  const n = Math.max(a.rows.length, b.rows.length);
  for (let i = 0; i < n; i++) {
    const L = a.rows[i], R = b.rows[i];
    if (!L || !R) { rows.push({ i, label: (R || L).label, only: L ? "live" : "branch" }); continue; }
    rows.push({
      label: L.label,
      indentLive: L.txt && L.txt.x, indentBranch: R.txt && R.txt.x,
      gapLive: L.gap, gapBranch: R.gap,
      hLive: L.row.h, hBranch: R.row.h,
      textMoved: (L.txt && R.txt) ? (L.txt.x !== R.txt.x || L.gap !== R.gap || L.row.h !== R.row.h) : true,
      sameLabel: L.label === R.label,
      sameText: L.text === R.text
    });
  }
  cmp[id] = { gridLive: a.grid, gridBranch: b.grid, rows };
}
writeFileSync(`${OUT}/key-live-vs-branch.json`, JSON.stringify({ report, cmp }, null, 2));
console.log("COMPARE", JSON.stringify(cmp, null, 2));
await browser.close();
process.exit(0);

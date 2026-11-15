// 390px Amethyst screenshots of the opened eye panel after the LOW CLOUD detail + flexible layout change.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/eye-icon-15nov";
const DOCS = "/workspace/wt-eye-icon-15nov/docs/eye-icon-15nov";
const ROOT = process.env.SITE_ROOT || "/workspace/wt-eye-icon-15nov/site";
const PORT = +(process.env.PORT || 8894);
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

function seed(theme, pal) {
  return (theme, pal) => {
    const d = { "wm-theme": theme, "wm-pal": pal, "wm-count": "all", "wm-perpage": "10", "wm-ac": "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": "depart", "wm-da-verdict": "0" };
    for (const k in d) localStorage.setItem(k, d[k]);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-pal", pal);
  };
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
p.on("pageerror", (x) => errs.push("pageerror " + String(x).slice(0, 200)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForFunction(() => {
  const all = [...document.querySelectorAll("#list .card"), ...(window.WM_CARD_STORE ? [...WM_CARD_STORE.querySelectorAll(".card")] : [])];
  return all.length > 600 && all.filter((c) => c.dataset.s && c.dataset.s !== "none").length > 400;
}, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(8000);

const dump = await p.evaluate(() => {
  const all = [...document.querySelectorAll("#list .card"), ...(window.WM_CARD_STORE ? [...WM_CARD_STORE.querySelectorAll(".card")] : [])];
  const seen = new Set(), cards = [];
  const X = (e) => (e ? (e.textContent || "").replace(/\s+/g, " ").trim() : "");
  const nowOf = (c) => {
    const i = c.querySelector(".inote");
    const n = i && i.dataset.n || "";
    const m = n.match(/<small>([^<]*)<\/small>/);
    return m ? m[1].replace(/&amp;/g, "&") : "";
  };
  for (const c of all) {
    const id = X(c.querySelector(".icao"));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const badges = [...c.querySelectorAll(".fcb2 .fbadge")].map((b) => X(b)).filter(Boolean);
    const chip = X(c.querySelector(".crow .wfc") || c.querySelector(".wfc"));
    const used = (c.__wm && (c.__wm.weatherUsed || (c.__wm.v2 && c.__wm.v2.weatherUsed))) || null;
    const low = badges.includes("LOW CLOUD") || /^LOW CLOUD$/.test(chip);
    const nowX = nowOf(c);
    cards.push({
      id,
      name: X((c.querySelector(".ch h2 .nm") || c.querySelector(".ch h2"))),
      chip, badges, low, nowX,
      usedSrc: (used && (used.src || used.ceilSrc || used.visSrc)) || (c.dataset.src || "") || (c.dataset.model === "1" ? "model" : ""),
      inote: !!c.querySelector(".inote")
    });
  }
  const low = cards.filter((c) => c.low);
  const bySrc = {};
  for (const c of low) { const k = (c.usedSrc || "none").toLowerCase(); bySrc[k] = (bySrc[k] || 0) + 1; }
  const longest = [...cards].sort((a, b) => b.nowX.length - a.nowX.length).slice(0, 8);
  return {
    total: cards.length,
    withEye: cards.filter((c) => c.inote).length,
    lowCloud: low.length,
    lowBySrc: bySrc,
    lowExamples: low.map((c) => ({ id: c.id, src: c.usedSrc, nowX: c.nowX, name: c.name })),
    fact: cards.find((c) => c.id === "FACT") || null,
    faar: cards.find((c) => c.id === "FAAR") || null,
    longest
  };
});

writeFileSync(`${OUT}/detail-count.json`, JSON.stringify(dump, null, 2));
console.log(JSON.stringify({
  total: dump.total, withEye: dump.withEye, lowCloud: dump.lowCloud, lowBySrc: dump.lowBySrc,
  faar: dump.faar, fact: dump.fact,
  lowSample: dump.lowExamples.slice(0, 12),
  longest: dump.longest,
  errs: errs.slice(0, 8)
}, null, 2));

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

async function closeEye() {
  await p.evaluate(() => {
    const x = document.querySelector(".ipop.on .wm-ix, .wm-ibk, .ipop.on [aria-label='Close']");
    if (x) x.click();
    else { const pop = document.querySelector(".ipop.on"); if (pop) pop.classList.remove("on"); }
  });
  await p.waitForTimeout(250);
}

function inspectLayout() {
  return p.evaluate(() => {
    const pop = document.querySelector(".ipop.on, .ipop.wm-imod.on");
    if (!pop) return { open: false };
    const r = pop.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const issues = [];
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      issues.push(`panel outside viewport L${r.left.toFixed(1)} T${r.top.toFixed(1)} R${r.right.toFixed(1)} B${r.bottom.toFixed(1)} vs ${vw}x${vh}`);
    }
    const walk = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "hidden") {
        issues.push(`clipped-x ${el.className} ${el.scrollWidth}>${el.clientWidth} "${(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,80)}"`);
      }
      for (const ch of el.children) walk(ch);
    };
    walk(pop);
    const now = (pop.querySelector(".ad-in-r small") || {}).textContent || "";
    const cats = [...pop.querySelectorAll(".ad-in-c")].map((e) => {
      const b = e.getBoundingClientRect();
      return { t: (e.textContent || "").replace(/\s+/g, " ").trim(), vis: b.height > 0 && b.bottom > 0 && b.top < vh };
    });
    const hiddenCats = cats.filter((c) => !c.vis).map((c) => c.t);
    if (hiddenCats.length) issues.push("category not visible: " + hiddenCats.join(" | "));
    return {
      open: true,
      now,
      size: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) },
      scroll: { sh: pop.scrollHeight, ch: pop.clientHeight, sw: pop.scrollWidth, cw: pop.clientWidth },
      cats,
      issues,
      theme: document.documentElement.getAttribute("data-theme") + "/" + document.documentElement.getAttribute("data-pal")
    };
  });
}

async function openAndShot(id, tag, { alsoPage = true } = {}) {
  const el = await showCard(id);
  if (!el) { console.log("missing card", id); return null; }
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  const clicked = await el.evaluate((c) => {
    const b = c.querySelector(".crow .inote, .fcb2 .inote, .inote");
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicked) { console.log("no inote", id); return null; }
  await p.waitForTimeout(700);
  const info = await inspectLayout();
  const pop = await p.$(".ipop.on, .ipop.wm-imod.on");
  const panelPath = `${OUT}/${tag}-panel-390.png`;
  const pagePath = `${OUT}/${tag}-panel-page-390.png`;
  if (pop) await pop.screenshot({ path: panelPath });
  if (alsoPage) await p.screenshot({ path: pagePath });
  console.log("shot", id, tag, JSON.stringify(info));
  return { info, panelPath, pagePath };
}

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const faar = await openAndShot("FAAR", "detail-lowcloud-FAAR");
await closeEye();

// other LOW CLOUD: prefer TAF, else a model card that is not FAAR
const otherLow = dump.lowExamples.find((c) => /taf/i.test(c.src) && c.id !== "FAAR")
  || dump.lowExamples.find((c) => /model|open-meteo|om/i.test(c.src) && c.id !== "FAAR")
  || dump.lowExamples.find((c) => c.id !== "FAAR");
let other = null;
if (otherLow) {
  other = await openAndShot(otherLow.id, `detail-lowcloud-${otherLow.id}`);
  await closeEye();
}

const fact = await openAndShot("FACT", "detail-FACT");
await closeEye();

// Narrow long-text case: pick the longest Now subtitle, shoot at 320px Amethyst
const longPick = (dump.longest && dump.longest[0] && dump.longest[0].id) || (otherLow && otherLow.id) || "FAAR";
await p.setViewportSize({ width: 320, height: 844 });
const longEl = await showCard(longPick);
if (longEl) {
  await longEl.scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await longEl.evaluate((c) => { const b = c.querySelector(".inote"); if (b) b.click(); });
  await p.waitForTimeout(700);
  const infoN = await inspectLayout();
  const popN = await p.$(".ipop.on, .ipop.wm-imod.on");
  if (popN) await popN.screenshot({ path: `${OUT}/detail-narrow-longtext-${longPick}-320.png` });
  await p.screenshot({ path: `${OUT}/detail-narrow-longtext-${longPick}-page-320.png` });
  console.log("narrow", longPick, JSON.stringify(infoN));
  await closeEye();
}
await p.setViewportSize({ width: 390, height: 844 });

// Theme layout check (FAAR opened) — Amethyst already done; also Pearl, Champagne, Midnight
const themes = [
  ["night", "purple", "Amethyst"],
  ["night", "black", "Midnight"],
  ["day", "white", "Pearl"],
  ["day", "beige", "Champagne"]
];
const themeReport = [];
for (const [theme, pal, name] of themes) {
  await p.evaluate(([theme, pal]) => {
    localStorage.setItem("wm-theme", theme);
    localStorage.setItem("wm-pal", pal);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-pal", pal);
  }, [theme, pal]);
  await p.waitForTimeout(250);
  const opened = await openAndShot("FAAR", `detail-theme-${name.toLowerCase()}-FAAR`, { alsoPage: false });
  themeReport.push({ name, theme, pal, info: opened && opened.info });
  await closeEye();
}

writeFileSync(`${OUT}/detail-layout.json`, JSON.stringify({ faar, other, otherLow, fact, longPick, themeReport, errs }, null, 2));
console.log("THEMES", JSON.stringify(themeReport, null, 2));

await b.close();
process.exit(0);

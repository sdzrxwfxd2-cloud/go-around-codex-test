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
const TREES = { before: await start("/workspace/wt-merge-cardchain-15nov/site", 8871), after: await start("/workspace/wt-engine-gaps-15nov/site", 8872) };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const R = { at: new Date().toString(), modes: {}, status: {}, errs: {} };
async function ctxFor(mode, off, ac) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  await ctx.addInitScript(([mode, off, ac]) => { if (sessionStorage.getItem("seeded")) return;
    const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": "10", "wm-ac": ac || "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": mode };
    for (const k in d) localStorage.setItem(k, d[k]);
    if (off != null) localStorage.setItem("wm.arriveAt", JSON.stringify({ off, at: null, t: Date.now() })); else localStorage.removeItem("wm.arriveAt");
    sessionStorage.setItem("seeded", "1"); }, [mode, off, ac]);
  return ctx;
}
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
const MODES = [["depart", null], ["land0", 0], ["land1", 1], ["land3", 3]];
for (const [name, off] of MODES) {
  for (const [tree, base] of Object.entries(TREES)) {
    const ctx = await ctxFor(off == null ? "depart" : "land", off); const p = await ctx.newPage(); watch(p, tree + "-" + name);
    await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await waitCards(p);
    await p.screenshot({ path: `${OUT}/${tree}-aerodromes-${name}-390.png` });
    const d = await dump(p); (R.modes[name] = R.modes[name] || {})[tree] = d;
    const cnt = {}; d.cards.forEach((c) => (cnt[c.s] = (cnt[c.s] || 0) + 1));
    console.log(name, tree, d.cards.length, JSON.stringify(cnt), "WM_COUNTS", JSON.stringify(d.counts));
    await ctx.close();
  }
}
// ---- Status vs Aerodromes, every aircraft, Depart and Land ----
const ACS = ["C172","PA28","C152","SLG2","PA34","DA20","DA42","SLG4","C182","DA40","DA40NG","P2008"];
for (const [tree, base] of Object.entries(TREES)) {
  const ctx = await ctxFor("depart", null); const a = await ctx.newPage(); watch(a, tree + "-status-aero");
  await a.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await waitCards(a);
  const s = await ctx.newPage(); watch(s, tree + "-status");
  await s.goto(base + "/status_demo.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await s.waitForTimeout(15000);
  const sc = () => s.evaluate(() => { const v = {}; document.querySelectorAll(".v4 .cnt>div[data-s]").forEach((el) => (v[el.dataset.s] = parseInt((el.querySelector("b") || {}).textContent, 10))); return v; });
  const pickAc = async (id) => { await s.evaluate(() => { const x = document.querySelector(".v4 .wsp-ac, #wsp .wsp-ac"); x && x.click(); }); await s.waitForTimeout(400);
    await s.evaluate((id) => { const o = document.querySelector('.opt[data-id="' + id + '"]'); o && o.click(); const d = document.querySelector(".wsh .x"); d && d.click(); }, id); await s.waitForTimeout(2500); };
  const setPhase = async (ph) => { await s.evaluate((ph) => { const bt = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim().toLowerCase() === ph); if (bt) bt.click(); }, ph); await s.waitForTimeout(2500); };
  const rows = [];
  for (const ph of ["depart", "land"]) { await setPhase(ph);
    for (const id of ACS) { await pickAc(id); const S = await sc();
      await a.evaluate(({ id, ph }) => { localStorage.setItem("wm-ac", id); localStorage.setItem("wm.phaseMode", ph); if (window.WMPHASE) WMPHASE.mode = ph; document.dispatchEvent(new CustomEvent("wm:phase", { detail: { mode: ph, arriveAt: ph === "land" ? Date.now() : null } })); if (typeof applyS === "function") applyS(); }, { id, ph });
      await a.waitForTimeout(2500); const A = await a.evaluate(() => (window.WM_COUNTS ? WM_COUNTS() : null));
      const diff = A ? Math.abs(A.go - S.go) + Math.abs(A.caution - S.caution) + Math.abs(A.nogo - S.nogo) : null;
      rows.push({ ph, ac: id, status: S, aero: A, diff, sum: (S.go || 0) + (S.caution || 0) + (S.nogo || 0) });
      console.log("status", tree, ph, id, JSON.stringify(S), "aero", JSON.stringify(A && { go: A.go, caution: A.caution, nogo: A.nogo }), "diff", diff);
      if (id === "C172" && ph === "depart") await s.screenshot({ path: `${OUT}/${tree}-status-c172-depart-390.png` });
    } }
  R.status[tree] = rows; await ctx.close();
}
// ---- FAHS detail: each tree's real Pages middleware (cloudflare/functions/_middleware.js) in front of its site folder ----
async function startMw(root, port) {
  const mw = await import(root.replace(/site$/, "cloudflare/functions/_middleware.js") + "?t=" + port);
  const file = async (pathname) => { let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const cand of [rel, rel + ".html"]) { const f = join(root, cand); try { if ((await stat(f)).isFile()) return new Response(await readFile(f), { status: 200, headers: { "content-type": T[extname(f)] || "application/octet-stream" } }); } catch {} }
    return new Response("", { status: 404 }); };
  const s = http.createServer(async (req, res) => {
    const url = "http://127.0.0.1:" + port + req.url, p = req.url.split("?")[0];
    if (p.startsWith("/api/")) { const c = cache[p] ? await cache[p] : null; res.writeHead(c ? c.st : 404, { "content-type": "application/json" }); return res.end(c ? c.b : ""); }
    const request = new Request(url, { headers: Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => typeof v === "string")) });
    let r; try { r = await mw.onRequest({ request, env: { ASSETS: { fetch: (q) => file(new URL(q.url).pathname) } }, next: () => file(p) }); } catch (e) { r = new Response("mw error " + e, { status: 500 }); }
    const h = {}; r.headers.forEach((v, k) => (h[k] = v)); res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r)); return `http://127.0.0.1:${port}`;
}
const MW = { before: await startMw("/workspace/wt-merge-cardchain-15nov/site", 8961), after: await startMw("/workspace/wt-engine-gaps-15nov/site", 8962) };
R.fahs = {};
for (const [tree, base] of Object.entries(MW)) {
  const ctx = await ctxFor("depart", null); const p = await ctx.newPage(); watch(p, tree + "-fahs");
  for (const u of ["/ad/FAHS.html?solo=1", "/ad/FAHS.html"]) { const r = await ctx.request.get(base + u, { headers: { "Sec-Fetch-Dest": "iframe" } }); const t = await r.text();
    (R.fahs[tree + "-direct"] = R.fahs[tree + "-direct"] || []).push({ u, status: r.status(), h1: (t.match(/<h1>([^<]*)/) || [])[1] || null, bytes: t.length }); }
  console.log("FAHS direct", tree, JSON.stringify(R.fahs[tree + "-direct"]));
  await p.goto(base + "/ad/FAHS", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForTimeout(15000);
  const info = await p.evaluate(() => { const f = [...document.querySelectorAll("iframe")].find((x) => /ad\/|fact\.html/.test(x.getAttribute("src") || "")); let h1 = null, len = 0;
    try { const d = f && f.contentDocument; h1 = d && d.querySelector("h1") ? d.querySelector("h1").textContent.trim() : null; len = d && d.body ? d.body.innerText.length : 0; } catch (e) {}
    return { src: f ? f.getAttribute("src") : null, h1, textLen: len, url: location.pathname }; });
  R.fahs[tree] = info; console.log("FAHS", tree, JSON.stringify(info));
  await p.screenshot({ path: `${OUT}/${tree}-fahs-detail-390.png` });
  await ctx.close();
}
// ---- FACT early-TAF fixture: FACT METAR removed, FACT TAF issued this hour, first period from +2 h ----
R.fact = {};
const now = new Date(); const H = now.getUTCHours(), D = now.getUTCDate(); const pad = (n) => String(n).padStart(2, "0");
const st = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), D, H + 2)), en = new Date(st.getTime() + 24 * 3600e3);
const FIXTAF = `TAF FACT ${pad(D)}${pad(H)}00Z ${pad(st.getUTCDate())}${pad(st.getUTCHours())}/${pad(en.getUTCDate())}${pad(en.getUTCHours())} 18010KT 9999 SCT030`;
R.fact.taf = FIXTAF;
const fixRows = (M, T) => { M = M.filter((m) => m.icaoId !== "FACT"); T = T.filter((t) => t.icaoId !== "FACT"); T.push({ icaoId: "FACT", issueTime: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), D, H)).toISOString(), rawTAF: FIXTAF }); return [M, T]; };
for (const [tree, base] of Object.entries(TREES)) {
  const ctx = await ctxFor("depart", null);
  await ctx.route(/\/api\/(wx-now|metar|taf)(\?|$)/, async (route) => { const u = new URL(route.request().url()); const r = await fetch(base + u.pathname); let j = await r.json();
    if (u.pathname === "/api/wx-now") { const [M, T] = fixRows(j.metar || [], j.taf || []); j.metar = M; j.taf = T; }
    else if (u.pathname === "/api/metar") j = fixRows(j, [])[0]; else j = fixRows([], j)[1];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) }); });
  const p = await ctx.newPage(); watch(p, tree + "-fact");
  await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await waitCards(p);
  const d = await dump(p); const c = d.cards.find((x) => x.id === "FACT"); R.fact[tree] = c; console.log("FACT", tree, JSON.stringify(c));
  await p.evaluate(() => { const box = document.querySelector("#q, .wsch input, input[type=search], input[placeholder]"); if (!box) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(box, "FACT"); box.dispatchEvent(new Event("input", { bubbles: true })); });
  await p.waitForTimeout(1500);
  const h = await p.evaluateHandle(() => [...document.querySelectorAll(".card")].find((c) => ((c.querySelector(".icao") || {}).textContent || "").trim() === "FACT" && getComputedStyle(c).display !== "none") || null);
  const el = h.asElement(); if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await el.screenshot({ path: `${OUT}/${tree}-fact-early-taf-card-390.png` }); }
  await ctx.close();
}
writeFileSync(`${OUT}/cmp-report.json`, JSON.stringify(R, null, 1));
await b.close(); process.exit(0);

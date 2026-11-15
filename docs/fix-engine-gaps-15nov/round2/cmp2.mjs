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
const TREES = { before: await start("/workspace/wt-merge-cardchain-15nov/site", 8871), after: await start("/workspace/wt-engine-gaps-15nov/site", 8872) };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const R = { at: new Date().toString(), modes: {}, status: {}, errs: {} };
async function ctxFor(mode, off, ac, da) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  await ctx.addInitScript(([mode, off, ac, da]) => { if (sessionStorage.getItem("seeded")) return;
    const d = { "wm-theme": "night", "wm-pal": "purple", "wm-count": "all", "wm-perpage": "10", "wm-ac": ac || "C172", "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm-heli-hide": "0", "wm.phaseMode": mode, "wm-da-verdict": da ? "1" : "0" };
    for (const k in d) localStorage.setItem(k, d[k]);
    if (off != null) localStorage.setItem("wm.arriveAt", JSON.stringify({ off, at: null, t: Date.now() })); else localStorage.removeItem("wm.arriveAt");
    sessionStorage.setItem("seeded", "1"); }, [mode, off, ac, da]);
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
for (const da of [0, 1]) for (const [name0, off] of MODES) {
  const name = name0 + (da ? "-daON" : "-daOFF");
  for (const [tree, base] of Object.entries(TREES)) {
    const ctx = await ctxFor(off == null ? "depart" : "land", off, null, da); const p = await ctx.newPage(); watch(p, tree + "-" + name);
    await p.goto(base + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await waitCards(p);
    await p.screenshot({ path: `${OUT}/${tree}-aerodromes-${name}-390.png` });
    const d = await dump(p); (R.modes[name] = R.modes[name] || {})[tree] = d;
    const cnt = {}; d.cards.forEach((c) => (cnt[c.s] = (cnt[c.s] || 0) + 1));
    console.log(name, tree, d.cards.length, JSON.stringify(cnt), "WM_COUNTS", JSON.stringify(d.counts));
    await ctx.close();
  }
}
// ---- lazy DB: the runway JSON held back 6 s (after the first render) gives the same cards as the normal load ----
{
  const ctx = await ctxFor("depart", null, null, 0);
  let held = 0; await ctx.route(/ad-rwy-db\.[0-9a-f]+\.json/, async (route) => { held++; await new Promise((r) => setTimeout(r, 6000)); await route.continue(); });
  const p = await ctx.newPage(); watch(p, "after-lazy");
  await p.goto(TREES.after + "/main.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500); const early = await dump(p);
  await waitCards(p); const late = await dump(p);
  const ref = R.modes["depart-daOFF"].after, key = (c) => c.id + " " + c.s + " " + c.why;
  const A = new Map(ref.cards.map((c) => [c.id, key(c)])), diff = late.cards.filter((c) => A.get(c.id) !== key(c)).map((c) => [A.get(c.id), key(c)]);
  const pend = early.cards.filter((c) => /Loading runway data/.test(c.why)).length, judged = early.cards.filter((c) => /^(go|caution|nogo)$/.test(c.s)).length;
  R.lazy = { held, earlyPending: pend, earlyJudged: judged, lateDiffs: diff.length, diffs: diff.slice(0, 20) };
  console.log("lazy", JSON.stringify(R.lazy));
  await ctx.close();
}
// ---- Status vs Aerodromes, every aircraft, Depart and Land ----
const ACS = ["C172","PA28","C152","SLG2","PA34","DA20","DA42","SLG4","C182","DA40","DA40NG","P2008"];
for (const da of [0, 1]) for (const [tree, base] of Object.entries(TREES)) {
  const ctx = await ctxFor("depart", null, null, da); const a = await ctx.newPage(); watch(a, tree + "-status-aero-da" + da);
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
      rows.push({ da, ph, ac: id, status: S, aero: A, diff, sum: (S.go || 0) + (S.caution || 0) + (S.nogo || 0) });
      console.log("status", tree, "da" + da, ph, id, JSON.stringify(S), "aero", JSON.stringify(A && { go: A.go, caution: A.caution, nogo: A.nogo }), "diff", diff);
      if (id === "C172" && ph === "depart") await s.screenshot({ path: `${OUT}/${tree}-status-c172-depart-da${da}-390.png` });
    } }
  R.status[tree + "-da" + da] = rows; await ctx.close();
}
writeFileSync(`${OUT}/cmp-report.json`, JSON.stringify(R, null, 1));
await b.close(); process.exit(0);

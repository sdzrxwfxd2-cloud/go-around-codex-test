// tools/engine-bench/measure.mjs — the speed numbers of STEP 1 / STEP 3 on a phone profile (390x844, Chrome CPU 4x slower).
// Use: node tools/engine-bench/measure.mjs <label> [overlay folder ...]   -> prints JSON, writes tools/engine-bench/out/<label>.json
// Measures: page open -> first verdict; weather arrives -> verdicts updated; tap LAND / DEPART and tap +1h/+2h/+3h -> every card
// updated; long tasks (> 50 ms), layout shifts, and whether a tap really changed what the cards show.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { start } from "./serve.mjs";
const { chromium } = createRequire("/opt/npm-tools/node_modules/")("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || "run", overlays = process.argv.slice(3);
const RUNS = +(process.env.RUNS || 3), THROTTLE = +(process.env.THROTTLE || 4);
// Real clock (so the browser's own performance timings are real). The default profile has night switched on, so the hour of
// the day does not change the load. The fixtures are built for the same instant.
const NOW = Date.now();
const med = (a) => { const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };

const INIT = () => {
  const M = (window.__m = { longTasks: [], shifts: 0, passes: [], marks: {} });
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => M.longTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: "longtask", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) M.shifts += e.value; })).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  window.addEventListener("wm:pass", () => M.passes.push(performance.now()), true);
  M.api = {}; const F0 = window.fetch;
  if (F0) window.fetch = function (u) { const s = typeof u === "string" ? u : (u && u.url) || ""; const p = F0.apply(this, arguments);
    const m = /\/api\/(wx-now|metar|taf|model-weather)/.exec(s); if (m) p.then(() => { M.api[m[1]] = Math.max(M.api[m[1]] || 0, performance.now()); }, () => {}); return p; };
  // one string that says what every card shows: status + badge words + the reason line
  window.__snap = () => [...document.querySelectorAll(".card")].map((c) => (c.querySelector(".icao") || {}).textContent + "|" + c.dataset.s + "|" +
    ((c.querySelector(".badge") || {}).textContent || "").trim() + "|" + ((c.querySelector(".why") || {}).textContent || "").trim()).join("\n");
  // time from an action until the cards stop changing: resolves with { ms, changed, longest }
  window.__tap = (fn, settle = 900) => new Promise((res) => {
    const before = window.__snap(), t0 = performance.now(), lt0 = M.longTasks.length; let last = t0, changed = false;
    const mo = new MutationObserver(() => { last = performance.now(); });
    document.querySelectorAll("#list, #wsp-cards, #tiles").forEach((n) => mo.observe(n, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-s"] }));
    fn();
    const iv = setInterval(() => { if (performance.now() - last > settle) { clearInterval(iv); mo.disconnect(); const after = window.__snap(); changed = after !== before;
      const lts = M.longTasks.slice(lt0); res({ ms: Math.round(last - t0), changed, longest: lts.reduce((m, x) => Math.max(m, x.d), 0), longTasks: lts.length, cardsChanged: after.split("\n").filter((l, i) => l !== before.split("\n")[i]).length }); } }, 50);
  });
};

async function once(server, browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.addInitScript(() => { try { localStorage.setItem("wm-theme", "night"); localStorage.setItem("wm-pal", "purple"); } catch (e) {} });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const outside = new Set();
  await page.route((u) => u.hostname !== "127.0.0.1", (r) => { outside.add(new URL(r.request().url()).hostname); return r.abort(); });   // nothing leaves the machine
  // The real thing: the shell (/) with the Aerodromes list (main.html) inside it as a frame, exactly as users get it.
  // (page.waitForFunction is not used: its polling does not run under the installed clock.)
  const frameWith = async (test, ms) => { for (let i = 0; i < ms / 1000; i++) { for (const x of page.frames()) { try { if (await x.evaluate(test)) return x; } catch (e) {} } await page.waitForTimeout(1000); } return null; };   // sparse: polling costs CPU on the throttled page
  await page.goto(server.url + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(+(process.env.LOAD_WAIT || 22000));       // no polling while the page loads: everything is recorded inside the page
  const f = await frameWith(() => !!(window.__m && document.querySelectorAll("#list .card").length), 60000);
  if (!f) throw new Error("the Aerodromes list did not load");
  const load = await f.evaluate(() => {
    const M = window.__m, res = (n) => { const e = performance.getEntriesByType("resource").filter((x) => x.name.indexOf(n) >= 0)[0]; return e ? e.responseEnd : null; };
    const fcp = (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || null, frameStart = Math.round(performance.timeOrigin - window.top.performance.timeOrigin);
    const apply = performance.getEntriesByName("wm:applyS").map((e) => ({ t: Math.round(e.startTime), d: Math.round(e.duration) }));
    const fin = performance.getEntriesByName("wm:final-pass").map((e) => Math.round(e.duration));
    const wx = Math.max(M.api["wx-now"] || 0, M.api.metar || 0, M.api.taf || 0, res("/api/wx-now") || 0);
    const after = M.passes.filter((t) => t > wx);
    const pe = performance.getEntriesByName("wm:final-pass").map((e) => e.startTime + e.duration);
    if (!M.passes.length) M.passes = pe;
    return { frameStart, fcp: fcp && Math.round(fcp + frameStart), firstVerdict: Math.round(M.passes[0] + frameStart), wxArrived: Math.round(wx), verdictAfterData: after.length ? Math.round(after[after.length - 1] - wx) : null,
      firstVerdictAfterData: after.length ? Math.round(after[0] - wx) : null, applyS: apply, finalPass: fin, passes: M.passes.length, cards: document.querySelectorAll(".card").length,
      longTasksLoad: M.longTasks.length, longestLoad: M.longTasks.reduce((m, x) => Math.max(m, x.d), 0), totalLongLoad: M.longTasks.reduce((s, x) => s + x.d, 0), cls: +M.shifts.toFixed(4),
      counts: window.__n, hasPhaseUi: !!document.querySelector(".v4ph .ph button[data-v=land]") };
  });
  // The Depart / Land switch and the Arrive picker (Now, +1h, +2h, +3h) live on the Status view, a second frame with its own cards.
  await page.goto(server.url + "/#status", { waitUntil: "domcontentloaded" });
  const st = await frameWith(() => !!document.querySelector(".v4ph .ph button[data-v=land]"), 120000);
  if (!st) throw new Error("the Status view with the Depart / Land switch did not load");
  await page.waitForTimeout(12000);
  const list = await frameWith(() => !!(window.__m && document.querySelectorAll("#list .card").length), 60000);
  const taps = {};
  const click = (sel) => `var b=document.querySelector(${JSON.stringify(sel)}); if(b) b.click(); else throw new Error("no " + ${JSON.stringify(sel)});`;
  const tap = async (name, fn) => {
    if (+(process.env.TAP_GAP || 0)) await page.waitForTimeout(+process.env.TAP_GAP);   // a pilot's pause between taps
    const before = list ? await list.evaluate(() => window.__snap()) : "";
    const r = await st.evaluate(([c]) => window.__tap(new Function(c)), [fn]);
    const after = list ? await list.evaluate(() => window.__snap()) : "";
    r.listCardsChanged = after.split("\n").filter((l, i) => l !== before.split("\n")[i]).length;
    r.statusPhase = await st.evaluate(() => JSON.stringify({ m: window.WMPHASE.mode, a: window.WMPHASE.arrive }));
    r.listPhase = list ? await list.evaluate(() => JSON.stringify({ m: window.WMPHASE.mode, a: window.WMPHASE.arrive })) : null;
    r.counts = await st.evaluate(() => JSON.stringify(window.__n));
    taps[name] = r;
  };
  await tap("land", click(".v4ph .ph button[data-v=land]"));
  await tap("plus1h", click('.v4ph .arm button[data-o="1"]'));
  await tap("plus2h", click('.v4ph .arm button[data-o="2"]'));
  await tap("plus3h", click('.v4ph .arm button[data-o="3"]'));
  await tap("now", click('.v4ph .arm button[data-o="0"]'));
  await tap("depart", click(".v4ph .ph button[data-v=depart]"));
  // what one full re-evaluation of every card costs (the work a tap has to pay for when it re-runs everything)
  const fullPass = await st.evaluate(() => { const t = performance.now(); window.WMF.pass(); return Math.round(performance.now() - t); });
  await ctx.close();
  return { load, taps, fullPass, errors, outside: [...outside] };
}

const server = await start({ port: 8790 + Math.floor(Math.random() * 500), overlays, now: NOW });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(await once(server, browser));
await browser.close(); await server.close();
const pick = (f) => med(runs.map(f));
const summary = { label, overlays, throttle: THROTTLE, runs: RUNS, cards: runs[0].load.cards,
  load: { frameStartAfterPageOpen: pick((r) => r.load.frameStart), fcp: pick((r) => r.load.fcp), firstVerdict: pick((r) => r.load.firstVerdict), wxArrived: pick((r) => r.load.wxArrived),
    firstVerdictAfterData: pick((r) => r.load.firstVerdictAfterData), lastVerdictAfterData: pick((r) => r.load.verdictAfterData),
    passes: pick((r) => r.load.passes), applySCalls: pick((r) => r.load.applyS.length), applySLongest: pick((r) => Math.max(0, ...r.load.applyS.map((x) => x.d))), passMs: pick((r) => med(r.load.finalPass)), passMsTotal: pick((r) => r.load.finalPass.reduce((a, b) => a + b, 0)),
    longTasks: pick((r) => r.load.longTasksLoad), longestTask: pick((r) => r.load.longestLoad), totalLongTaskMs: pick((r) => r.load.totalLongLoad), cls: runs[0].load.cls },
  taps: Object.fromEntries(Object.keys(runs[0].taps).map((k) => [k, { ms: pick((r) => r.taps[k].ms), longest: pick((r) => r.taps[k].longest), changed: runs.every((r) => r.taps[k].changed), statusCardsChanged: pick((r) => r.taps[k].cardsChanged), listCardsChanged: pick((r) => r.taps[k].listCardsChanged), counts: runs[0].taps[k].counts, statusPhase: runs[0].taps[k].statusPhase, listPhase: runs[0].taps[k].listPhase }])),
  fullPassMs: pick((r) => r.fullPass), counts: runs[0].load.counts, apiHits: server.hits, errors: [...new Set(runs.flatMap((r) => r.errors))].slice(0, 8), blockedOutsideHosts: runs[0].outside };
mkdirSync(join(HERE, "out"), { recursive: true });
writeFileSync(join(HERE, "out", label + ".json"), JSON.stringify({ summary, runs }, null, 1));
console.log(JSON.stringify(summary, null, 1));

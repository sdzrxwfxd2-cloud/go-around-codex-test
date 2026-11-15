// tests/engine-v2/wire.test.mjs — the wire (site/engine/ga-core-v2-wire.js) loaded in a fake page. Core engine review, 13 Nov 2026.
// Run: node --test tests/engine-v2/wire.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const ENGINE = readFileSync(new URL("site/engine/ga-core-v2.js", ROOT), "utf8");
const WIRE = readFileSync(new URL("site/engine/ga-core-v2-wire.js", ROOT), "utf8");
// wst-engine.js (the old engine the wire takes over) and the page's location object are needed for the wire to attach.
const WST = readFileSync(new URL("site/wst/wst-engine.js", ROOT), "utf8");

/** A window with just enough page for the engine and the wire. Counts whole-document searches. */
export function page({ store = {}, onSelector = () => null } = {}) {
  const counts = { qs: 0 };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const document = { querySelector: (s) => { counts.qs++; return onSelector(s); }, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }), head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
    dispatchEvent() {}, documentElement: { classList: { add() {}, remove() {}, contains: () => false } }, readyState: "complete", body: {} };
  const win = { document, localStorage: ls, console, Date, Math, JSON, Promise, setTimeout, clearTimeout, queueMicrotask, performance: { now: () => 0, mark() {}, measure() {} },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, CustomEvent: function (t, d) { this.type = t; this.detail = d && d.detail; } };
  win.window = win; win.self = win; win.globalThis = win; win.location = { search: "", pathname: "/main.html", href: "http://x/main.html" };
  win.fetch = () => new Promise(() => {}); win.setInterval = () => 0; win.clearInterval = () => {}; win.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; };
  vm.createContext(win);
  vm.runInContext(WST, win, { filename: "wst-engine.js" });
  vm.runInContext(ENGINE, win, { filename: "ga-core-v2.js" });
  vm.runInContext(WIRE, win, { filename: "ga-core-v2-wire.js" });
  win.GACoreV2Wire = { status: (...a) => win.WST.status(...a) };
  return { win, counts, store };
}

const A = { ic: "FAGC", la: -26.24, lo: 28.15, el: 5321, rw: ["17", "35"] };
const NOW = Date.UTC(2026, 10, 13, 10, 0);          // 12:00 SAST, daylight
const OB = { ws: 8, wd: 170, g: null, vis: 10, ceil: null, t: 22, qnh: 1020, time: NOW - 10 * 6e4 };

test("E-01: before phase.js has set WMPHASE, 640 verdicts in one loop search the page once, not 640 times", async () => {
  const { win, counts } = page();
  assert.equal(win.GA_USE_ENGINE_V2, true, "the wire attached");
  await Promise.resolve(); counts.qs = 0;                         // start-up lookups are not part of the verdict loop
  for (let i = 0; i < 640; i++) win.GACoreV2Wire.status(A, OB, "C172", "v2", null, NOW);
  assert.ok(counts.qs <= 1, `whole-page searches in one loop: ${counts.qs}`);
  await Promise.resolve();
  win.GACoreV2Wire.status(A, OB, "C172", "v2", null, NOW);
  assert.ok(counts.qs <= 2, "the next turn may look again (the buttons may have appeared)");
});

test("E-01: the answer is unchanged — stored 'land' wins, a pressed LAND button counts, otherwise DEPART", async () => {
  const phaseSeen = (setup) => { const p = page(setup); const seen = []; const ev = p.win.GACoreV2.evaluate;
    p.win.GACoreV2.evaluate = (x) => { seen.push(x.phase); return ev(x); }; p.win.GACoreV2Wire.status(A, OB, "C172", "v2", null, NOW); return seen[0]; };
  assert.equal(phaseSeen({}), "depart");
  assert.equal(phaseSeen({ store: { "wm.phaseMode": "land" } }), "land");
  assert.equal(phaseSeen({ store: { "wm-phase": "land" } }), "land");
  assert.equal(phaseSeen({ onSelector: () => ({ getAttribute: (a) => (a === "data-v" ? "land" : null), textContent: "LAND" }) }), "land");
  assert.equal(phaseSeen({ store: { "wm.phaseMode": "depart" }, onSelector: () => ({ getAttribute: () => "land", textContent: "LAND" }) }), "depart");
});

test("E-01: once WMPHASE exists it is used directly and the page is never searched", () => {
  const { win, counts } = page();
  win.WMPHASE = { mode: "land", arrive: { off: 0, at: null } };
  counts.qs = 0;
  for (let i = 0; i < 50; i++) win.GACoreV2Wire.status(A, OB, "C172", "v2", null, NOW);
  assert.equal(counts.qs, 0);
});

// STEP 4, wire level: old wire + old engine (archive, live 2.3.2) vs new wire + new engine, every point of a real-shaped
// wx-now copy (built by the repo's own composer), Depart and Land Now. E-05 (copy index) must not change a single verdict.
test("STEP 4 / E-05: old vs new wire on all 640 points of a wx-now copy — Depart and Land Now verdicts identical", async () => {
  const { build } = await import("../../tools/engine-bench/fixtures.mjs");
  const NOW2 = Date.now(), fx = build(NOW2);
  const OLDENG = readFileSync(new URL("tests/engine-v2/baseline-live-644fcb87/engine/ga-core-v2.js", ROOT), "utf8");
  const OLDWIRE = readFileSync(new URL("tests/engine-v2/baseline-live-644fcb87/engine/ga-core-v2-wire.js", ROOT), "utf8");
  const mk = (eng, wire) => { const store = { "wm.now.v1": fx.wxNow }; const p = page({ store }); // page() loads the NEW pair; reload with the chosen pair
    vm.runInContext(eng, p.win, { filename: "eng.js" }); delete p.win.GA_USE_ENGINE_V2;
    p.win.WST.status = p.win.GA_ENGINE_PREV_STATUS; vm.runInContext(wire, p.win, { filename: "wire.js" }); return p.win; };
  const oldW = mk(OLDENG, OLDWIRE), newW = mk(ENGINE, WIRE);
  const diffs = [], seen = {}; let n = 0;
  for (const mode of ["depart", "land"]) {
    oldW.WMPHASE = newW.WMPHASE = { mode, arrive: { off: 0, at: null } };
    for (const pt of fx.points) {
      const a = { ic: pt[0], la: pt[1], lo: pt[2], el: null, rw: [] };
      const o = oldW.WST.status(a, null, "C172", "vfr", null, NOW2), w = newW.WST.status(a, null, "C172", "vfr", null, NOW2); n++;
      seen[w.s] = (seen[w.s] || 0) + 1;
      if (o.s !== w.s || o.why !== w.why) diffs.push(mode + " " + pt[0] + ": " + o.s + " / " + w.s + " | " + o.why + " | " + w.why);
    }
  }
  assert.equal(n, fx.points.length * 2);
  assert.ok(fx.points.length >= 600);
  assert.ok((seen.go || 0) + (seen.caution || 0) + (seen.nogo || 0) > n * 0.8, "the copy really is judged: " + JSON.stringify(seen));
  assert.ok(seen.go > 0 && seen.nogo > 0, JSON.stringify(seen));
  assert.deepEqual(diffs.slice(0, 10), []);
});

// E-10 verdict cache: a hit only for the very same input in the same minute; new weather is a new key; the minute empties it.
test("E-10: the verdict cache answers the same input from memory, and new weather or a new minute is worked out again", () => {
  const { win } = page();
  let calls = 0; const ev = win.GACoreV2.evaluate; win.GACoreV2.evaluate = (x) => { calls++; return ev(x); };
  const T = Date.UTC(2026, 10, 13, 10, 0, 5);
  const met = (raw) => ({ ...OB, src: "metar", raw, time: T - 10 * 6e4 });
  const s1 = win.WST.status(A, met("METAR FAGC 130950Z 17008KT 9999 FEW040 22/08 Q1020"), "C172", "vfr", null, T);
  const s2 = win.WST.status(A, met("METAR FAGC 130950Z 17008KT 9999 FEW040 22/08 Q1020"), "C172", "vfr", null, T + 20e3);
  assert.equal(calls, 1, "same input, same minute: one engine run");
  assert.equal(s2.s, s1.s);
  const s3 = win.WST.status(A, met("METAR FAGC 130950Z 17030G45KT 2000 TSRA BKN008CB 22/20 Q1010"), "C172", "vfr", null, T + 25e3);
  assert.equal(calls, 2, "new weather: worked out again");
  assert.equal(s3.s, "nogo");
  win.WST.status(A, met("METAR FAGC 130950Z 17008KT 9999 FEW040 22/08 Q1020"), "C172", "vfr", null, T + 61e3);
  assert.equal(calls, 3, "next minute: worked out again (the cache is emptied every minute)");
  win.WMPHASE = { mode: "land", arrive: { off: 0, at: null } };
  win.WST.status(A, met("METAR FAGC 130950Z 17008KT 9999 FEW040 22/08 Q1020"), "C172", "vfr", null, T + 62e3);
  assert.equal(calls, 4, "Land is a different input from Depart");
});

test("E-10: the wire source keeps the precompute override inside a try/finally and never writes cards while warming", () => {
  const src = WIRE.slice(WIRE.indexOf("function warmSoon"), WIRE.indexOf("function warmCard"));
  assert.match(src, /FORCE = \{[^}]+\};\s*try \{ warmCard\(c, now\); \} catch \(e\) \{\} finally \{ FORCE = null; \}/);
  const wc = WIRE.slice(WIRE.indexOf("function warmCard"), WIRE.indexOf("function warmCard") + 400);
  assert.doesNotMatch(wc, /storeResult|dataset|innerHTML|textContent\s*=/, "warmCard only computes");
});

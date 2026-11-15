// First-visit cards and density altitude (MT 11 Nov 2026). Run: cd cloudflare && npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const SITE = new URL("../../site/", import.meta.url);
const read = (p) => readFileSync(new URL(p, SITE), "utf8");
const RWDB = "wst/" + read("engine/ga-core-v2-wire.js").match(/\/wst\/(ad-rwy-db\.[0-9a-f]{10}\.json)/)[1];

// a page-like sandbox: the engine, then the wire, with a fake localStorage and no DOM work
function page(store = {}) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const doc = { readyState: "complete", querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = { console, Date, Math, JSON, isFinite, parseFloat, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    localStorage: ls, document: doc, location: { search: "" },
    addEventListener() {} };   // window.addEventListener: the ported wire listens for "storage" (wm.phaseMode from another tab)
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("engine/ga-core-v2.js"), ctx);
  ctx.WST = { status() { return { s: "none" }; }, obsOf: () => null };
  ctx.WMB = { results: {}, evalCard: () => ({ status: "old-engine" }) };
  vm.runInContext(read("engine/ga-core-v2-wire.js"), ctx);
  ctx.WM_RWDB_INSTALL(JSON.parse(read(RWDB)));   // 15 Nov: the locked runway/elevation DB (lazy JSON) replaces wst/ad-elev.js
  return { ctx, store };
}
function card(ic, la, lo, wxm) {
  const q = { ".icao": { textContent: ic }, "[data-la]": { dataset: { la: String(la), lo: String(lo) } } };
  return { dataset: { cat: "uncontrolled", ...(wxm ? { wxm: JSON.stringify(wxm) } : {}) }, querySelector: (s) => q[s] || null, querySelectorAll: () => [] };
}
function nowFile(id, la, lo, t = Date.now()) {
  const h0 = new Date(Math.floor(t / 36e5) * 36e5), vars = ["temperature_2m", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "visibility", "pressure_msl", "cloud_cover", "cloud_cover_low"];
  const v = [24, 24, 9, 9, 210, 210, 14, 14, 40000, 40000, 1016, 1016, 5, 5, 0, 0];
  return JSON.stringify({ v: 1, composedAt: new Date(t - 6e4).toISOString(), t0: h0.toISOString().slice(0, 16), hours: 2, fzlHours: 5, vars,
    pts: [[id, la, lo]], ft: [new Date(t - 10 * 6e4).toISOString()], el: [1500], c: [v], fzl: [[4000, 4000, 4000, 4000, 4000]] });
}

test("engine density altitude = the calculator and aerodrome page formula (ISA at pressure altitude)", () => {
  const w = { WC: createRequire(import.meta.url)("../../site/calculator_v5/assets/calc.js") };
  const { ctx } = page();
  for (const [el, qnh, oat] of [[5558, 1030, 25], [5558, 1013.25, 15], [151, 1019, 27], [0, 990, 35], [4459, 1022, 31], [98, 1008, -2]]) {
    assert.equal(ctx.GACoreV2.da(el, oat, qnh), Math.round(w.WC.atmos(el, qnh, oat).da), [el, qnh, oat].join("/"));
  }
  assert.equal(ctx.GACoreV2.da(5558, 25, 1030), 7469, "calculator worked example: FAOR 5558 ft, 1030 hPa, 25 °C");
  // the aerodrome page (wq.js) uses the same steps
  assert.match(read("wst/wq.js"), /pa=el\+\(isNaN\(q\)\?0:\(1013\.25-q\)\*30\),isa=15-2\*pa\/1000,da=Math\.round\(\(pa\+120\*\(t-isa\)\)/);
});

// 15 Nov 2026 (MT 14:23 SAST): field elevation and runway headings come from the locked DB (site/data/ad-runways-elev.locked.v2.json)
// through site/wst/ad-rwy-db.<hash>.json (lazy, MT 14:55 SAST), not from the aerodrome pages (wst/ad-elev.js) and never from a runway designator.
test("field elevation for every card: the locked DB, then the model ground height", () => {
  const db = JSON.parse(read("data/ad-runways-elev.locked.v2.json"));
  const { ctx } = page();
  const D = ctx.WM_RWDB.a; let n = 0;
  for (const a of db.aerodromes) {
    const v = a.elevation_ft && a.elevation_ft.v;
    if (v == null) continue;
    n++; assert.equal(D[a.id][0], Math.round(v), a.id + " elevation (the runway DB JSON is stale: run node tools/rwdb/emit.mjs)");
  }
  assert.equal(n, 640);
  assert.equal(ctx.WM_AD_ELEV, undefined, "wst/ad-elev.js is not loaded");
  const main = read("main.html"), s = read("status_demo.html");
  assert.ok(!main.includes("wst/ad-elev.js") && !main.includes("ad-rwy-db"), "main.html loads neither ad-elev.js nor the DB (lazy JSON)");
  assert.ok(!s.includes("ad-rwy-db"), "Status gets the same DB through the wire");
  // the file name carries its content hash (/wst/* is cached for a year) and the aerodrome pages read the same file
  assert.equal(createHash("sha256").update(read(RWDB)).digest("hex").slice(0, 10), RWDB.slice(-15, -5));
  assert.ok(read("wst/wst-ad.js").includes("/" + RWDB));
  const card = read("wst/wst-card.js");
  assert.match(card, /eSrc=window\.WM_RWDB[^\n]*'field elevation'[\s\S]*eSrc='field elevation'[\s\S]*eSrc='model ground height'/);
  // public file: numbers and runway ids only, no source names or dates
  assert.ok(!/OurAirports|Open-Meteo|SACAA|OSM|AIP AD|20\d\d-\d\d/.test(read(RWDB)));
});

test("runway headings come from the DB only, never from a runway designator", () => {
  const db = JSON.parse(read("data/ad-runways-elev.locked.v2.json"));
  const { ctx } = page();
  const dd = (a, b) => Math.abs(((b - a) % 360 + 540) % 360 - 180);
  let n = 0;
  for (const a of db.aerodromes) for (const r of a.runways || []) for (const e of r.ends || []) {
    if (!e.id || !e.true_hdg || e.true_hdg.v == null) continue;
    const got = (ctx.WM_RWDB.a[a.id][1] || []).find((x) => x[0] === e.id);
    assert.ok(got && dd(got[1], e.true_hdg.v) <= 0.6, a.id + " " + e.id); n++;
  }
  assert.ok(n > 900, String(n));
  // the wire has no designator x 10 path any more
  assert.ok(!/designator[^\n]*\*\s*10|parseInt\([^)]*\)\s*\*\s*10/.test(read("engine/ga-core-v2-wire.js")));
  // a field with no DB heading gets no runway (no crosswind guessed from "09/27")
  const none = db.aerodromes.find((a) => !(a.runways || []).some((r) => (r.ends || []).some((e) => e.true_hdg && e.true_hdg.v != null)));
  assert.ok(none && !(ctx.WM_RWDB.a[none.id] && ctx.WM_RWDB.a[none.id][1]), none && none.id);
});

test("first visit: a card evaluated before the model copy keeps the model wind direction (no 'variable, direction unknown')", () => {
  const { ctx } = page();
  const c = card("ZA-0001", -26.1, 28.2, { v: 10, c: null, w: 12, d: 200, g: 18, t: Math.floor(Date.now() / 36e5) * 36e5 });
  const r = ctx.WMB.evalCard(c, Date.now());
  assert.equal(r.rulePackVersion, ctx.GACoreV2.RULES_VERSION);
  const used = r.v2.weatherUsed;
  assert.equal(used.wd, 200); assert.equal(used.vrb, false);
  assert.ok(!/Variable wind|direction unknown/.test(r.why), r.why);
  // no direction in the snapshot: still honest about it
  const r2 = ctx.WMB.evalCard(card("ZA-0002", -26.1, 28.3, { v: 10, c: null, w: 12, d: null, g: 18, t: Date.now() }), Date.now());
  assert.equal(r2.v2.weatherUsed.vrb, true);
});

test("first visit: the model copy is used as soon as it is stored (a miss is not cached)", () => {
  const { ctx, store } = page();
  const c = card("ZA-0003", -29.5, 24.5, null);
  const before = ctx.WMB.evalCard(c, Date.now());
  assert.notEqual(before.v2.source, "model");
  store["wm.now.v1"] = nowFile("ZA-0003", -29.5, 24.5);       // wm-model.js stores the copy a moment later
  const after = ctx.WMB.evalCard(c, Date.now());
  assert.equal(after.v2.weatherUsed.wd, 210); assert.equal(after.v2.weatherUsed.temp, 24);
  assert.ok(!/Variable wind|direction unknown/.test(after.why), after.why);
});

// 15 Nov 2026 (MT 13:25 SAST): density altitude is information only (aircraft weight), never a verdict. It is still worked out
// against the field's own elevation on non-AIP cards and shown as a note.
test("density altitude is measured against the field's own elevation on non-AIP cards, as a note, never a caution", () => {
  const { ctx, store } = page();
  const E = (k) => ctx.WM_RWDB.a[k] && ctx.WM_RWDB.a[k][0];
  const ic = Object.keys(ctx.WM_RWDB.a).find((k) => k.startsWith("ZA-") && E(k) > 4000);
  store["wm.now.v1"] = nowFile(ic, -26, 28).replace('"vars":["temperature_2m"', '"vars":["temperature_2m"').replace("[24,24,", "[38,38,");
  const r = ctx.WMB.evalCard(card(ic, -26, 28, null), Date.now());
  const el = E(ic), dA = ctx.GACoreV2.da(el, 38, 1016);
  assert.ok(dA > el + 2500, String(dA));
  assert.ok(r.v2.findings.some((f) => f.k === "da" && f.lv === "note"), JSON.stringify(r.v2.findings));
  assert.ok(!r.v2.findings.some((f) => f.k === "da" && f.lv !== "note"), "DA never raises a verdict");
});

// 15 Nov 2026 (MT 14:23 SAST): the pilot can switch density altitude on (wm-da-verdict = 1): then it is a caution again.
test("density altitude switch on: the same card gets a caution", () => {
  const { ctx, store } = page({ "wm-da-verdict": "1" });
  const E = (k) => ctx.WM_RWDB.a[k] && ctx.WM_RWDB.a[k][0];
  const ic = Object.keys(ctx.WM_RWDB.a).find((k) => k.startsWith("ZA-") && E(k) > 4000);
  store["wm.now.v1"] = nowFile(ic, -26, 28).replace("[24,24,", "[38,38,");
  const r = ctx.WMB.evalCard(card(ic, -26, 28, null), Date.now());
  assert.ok(r.v2.findings.some((f) => f.k === "da" && f.lv === "caution"), JSON.stringify(r.v2.findings));
});

// 15 Nov 2026: pilot-set DA limit (default 2500 ft above the field). Same hot card, a high limit means no DA caution.
test("density altitude switch on at 6000 ft: the same card stays without a DA caution when DA is under the limit", () => {
  const { ctx, store } = page({ "wm-da-verdict": "1", "wm-da-limit": "6000" });
  const E = (k) => ctx.WM_RWDB.a[k] && ctx.WM_RWDB.a[k][0];
  const ic = Object.keys(ctx.WM_RWDB.a).find((k) => k.startsWith("ZA-") && E(k) > 4000);
  store["wm.now.v1"] = nowFile(ic, -26, 28).replace("[24,24,", "[38,38,");
  const r = ctx.WMB.evalCard(card(ic, -26, 28, null), Date.now());
  const el = E(ic), dA = ctx.GACoreV2.da(el, 38, 1016);
  assert.ok(dA <= el + 6000, "fixture must be under a 6000 ft above-field limit: " + dA + " vs " + (el + 6000));
  assert.ok(!r.v2.findings.some((f) => f.k === "da" && f.lv === "caution"), JSON.stringify(r.v2.findings));
});

// 15 Nov 2026 (MT 14:55 SAST): while the DB is on its way the cards are pending (no verdict); after it arrives they are
// exactly what they are when it was there from the start.
test("runway DB loading: pending first, then the same verdict as with the DB already there", async () => {
  const j = JSON.parse(read(RWDB)); let release;
  const gate = new Promise((r) => { release = r; });
  const mk = (lazy) => {
    const store = {}, ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    const doc = { readyState: "complete", querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => ({}), documentElement: { setAttribute() {} } };
    const ctx = { console, Date, Math, JSON, isFinite, parseFloat, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
      localStorage: ls, document: doc, location: { search: "" }, addEventListener() {} };
    if (lazy) ctx.fetch = () => gate.then(() => ({ ok: true, json: async () => j }));
    ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(read("engine/ga-core-v2.js"), ctx);
    ctx.WST = { status() { return { s: "none" }; }, obsOf: () => null };
    ctx.WMB = { results: {}, evalCard: () => ({ status: "old-engine" }) };
    vm.runInContext(read("engine/ga-core-v2-wire.js"), ctx);
    if (!lazy) ctx.WM_RWDB_INSTALL(j);
    return { ctx, store };
  };
  const A = mk(false), B = mk(true), t = Date.now();
  const ids = Object.keys(A.ctx.WM_RWDB.a).filter((k) => A.ctx.WM_RWDB.a[k][1]).slice(0, 25);
  const wx = { v: 10, c: null, w: 15, d: 250, g: 22, t: Math.floor(t / 36e5) * 36e5 };
  for (const ic of ids) assert.equal(B.ctx.WMB.evalCard(card(ic, -26, 28, wx), t).status, "none", ic + " pending");
  assert.equal(B.ctx.WM_RWDB_PENDING(), true);
  release(); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(B.ctx.WM_RWDB_PENDING(), false);
  for (const ic of ids) {
    const a = A.ctx.WMB.evalCard(card(ic, -26, 28, wx), t), b = B.ctx.WMB.evalCard(card(ic, -26, 28, wx), t);
    assert.deepEqual([b.status, b.why, b.label], [a.status, a.why, a.label], ic);
  }
});

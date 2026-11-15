// tests/engine-v2/night-land-steps.test.mjs — MT t1973u (13 Nov 2026): the night pill and the night verdict follow the
// selected Land time (Now, +1h, +2h, +3h). Night is judged at the arrival time by the engine (POL-NIGHT-ARRIVAL = CAUTION
// without night rating), and the wq.js pill shows "You'll land after dark" exactly when the engine says so.
// Case: FAGC (Grand Central), 17:50 SAST on 13 Nov 2026; night from about 18:46 SAST.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const WQ = readFileSync(new URL("../../site/wst/wq.js", import.meta.url), "utf8");
const s0 = WQ.indexOf("(function(){const list=document.getElementById('list');if(!list)return;const ic=");
const PILL = WQ.slice(s0, WQ.indexOf("})();", s0) + 5);
const ENGINE = readFileSync(new URL("../../site/engine/ga-core-v2.js", import.meta.url), "utf8");
const ectx = { console, Date, Math, JSON }; ectx.window = ectx; vm.createContext(ectx); vm.runInContext(ENGINE, ectx);
const E = ectx.GACoreV2;

const H = 3600e3, MIN = 60e3, NOW = Date.UTC(2026, 10, 13, 15, 50);   // 17:50 SAST
const LA = -25.986, LO = 28.14;
const p2 = (n) => String(n).padStart(2, "0"), z = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + "Z"; };
const ddhh = (t) => z(t).slice(0, 4);
const FAGC = { icao: "FAGC", lat: LA, lon: LO, elevFt: 5325, category: "c", runways: [{ id: "17", true: 170 }, { id: "35", true: 350 }] };
const T0 = NOW - 4 * H;
const WX = { metar: { raw: `METAR FAGC ${z(NOW - 15 * MIN)} 17006KT 9999 SCT045 22/08 Q1019`, time: NOW - 15 * MIN },
  taf: `TAF FAGC ${z(T0 - 30 * MIN)} ${ddhh(T0)}/${ddhh(T0 + 30 * H)} 17006KT 9999 SCT045` };
const evalAt = (off, night) => E.evaluate({ field: FAGC, weather: JSON.parse(JSON.stringify(WX)), profile: { licence: "ppl", night }, aircraftId: "C172",
  phase: "land", eta: off ? NOW + off * H : undefined, now: NOW });

function pill({ off, result, engineNight }) {
  const made = [];
  const why = { after: (e) => made.push(e) };
  const card = { querySelector: (q) => (q === ".why" ? why : q === ".wq-nn" ? null : q === ".icao" ? { textContent: "FAGC" } : q === ".cp[data-p=model]" ? { dataset: { la: String(LA), lo: String(LO) } } : null), dataset: {} };
  const ctx = { console, Date: class extends Date { static now() { return NOW; } }, Math, JSON, Number, setInterval: () => 0, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; } };
  ctx.window = ctx;
  ctx.document = { getElementById: (id) => (id === "list" ? { querySelectorAll: () => [card] } : null), createElement: () => ({ className: "", innerHTML: "" }), addEventListener() {}, hidden: false };
  vm.createContext(ctx); vm.runInContext(ENGINE, ctx);
  ctx.WMPHASE = { mode: "land", arrive: { off, at: null } };
  ctx.WST = { sunInfo: () => ({ isNight: false }) };   // the old sun maths must not decide
  ctx.WMB = { prof: () => ({ night: true }), results: result ? { FAGC: { r: { v2: result } } } : {} };
  ctx.GA_ENGINE_PROFILE = () => ({ profile: { night: engineNight }, rules: "vfr" });
  vm.runInContext(PILL, ctx);
  return made[0] || null;
}

const EXPECT = { 0: false, 1: true, 2: true, 3: true };
for (const off of [0, 1, 2, 3]) {
  test(`Land +${off}h, no night rating: engine ${EXPECT[off] ? "CAUTION night arrival" : "no night finding"}, pill follows`, () => {
    const r = evalAt(off, false);
    const n = r.findings.find((f) => f.ruleId === "POL-NIGHT-ARRIVAL");
    assert.equal(!!n, EXPECT[off]);
    if (n) { assert.equal(n.lv, "caution"); assert.equal(r.status, "caution"); } else assert.equal(r.status, "go");
    assert.ok(!r.findings.some((f) => f.ruleId === "POL-NIGHT-UNSELECTED"), "Land never uses the depart NO-GO night rule");
    const e = pill({ off, result: r, engineNight: false });
    assert.equal(!!e, EXPECT[off]);
    if (e) { assert.match(e.innerHTML, /You'll land after dark · Night not enabled/); assert.match(e.className, /wq-nn-cau/); }
  });
  test(`Land +${off}h, night rating on: no night caution and no pill`, () => {
    const r = evalAt(off, true);
    assert.ok(!r.findings.some((f) => /NIGHT/.test(f.ruleId) && f.lv !== "note"));
    assert.equal(pill({ off, result: r, engineNight: true }), null);
  });
  test(`Land +${off}h, card has no verdict yet: the pill uses the engine sun at the arrival time`, () => {
    assert.equal(!!pill({ off, result: null, engineNight: false }), EXPECT[off]);
  });
}

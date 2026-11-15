// taf_validity: a TAF is used only while valid (issue <= 30 h old, window not ended); the frozen engine's CAVOK-anywhere and
// missing validity check are mitigated in ga-core-v2-wire.js (evaluateSafe). Pilot-safety P0-2 / P0-3, 13 Nov 2026.
import test from "node:test";
import assert from "node:assert/strict";
import { page } from "./harness.mjs";

const U = (d, h, m = 0, mo = 10) => Date.UTC(2026, mo, d, h, m);
function wired(now) {
  const w = page({ now });
  w.load("wst/wst-engine.js"); w.load("engine/ga-core-v2.js"); w.load("engine/ga-core-v2-wire.js");
  return w;
}
const BAKED = "TAF FALA 211100Z 2112/2218 34008KT CAVOK BECMG 2200/2202 VRB03KT";
const FALA = { ic: "FALA", la: -25.9385, lo: 27.9261, el: 4522, rw: [{ id: "06", true: 46 }, { id: "24", true: 226 }] };

test("tafWindow anchors ddhh/ddhh to the issue time, across month ends and hour 24", () => {
  const w = wired(U(13, 14));
  const T = w.GA_TAF, J = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(J(T.window("TAF FALA 131100Z 1312/1418 CAVOK", U(13, 14))), { issue: U(13, 11), from: U(13, 12), to: U(14, 18) });
  assert.deepEqual(J(T.window("TAF FAOR 302300Z 0100/0206 CAVOK", U(1, 3, 0, 11))), { issue: U(30, 23), from: U(1, 0, 0, 11), to: U(2, 6, 0, 11) });
  assert.equal(T.window("TAF FAOR 131100Z 1312/1424 CAVOK", U(13, 14)).to, U(15, 0));
  assert.equal(T.window("TAF FAOR 1312/1418 CAVOK", U(13, 14)), null, "no issue time: unusable");
  assert.equal(T.window("garbage", U(13, 14)), null);
});

test("tafValid: valid now, expired, issued > 30 h ago, the 21 Oct baked TAF on 13 Nov", () => {
  const T = wired(U(13, 14)).GA_TAF;
  assert.equal(T.valid("TAF FALA 131100Z 1312/1418 CAVOK", U(13, 14)), true);
  assert.equal(T.valid("TAF FALA 131100Z 1312/1418 CAVOK", U(14, 18)), false, "window ended");
  assert.equal(T.valid("TAF FALA 131100Z 1312/1418 CAVOK", U(14, 17, 1)), false, "issued 30 h+ ago");
  assert.equal(T.valid(BAKED, U(13, 14)), false, "21 Oct TAF on 13 Nov");
  assert.equal(T.valid("TAF FALA 131100Z 1312/1418 CAVOK", U(13, 10)), true, "issued within the 2 h clock-skew allowance, not yet in force: kept (not judged before its window)");
});

function verdict(w, taf, now) {
  w.WMST = { ads: [], metar: {}, taf: taf ? { FALA: taf } : {}, om: {} };
  const seen = [], ev = w.GACoreV2.evaluate;
  w.GACoreV2.evaluate = (x) => { const r = ev(x); seen.push(r); return r; };
  w.WST.status(FALA, null, "C172", "vfr", { ceil: 1500, vis: 5, xw: 15, gust: 25 }, now);
  w.GACoreV2.evaluate = ev;
  return seen[seen.length - 1];
}

test("the 21 Oct baked CAVOK TAF never gives FALA a TAF verdict on 13 Nov (was GO, 'TAF covering now')", () => {
  const now = U(13, 14), w = wired(now);
  const r = verdict(w, BAKED, now);
  assert.notEqual(r && r.source && r.source.kind, "taf");
  assert.notEqual(r.status, "go");
});

test("a valid CAVOK TAF still gives a TAF verdict (positive control)", () => {
  const now = U(13, 14), w = wired(now);
  const r = verdict(w, "TAF FALA 131100Z 1312/1418 34008KT CAVOK", now);
  assert.equal(r.source.kind, "taf");
  assert.equal(r.status, "go");
});

test("CAVOK only in a later BECMG is not CAVOK now: the low cloud in force decides", () => {
  const now = U(13, 14), w = wired(now);
  const r = verdict(w, "TAF FALA 131100Z 1312/1418 24010KT 6000 BKN008 BECMG 1406/1408 CAVOK", now);
  assert.equal(r.source.kind, "taf");
  assert.notEqual(r.status, "go", "BKN008 in force");
});

test("a TAF answer outside the TAF's own window is re-run without the TAF", () => {
  const now = U(13, 8, 30), w = wired(now);   // issued 0800Z, valid from 1312Z: more than 3 h away, not in force
  const r = verdict(w, "TAF FALA 130800Z 1312/1418 34008KT CAVOK", now);
  assert.notEqual(r && r.source && r.source.kind, "taf");
});

// 2.5.0 early TAF (MT 15 Nov 2026): no METAR and no TAF period in force, the first period starts within 3 h and the TAF was
// issued before now -> that period is used, labelled and never a plain GO (CAUTION POL-TAF-EARLY).
test("early TAF: a TAF issued before now whose first period starts within 3 h is used, marked early, as a CAUTION", () => {
  const now = U(13, 11, 30), w = wired(now);   // issued 1100Z, valid from 1312Z: starts in 30 min
  const r = verdict(w, "TAF FALA 131100Z 1312/1418 34008KT CAVOK", now);
  assert.equal(r.source.kind, "taf");
  assert.equal(r.source.tafEarly, true);
  assert.equal(r.source.label, "TAF (next period from 1200Z)");
  assert.equal(r.status, "caution");
  assert.ok(r.findings.some((f) => f.ruleId === "POL-TAF-EARLY" && f.lv === "caution"));
  const r2 = verdict(wired(U(13, 10, 59)), "TAF FALA 131100Z 1312/1418 34008KT CAVOK", U(13, 10, 59));   // not issued yet
  assert.notEqual(r2 && r2.source && r2.source.kind, "taf");
});

test("a segment in force with no visibility or cloud is not CAVOK because a later BECMG says CAVOK (was a fabricated GO)", () => {
  const now = U(13, 14), w = wired(now);
  const r = verdict(w, "TAF FALA 131100Z 1312/1418 24010KT BECMG 1406/1408 CAVOK", now);
  assert.notEqual(r.status, "go");
});

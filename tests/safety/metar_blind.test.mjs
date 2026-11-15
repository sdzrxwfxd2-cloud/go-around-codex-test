// metar_blind: an AUTO METAR that does not report visibility ("////") or cloud ("//////") never gives a GO on its own; the
// frozen engine reads missing as fine, so ga-core-v2-wire.js (evaluateSafe) judges on the TAF / model instead. A CAUTION or
// NO-GO the METAR does show is kept. Live on 13 Nov 2026 19:55 SAST: FAWB "AUTO 00000KT //// // ////// 25/07 Q1017" -> GO.
import test from "node:test";
import assert from "node:assert/strict";
import { page } from "./harness.mjs";

const NOW = Date.UTC(2026, 10, 13, 17, 10);
const FAWB = { ic: "FAWB", la: -25.6539, lo: 28.2242, el: 4095, rw: [{ id: "07", true: 70 }, { id: "25", true: 250 }] };
const OM = { current: { time: "2026-11-13T17:00", temperature_2m: 25, dew_point_2m: 7, visibility: 24140, cloud_cover: 10, cloud_cover_low: 0, wind_speed_10m: 3, wind_direction_10m: 90, wind_gusts_10m: 6, pressure_msl: 1017 } };
function run(raw, taf, om = OM) {
  const w = page({ now: NOW });
  w.load("wst/wst-engine.js"); w.load("engine/ga-core-v2.js"); w.load("engine/ga-core-v2-wire.js");
  const m = { icaoId: "FAWB", obsTime: Date.UTC(2026, 10, 13, 17) / 1e3, reportTime: "2026-11-13T17:00:00.000Z", temp: 25, dewp: 7, wdir: 0, wspd: 0, altim: 1017, qcField: 2, rawOb: raw };   /* AWC row as served live */
  w.WMST = { ads: [], metar: { FAWB: m }, taf: taf ? { FAWB: taf } : {}, om: om ? { FAWB: om } : {} };
  const seen = [], ev = w.GACoreV2.evaluate;
  w.GACoreV2.evaluate = (x) => { const r = ev(x); seen.push(r); return r; };
  w.WST.status(FAWB, null, "C172", "vfr", { ceil: 1500, vis: 5, xw: 15, gust: 25 }, NOW);
  w.GACoreV2.evaluate = ev;
  const last = seen[seen.length - 1] || {};
  return { status: last.status, src: last.source && last.source.kind, first: seen[0] && seen[0].status, firstSrc: seen[0] && seen[0].source && seen[0].source.kind };
}

test("AUTO METAR with no visibility and no cloud: no METAR GO (was GO live on FAWB / FAWK when a model fills the visibility)", () => {
  const r = run("METAR FAWB 131700Z AUTO 00000KT //// // ////// 25/07 Q1017");
  assert.ok(!(r.status === "go" && /metar|speci|trend/.test(r.src || "")), JSON.stringify(r));
});

test("visibility reported but cloud '//////' only: no METAR GO", () => {
  const r = run("METAR FAWB 131700Z AUTO 00000KT 9999 ////// 25/07 Q1017");
  assert.ok(!(r.status === "go" && /metar|speci|trend/.test(r.src || "")), JSON.stringify(r));
});

test("an AUTO METAR showing a hazard keeps its verdict (low cloud with visibility missing)", () => {
  const r = run("METAR FAWB 131700Z AUTO 00000KT //// BKN004 25/07 Q1017");
  assert.notEqual(r.status, "go", JSON.stringify(r));
});

test("a complete METAR still decides (positive control)", () => {
  const r = run("METAR FAWB 131700Z 00000KT 9999 FEW040 25/07 Q1017");
  assert.equal(r.status, "go"); assert.match(r.src, /metar/);
  const c = run("METAR FAWB 131700Z 00000KT CAVOK 25/07 Q1017");
  assert.equal(c.status, "go"); assert.match(c.src, /metar/);
  const n = run("METAR FAWB 131700Z AUTO 00000KT 9999 NCD 25/07 Q1017");
  assert.equal(n.status, "go"); assert.match(n.src, /metar/);
});

test("visibility missing but cloud reported: the engine's own TAF / model visibility fill decides, METAR stays the source", () => {
  const r = run("METAR FAWB 131700Z AUTO 00000KT //// FEW030 25/07 Q1017");
  assert.match(r.src || "", /metar/, JSON.stringify(r));
});

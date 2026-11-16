// tests/engine-v2/sa-weather-parser.test.mjs — 16 Nov 2026 (MT approved: "fix all the bugs and add all the new readings").
// Every report below is a REAL South African METAR / TAF from tests/sa-weather (results.json, 15 Nov 2026 run).
// Rules, limits and RULES_LOCK are unchanged; only how the report is READ changed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { console, Date, Math, JSON }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../../site/engine/ga-core-v2.js", import.meta.url), "utf8"), ctx);
const E = ctx.GACoreV2;

const P = (raw) => E.parseOfficial({ raw, time: 0 }, 0);
const FIELD = { icao: "FAPE", lat: -33.985, lon: 25.617, elevFt: 226, category: "c",
  runways: [{ id: "08", true: 80 }, { id: "26", true: 260 }, { id: "17", true: 170 }, { id: "35", true: 350 }] };
const GG = { icao: "FAGG", lat: -34.005, lon: 22.379, elevFt: 648, category: "c", runways: [{ id: "11", true: 110 }, { id: "29", true: 290 }] };
const ev = (raw, iso, o = {}) => {
  const t = Date.parse(iso);
  return E.evaluate(Object.assign({ field: FIELD, weather: { metar: { raw, time: t } }, profile: { licence: "ppl", night: 1 },
    aircraftId: "C172", rules: "vfr", phase: "depart", now: t + 5 * 60e3 }, o));
};

test("1. directional visibility is read, direction ignored (0400W, 0800NE, 2000S, 5000E)", () => {
  assert.equal(P("METAR FABL 230600Z 03006KT 360V060 0400W R02/1900U FG VV002 09/08 Q1025 TEMPO 1500 BR OVC008").vis, 0.4);
  assert.equal(P("METAR FALA 190500Z 21004KT 0800NE FG NSC 15/14 Q1021 TEMPO 0500").vis, 0.8);
  assert.equal(P("METAR FAPE 160400Z VRB02KT 2000S BR SCT002 BKN025 17/17 Q1009 NOSIG").vis, 2);
  assert.equal(P("METAR FABL 170700Z VRB01KT 5000E BR NSC 10/05 Q1031 NOSIG").vis, 5);
  assert.equal(P("METAR FAPE 181340Z 23024KT 4000SW R26/P2000N FU FEW015 22/11 Q1015 TEMPO 23024G34KT").vis, 4);
});

test("1. two visibility groups: the LOWEST is used (4500W 9999, 2000SW 8000NE, 9999E 3700W, 9999 1200S)", () => {
  const a = P("METAR FAPE 021700Z 23006KT 4500W 9999 R26/P2000N FU FEW010 21/19 Q1014 TEMPO FM1800 BKN009");
  assert.equal(a.vis, 4.5); assert.equal(a.visAtLeast, false);
  assert.equal(P("METAR FAPE 121500Z 22018KT 2000SW 8000NE FU FEW004 26/22 Q1009 NOSIG").vis, 2);
  assert.equal(P("METAR FAPE 181400Z 19007KT 160V220 9999E 3700W R26/P2000N -SHRA FEW008 BKN030 23/21 Q1012 TEMPO 2500").vis, 3.7);
  assert.equal(P("METAR FAPE 081054Z 17008KT 130V210 9999 1200S FU NSC 27/17 Q1012 NOSIG").vis, 1.2);
  assert.equal(P("METAR COR FAPE 010400Z 27004KT 1000SW 9000 R26/P2000N MIFG NSC 08/08 Q1020 NOSIG").vis, 1);
  // was GO (9999 read, 1200 m ignored); now NO-GO on the 5 km VFR minimum
  const r = ev("METAR FAPE 081054Z 17008KT 130V210 9999 1200S FU NSC 27/17 Q1012 NOSIG", "2025-12-08T10:54:00Z");
  assert.equal(r.status, "nogo"); assert.match(r.why, /1\.2 km below VFR 5 km/);
});

test("1. single plain 9999 / NDV still read as before", () => {
  const a = P("METAR FACT 151000Z 17012KT 9999 FEW020 22/12 Q1018 NOSIG");
  assert.equal(a.vis, 10); assert.equal(a.visAtLeast, true);
  assert.equal(P("METAR FAPE 151000Z AUTO 17012KT 6000NDV FEW020 22/12 Q1018").vis, 6);
});

test("RVR, VV, split cloud do not break the visibility (R02/1900U, R26/P2000N, R25/1700, VV002)", () => {
  const a = P("METAR FABL 230600Z 03006KT 360V060 0400W R02/1900U FG VV002 09/08 Q1025 TEMPO 1500 BR OVC008");
  assert.equal(a.vis, 0.4); assert.equal(a.ceil, 200);
  // TS report with only an RVR and no prevailing visibility: visibility stays unknown (not read from the RVR or the TEMPO)
  assert.equal(P("METAR FABL 041617Z 32014G24KT 270V350 R02/P2000N TS SCT020 FEW035CB 21/14 Q1021 TEMPO 5000 TSRA SCT035CB").vis, null);
  // AUTO //// slot then a garbled wind, then 0800: 0800 is the visibility
  assert.equal(P("METAR FAKN 220300Z AUTO 15004KT //// // /////004KT 0800 R25/1700 R07/1900 FG VV/// 13/11 Q1019 NOSIG").vis, 0.8);
  // a 9999 AFTER the temperature group is a garbled AUTO tail, not the visibility
  assert.equal(P("METAR FAKM 270100Z AUTO 35006KT //// // ////// 17/14 9999 SCT018 BKN035 FEW045CB 20/18 Q1013 NOSIG").vis, null);
});

test("2. glued weather is split: 9999-RA, 9999-DZ, 9999-SHRA", () => {
  const a = P("METAR FALA 271700Z 03003KT 340V060 9999-RA BKN030 17/14 Q1024 NOSIG");
  assert.equal(a.vis, 10); assert.equal(a.visAtLeast, true); assert.match(a.wx, /9999 -RA/);
  assert.equal(a.raw, "METAR FALA 271700Z 03003KT 340V060 9999-RA BKN030 17/14 Q1024 NOSIG"); // shown as sent
  assert.equal(P("METAR FAMM 211500Z 01004KT 9999-DZ FEW035TCU BKN080 17/15 Q1022 TEMPO TSRA FEW035CB").vis, 10);
  assert.equal(P("METAR FAUT 180849Z 21005KT 9999-SHRA BKN045 FEW060TCU 23/17 Q1012").vis, 10);
  // a thunderstorm glued to the visibility is still a hazard
  const r = ev("METAR FAUT 180849Z 21005KT 9999TSRA BKN045 23/17 Q1012", "2026-01-18T08:49:00Z");
  assert.equal(r.status, "nogo"); assert.match(r.why, /TSRA/);
});

test("3. COR / AUTO before or after the station are skipped", () => {
  const a = P("METAR COR FAPE 071200Z 22018KT 3500SE 9000 R26/P2000N FU FEW023 23/14 Q1016 NOSIG");
  assert.equal(a.vis, 3.5); assert.equal(a.ws, 18);
  assert.equal(P("METAR FAGG 161900Z AUTO 02002KT CAVOK 16/14 Q1015").cavok, true);
});

test("3. NIL METAR with no TAF is INCOMPLETE (no report), not a parse failure", () => {
  const r = ev("METAR FABM NIL", "2026-11-14T09:00:00Z");
  assert.equal(r.status, "incomplete"); assert.equal(r.code, "nil");
  const r2 = ev("METAR FABL 141800Z NIL", "2026-11-14T18:00:00Z");
  assert.equal(r2.status, "incomplete");
});

test("3. malformed required groups are not guessed: INCOMPLETE (23016VKT, 01006K6002KT, 5000VE, BKN49)", () => {
  for (const [raw, iso] of [
    ["METAR FAGM 070900Z 23016VKT 9999 OVC017 08/03 Q1018", "2026-05-07T09:00:00Z"],
    ["METAR FAMM 221800Z 01006K6002KT 9999 FEW012 SCT080 17/16 Q1019 NOSIG", "2026-01-22T18:00:00Z"],
    ["METAR FAUP 130600Z 28003KT 5000VE BR NSC 03/03 Q1024 BECMG CAVOK", "2026-06-13T06:00:00Z"],
    ["METAR FAPE 161300Z 08014KT 050V110 9999 FEW027 BKN49 24/16 Q1014 NOSIG", "2026-01-16T13:00:00Z"]]) {
    const r = ev(raw, iso);
    assert.equal(r.status, "incomplete", raw); assert.equal(r.code, "parse", raw);
  }
  // a validly coded missing wind (/////KT) keeps the locked rule: CAUTION "Wind not reported"
  const w = ev("METAR FACT 151000Z AUTO /////KT 9999 FEW020 22/12 Q1018", "2026-11-15T10:00:00Z");
  assert.notEqual(w.code, "parse");
});

test("5. CAVOK in the TREND is not CAVOK now (was a false GO)", () => {
  const a = P("METAR FACT 160600Z VRB01KT 2500 R01/0250 BCFG NSC 06/06 Q1022 BECMG CAVOK");
  assert.equal(a.cavok, false); assert.equal(a.vis, 2.5);
  const r = ev("METAR FACT 160600Z VRB01KT 2500 R01/0250 BCFG NSC 06/06 Q1022 BECMG CAVOK", "2026-05-16T06:00:00Z",
    { field: { icao: "FACT", lat: -33.965, lon: 18.602, elevFt: 151, category: "c", runways: [{ id: "01", true: 1 }, { id: "19", true: 181 }] } });
  assert.equal(r.status, "nogo"); assert.match(r.why, /2\.5 km below VFR 5 km/);
});

const GG_TAF = "TAF FAGG 161600Z 1618/1718 35005KT 9999 SCT012 TX20/1712Z TN14/1703Z FM162000 35005KT 9999 BKN020 FM170700 23015KT 9999 SCT005 BKN010 TEMPO 1710/1718 2500 RA BKN008";
const gg = (iso, lic, phase) => ev("METAR FAGG " + iso.slice(8, 10) + iso.slice(11, 13) + iso.slice(14, 16) + "Z 02002KT CAVOK 16/14 Q1015", iso,
  { field: GG, weather: { metar: { raw: "METAR FAGG 161900Z AUTO 02002KT CAVOK 16/14 Q1015", time: Date.parse(iso) }, taf: { raw: GG_TAF } }, profile: { licence: lic, night: 1 }, phase });

test("4. TAF FM: the FAGG NO-GOs are the PPL's own 2 500 ft minimum, inside the look-ahead (unchanged, by design)", () => {
  // FM162000 BKN020: 2 000 ft is below the PPL preset 2 500 ft -> NO-GO when 20:00Z is inside the window
  assert.equal(gg("2026-10-16T19:00:00Z", "ppl", "land").status, "nogo");  // land: ETA +/- 1 h (CAR 91.07.7)
  assert.equal(gg("2026-10-16T18:30:00Z", "ppl", "depart").status, "nogo"); // depart: next 2 h
  // FM outside the 2 h look-ahead is not applied
  assert.equal(gg("2026-10-16T17:00:00Z", "ppl", "depart").status, "go");
  // CPL minimum 1 500 ft: 2 000 ft is not below the limit, so the FM drives nothing
  assert.equal(gg("2026-10-16T19:00:00Z", "cpl", "land").status, "go");
});

test("4. TAF periods across month end: FM/TEMPO/BECMG dates roll over correctly", () => {
  const taf = "TAF FACT 302300Z 3100/0106 17010KT 9999 FEW030 FM310300 17010KT 3000 BR BKN004 TEMPO 0100/0104 0800 FG";
  const f = { icao: "FACT", lat: -33.965, lon: 18.602, elevFt: 151, category: "c", runways: [{ id: "01", true: 1 }, { id: "19", true: 181 }] };
  const at = (iso) => { const t = Date.parse(iso); return E.evaluate({ field: f, weather: { metar: { raw: "METAR FACT 310000Z 17010KT 9999 FEW030 15/10 Q1018", time: t }, taf: { raw: taf } },
    profile: { licence: "ppl", night: 1 }, aircraftId: "C172", rules: "vfr", phase: "depart", now: t }); };
  assert.equal(at("2026-10-31T00:00:00Z").status, "go");                  // FM 31st 03Z is 3 h away
  const r = at("2026-10-31T01:30:00Z");                                    // FM inside the 2 h look-ahead
  assert.equal(r.status, "nogo"); assert.match(r.why, /FM from 3103Z/);
});

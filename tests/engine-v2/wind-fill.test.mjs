// tests/engine-v2/wind-fill.test.mjs — rule pack 2.4.0, MT wind rule (13 Nov 2026, SAST):
// "When the METAR wind is unknown, use the TAF wind; with no TAF, use the model wind."
// Only with no wind anywhere: CAUTION "Wind not reported" (POL-WIND-MISSING).
// Also the 2.4.0 visibility fixes: VRB / ///// wind groups before the vis group, and AWC "6+" = 10 km or more.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { console, Date, Math, JSON }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../../site/engine/ga-core-v2.js", import.meta.url), "utf8"), ctx);
const E = ctx.GACoreV2;

const H = 3600e3, MIN = 60e3;
const NOW = Date.UTC(2026, 10, 13, 10, 0); // 12:00 SAST
const p2 = (n) => String(n).padStart(2, "0");
const z = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + "Z"; };
const ddhh = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()); };
const FACT = { icao: "FACT", lat: -33.965, lon: 18.602, elevFt: 151, category: "c",
  runways: [{ id: "01", true: 1 }, { id: "19", true: 181 }, { id: "16", true: 161 }, { id: "34", true: 341 }] };
const met = (body, ageMin = 10) => { const t = NOW - ageMin * MIN; return { raw: `METAR FACT ${z(t)} ${body}`, time: t }; };
const awc = (body, fields, ageMin = 10) => { const t = NOW - ageMin * MIN; return Object.assign({ rawOb: `METAR FACT ${z(t)} ${body}`, obsTime: Math.round(t / 1000) }, fields); };
const T0 = NOW - 4 * H;
const TAF = `TAF FACT ${z(T0 - 30 * MIN)} ${ddhh(T0)}/${ddhh(T0 + 30 * H)} 25020KT 9999 FEW030 FM${z(NOW + 5 * H).slice(0, 6)} 18008KT 9999 SCT040`;
const TAF_NOWIND = `TAF FACT ${z(T0 - 30 * MIN)} ${ddhh(T0)}/${ddhh(T0 + 30 * H)} 9999 FEW030`;
const mrow = (t, o = {}) => Object.assign({ time: t, fetchedAt: NOW - 20 * MIN, wd: 250, ws: 20, g: 24, vis: 20, ceil: null, low: 10, t: 20, qnh: 1015 }, o);
const MODEL = mrow(Math.floor(NOW / H) * H);
const HOURS = Array.from({ length: 10 }, (_, i) => mrow(Math.floor(NOW / H) * H + (i - 1) * H));
const PROFILE = { licence: "ppl", night: true };
const run = (w, mode = {}, profile = PROFILE) => E.evaluate({ field: FACT, weather: JSON.parse(JSON.stringify(w)), profile, aircraftId: "C172", phase: mode.phase || "depart", etd: mode.etd, eta: mode.eta, now: NOW });
const has = (r, id) => r.findings.some((f) => f.ruleId === id);
const MODES = [{ phase: "depart" }, { phase: "land", eta: NOW }, { phase: "land", eta: NOW + H }, { phase: "land", eta: NOW + 2 * H }, { phase: "depart", etd: NOW + 2 * H }];
const NOWIND_METARS = {
  "AUTO, no wind group": met("AUTO 9999 NCD 22/10 Q1018"),
  "/////KT": met("AUTO /////KT 9999 NCD 22/10 Q1018"),
  "stale 75 min, no wind": met("AUTO /////KT 9999 NCD 22/10 Q1018", 75),
  "NOSIG trend, no wind": met("AUTO /////KT 9999 NCD 22/10 Q1018 NOSIG"),
  "AWC row with no wdir/wspd": awc("AUTO /////KT 9999 NCD 22/10 Q1018", { visib: "6+" }),
};

test("MT test case: METAR wind missing + TAF 25020 at FACT -> NO DEPART, ~19 kt crosswind, wind from TAF", () => {
  const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), taf: TAF, model: MODEL });
  assert.equal(r.status, "nogo");
  assert.equal(r.windSource, "taf");
  assert.equal(r.weatherUsed.ws, 20); assert.equal(r.weatherUsed.wd, 250); assert.equal(r.weatherUsed.windSrc, "taf");
  assert.equal(Math.round(r.wind.xw), 19);
  assert.match(r.why, /Crosswind 19 kt.*wind from TAF/);
  assert.ok(has(r, "POL-WIND-FILL")); assert.ok(!has(r, "POL-WIND-MISSING"));
});

for (const [name, m] of Object.entries(NOWIND_METARS)) for (const mode of MODES) {
  test(`fill from TAF: ${name}, ${mode.phase} ${mode.eta != null ? "+" + (mode.eta - NOW) / H + "h" : mode.etd != null ? "ETD+" + (mode.etd - NOW) / H + "h" : "now"}`, () => {
    const r = run({ metar: m, taf: TAF, model: MODEL, modelHours: HOURS }, mode);
    assert.equal(r.weatherUsed.ws, 20, "wind used must be the TAF 25020");
    assert.equal(r.status, "nogo");
    assert.ok(!has(r, "POL-WIND-MISSING"));
  });
}

test("no TAF -> model wind, labelled 'wind from model', model margins apply", () => {
  for (const mode of MODES) {
    const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), model: MODEL, modelHours: HOURS }, mode);
    assert.equal(r.weatherUsed.ws, 20); assert.ok(r.windSource === "model");
    assert.equal(r.status, "nogo"); // 19 kt xw >= 12 + 5 margin: clear model NO-GO
    assert.ok(!has(r, "POL-WIND-MISSING"));
  }
  const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), model: MODEL });
  assert.match(r.why, /wind from model/);
});

test("model margin applies to a model-filled wind (borderline 14 kt xw -> caution, not NO DEPART)", () => {
  const m = mrow(Math.floor(NOW / H) * H, { wd: 250, ws: 15, g: null });
  const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), model: m });
  assert.equal(r.windSource, "model");
  assert.equal(r.status, "caution");
  assert.ok(r.findings.some((f) => f.ruleId === "POL-MODEL-BORDERLINE" && /wind from model/.test(f.txt)));
});

test("TAF period without wind -> model wind", () => {
  for (const w of [{ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), taf: TAF_NOWIND, model: MODEL, modelHours: HOURS }, { taf: TAF_NOWIND, model: MODEL, modelHours: HOURS }]) {
    for (const mode of MODES) {
      const r = run(w, mode);
      assert.equal(r.weatherUsed.ws, 20, JSON.stringify(mode)); assert.equal(r.windSource, "model");
      assert.ok(!has(r, "POL-WIND-MISSING"));
    }
  }
});

test("no wind anywhere -> CAUTION 'Wind not reported' (POL-WIND-MISSING) stays", () => {
  const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018") });
  assert.equal(r.status, "caution");
  assert.ok(has(r, "POL-WIND-MISSING")); assert.equal(r.windSource, null);
  const r2 = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), taf: TAF_NOWIND });
  assert.ok(has(r2, "POL-WIND-MISSING"));
});

test("METAR wind present is never overridden by the TAF or model", () => {
  const r = run({ metar: met("16010KT 9999 FEW030 22/10 Q1018"), taf: TAF, model: MODEL });
  assert.equal(r.status, "go"); assert.equal(r.windSource, "metar"); assert.equal(r.weatherUsed.ws, 10);
  assert.ok(!has(r, "POL-WIND-FILL"));
  const c = run({ metar: met("AUTO 00000KT 9999 NCD 15/11 Q1023"), taf: TAF });
  assert.equal(c.windSource, "metar"); assert.equal(c.weatherUsed.ws, 0);
});

test("old model (over 180 min) is not used for the fill", () => {
  const old = mrow(Math.floor(NOW / H) * H, { fetchedAt: NOW - 200 * MIN });
  const r = run({ metar: met("AUTO /////KT 9999 NCD 22/10 Q1018"), model: old });
  assert.ok(has(r, "POL-WIND-MISSING"));
});

test("visibility: VRB and ///// wind groups no longer hide the vis group", () => {
  assert.equal(E.visKm("METAR FACT 130950Z VRB03KT 9999 FEW030 22/10 Q1018"), 10);
  assert.equal(E.visKm("METAR FACT 130950Z /////KT 4000 BR 22/10 Q1018"), 4);
  assert.equal(E.visKm("METAR FACT 130950Z AUTO 6000 NCD 22/10 Q1018"), 6);
  assert.equal(E.visKm("METAR FACT 130950Z VRB03G15KT 0800 FG 22/10 Q1018"), 0.8);
  assert.equal(E.visKm("METAR FACT 130950Z 16010KT 9999 FEW030 22/10 Q1018"), 10);
  const r = run({ metar: met("VRB03KT 9999 FEW030 22/10 Q1018") });
  assert.equal(r.status, "go"); assert.equal(r.weatherUsed.vis, 10);
  assert.ok(!r.findings.some((f) => f.k === "vis" && f.lv !== "note"));
  const r2 = run({ metar: met("/////KT 9999 FEW030 22/10 Q1018") });
  assert.equal(r2.weatherUsed.vis, 10); assert.equal(r2.status, "caution"); assert.ok(has(r2, "POL-WIND-MISSING"));
});

test("visibility: AWC '6+' is 10 km or more and meets a 10 km personal limit", () => {
  const r = run({ metar: awc("VRB03KT 9999 FEW030 22/10 Q1018", { wdir: "VRB", wspd: 3, visib: "6+" }) }, {}, { licence: "ppl", night: true, visKm: 10 });
  assert.equal(r.status, "go");
  const r2 = run({ metar: { obsTime: Math.round((NOW - 10 * MIN) / 1000), wdir: 160, wspd: 10, visib: "6+" } }, {}, { licence: "ppl", night: true, visKm: 10 });
  assert.equal(r2.weatherUsed.vis, 10); assert.equal(r2.status, "go");
});

/* MT t1968u (13 Nov 2026): a STALE METAR (older than policy.metarFreshMin = 60 min) that DOES report a wind has
   that wind replaced: TAF for that time, else model, labelled the same way. A fresh METAR wind is never replaced. */
test("stale METAR (75 min) with calm wind + TAF 25020 -> wind from TAF, NO DEPART, note says the METAR wind was replaced", () => {
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", 75), taf: TAF, model: MODEL });
  assert.equal(r.weatherUsed.ws, 20); assert.equal(r.weatherUsed.wd, 250); assert.equal(r.windSource, "taf");
  assert.equal(r.status, "nogo"); assert.match(r.why, /wind from TAF/);
  const n = r.findings.find((f) => f.ruleId === "POL-WIND-FILL"); assert.ok(n); assert.match(n.txt, /stale \(75 min old\), its wind 340° 4 kt replaced from the TAF/);
  assert.ok(has(r, "POL-METAR-STALE-60"), "the stale caution stays");
});
test("stale METAR with wind, no TAF -> model wind, labelled 'wind from model'", () => {
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", 75), model: MODEL });
  assert.equal(r.windSource, "model"); assert.equal(r.weatherUsed.ws, 20); assert.match(r.why, /wind from model/);
});
test("stale METAR with wind, TAF without wind -> model wind", () => {
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", 75), taf: TAF_NOWIND, model: MODEL });
  assert.equal(r.windSource, "model"); assert.equal(r.weatherUsed.ws, 20);
});
test("stale METAR with wind, no TAF and no model -> the METAR wind is kept (not 'Wind not reported')", () => {
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", 75) });
  assert.equal(r.windSource, "metar"); assert.equal(r.weatherUsed.ws, 4);
  assert.ok(!has(r, "POL-WIND-MISSING")); assert.ok(!has(r, "POL-WIND-FILL"));
});
test("stale METAR with wind, model too old -> METAR wind kept", () => {
  const old = mrow(Math.floor(NOW / H) * H - 5 * H, { fetchedAt: NOW - 5 * H });
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", 75), model: old });
  assert.equal(r.windSource, "metar"); assert.equal(r.weatherUsed.ws, 4);
});
for (const age of [10, 59, 60]) test(`fresh METAR (${age} min) with wind is NOT replaced even with TAF 25020`, () => {
  const r = run({ metar: met("34004KT 9999 FEW030 22/10 Q1018", age), taf: TAF, model: MODEL });
  assert.equal(r.windSource, "metar"); assert.equal(r.weatherUsed.ws, 4); assert.ok(!has(r, "POL-WIND-FILL"));
});
test("stale METAR with gusty wind replaced by a calmer TAF wind: gust no longer judged from the old METAR", () => {
  const calmTaf = `TAF FACT ${z(T0 - 30 * MIN)} ${ddhh(T0)}/${ddhh(T0 + 30 * H)} 34005KT 9999 FEW030`;
  const r = run({ metar: met("25025G38KT 9999 FEW030 22/10 Q1018", 90), taf: calmTaf, model: MODEL });
  assert.equal(r.windSource, "taf"); assert.equal(r.weatherUsed.ws, 5); assert.equal(r.weatherUsed.g ?? null, null);
});
test("stale METAR with VRB wind -> TAF wind replaces it", () => {
  const r = run({ metar: met("VRB03KT 9999 FEW030 22/10 Q1018", 75), taf: TAF, model: MODEL });
  assert.equal(r.windSource, "taf"); assert.equal(r.weatherUsed.wd, 250);
});

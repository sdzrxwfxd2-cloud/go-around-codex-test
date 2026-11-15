// tests/engine-v2/compare.test.mjs — STEP 4 of the core engine review (13 Nov 2026): the old engine (live 2.3.2, archived
// untouched in archive/core-engine-12nov/live-2.3.2/) and the new engine (site/engine/) on the same inputs. Every verdict or
// number that differs is listed in tests/engine-v2/compare-report.json, and the test fails on any difference that is not one
// of the PLANNED ones below.
//
// Inputs: 40 aerodromes (real SA positions and elevations, with and without runways) x 22 weather cases (METAR edge cases, NIL,
// /////KT, CAVOK, TEMPO/BECMG/FM/PROB TAFs, model only, old model, old METAR, nothing) x Depart / Land Now / +1h / +2h / +3h
// x 3 pilot profiles x 4 times of day (incl. dusk and night). 52 800 evaluations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const load = (file) => { const ctx = { console, Date, Math, JSON }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../../" + file, import.meta.url), "utf8"), ctx); return ctx.GACoreV2; };
const OLD = load("tests/engine-v2/baseline-live-644fcb87/engine/ga-core-v2.js");
const NEW = load("site/engine/ga-core-v2.js");
const H = 3600e3, MIN = 60e3;
const p2 = (n) => String(n).padStart(2, "0");
const z = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + "Z"; };
const zh = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()); };

// 40 aerodromes from the model point list (real positions and elevations), every third one without runways
const PTS = JSON.parse(readFileSync(new URL("../../netlify/lib/model_points.json", import.meta.url), "utf8"));
const LIST = (Array.isArray(PTS) ? PTS : PTS.points || []).filter((p) => /^FA[A-Z]{2}$/.test(p[0])).slice(0, 40);
const FIELDS = LIST.map((p, i) => ({ ic: p[0], lat: +p[1], lon: +p[2], elev: 200 + ((i * 397) % 5600), rw: i % 3 === 2 ? [] : rwPair(((i * 7) % 18) + 1) }));
// Port 13 Nov 2026: runways go in as { id, true } objects (what runwaysOf() reads). As bare strings they were dropped, every
// field looked runway-less and crosswind / tailwind on a runway was never compared.
function rwPair(n) { return [{ id: String(n).padStart(2, "0"), true: n * 10 }, { id: String(n + 18).padStart(2, "0"), true: ((n + 18) * 10) % 360 }]; }

function cases(now) {
  const hr = Math.floor(now / H) * H, ft = now - 25 * MIN;
  const rows = (f) => [-1, 0, 1, 2, 3, 4, 5].map((h) => ({ time: hr + h * H, fetchedAt: ft, ...f(h) }));
  const calm = (h) => ({ visibility: 24000, wind_speed_10m: 6, wind_direction_10m: 30, wind_gusts_10m: 10, cloud_cover_low: 0, temperature_2m: 22, pressure_msl: 1018 });
  const worse = (h) => ({ ...calm(h), wind_speed_10m: 6 + h * 6, wind_gusts_10m: 10 + h * 8, wind_direction_10m: 30 + h * 40, visibility: h >= 3 ? 3000 : 24000 });
  const mt = (body, age = 10) => ({ raw: `METAR FAZZ ${z(now - age * MIN)} ${body}`, time: now - age * MIN });
  const taf = (body) => `TAF FAZZ ${z(hr - 3 * H)} ${zh(hr - 2 * H)}/${zh(hr + 22 * H)} ${body}`;
  return {
    "metar-cavok": { metar: mt("22008KT CAVOK 24/10 Q1021 NOSIG") },
    "metar-gust": { metar: mt("18012G28KT 9999 FEW040 25/09 Q1019") },
    "metar-fog": { metar: mt("VRB03KT 0400 FG VV002 12/12 Q1022") },
    "metar-ts-tempo": { metar: mt("27015G28KT 6000 TSRA SCT030CB BKN045 21/17 Q1012 TEMPO 3000 +TSRA") },
    "metar-nil": { metar: mt("NIL") },
    "metar-nowind": { metar: mt("AUTO /////KT 9999 FEW030 20/10 Q1020") },
    // 2.4.0 wind fill: no METAR wind, TAF wind / model wind available
    "metar-nowind+taf": { metar: mt("AUTO /////KT 9999 FEW030 20/10 Q1020"), taf: taf("25020KT 9999 SCT045") },
    "metar-nowind+model": { metar: mt("AUTO /////KT 9999 FEW030 20/10 Q1020"), model: rows(worse)[1], modelHours: rows(worse) },
    "metar-varying": { metar: mt("12009KT 090V160 8000 SCT018 BKN030 20/14 Q1017") },
    "metar-low-ceil": { metar: mt("15006KT 9999 BKN012 19/15 Q1020") },
    "metar-hot-high": { metar: mt("33010KT 9999 FEW050 34/02 Q1015") },
    "metar-old-80": { metar: mt("22008KT 9999 SCT040 24/10 Q1021", 80), model: rows(calm)[1] },
    "metar-old-100": { metar: mt("22008KT 9999 SCT040 24/10 Q1021", 100), model: rows(calm)[1] },
    "metar+taf-tempo": { metar: mt("22010KT 9999 SCT040 24/10 Q1021"), taf: taf(`22010KT 9999 SCT040 TEMPO ${zh(hr + 1 * H)}/${zh(hr + 4 * H)} 25018G30KT 5000 TSRA SCT030CB`) },
    "taf-only-becmg": { taf: taf(`VRB03KT 0800 FG VV002 BECMG ${zh(hr + 1 * H)}/${zh(hr + 2 * H)} 18008KT 9999 SCT030`) },
    "taf-only-fm": { taf: taf(`18008KT CAVOK FM${z(hr + 3 * H).slice(0, 6)} 27025G38KT 6000 -SHRA BKN020`) },
    "taf-prob30": { taf: taf(`09012KT 9999 FEW030 PROB30 TEMPO ${zh(hr + 2 * H)}/${zh(hr + 6 * H)} 3000 TSRA BKN025CB`) },
    "taf+model": { taf: taf("24006KT 9999 SCT045"), model: rows(worse)[1], modelHours: rows(worse) },
    "model-calm": { model: rows(calm)[1], modelHours: rows(calm) },
    "model-worsening": { model: rows(worse)[1], modelHours: rows(worse) },
    "model-old": { model: { ...rows(calm)[1], fetchedAt: now - 200 * MIN }, modelHours: rows(calm).map((r) => ({ ...r, fetchedAt: now - 200 * MIN })) },
    "model-now-only": { model: rows(worse)[1] },
    "speci": { metar: mt("22008KT 9999 SCT040 24/10 Q1021", 40), speci: mt("22020G35KT 4000 TSRA BKN015CB 22/16 Q1018", 5) },
    "nothing": {},
  };
}
const PROFILES = { ppl: { licence: "ppl" }, "ppl-night": { licence: "ppl", night: true }, cpl: { licence: "cpl" } };
// 13 Nov 2026 SAST: 08:00 (day), 15:30 (afternoon), 18:20 (dusk, night within the hour), 23:10 (night)
const TIMES = [Date.UTC(2026, 10, 13, 6, 0), Date.UTC(2026, 10, 13, 13, 30), Date.UTC(2026, 10, 13, 16, 20), Date.UTC(2026, 10, 13, 21, 10)];
const STEPS = [["depart", null], ["land", 0], ["land", 1], ["land", 2], ["land", 3]];

// 2.4.0 (13 Nov 2026): weatherUsed.windSrc is new; it is compared through the wind-fill rule below, not as a raw key.
// 14 Nov 2026 (card weather chain, MT "update" 07:21 SAST): weatherUsed gained per-field source / display keys (visSrc, ceilSrc,
// tempSrc, qnhSrc, windSrc, visFill, ceilFill, cavok, cnr, visAtLeast, skyClear, low, cc, raw, wx). They are display data only, so
// the comparison keeps to the keys the old engine had. Any change in those keys, the verdict, the reasons or the why still counts.
const USED_KEYS = ["vis", "ceil", "wd", "vrb", "ws", "g", "temp", "qnh", "time", "src"];
const usedNoSrc = (u) => { if (!u) return u; const o = {}; for (const k of USED_KEYS) if (k in u) o[k] = u[k]; return JSON.stringify(o); };
const strip = (r) => ({ status: r.status, code: r.code, why: r.why, src: r.source && r.source.kind, srcTime: r.source && r.source.time,
  used: r.weatherUsed && usedNoSrc(r.weatherUsed), wind: r.wind && JSON.stringify(r.wind), da: r.da,
  reasons: (r.reasons || []).filter((f) => f.lv !== "note").map((f) => f.lv + ":" + f.ruleId).join(",") });

/** A difference is PLANNED when it comes from E-02: a land arrival window (+1h/+2h/+3h) that the old engine judged on the model
 *  row of NOW. The new engine judges the model hours in ETA ±1 h (worst wins), or says "no forecast loaded for the arrival time"
 *  when no hour covers it. Anything else is a bug. */
/** PLANNED WIND-FILL (rule pack 2.4.0, MT 13 Nov 2026): the old engine had no wind (ws null, POL-WIND-MISSING) and the new
 *  engine took the wind from the TAF for that time or, with no TAF wind, from the model. */
function plannedWindFill(oRaw, nRaw) {
  const ou = oRaw.weatherUsed, nu = nRaw.weatherUsed;
  return !!(ou && nu && ou.ws == null && nu.ws != null && (nu.windSrc === "taf" || nu.windSrc === "model") &&
    (oRaw.reasons || []).some((f) => f.ruleId === "POL-WIND-MISSING") && !(nRaw.reasons || []).some((f) => f.ruleId === "POL-WIND-MISSING"));
}
/** PLANNED STALE-WIND (rule pack 2.4.0, MT t1968u 13 Nov 2026): a stale METAR (POL-METAR-STALE-60) that reported a wind
 *  now has that wind replaced by the TAF wind for that time, else the model wind (POL-WIND-FILL note, windSrc taf/model). */
function plannedStaleWind(oRaw, nRaw) {
  const ou = oRaw.weatherUsed, nu = nRaw.weatherUsed, R = (x, id) => (x.reasons || x.findings || []).some((f) => f.ruleId === id);
  return !!(ou && nu && ou.ws != null && nu.ws != null && (nu.windSrc === "taf" || nu.windSrc === "model") &&
    R(nRaw, "POL-METAR-STALE-60") && R(nRaw, "POL-WIND-FILL"));
}
/** PLANNED VIS-VRB (rule pack 2.4.0): the vis group after a VRB or ///// wind group (or with no wind group) was not read, so a
 *  real visibility (e.g. VRB03KT 0400 FG) became "Visibility not in METAR". The new engine reads it. */
function plannedVisVrb(oRaw, nRaw, wx) {
  const ou = oRaw.weatherUsed, nu = nRaw.weatherUsed, raw = (wx.speci && wx.speci.raw || "") + " " + (wx.metar && wx.metar.raw || "");
  return !!(ou && nu && ou.vis == null && nu.vis != null && /\s(?:VRB\d|\/\/\/\/\/KT|\d{6}Z\s(?:AUTO\s)?\d{4}\s)/.test(raw));
}
/** PLANNED TAF-MODEL-FILL (14 Nov 2026, METAR -> TAF -> model for every field): a TAF has no temperature or QNH, so the new engine
 *  takes them from a usable model row; density altitude can then be worked out. Allowed only when nothing else moved: same
 *  verdict, code, reasons and why, source still TAF, and temp / QNH were empty before and are filled now. */
function plannedTafModelFill(o, n, keys) {
  if (!keys.every((k) => k === "used" || k === "da")) return false;
  if (o.src !== "taf" || n.src !== "taf" || !o.used || !n.used) return false;
  const ou = JSON.parse(o.used), nu = JSON.parse(n.used);
  const moved = USED_KEYS.filter((k) => JSON.stringify(ou[k]) !== JSON.stringify(nu[k]));
  if (!moved.every((k) => (k === "temp" || k === "qnh") && ou[k] == null && nu[k] != null)) return false;
  return keys.includes("da") ? o.da == null && n.da != null : true;
}
/** PLANNED DA-INFO (rule pack 2.5.0, MT 15 Nov 2026 13:25 SAST): density altitude depends on aircraft weight, so it is information
 *  only. The old CAUTION POL-DA is gone and nothing else moved: same reasons without it, same why unless the why was the DA line. */
function plannedDaInfo(o, n, keys) {
  if (!keys.every((k) => k === "status" || k === "code" || k === "why" || k === "reasons")) return false;
  const or = o.reasons ? o.reasons.split(",") : [];
  if (!or.includes("caution:POL-DA")) return false;
  if (or.filter((x) => x !== "caution:POL-DA").join(",") !== n.reasons) return false;
  return o.why === n.why || /^Density altitude/.test(o.why);
}
/** PLANNED TAF-EARLY (rule pack 2.5.0, MT 15 Nov 2026): no METAR in use and no TAF period in force; the TAF (issued before now)
 *  starts within 3 h, so its first period is used and marked early (CAUTION POL-TAF-EARLY). */
function plannedTafEarly(nRaw) {
  return !!(nRaw.weatherUsed && nRaw.weatherUsed.tafEarly != null && (nRaw.reasons || []).some((f) => f.ruleId === "POL-TAF-EARLY"));
}
function planned(o, n, step, wx) {
  const window = step[0] === "land" && step[1] >= 1;
  const oldUsedModel = o.src === "model" || (o.status === "incomplete" && n.code === "noforecast");
  return window && oldUsedModel && (n.src === "model" || n.code === "noforecast") && !!(wx.model || wx.modelHours);
}

test("old (live 2.3.2) vs new engine: every difference is planned (E-02 / E-08 / WIND-FILL / STALE-WIND / VIS-VRB / TAF-MODEL-FILL / DA-INFO / TAF-EARLY) and listed", () => {
  const diffs = [], byKind = {}, verdictChanges = {}; let total = 0, same = 0;
  for (const now of TIMES) {
    const C = cases(now);
    for (const f of FIELDS) for (const [cname, wx] of Object.entries(C)) for (const [pname, prof] of Object.entries(PROFILES)) for (const step of STEPS) {
      const input = { field: f, weather: wx, profile: prof, aircraftId: "C172", rules: "vfr", phase: step[0], eta: step[1] == null ? undefined : now + step[1] * H, now };
      // the old engine never received modelHours; give it exactly what live gave it
      const oldIn = { ...input, weather: Object.fromEntries(Object.entries(wx).filter(([k]) => k !== "modelHours")) };
      const oRaw = OLD.evaluate(oldIn), nRaw = NEW.evaluate(input);
      const o = strip(oRaw), n = strip(nRaw); total++;
      const keys = Object.keys(o).filter((k) => o[k] !== n[k]);
      if (!keys.length) { same++; continue; }
      const onlyWording = keys.every((k) => k === "why") && o.why.replace(/\((now) /g, "(at arrival ") === n.why && step[0] === "land" && step[1] >= 1;
      const wf = plannedWindFill(oRaw, nRaw), sw = plannedStaleWind(oRaw, nRaw), vv = plannedVisVrb(oRaw, nRaw, wx);
      const kind = wf && vv ? "PLANNED WIND-FILL + VIS-VRB"
        : vv ? "PLANNED VIS-VRB (vis group after a VRB / ///// wind group is read)"
        : wf ? "PLANNED WIND-FILL (METAR/TAF wind missing -> TAF wind, then model wind)"
        : sw ? "PLANNED STALE-WIND (stale METAR wind -> TAF wind, then model wind)"
        : plannedDaInfo(o, n, keys) ? "PLANNED DA-INFO (density altitude is information only, never a verdict)"
        : plannedTafEarly(nRaw) ? "PLANNED TAF-EARLY (TAF not yet in force, next period within 3 h)"
        : plannedTafModelFill(o, n, keys) ? "PLANNED TAF-MODEL-FILL (TAF temp / QNH from the model, DA now known)"
        : planned(o, n, step, wx) ? "PLANNED E-02 (arrival window judged on its own model hours)"
        : onlyWording ? "PLANNED E-08 (reason says 'at arrival', not 'now', for a forecast value)" : "UNPLANNED";
      byKind[kind] = (byKind[kind] || 0) + 1;
      if (o.status !== n.status) { const vk = o.status + " -> " + n.status + " (" + step[0] + (step[1] == null ? "" : " +" + step[1] + "h") + ")"; verdictChanges[vk] = (verdictChanges[vk] || 0) + 1; }
      if (diffs.length < 4000) diffs.push({ kind, case: cname, field: f.ic, profile: pname, step: step[0] + (step[1] == null ? "" : " +" + step[1] + "h"),
        at: new Date(now).toISOString().slice(11, 16) + "Z", keys, old: Object.fromEntries(keys.map((k) => [k, o[k]])), new: Object.fromEntries(keys.map((k) => [k, n[k]])) });
    }
  }
  const report = { total, same, different: total - same, byKind, verdictChanges, unplanned: diffs.filter((d) => d.kind === "UNPLANNED").slice(0, 50), examples: diffs.slice(0, 40) };
  writeFileSync(new URL("compare-report.json", import.meta.url), JSON.stringify(report, null, 1) + "\n");
  assert.equal(total, TIMES.length * FIELDS.length * Object.keys(cases(TIMES[0])).length * Object.keys(PROFILES).length * STEPS.length);
  assert.equal(byKind.UNPLANNED || 0, 0, "unplanned differences: see tests/engine-v2/compare-report.json");
  // Depart and land-Now must be byte-for-byte the same verdicts, apart from the planned wind fill (2.4.0).
  assert.ok(!diffs.some((d) => (d.step === "depart" || d.step === "land +0h") && !/WIND-FILL|STALE-WIND|VIS-VRB|TAF-MODEL-FILL|DA-INFO|TAF-EARLY/.test(d.kind)), "Depart / Land Now changed");
});

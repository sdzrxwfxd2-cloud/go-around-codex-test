// tests/engine-v2/time-steps.test.mjs — Now, +1h, +2h, +3h (core engine review, 13 Nov 2026). Run: node --test tests/engine-v2/
// Rule under test, docs/engine-v2/DECISIONS.md: "Land with an arrive time more than about 30 minutes away uses the TAF (or TREND,
// or model) across ETA ±1 h, and takes the worst expected lasting condition."
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function engine(file = "site/engine/ga-core-v2.js") {
  const ctx = { console, Date, Math, JSON }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../../" + file, import.meta.url), "utf8"), ctx);
  return ctx.GACoreV2;
}
const E = engine();
const H = 3600e3, MIN = 60e3;
// 12:20 SAST on 13 Nov 2026 (10:20 UTC): full daylight, so night rules stay out of the way.
const NOW = Date.UTC(2026, 10, 13, 10, 20);
const HOUR0 = Date.UTC(2026, 10, 13, 10, 0);
const FIELD = { ic: "FAZZ", lat: -26.2, lon: 28.2, elev: 5000, rw: ["03", "21"] };
const PROFILE = { licence: "ppl" };
const row = (h, over = {}) => ({ time: HOUR0 + h * H, fetchedAt: NOW - 20 * MIN, visibility: 24000, wind_speed_10m: 6, wind_direction_10m: 30, wind_gusts_10m: 9, cloud_cover_low: 0, ...over });
const HOURS = [-1, 0, 1, 2, 3, 4, 5].map((h) => row(h));
const land = (off, weather) => E.evaluate({ field: FIELD, weather, profile: PROFILE, aircraftId: "C172", rules: "vfr", phase: "land", eta: NOW + off * H, now: NOW });

test("+3h: a strong wind forecast at 13:00 UTC makes +3h NO LAND while Now stays LAND (model only, no TAF)", () => {
  const hours = HOURS.map((r) => (r.time === HOUR0 + 3 * H ? { ...r, wind_speed_10m: 30, wind_gusts_10m: 42, wind_direction_10m: 120 } : r));
  const now = land(0, { model: hours[1] });
  assert.equal(now.status, "go");
  const plus3 = land(3, { model: hours[1], modelHours: hours });
  assert.equal(plus3.status, "nogo", plus3.why);
  assert.equal(plus3.source.kind, "model");
  assert.equal(plus3.source.time, HOUR0 + 3 * H, "the verdict names the hour it comes from");
  assert.deepEqual([...plus3.modelWindow.hours], [HOUR0 + 2 * H, HOUR0 + 3 * H, HOUR0 + 4 * H], "ETA 13:20 ±1 h = the 12:00, 13:00 and 14:00 rows");
});

test("+1h, +2h, +3h: the worst hour inside ETA ±1 h wins, and an hour outside it never counts", () => {
  // fog (vis 0.8 km, below the legal VFR 5 km) only in the 14:00 UTC row
  const hours = HOURS.map((r) => (r.time === HOUR0 + 4 * H ? { ...r, visibility: 800 } : r));
  assert.equal(land(1, { model: hours[1], modelHours: hours }).status, "go", "+1h window 10:20–12:20: rows 10, 11, 12");
  assert.equal(land(2, { model: hours[1], modelHours: hours }).status, "go", "+2h window 11:20–13:20: rows 11, 12, 13");
  const r3 = land(3, { model: hours[1], modelHours: hours });
  assert.equal(r3.status, "nogo", "+3h window 12:20–14:20 holds the 14:00 fog");
  assert.match(r3.why, /Visibility 0\.8 km below VFR 5 km/);
  assert.equal(r3.source.time, HOUR0 + 4 * H);
});

test("E-02 regression: with only the weather of now, a +2h or +3h arrival is NOT judged on the weather of now", () => {
  for (const off of [2, 3]) {
    const r = land(off, { model: row(0) });
    assert.equal(r.status, "incomplete", `+${off}h`);
    assert.equal(r.code, "noforecast");
    assert.match(r.why, /No forecast loaded for the arrival time/);
  }
  const r1 = land(1, { model: row(0) });
  assert.equal(r1.status, "go", "+1h: the 10:00 row is inside 10:20 ±1 h, so it may stand");
});

test("a TAF covering the window still wins over the model, as before", () => {
  const taf = "TAF FAZZ 130900Z 1309/1409 03008KT 9999 SCT040";
  const hours = HOURS.map((r) => ({ ...r, visibility: 500 }));
  const r = land(3, { taf, model: hours[1], modelHours: hours });
  assert.equal(r.source.kind, "taf");
  assert.equal(r.status, "go");
});

test("Depart and land Now are untouched by modelHours", () => {
  const hours = HOURS.map((r) => ({ ...r, visibility: 500 }));
  const dep = E.evaluate({ field: FIELD, weather: { model: row(0), modelHours: hours }, profile: PROFILE, aircraftId: "C172", rules: "vfr", phase: "depart", now: NOW });
  assert.equal(dep.status, "go");
  assert.equal(land(0, { model: row(0), modelHours: hours }).status, "go");
});

test("a forecast hour is usable while its run is younger than 180 min, and not after", () => {
  const fresh = HOURS.map((r) => ({ ...r }));
  assert.equal(land(3, { model: fresh[1], modelHours: fresh }).status, "go");
  const old = HOURS.map((r) => ({ ...r, fetchedAt: NOW - 200 * MIN }));
  const r = land(3, { model: old[1], modelHours: old });
  assert.equal(r.status, "incomplete");
});

test("night at the arrival time still decides, with the window hours judged", () => {
  const T = Date.UTC(2026, 10, 13, 15, 30);                        // 17:30 SAST; sunset in Johannesburg about 18:45 SAST
  const H0 = Date.UTC(2026, 10, 13, 15, 0);
  const hrs = [0, 1, 2, 3, 4, 5].map((h) => ({ time: H0 + h * H, fetchedAt: T - 10 * MIN, visibility: 24000, wind_speed_10m: 5, wind_direction_10m: 30, cloud_cover_low: 0 }));
  const r = E.evaluate({ field: FIELD, weather: { model: hrs[0], modelHours: hrs }, profile: PROFILE, aircraftId: "C172", rules: "vfr", phase: "land", eta: T + 3 * H, now: T });
  // POL-NIGHT-ARRIVAL (signed off): landing after dark without night selected is CAUTION (departing at night is NO-GO).
  assert.equal(r.status, "caution", "arriving 20:30 SAST without night selected");
  assert.match(r.why, /land after dark \(night from 18:47\)/);
  const day = E.evaluate({ field: FIELD, weather: { model: hrs[0], modelHours: hrs }, profile: PROFILE, aircraftId: "C172", rules: "vfr", phase: "land", eta: T + 1 * H, now: T });
  assert.equal(day.status, "go", "+1h lands 18:30 SAST, before night");
});

test("E-08: a limit reason for a later arrival says 'at arrival', not 'now'", () => {
  const taf = "TAF FAZZ 130700Z 1308/1408 03008KT 9999 SCT040 FM131200 03008KT 9999 BKN015";
  const r = land(3, { taf });
  assert.equal(r.status, "nogo");
  assert.match(r.why, /Your ceiling limit 2500 ft \(at arrival 1500\)/);
  const now = E.evaluate({ field: FIELD, weather: { metar: { raw: "METAR FAZZ 131010Z 03008KT 9999 BKN015 20/08 Q1020", time: NOW - 10 * MIN } }, profile: PROFILE, aircraftId: "C172", rules: "vfr", phase: "depart", now: NOW });
  assert.match(now.why, /\(now 1500\)/, "Now keeps 'now'");
});


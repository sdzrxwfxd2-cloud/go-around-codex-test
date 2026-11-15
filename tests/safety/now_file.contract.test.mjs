// now_file.contract: for every hour of the wx-now file (h = 0 .. hours-1) the card helpers in wm-model.js give the freezing
// level and the model temperature for now AND the next hour (FZL / DA trends), from the now file or the full copy; a stale
// copy, an hour that does not contain now, or a past-its-hours now file never serves old values as current.
// Pilot-safety P1-1 / P1-2, 13 Nov 2026 (DA trend was on 0/640 cards in the now file's last hour).
import test from "node:test";
import assert from "node:assert/strict";
import { page } from "./harness.mjs";

const H = 3600e3, T0 = Date.UTC(2026, 10, 13, 14, 0);
const iso = (t) => new Date(t).toISOString().slice(0, 16);
const PT = ["FAOR", -26.1392, 28.246];
function nowFile(t0, fetched, hours = 3, fzlHours = 5) {
  const vars = ["temperature_2m", "wind_speed_10m"], c = [[]];
  vars.forEach((k) => { for (let h = 0; h < hours; h++) c[0].push(k === "temperature_2m" ? 20 + h : 8); });
  return { v: 1, composedAt: new Date(fetched).toISOString(), t0: iso(t0), hours, fzlHours, vars, units: {}, pts: [PT], ft: [new Date(fetched).toISOString()],
    el: [1694], fz: [true], c, fzl: [[4000, 4100, 4200, 4300, 4400].slice(0, fzlHours)], metar: [], taf: [], got: fetched };
}
function fullCopy(t0, fetched, n = 13) {
  const time = [], t = [], f = [], w = [];
  for (let h = 0; h < n; h++) { const k = (t0 + h * H - T0) / H; time.push(iso(t0 + h * H)); t.push(20 + k); f.push(4000 + 100 * k); /* same values as the now file for the same hour */ w.push(8); }
  return { pts: [PT], time, el: [1694], ft: [new Date(fetched).toISOString()], fz: [true], updatedAt: new Date(fetched).toISOString(), got: fetched,
    vars: ["temperature_2m", "wind_speed_10m", "freezing_level_height"], v: { temperature_2m: [t], wind_speed_10m: [w], freezing_level_height: [f] }, units: {} };
}
async function at(t, store) {
  const w = page({ now: t, store, fetch: () => Promise.reject(new Error("offline")) });
  w.load("wm-model.js");
  await w.__wmModelPoints([[PT[1], PT[2]]], ["temperature_2m"]);   // loads the now file the way the cards do
  w.__wmFzlAt(PT[1], PT[2]);                                        // first look may start the full-copy read
  await new Promise((r) => setImmediate(r));
  return w;
}

test("every hour of the now file has FZL now/next and temperature now/next (DA trend), with the full copy behind it", async () => {
  for (let h = 0; h < 3; h++) for (const m of [0, 1, 30, 59]) {
    const t = T0 + h * H + m * 60e3;
    const store = { "wm.now.v1": JSON.stringify(nowFile(T0, t - 5 * 60e3)), "wm.mw.v2": JSON.stringify(fullCopy(T0 - 2 * H, t - 20 * 60e3)) };
    const w = await at(t, store);
    const f = w.__wmFzlAt(PT[1], PT[2]), x = w.__wmTAt(PT[1], PT[2]);
    const tag = `h=${h} :${String(m).padStart(2, "0")}`;
    assert.ok(f && f.fl != null && f.next != null, tag + " FZL now/next");
    assert.ok(x && x.t != null && x.tNext != null, tag + " temperature now/next");
    assert.equal(f.time, iso(T0 + h * H), tag + " the hour in force");
    assert.equal(x.tNext - x.t, 1, tag + " next hour is the next hour");
  }
});

test("past the now file's hours the full copy answers; it never re-serves the now file's last hour", async () => {
  const t = T0 + 3 * H + 5 * 60e3;
  const store = { "wm.now.v1": JSON.stringify(nowFile(T0, T0 - 5 * 60e3)), "wm.mw.v2": JSON.stringify(fullCopy(T0 - 2 * H, t - 30 * 60e3)) };
  const w = await at(t, store);
  const f = w.__wmFzlAt(PT[1], PT[2]);
  assert.ok(f, "served from the full copy");
  assert.equal(f.time, iso(T0 + 3 * H));
});

test("a copy fetched more than 180 min ago, or with no row for the hour in force, serves nothing (no row[0] fallback)", async () => {
  const t = T0 + 30 * 60e3;
  let w = await at(t, { "wm.mw.v2": JSON.stringify(fullCopy(T0 - 2 * H, t - 200 * 60e3)) });
  assert.equal(w.__wmFzlAt(PT[1], PT[2]), null, "stale fetch");
  assert.equal(w.__wmTAt(PT[1], PT[2]), null, "stale fetch (DA trend)");
  w = await at(t, { "wm.mw.v2": JSON.stringify(fullCopy(T0 + 2 * H, t - 10 * 60e3)) });
  assert.equal(w.__wmFzlAt(PT[1], PT[2]), null, "copy starts in the future");
  w = await at(T0 + 20 * H, { "wm.mw.v2": JSON.stringify(fullCopy(T0, T0 + 19 * H, 13)) });
  assert.equal(w.__wmFzlAt(PT[1], PT[2]), null, "copy ended hours ago");
});

test("elevation for the DA pill comes from the copy point without any freshness rule", async () => {
  const t = T0 + 30 * 60e3;
  const w = await at(t, { "wm.mw.v2": JSON.stringify(fullCopy(T0 - 2 * H, t - 400 * 60e3)) });
  assert.equal(w.__wmElevAt(PT[1], PT[2]), 1694);
});

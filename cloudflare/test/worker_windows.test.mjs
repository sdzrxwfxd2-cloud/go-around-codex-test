// Weather Worker fetch windows and write-on-change (MT 15 Nov 2026 14:23 SAST). Run: cd cloudflare && npm test
// METAR: every minute at :04-:20 and :30-:34 SAST, every 5 min otherwise. TAF: every minute for 45 min after 05, 06, 08,
// 11, 12, 18, 00 SAST, every 10 min otherwise. KV: written only when a report changed, plus the 10-min full tick, under
// 1,000 writes a day. The previous TAF is kept (taf.prev) until the early one starts; /api/metar, /api/taf, /api/wx-now
// keep their shape for the pages that are live now.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
// the Worker bundles @netlify/blobs as worker/src/no-blobs.mjs (wrangler alias); do the same here
register("data:text/javascript," + encodeURIComponent(
  'export async function resolve(s, c, n) { return s === "@netlify/blobs" ? { url: "data:text/javascript,export const getStore=()=>null", shortCircuit: true } : n(s, c); }'));
const { runTick, WRITE_CAP } = await import("../worker/src/index.mjs");
const { windowDue, metarFast, tafFast, keepPrevTaf, rowsSig } = await import("../../netlify/lib/wx_snapshot.mjs");
const { KV_KEYS } = await import("../lib/keys.mjs");

const MIN = 60e3, H = 3600e3;
const sast = (h, m) => Date.UTC(2026, 10, 15, h - 2, m);   // SAST = UTC+2
function kv() {
  const m = new Map(); let puts = 0;
  return { m, get puts() { return puts; },
    async get(k) { const x = m.get(k); return x ? x.v : null; },
    async getWithMetadata(k) { const x = m.get(k); return x ? { value: { cancel: async () => {} }, metadata: x.meta || null } : { value: null, metadata: null }; },
    async put(k, v, o) { puts++; m.set(k, { v: String(v), meta: (o && o.metadata) || null }); } };
}
/* a fake aviationweather.gov: new METARs arrive at :05-:08 and :35 past every hour, one TAF set per issue time; Open-Meteo answers */
function world() {
  const S = { now: 0, awc: 0, om: 0 };
  const ids = ["FAOR", "FACT", "FALE", "FABL"];
  const metars = () => { const t = S.now, hb = Math.floor(t / H) * H, mm = (t - hb) / MIN;
    const obs = mm >= 35 ? hb + 30 * MIN : hb;                      // half-hourly reports, received a few minutes after
    return ids.map((id, i) => { const recv = obs + (5 + i) * MIN, o = recv <= t ? obs : obs - 30 * MIN;
      return { icaoId: id, obsTime: o / 1000, rawOb: "METAR " + id + " " + new Date(o).toISOString().slice(8, 16).replace(/[-T:]/g, "") + "Z 22008KT CAVOK 24/10 Q1021" }; }); };
  const issues = [0, 5, 6, 8, 11, 12, 18].map((h) => h - 2 < 0 ? h + 22 : h - 2);   // UTC hours
  const tafs = () => { const t = S.now, d = new Date(t); let best = null;
    for (let k = 0; k < 48; k++) { const hh = new Date(Math.floor(t / H) * H - k * H); if (issues.includes(hh.getUTCHours()) && hh.getTime() + 20 * MIN <= t) { best = hh.getTime(); break; } }
    void d; return ids.map((id) => ({ icaoId: id, issueTime: new Date(best).toISOString(), validTimeFrom: (best + 2 * H) / 1000, validTimeTo: (best + 26 * H) / 1000, rawTAF: "TAF " + id + " " + best }));
  };
  const fetchFn = async (u) => {
    if (/aviationweather/.test(u)) { S.awc++; const rows = /metar/.test(u) ? metars() : tafs(); return { ok: true, status: 200, text: async () => (/bbox/.test(u) ? JSON.stringify(rows) : "[]") }; }
    S.om++; const n = new URL(u).searchParams.get("latitude").split(",").length, time = Array.from({ length: 20 }, (_, h) => new Date(Math.floor(S.now / H) * H + (h - 1) * H).toISOString().slice(0, 16));
    const one = { elevation: 1000, hourly_units: {}, hourly: Object.fromEntries([["time", time], ...["temperature_2m", "dew_point_2m", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "visibility", "pressure_msl", "cloud_cover", "cloud_cover_low", "cloud_base", "freezing_level_height"].map((k) => [k, time.map(() => 10)])]) };
    return { ok: true, status: 200, headers: new Map(), json: async () => Array.from({ length: n }, () => one), text: async () => "" };
  };
  return { S, fetchFn };
}

test("fetch windows: METAR and TAF minutes (SAST)", () => {
  assert.equal(metarFast(sast(9, 4)), true); assert.equal(metarFast(sast(9, 20)), true); assert.equal(metarFast(sast(9, 21)), false);
  assert.equal(metarFast(sast(9, 30)), true); assert.equal(metarFast(sast(9, 34)), true); assert.equal(metarFast(sast(9, 35)), false);
  assert.equal(windowDue("metar", sast(9, 25)), true); assert.equal(windowDue("metar", sast(9, 26)), false);
  for (const h of [5, 6, 8, 11, 12, 18, 0]) { assert.equal(tafFast(sast(h, 0)), true); assert.equal(tafFast(sast(h, 44)), true); assert.equal(tafFast(sast(h, 45)), false); }
  assert.equal(tafFast(sast(9, 10)), false); assert.equal(windowDue("taf", sast(9, 10)), true); assert.equal(windowDue("taf", sast(9, 11)), false);
  let m = 0, t = 0; for (let i = 0; i < 1440; i++) { const x = sast(0, 0) + i * MIN; if (windowDue("metar", x)) m++; if (windowDue("taf", x)) t++; }
  assert.equal(m, 24 * (17 + 5 + 7)); assert.equal(t, 7 * 45 + 17 * 6 + 7 * 1);   // 696 METAR minutes, 424 TAF minutes a day
});

test("previous TAF kept until the early one starts; rows unchanged", () => {
  const now = sast(10, 30), old = { icaoId: "FAOR", issueTime: "2026-11-15T04:00:00Z", validTimeFrom: (now - 4 * H) / 1000, validTimeTo: (now + 2 * H) / 1000, rawTAF: "old" };
  const early = { icaoId: "FAOR", issueTime: "2026-11-15T08:20:00Z", validTimeFrom: (now + 30 * MIN) / 1000, validTimeTo: (now + 24 * H) / 1000, rawTAF: "new" };
  assert.deepEqual(keepPrevTaf([early], { rows: [old] }, now), [old]);
  assert.deepEqual(keepPrevTaf([early], { rows: [old] }, now + 31 * MIN), [], "the new one has started");
  assert.deepEqual(keepPrevTaf([early], { rows: [{ ...old, validTimeTo: (now - 1) / 1000 }] }, now), [], "the old one has ended");
  assert.equal(rowsSig("taf", [early]), rowsSig("taf", [{ ...early }])); assert.notEqual(rowsSig("taf", [early]), rowsSig("taf", [old]));
});

test("one simulated day: writes only on a change + every 10 min, under 1,000; API shape unchanged", async () => {
  const W = kv(), { S, fetchFn } = world(), env = { WX: W, OPEN_METEO_KEY: "" };
  const start = Date.UTC(2026, 10, 15, 0, 0); /* one UTC day = one KV write day */ let runs = 0, minuteWrites = 0, beatWrites = 0, skippedSame = 0, lastNow = null;
  const log = console.log; console.log = () => {};
  try {
    for (let i = 0; i < 1440; i++) {
      S.now = start + i * MIN;
      const r = await runTick(env, { now: () => S.now, tickOpts: { fetchFn } });
      if (r.ran === false) continue; runs++;
      if (S.now % (10 * MIN) === 0) beatWrites += r.writes; else { minuteWrites += r.writes; if (!r.writes) skippedSame++; }
      const g = W.m.get(KV_KEYS.now); if (g) { const n = JSON.parse(g.v); if (lastNow) assert.ok(Date.parse(n.composedAt) >= Date.parse(lastNow)); lastNow = n.composedAt;
        assert.ok(S.now - Date.parse(n.composedAt) < 15 * MIN, "wx-now never older than the 15 min the live pages accept"); }
    }
  } finally { console.log = log; }
  const meta = W.m.get(KV_KEYS.snapshot).meta, total = W.puts;
  console.log(`simulated day: ${runs} runs with a fetch, KV writes ${total} (10-min ticks ${beatWrites}, change minutes ${minuteWrites}), ${skippedSame} fetch minutes with no change and no write, AWC requests ${S.awc}`);
  assert.ok(total < 1000 && total <= WRITE_CAP, String(total));
  assert.equal(beatWrites, 144 * 3);
  assert.ok(minuteWrites > 0 && skippedSame > 300);
  assert.equal(meta.wn, total);
  // shape the live pages read
  const snap = JSON.parse(W.m.get(KV_KEYS.snapshot).v);
  assert.ok(Array.isArray(snap.metar.rows) && Array.isArray(snap.taf.rows) && snap.model && snap.composedAt);
  assert.deepEqual(Object.keys(meta.off).sort(), ["metar", "model", "state", "taf"].sort());
  assert.equal(W.m.get(KV_KEYS.snapshot).v.slice(meta.off.taf[0], meta.off.taf[1]), JSON.stringify(snap.taf.rows));
  const now = JSON.parse(W.m.get(KV_KEYS.now).v);
  assert.ok(now.v === 1 && Array.isArray(now.pts) && Array.isArray(now.metar) && Array.isArray(now.taf));
});

test("a METAR change at :06 is in KV the same minute (was up to 10 min)", async () => {
  const W = kv(), { S, fetchFn } = world(), env = { WX: W, OPEN_METEO_KEY: "" };
  const log = console.log; console.log = () => {};
  try {
    for (let m = 0; m <= 6; m++) { S.now = sast(9, 0) + m * MIN; await runTick(env, { now: () => S.now, tickOpts: { fetchFn } }); }
  } finally { console.log = log; }
  const rows = JSON.parse(W.m.get(KV_KEYS.snapshot).v).metar.rows;
  assert.equal(rows.find((r) => r.icaoId === "FACT").obsTime * 1000, sast(9, 0), "FACT 09:00 report, received 09:06, served at 09:06");
});

test("first run after the deploy: the old Worker's writes today are counted (3 per 10 min since 00:00 UTC)", async () => {
  const W = kv(), { S, fetchFn } = world(), env = { WX: W, OPEN_METEO_KEY: "" };
  S.now = Date.UTC(2026, 10, 15, 13, 15);   // 15:15 SAST, a METAR minute
  await W.put(KV_KEYS.snapshot, "{}", { metadata: { composedAt: "2026-11-15T13:20:00Z" } });   // old Worker: no wd / wn / sig
  const log = console.log; console.log = () => {};
  try { await runTick(env, { now: () => S.now, tickOpts: { fetchFn } }); } finally { console.log = log; }
  const meta = W.m.get(KV_KEYS.snapshot).meta;
  assert.equal(meta.wd, "2026-11-15"); assert.equal(meta.wn, 80 * 3 + 2);
});

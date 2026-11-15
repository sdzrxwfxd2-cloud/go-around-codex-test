// awc_coverage: the Worker asks AWC for every ICAO the site lists (bbox + ids= chunks), keeps the union, survives one chunk
// failing, and stays inside the free-plan subrequest limit. Pilot-safety P0-1, 13 Nov 2026 (the bbox query left out the
// METARs of FALA / FAWB / FAWK and the TAFs of FALA / FAPM / FARB / FAWB).
// AWC_LIVE=1 also asks aviationweather.gov now and checks the union covers every station AWC has for the site.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(
  'export async function resolve(s, c, n) { return s === "@netlify/blobs" ? { url: "data:text/javascript,export const getStore=()=>null", shortCircuit: true } : n(s, c); }'));
const { AWC_IDS, AWC_ID_CHUNK, awcUrls, mergeAwc, parseAwc } = await import("../../netlify/lib/wx_awc.mjs");
const { fetchAwc } = await import("../../netlify/lib/wx_snapshot.mjs");

const NOW = Date.UTC(2026, 10, 13, 14) / 1e3;
const met = (id, minAgo, raw = "") => ({ icaoId: id, obsTime: NOW - minAgo * 60, reportTime: new Date((NOW - minAgo * 60) * 1e3).toISOString(), rawOb: raw || `METAR ${id} 131400Z 34008KT CAVOK 20/05 Q1020` });
const taf = (id, issue, raw) => ({ icaoId: id, issueTime: issue, rawTAF: raw || `TAF ${id} 131100Z 1312/1418 CAVOK` });

test("the site's aerodromes that AWC missed in the bbox on 13 Nov are asked for by id", () => {
  for (const id of ["FALA", "FAWB", "FAWK", "FAPM", "FARB", "FAOR", "FACT"]) assert.ok(AWC_IDS.includes(id), id);
  for (const kind of ["metar", "taf"]) {
    const u = awcUrls(kind), asked = u.slice(1).flatMap((x) => new URL(x).searchParams.get("ids").split(","));
    assert.match(u[0], /bbox=-35\.5,16,-22,33\.5/);
    assert.deepEqual(asked.sort(), AWC_IDS, kind + ": every id asked exactly once");
    assert.ok(u.slice(1).every((x) => new URL(x).searchParams.get("ids").split(",").length <= AWC_ID_CHUNK));
    if (kind === "metar") assert.ok(u.every((x) => /hours=3/.test(x)), "METAR: last 3 h only");
  }
});

test("mergeAwc: union of bbox and id replies; METAR newest per station; TAF newest issue per station", () => {
  const m = mergeAwc("metar", [[met("FAOR", 20)], [met("FALA", 25), met("FAOR", 50)], []], NOW);
  assert.deepEqual(m.map((r) => r.icaoId).sort(), ["FALA", "FAOR"]);
  assert.equal(m.find((r) => r.icaoId === "FAOR").obsTime, NOW - 1200);
  const t = mergeAwc("taf", [[taf("FALA", "2026-11-13T05:00:00Z")], [taf("FALA", "2026-11-13T11:00:00Z"), taf("FAPM", "2026-11-13T11:00:00Z")]]);
  assert.deepEqual(t.map((r) => r.icaoId).sort(), ["FALA", "FAPM"]);
  assert.equal(t.find((r) => r.icaoId === "FALA").issueTime, "2026-11-13T11:00:00Z");
  assert.deepEqual(parseAwc(""), []);
  assert.throws(() => parseAwc("<html>502</html>"));
});

test("fetchAwc: a chunk that fails twice is reported as partial, the rest still lands; a 502 once is retried", async () => {
  const urls = awcUrls("taf"), calls = {};
  const rows = { 0: [taf("FAOR", "2026-11-13T11:00:00Z")], 1: [taf("FALA", "2026-11-13T11:00:00Z")], 2: [taf("FAPM", "2026-11-13T11:00:00Z")] };
  const fetchFn = async (u) => {
    const i = urls.indexOf(u); calls[i] = (calls[i] || 0) + 1;
    if (i === 1 && calls[i] === 1) return new Response("bad gateway", { status: 502 });     // once: retried
    if (i === 3) return new Response("bad gateway", { status: 502 });                         // always: partial
    return new Response(JSON.stringify(rows[i] || []), { status: 200 });
  };
  const r = await fetchAwc("taf", { fetchFn, urls });
  assert.equal(r.ok, true);
  assert.equal(r.partial, 1);
  assert.deepEqual(r.rows.map((x) => x.icaoId).sort(), ["FALA", "FAOR", "FAPM"]);
  assert.equal(calls[1], 2); assert.equal(calls[3], 2);
  assert.ok(Object.values(calls).every((n) => n <= 2), "at most one retry per URL");
});

test("free-plan budget: worst case AWC + Open-Meteo subrequests per tick stay well under 50", () => {
  const awcWorst = 2 * (awcUrls("metar").length + awcUrls("taf").length);   // every URL retried once
  assert.ok(awcWorst + 3 <= 40, "AWC " + awcWorst + " + Open-Meteo 3");
});

test("live AWC (AWC_LIVE=1): the union covers every station AWC reports for the site; FALA / FAWB have METAR and TAF", { skip: !process.env.AWC_LIVE }, async () => {
  const m = await fetchAwc("metar"), t = await fetchAwc("taf");
  assert.ok(m.ok && t.ok, "AWC answered");
  const mi = new Set(m.rows.map((r) => r.icaoId)), ti = new Set(t.rows.map((r) => r.icaoId));
  for (const id of ["FALA", "FAWB", "FAOR"]) { assert.ok(mi.has(id), id + " METAR"); assert.ok(ti.has(id), id + " TAF"); }
  for (const id of ["FAPM", "FARB"]) assert.ok(ti.has(id), id + " TAF");
  assert.ok(mi.has("FAWK"), "FAWK METAR");
});

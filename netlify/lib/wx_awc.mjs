// AWC station coverage (pilot-safety P0-1, 13 Nov 2026). The aviationweather.gov bbox query does not return every
// station inside the box: on 13 Nov it left out the METARs of FALA, FAWB and FAWK and the TAFs of FALA, FAPM, FARB and
// FAWB, which AWC serves when asked by station id. So each METAR / TAF fetch asks for the bbox AND for every ICAO the
// site lists (model_points.json + wx_core.json), in chunks of AWC_ID_CHUNK ids, and keeps the union:
//   METAR: newest report per station (latestPerStation),  TAF: newest issue per station.
// Pure helpers; the fetch itself stays in wx_snapshot.mjs (Worker tick) and cloudflare/lib/wx_route.mjs (live fallback).
import POINTS_JSON from "./model_points.json" with { type: "json" };
import CORE_JSON from "./wx_core.json" with { type: "json" };
import { latestPerStation } from "./wx_latest.mjs";

export const AWC_BBOX = "-35.5,16,-22,33.5";
export const AWC_ID_CHUNK = 100;
export const AWC_IDS = [...new Set(POINTS_JSON.concat(CORE_JSON).map((p) => p[0]).filter((k) => /^[A-Z]{4}$/.test(k)))].sort();
const BASE = { metar: "https://aviationweather.gov/api/data/metar?format=json&hours=3", taf: "https://aviationweather.gov/api/data/taf?format=json" };

/** Every URL one METAR or TAF fetch asks: the bbox first, then the id chunks. */
export function awcUrls(kind, ids = AWC_IDS, chunk = AWC_ID_CHUNK) {
  const out = [BASE[kind] + "&bbox=" + AWC_BBOX];
  for (let i = 0; i < ids.length; i += chunk) out.push(BASE[kind] + "&ids=" + ids.slice(i, i + chunk).join(","));
  return out;
}
const issueMs = (r) => { const t = Date.parse(r && r.issueTime); if (Number.isFinite(t)) return t; const b = Date.parse(r && r.bulletinTime); return Number.isFinite(b) ? b : 0; };
/** Union of the replies. METAR: latestPerStation (newest per station, SPECI/COR/NIL handled). TAF: newest issue per station. */
export function mergeAwc(kind, lists, now = Date.now() / 1000) {
  const rows = [].concat(...lists.filter(Array.isArray));
  if (kind === "metar") return latestPerStation(rows, now);
  const best = new Map();
  for (const r of rows) {
    const id = String((r && r.icaoId) || "").trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(id) || !r.rawTAF) continue;
    const p = best.get(id); if (!p || issueMs(r) > issueMs(p) || (issueMs(r) === issueMs(p) && String(r.rawTAF).length > String(p.rawTAF).length)) best.set(id, r);
  }
  return [...best.values()];
}
/** Parse one AWC reply body: JSON array, or [] for an empty body (no station reporting in that chunk). */
export function parseAwc(text) {
  if (text == null || !String(text).trim()) return [];
  const j = JSON.parse(text); if (!Array.isArray(j)) throw new Error("not an array"); return j;
}

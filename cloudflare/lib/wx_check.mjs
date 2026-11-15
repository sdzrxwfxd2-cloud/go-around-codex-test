// Weather check (11 Nov 2026, MT t2584u/t2585u; v2 for every aerodrome card): read-only helpers for GET /api/admin/wx-check and
// /admin-weather-check. The check fetches the SAME sources the site's weather Worker uses (aviationweather.gov METAR/TAF bbox,
// Open-Meteo forecast with the same variables and units) plus what the live site serves (/api/wx-now, /api/metar, /api/taf,
// /main.html and its engine files). Nothing here writes KV, D1 or anything else. No keys: Open-Meteo free host only.
//
// Which aerodromes: every card the live main.html renders (640 on 11 Nov 2026), parsed from the page itself. The model copy
// (/api/wx-now) has 642 points = netlify/lib/model_points.json (640) + the 65 AIP points of wx_core.json not already in it.
// The first version of this page used wx_core.json (the 65 AIP aerodromes of site/wst/wst-data.js) - that was the mistake.
import CORE from "../../netlify/lib/wx_core.json" with { type: "json" };          // [[ident, lat, lon]] the 65 AIP aerodromes
import MODEL_POINTS from "../../netlify/lib/model_points.json" with { type: "json" }; // [[ident, lat, lon]] 640 model points

export const LIVE = "https://go-around-aero.pages.dev";
// same URLs as netlify/lib/wx_snapshot.mjs AWC (test checks they stay equal)
export const AWC = {
  metar: "https://aviationweather.gov/api/data/metar?bbox=-35.5,16,-22,33.5&format=json&hours=3",
  taf: "https://aviationweather.gov/api/data/taf?bbox=-35.5,16,-22,33.5&format=json"
};
// same list as wx_snapshot.mjs VARS (test checks)
export const VARS = ["temperature_2m", "dew_point_2m", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "visibility",
  "pressure_msl", "cloud_cover", "cloud_cover_low", "cloud_base", "freezing_level_height"];
export const POINTS = CORE;   // the 65 AIP aerodromes (full AIP data in wst-data.js)
// same composition as wx_snapshot.mjs ALL_POINTS: model_points.json, then the AIP points it does not already have (test checks)
export const ALL_POINTS = (() => { const seen = new Set(MODEL_POINTS.map((p) => p[0])); return MODEL_POINTS.concat(CORE.filter((p) => !seen.has(p[0]))); })();
const BY_ID = new Map(ALL_POINTS.map((p) => [p[0], p]));
// engine files the aerodrome cards run (main.html), plus display code; run = the page executes the live copy too
export const ENGINE_FILES = [
  { path: "/wst/wst-engine.js", name: "wst-engine.js", run: true },
  { path: "/wm-core.js", name: "wm-core.js", run: true },
  { path: "/wst/wm-bridge.js", name: "wm-bridge.js", run: true },
  { path: "/engine/ga-core-v2.js", name: "ga-core-v2.js", run: true },
  { path: "/engine/ga-core-v2-wire.js", name: "ga-core-v2-wire.js", run: true },
  { path: "/wst/wst-card.js", name: "wst-card.js", run: false },
  { path: "/wm-model.js", name: "wm-model.js", run: false }
];
// Rate limits (server side, per isolate). The page's own settings can only make them slower, never faster.
export const COOLDOWN_MS = 60e3;            // default gap between full runs
export const MIN_COOLDOWN_MS = 30e3;        // floor for ?cool=
export const MAX_COOLDOWN_MS = 600e3;
export const OM_MAX_IDS = 100;              // Open-Meteo points per batch request
export const OM_MIN_GAP_MS = 4e3;           // at least 4 s between two upstream Open-Meteo requests
export const OM_CACHE_MS = 30 * 60e3;       // a batch answer is reused for 30 min (model is hourly)
export const OM_PAUSE_MS = 15 * 60e3;       // after an Open-Meteo 429: no upstream model calls for 15 min
export const clampCool = (s) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, Math.round(n) * 1000)) : COOLDOWN_MS; };

// Open-Meteo: same host (free), variables, units and time zone as the Worker; 4 hours from the previous hour is enough for "now",
// plus daily sunrise/sunset as an outside reference for the day/night check.
export function omUrl(points = POINTS) {
  return "https://api.open-meteo.com/v1/forecast?latitude=" + points.map((p) => p[1]).join(",") + "&longitude=" + points.map((p) => p[2]).join(",") +
    "&hourly=" + VARS.join(",") + "&daily=sunrise,sunset&wind_speed_unit=kn&timezone=UTC&forecast_hours=4&past_hours=1&forecast_days=2";
}
/** ?ids=A,B,C -> known model points only (max OM_MAX_IDS, no duplicates, order kept). Unknown ids are returned separately. */
export function omPoints(idsParam) {
  const want = String(idsParam || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const seen = new Set(), pts = [], unknown = [];
  for (const id of want) { if (seen.has(id)) continue; seen.add(id); const p = BY_ID.get(id); if (p) pts.push(p); else unknown.push(id); if (pts.length >= OM_MAX_IDS) break; }
  return { pts, unknown };
}

// only the production site or one of its preview aliases may be the "live" target
export function targetOf(q) {
  if (!q) return LIVE;
  try { const u = new URL(q); if (u.protocol === "https:" && /^([a-z0-9-]+\.)?go-around-aero\.pages\.dev$/.test(u.hostname)) return u.origin; } catch {}
  return LIVE;
}

// newest row per station (METAR obsTime s; TAF issueTime ISO)
export function latest(kind, rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r && String(r.icaoId || "").toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(id)) continue;
    const t = kind === "metar" ? (Number(r.obsTime) || 0) * 1000 : Date.parse(r.issueTime || r.bulletinTime || "") || 0;
    const p = m.get(id); if (!p || t > p._t || (t === p._t && /\bCOR\b/.test(r.rawOb || r.rawTAF || ""))) m.set(id, { ...r, _t: t });
  }
  return [...m.values()].map(({ _t, ...r }) => r);
}

// keep only the fields the check needs (the bbox feeds carry ~40 fields per row)
const MK = ["icaoId", "obsTime", "reportTime", "receiptTime", "temp", "dewp", "wdir", "wspd", "wgst", "visib", "altim", "clouds", "rawOb", "metarType", "lat", "lon", "elev"];
const TK = ["icaoId", "issueTime", "bulletinTime", "validTimeFrom", "validTimeTo", "rawTAF"];
const pick = (r, ks) => { const o = {}; for (const k of ks) if (r[k] !== undefined) o[k] = r[k]; return o; };
export const slimMetar = (rows) => latest("metar", rows).map((r) => pick(r, MK));
export const slimTaf = (rows) => latest("taf", rows).map((r) => pick(r, TK));

/** /api/wx-now as the phones get it (all 642 points, the shape wm-model.js stores as 'wm.now.v1'), METAR/TAF rows slimmed. */
export function nowAll(n) {
  if (!n || !Array.isArray(n.pts)) return null;
  const { metar, taf, ...rest } = n;
  return { ...rest, metar: slimMetar(metar), taf: slimTaf(taf) };
}

/** Resolve virtualized card HTML from wst-cards-data.js, raw main.html, or both concatenated. */
function cardHtmlSource(raw) {
  const mark = "window.WM_CARD_HTML=";
  const at = raw.indexOf(mark);
  if (at < 0) return raw;
  const rest = raw.slice(at + mark.length).trim();
  if (rest[0] !== "[") return raw;
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (inStr) { if (esc) { esc = false; continue; } if (ch === "\\") { esc = true; continue; } if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try { const arr = JSON.parse(rest.slice(0, i + 1)); if (Array.isArray(arr) && arr.length) return arr.join(""); }
        catch (e) {}
        break;
      }
    }
  }
  return raw;
}

/** Every aerodrome card on main.html (or wst-cards-data.js after list virtualization) -> [ident, name, province, cat, lat, lon, [runway headings from the diagram], static data-s]. */
export function parseCards(html) {
  const out = [], raw = String(html || "");
  let s = cardHtmlSource(raw);
  const re = /<article class="card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(s))) {
    const attrs = m[1], body = m[2];
    const ic = (body.match(/<span class="icao">([^<]+)<\/span>/) || [])[1]; if (!ic) continue;
    const prov = (body.match(/<span class="icao">[^<]+<\/span><span>·<\/span><span>([^<]*)<\/span>/) || [])[1] || "";
    const nm = (body.match(/<h2>([^<]*)<\/h2>/) || [])[1] || "";
    const cat = (attrs.match(/data-cat="([^"]*)"/) || [])[1] || "";
    const st = (attrs.match(/data-s="([^"]*)"/) || [])[1] || "";
    const la = Number((body.match(/data-la="([^"]+)"/) || [])[1]), lo = Number((body.match(/data-lo="([^"]+)"/) || [])[1]);
    const rw = [];
    for (const l of body.matchAll(/<line class="r" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)) {
      const dx = l[3] - l[1], dy = l[4] - l[2]; rw.push(Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360));
    }
    out.push([ic.trim(), decode(nm), decode(prov), cat, Number.isFinite(la) ? la : null, Number.isFinite(lo) ? lo : null, rw, st]);
  }
  return out;
}
/** wst/ad-class.js -> {ident: "heliport"|"helistop"} (rotary-only sites: the card shows HELIPORT/HELIPAD, no engine verdict). */
export function parseAdClass(js) {
  const m = String(js || "").match(/window\.AD_CLASS\s*=\s*(\{[^}]*\})/);
  if (!m) return {};
  try { const o = JSON.parse(m[1]), out = {}; for (const [k, v] of Object.entries(o)) if (typeof v === "string") out[k] = v; return out; } catch { return {}; }
}
const decode = (t) => t.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// <script src> / <link href> with ?v= on a page -> [{path, v}]
export function assetTags(html, base = "/") {
  const out = [], seen = new Set();
  for (const m of String(html || "").matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?v=([^"&#]+))?[^"]*"/g)) {
    let p = m[1]; if (/^https?:/.test(p)) continue;
    if (!p.startsWith("/")) p = new URL(p, "https://x" + base).pathname;
    if (seen.has(p)) continue; seen.add(p); out.push({ path: p, v: m[2] || null });
  }
  return out;
}

export async function sha256hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

#!/usr/bin/env node
/**
 * Feed real worldwide METARs and TAFs through the FIXED engine, read-only.
 * Does not modify site/engine/*.
 *
 * Usage:
 *   node run-engine.mjs
 *   node run-engine.mjs --limit=500 --station=EGLL
 *   ENGINE_ROOT=/workspace/wt-engine-fix-16nov node run-engine.mjs
 *
 * Writes RESULTS.md and results.json in this folder.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = process.env.ENGINE_ROOT
  || (existsSync(join(HERE, "../../site/engine/ga-core-v2.js")) ? join(HERE, "../..") : "/workspace/wt-engine-fix-16nov");
const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const ENGINE_PATH = args.engine ? String(args.engine) : join(ENGINE_ROOT, "site/engine/ga-core-v2.js");
const E = require(ENGINE_PATH);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const ONLY = args.station ? String(args.station).toUpperCase() : null;
const NO_WRITE = !!args["no-write"];
const META_ONLY = !!args["metar-only"];
const FCST_ONLY = !!args["forecast-only"];

const PROFILE = { licence: "ppl" };
const PROFILE_MIN = { visKm: 8, ceilFt: 2500 }; // PPL preset
const AIRCRAFT = "C172";
const RULES = "vfr";
const FRESH_MS = 5 * 60 * 1000;
const OK_STATUS = new Set(["go", "caution", "nogo", "incomplete", "none"]);
const TAF_LOOKAHEAD_MS = 2 * 3600e3; // RULES.policy.tafLookaheadH
const METAR_USABLE_MS = 90 * 60e3;
const EXAMPLE_CAP = 80;

function loadRunways() {
  const dir = join(ENGINE_ROOT, "site/wst");
  const map = {};
  if (!existsSync(dir)) return map;
  const name = readdirSync(dir).find((f) => /^ad-rwy-db\..*\.json$/.test(f));
  if (!name) return map;
  const db = JSON.parse(readFileSync(join(dir, name), "utf8"));
  const s = db.s || "";
  for (const part of s.split(";")) {
    if (!part) continue;
    const [id, rest] = part.split("=");
    if (!id || !rest) continue;
    const [elev, rwy] = rest.split("|");
    const runways = [];
    if (rwy) {
      for (const g of rwy.split(",")) {
        const [pair, hdg] = g.split(":");
        if (!pair) continue;
        const [a, b] = pair.split("/");
        const h = hdg != null && hdg !== "" ? Number(hdg) : null;
        if (a) runways.push({ id: a, true: h });
        if (b && h != null && isFinite(h)) runways.push({ id: b, true: (h + 180) % 360 });
        else if (b) runways.push({ id: b, true: null });
      }
    }
    map[id] = { elevFt: elev != null && elev !== "" ? Number(elev) : null, runways };
  }
  return map;
}

function loadStationMeta() {
  const map = {};
  const p = join(HERE, "sources/station-lists.json");
  if (!existsSync(p)) return map;
  const obj = JSON.parse(readFileSync(p, "utf8"));
  for (const [icao, row] of Object.entries(obj.stations || {})) {
    map[icao] = {
      lat: row.lat ?? null,
      lon: row.lon ?? null,
      elevFt: row.elev_ft ?? (row.elev_m != null ? Math.round(row.elev_m * 3.28084) : null),
      name: row.name || null,
      country: row.country || null,
    };
  }
  return map;
}

function fieldOf(icao, rwyMap, metaMap) {
  const r = rwyMap[icao] || {};
  const m = metaMap[icao] || {};
  const runways = r.runways || [];
  const elevFt = r.elevFt != null ? r.elevFt : m.elevFt;
  return {
    icao,
    ic: icao,
    lat: m.lat ?? null,
    la: m.lat ?? null,
    lon: m.lon ?? null,
    lo: m.lon ?? null,
    elevFt: elevFt ?? null,
    el: elevFt ?? null,
    runways,
    rw: runways.map((x) => x.id),
    hasRunways: runways.length > 0 && runways.some((x) => x.true != null),
    hasLatLon: m.lat != null && m.lon != null,
    hasElev: elevFt != null,
  };
}

function readGzLines(path) {
  if (!existsSync(path)) return [];
  const buf = path.endsWith(".gz") ? gunzipSync(readFileSync(path)) : readFileSync(path);
  const text = buf.toString("utf8");
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [time, kind, raw, sources] = line.split("\t");
    if (!raw) continue;
    out.push({ time: time || null, kind: kind || "", raw, sources: sources || "" });
  }
  return out;
}

function isoMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function tafIssueMs(rec, around) {
  const t = isoMs(rec.time);
  if (t != null) return t;
  const m = rec.raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!m || around == null) return null;
  const day = +m[1], hh = +m[2], mm = +m[3];
  const d = new Date(around);
  d.setUTCDate(day);
  d.setUTCHours(hh, mm, 0, 0);
  if (d.getTime() - around > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
  if (around - d.getTime() > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

function tafValidWindow(raw, issueMs) {
  const m = raw.match(/\b(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\b/);
  const short = m || raw.match(/\b\d{6}Z\s+(\d{2})(\d{2})\/(\d{2})(\d{2})\b/);
  if (!short || issueMs == null) {
    return { from: issueMs, to: issueMs != null ? issueMs + 30 * 3600e3 : null };
  }
  const fromDay = m ? +m[1] : +short[1];
  const fromHour = m ? +m[2] : +short[2];
  const fromMin = m ? +m[3] : 0;
  const toDay = m ? +m[4] : +short[3];
  const toHour = m ? +m[5] : +short[4];
  const toMin = m ? +m[6] : 0;
  const from = new Date(issueMs);
  from.setUTCDate(fromDay);
  from.setUTCHours(fromHour, fromMin, 0, 0);
  if (from.getTime() < issueMs - 12 * 3600e3) from.setUTCMonth(from.getUTCMonth() + 1);
  if (from.getTime() - issueMs > 20 * 86400e3) from.setUTCMonth(from.getUTCMonth() - 1);
  const to = new Date(from.getTime());
  to.setUTCDate(toDay);
  to.setUTCHours(toHour, toMin, 0, 0);
  if (to.getTime() < from.getTime()) to.setUTCMonth(to.getUTCMonth() + 1);
  return { from: from.getTime(), to: to.getTime() };
}

function metarInForce(metars, nowMs) {
  // metars sorted by time ascending; latest at or before now
  let lo = 0, hi = metars.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = isoMs(metars[mid].time);
    if (t == null || t > nowMs) hi = mid - 1;
    else { best = metars[mid]; lo = mid + 1; }
  }
  return best;
}

function looksLikeWind(raw) {
  return /\b(?:VRB|\d{3}|\/\/\/)(\d{2}|\/\/)(?:G\d{2})?KT\b/.test(raw) || /\b\/\/\/{0,2}\/\/KT\b/.test(raw);
}
function visZone(raw) {
  const body = metarBodyOf(raw);
  const cut = body.search(/\sM?\d{2}\/(?:M?\d{2})?(?:\s|$)/);
  return (cut >= 0 ? body.slice(0, cut) : body).replace(/\bR\d{2}[LCR]?\/[PM]?\d{4}[A-Z]*\b/g, " ").replace(/\b[QA]\d{4}\b/g, " ");
}
function looksLikeVisOrCavok(raw) {
  const z = visZone(raw);
  if (/\bCAVOK\b/.test(z) || /\bP?\d{1,2}(?:\s+\d\/\d)?SM\b/.test(z) || /\b\d{1,2}(?:SM|KM)\b/.test(z) || /\bP\d(?:SM)?\b/.test(z)) return true;
  if (/\b(?:M?\d+\/\d+|\d+\s+\d+\/\d+)SM\b/.test(z)) return true;
  return /(?:^|\s)\d{4}(?:[A-Z]{1,3})?(?:-|\+|$|\s|[A-Z]{2})/.test(z);
}
function isNil(raw) {
  return /(?:^|\s)NIL(?:\s|=|$)/.test(raw);
}
function metarBodyOf(raw) {
  return String(raw || "").split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0];
}
function isCavok(raw) {
  return /\bCAVOK\b/.test(metarBodyOf(raw));
}
function visMeters(raw) {
  const z = visZone(raw);
  if (/\bCAVOK\b/.test(z)) return 10000;
  let low = null;
  for (const t of z.split(/\s+/)) {
    const m = /^(\d{4})(?:[A-Z]{0,3}|[+-]?[A-Z]{2,})$/.exec(t);
    if (m && /^\d{4}(?:Z|KT|MPS|FT)$/.test(t)) continue;
    if (m) { const v = m[1] === "9999" ? 10000 : Number(m[1]); if (low == null || v < low) low = v; }
  }
  if (low != null) return low;
  // statute miles (US)
  const sm = parseSmMeters(z);
  return sm;
}
function parseSmMeters(text) {
  // P6SM / 10SM / 3SM / 1/2SM / 2 1/2SM / M1/4SM
  const re = /(?:^|\s)(P|M)?(\d+)?(?:\s+)?(?:(\d+)\/(\d+))?(SM)\b/g;
  let low = null, x;
  const s = " " + text + " ";
  while ((x = re.exec(s))) {
    if (!x[5]) continue;
    if (!x[2] && !x[3]) continue;
    if (x[1] === "P") { const v = 10000; if (low == null || v < low) low = v; continue; }
    let sm = 0;
    if (x[2]) sm += Number(x[2]);
    if (x[3] && x[4]) sm += Number(x[3]) / Number(x[4]);
    if (!sm && x[1] === "M") sm = 0.2;
    const v = Math.round(sm * 1609.344);
    if (low == null || v < low) low = v;
  }
  return low;
}
function lowCeilingFt(raw) {
  let low = null;
  const re = /\b(BKN|OVC|VV)(\d{3})\b/g;
  let x;
  const body = metarBodyOf(raw);
  while ((x = re.exec(body))) {
    const ft = Number(x[2]) * 100;
    if (low == null || ft < low) low = ft;
  }
  return low;
}
function windKt(raw) {
  const m = raw.match(/\b(?:VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  if (!m) return null;
  const ws = Number(m[1]);
  const g = m[2] != null ? Number(m[2]) : ws;
  return { ws, g };
}

function parseFailReason(rec, parsed) {
  if (isNil(rec.raw)) return null;
  if (!parsed) return "parseOfficial returned null";
  if (parsed.parseUnknown) return null;
  const raw = rec.raw;
  if (looksLikeWind(raw) && !/\/\/\/{0,2}\/\//.test(raw) && !/\b\/\/KT\b/.test(raw) && parsed.ws == null && !parsed.vrb) {
    if (/\b(?:VRB|\d{3})\d{2,3}(?:G\d{2,3})?KT\b/.test(raw) && parsed.ws == null)
      return "wind group present but ws is null";
  }
  if (looksLikeVisOrCavok(raw) && parsed.vis == null && !parsed.cavok)
    return "visibility/CAVOK present but vis/cavok not set";
  return null;
}

function classifyParseFail(reason, raw) {
  if (/0400W|visibility\/CAVOK/.test(reason) && /\b\d{4}(?:N|NE|E|SE|S|SW|W|NW|NDV)\b/.test(raw))
    return "directional visibility";
  if (/\d{4}-[A-Z]/.test(raw)) return "glued weather after vis (missing space)";
  if (/\bMETAR COR\b|\bSPECI COR\b|^METAR COR |\bCOR [A-Z]{4}\b/.test(raw)) return "COR correction prefix";
  if (/\b\d{1,2}SM\b|\bP6SM\b|\b\d+\/\d+SM\b/.test(raw) && /vis\/cavok/i.test(reason))
    return "statute-mile visibility";
  if (/ws is null/.test(reason)) return "wind group not read";
  if (/returned null/.test(reason)) return "parseOfficial returned null";
  if (/threw/.test(reason)) return "parseOfficial threw";
  return "other";
}

function whyIsWorstCaseXw(why) {
  return /worst-case crosswind/i.test(String(why || ""));
}

function oddReasons(rec, result, parsed, field, opts) {
  const odds = [];
  if (!result) return ["no result"];
  if (!OK_STATUS.has(result.status)) odds.push(`unexpected status ${result.status}`);
  const raw = rec.raw;
  if (isNil(raw)) return odds;
  const vis = visMeters(raw);
  const ceil = lowCeilingFt(raw);
  const wind = windKt(raw);
  const why = String(result.why || "");
  // NO-GO on CAVOK (not merely 9999, which can sit under a low ceiling) with modest wind.
  if (result.status === "nogo" && isCavok(raw) && wind && wind.g < 20) {
    const tc = /^TAF forecast: (?:FM|BECMG|BASE)?.*?ceiling (\d+) ft/.exec(why);
    const tv = /^TAF forecast: (?:FM|BECMG|BASE)?.*?vis ([\d.]+) km/.exec(why);
    const tafBelowOwn = (tc && Number(tc[1]) < PROFILE_MIN.ceilFt) || (tv && Number(tv[1]) < PROFILE_MIN.visKm);
    // No runway headings: worst-case crosswind is the engine's stated policy, not a surprise.
    const expectedXw = !field.hasRunways && whyIsWorstCaseXw(why);
    if (!tafBelowOwn && !expectedXw && !/night|density altitude|instrument|heliport|crosswind|tailwind|gust|trend|tempo|becmg/i.test(why))
      odds.push(`NO-GO on CAVOK with gust ${wind.g} kt (${why})`);
  }
  if (result.status === "go" && vis != null && vis < 5000)
    odds.push(`GO with visibility ${vis} m (below the 5 km VFR minimum)`);
  if (result.status === "go" && ceil != null && ceil <= 200)
    odds.push(`GO with ${ceil} ft ceiling`);
  if (result.status === "incomplete" && result.code === "parse") return odds;
  if (result.status === "incomplete" && parsed && (parsed.ws != null || parsed.cavok || parsed.vis != null) && !isNil(raw))
    odds.push(`incomplete despite a usable official report (${result.code || ""} ${result.why || ""})`);
  const used = result.weatherUsed;
  if (used) {
    for (const [k, v] of Object.entries(used)) {
      if (typeof v === "number" && !Number.isFinite(v)) odds.push(`weatherUsed.${k} is ${v}`);
    }
  }
  if (result.status === "nogo" && !result.why) odds.push("NO-GO with empty why");

  // Forecast timing: an FM/BECMG cited as starting after the 2 h look-ahead
  // (or clearly after 'now' with a start time more than 2 h away) is the bug class found in the SA run.
  if (opts && opts.now != null && /TAF forecast:\s*(?:PROB\d+\s+)?(?:FM|BECMG|BASE)/i.test(why)) {
    const early = forecastTimingIssue(why, opts.now, opts.phase);
    if (early) odds.push(early);
  }
  return odds;
}

function hzToMs(ddhh, now) {
  if (!/^\d{4}$/.test(ddhh)) return null;
  const day = +ddhh.slice(0, 2), hour = +ddhh.slice(2, 4);
  const d = new Date(now);
  d.setUTCDate(day);
  d.setUTCHours(hour, 0, 0, 0);
  if (d.getTime() - now > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
  if (now - d.getTime() > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

function forecastTimingIssue(why, now, phase) {
  // "TAF forecast: FM from 1620Z: ..." or "TAF forecast: BECMG from 1519Z:"
  const m = /TAF forecast:\s*(?:PROB\d+\s+)?(FM|BECMG|BASE|TEMPO)?\s*from\s+(\d{4})Z/i.exec(why);
  if (!m) return null;
  const typ = (m[1] || "FM").toUpperCase();
  const start = hzToMs(m[2], now);
  if (start == null) return null;
  const ahead = start - now;
  // TEMPO/PROB overlapping the window is expected even if the start is slightly in the future.
  if (typ === "TEMPO") return null;
  if (ahead > TAF_LOOKAHEAD_MS + 60e3) {
    return `${typ} start ${m[2]}Z is ${Math.round(ahead / 60000)} min after now, outside the 2 h look-ahead (${phase})`;
  }
  return null;
}

/** Collect FM / BECMG / TEMPO / PROB / validity boundaries from a TAF, as UTC ms. */
function tafBoundaries(raw, issueMs) {
  const out = [];
  const win = tafValidWindow(raw, issueMs);
  if (win.from != null) out.push({ t: win.from, typ: "VALID_FROM" });
  if (win.to != null) out.push({ t: win.to, typ: "VALID_TO" });
  const fm = raw.matchAll(/\bFM(\d{2})(\d{2})(\d{2})\b/g);
  for (const m of fm) {
    const d = new Date(issueMs);
    d.setUTCDate(+m[1]);
    d.setUTCHours(+m[2], +m[3], 0, 0);
    if (d.getTime() < issueMs - 12 * 3600e3) d.setUTCMonth(d.getUTCMonth() + 1);
    if (d.getTime() - issueMs > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
    out.push({ t: d.getTime(), typ: "FM" });
  }
  const ev = raw.matchAll(/\b(BECMG|TEMPO|PROB(?:30|40)(?:\s+TEMPO)?)\s+(\d{2})(\d{2})\/(\d{2})(\d{2})\b/g);
  for (const m of ev) {
    const typ = m[1].startsWith("PROB") ? "PROB" : m[1];
    const a = new Date(issueMs);
    a.setUTCDate(+m[2]); a.setUTCHours(+m[3], 0, 0, 0);
    if (a.getTime() < issueMs - 12 * 3600e3) a.setUTCMonth(a.getUTCMonth() + 1);
    if (a.getTime() - issueMs > 20 * 86400e3) a.setUTCMonth(a.getUTCMonth() - 1);
    const b = new Date(a.getTime());
    b.setUTCDate(+m[4]); b.setUTCHours(+m[5], 0, 0, 0);
    if (b.getTime() < a.getTime()) b.setUTCMonth(b.getUTCMonth() + 1);
    out.push({ t: a.getTime(), typ: typ + "_FROM" });
    out.push({ t: b.getTime(), typ: typ + "_TO" });
  }
  return out;
}

function evalTimesForTaf(raw, issueMs, validFrom, validTo, nextIssue) {
  const start = Math.max(issueMs, validFrom != null ? validFrom : issueMs);
  const end = Math.min(validTo != null ? validTo : issueMs + 30 * 3600e3, nextIssue != null ? nextIssue : Infinity);
  if (!(end > start)) return [];
  const times = new Map(); // ms -> tags
  const add = (t, tag) => {
    if (t == null || t < start || t >= end) return;
    const k = Math.round(t / 60000) * 60000; // 1-minute bucket to dedupe
    const cur = times.get(k);
    if (cur) cur.tags.push(tag);
    else times.set(k, { t: k, tags: [tag] });
  };
  add(start + 5 * 60e3, "just-after-issue");
  for (let t = start + 3600e3; t < end; t += 3600e3) add(t, "hourly");
  if (end - start > 40 * 60e3) add(end - 30 * 60e3, "near-valid-to");
  for (const b of tafBoundaries(raw, issueMs)) {
    add(b.t - 5 * 60e3, "5min-before-" + b.typ);
    add(b.t + 5 * 60e3, "5min-after-" + b.typ);
  }
  // month rollover: if validity crosses a month end, sample both sides
  const d0 = new Date(start), d1 = new Date(end - 1);
  if (d0.getUTCMonth() !== d1.getUTCMonth()) {
    const roll = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), 1, 0, 0, 0);
    add(roll - 5 * 60e3, "5min-before-month-roll");
    add(roll + 5 * 60e3, "5min-after-month-roll");
  }
  return [...times.values()].sort((a, b) => a.t - b.t);
}

/** Independent read of permanent-period vis/ceiling at a time (FM/BASE/BECMG only). Includes SM vis. */
function independentTafState(raw, when, issueMs) {
  // Very small helper for odd checks, not a second engine.
  const body = String(raw || "").toUpperCase().replace(/=/g, " ");
  const parts = body.split(/\s+(?=(?:FM\d{6}|BECMG\s+\d{4}\/\d{4}|TEMPO\s+\d{4}\/\d{4}|PROB(?:30|40)))/);
  let vis = null, ceil = null, sm = false;
  const apply = (text, overwrite) => {
    if (/\bCAVOK\b/.test(text)) { vis = 10000; ceil = null; return; }
    const m4 = text.match(/\b(\d{4})\b/);
    const meters = m4 && !/^\d{4}\/\d{4}$/.test(m4[0]) && m4[1] !== "9999" ? +m4[1] : (m4 && m4[1] === "9999" ? 10000 : null);
    const smV = parseSmMeters(text);
    const v = meters != null ? meters : smV;
    if (v != null) { vis = overwrite || vis == null ? v : Math.min(vis, v); if (smV != null && meters == null) sm = true; }
    let c = null;
    const re = /\b(BKN|OVC|VV)(\d{3})\b/g;
    let x;
    while ((x = re.exec(text))) { const ft = +x[2] * 100; c = c == null ? ft : Math.min(c, ft); }
    if (c != null) ceil = overwrite || ceil == null ? c : Math.min(ceil, c);
  };
  // Walk chunks in order, apply those in force
  // Simpler: use the same boundary list
  const fms = [...body.matchAll(/\bFM(\d{2})(\d{2})(\d{2})\b/g)].map((m) => {
    const d = new Date(issueMs);
    d.setUTCDate(+m[1]); d.setUTCHours(+m[2], +m[3], 0, 0);
    if (d.getTime() < issueMs - 12 * 3600e3) d.setUTCMonth(d.getUTCMonth() + 1);
    if (d.getTime() - issueMs > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
    return { t: d.getTime(), i: m.index };
  });
  // BASE is the first weather after the validity group, until first FM/BECMG
  apply(parts[0] || body, true);
  // Apply last FM that has started
  let lastFm = null;
  for (const f of fms) if (f.t <= when) lastFm = f;
  if (lastFm) {
    const slice = body.slice(lastFm.i);
    const stop = slice.search(/\s(?:FM\d{6}|BECMG\s|TEMPO\s|PROB(?:30|40))/);
    apply(stop > 0 ? slice.slice(0, stop) : slice, true);
  }
  return { vis, ceil, usedSm: sm };
}

function listIcaos() {
  const dir = join(HERE, "raw", "metar");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt.gz") || f.endsWith(".txt"))
    .map((f) => f.replace(/\.txt(\.gz)?$/, ""))
    .sort();
}

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function main() {
  const started = Date.now();
  const rwyMap = loadRunways();
  const metaMap = loadStationMeta();
  const stations = listIcaos().filter((id) => !ONLY || id === ONLY);

  const counts = {
    stations: 0,
    stations_with_runways: 0,
    stations_with_latlon: 0,
    stations_with_elev: 0,
    metars: 0,
    tafs: 0,
    tafs_attached: 0,
    metar_evaluations: 0,
    forecast_evaluations: 0,
    forecast_time_points: 0,
    tafs_scanned: 0,
    byStatus: { metar_depart: {}, metar_land: {}, forecast_depart: {}, forecast_land: {} },
    crashes: 0,
    parse_failures: 0,
    parse_failures_by_type: {},
    odd: 0,
    odd_forecast_timing: 0,
    malformed_incomplete: 0,
    nogo_worst_case_xw_no_runway: 0,
    nogo_night_no_rating: 0,
    nogo_vis_not_in_metar: 0,
    go_with_taf_low_sm_vis: 0,
  };
  const crashes = [];
  const parseFailures = [];
  const odd = [];
  const forecastTiming = [];
  const smVisGaps = [];
  const byStation = [];
  const parseFailTypes = {};

  let ranMetar = 0;
  let ranFcst = 0;

  for (const icao of stations) {
    const metars = readGzLines(join(HERE, "raw/metar", icao + ".txt.gz"));
    const tafs = readGzLines(join(HERE, "raw/taf", icao + ".txt.gz"));
    if (!metars.length && !tafs.length) continue;
    counts.stations += 1;
    counts.tafs += tafs.length;
    const field = fieldOf(icao, rwyMap, metaMap);
    if (field.hasRunways) counts.stations_with_runways += 1;
    if (field.hasLatLon) counts.stations_with_latlon += 1;
    if (field.hasElev) counts.stations_with_elev += 1;
    const st = {
      station: icao,
      metars: metars.length,
      tafs: tafs.length,
      hasRunways: field.hasRunways,
      hasLatLon: field.hasLatLon,
      hasElev: field.hasElev,
      metar_depart: {},
      metar_land: {},
      forecast_depart: {},
      forecast_land: {},
      crashes: 0,
      parse_failures: 0,
      odd: 0,
      forecast_evaluations: 0,
      nogo_worst_case_xw: 0,
    };

    const tafsTimed = tafs.map((rec) => {
      const iss = tafIssueMs(rec, isoMs(rec.time) || (metars[0] && isoMs(metars[0].time)) || Date.now());
      const win = tafValidWindow(rec.raw, iss);
      return { rec, iss, from: win.from, to: win.to };
    }).filter((x) => x.iss != null).sort((a, b) => a.iss - b.iss);

    // ---- METAR pass (each report, TAF in force, depart + land) ----
    if (!FCST_ONLY) {
      for (const rec of metars) {
        if (ranMetar >= LIMIT) break;
        counts.metars += 1;
        const obsMs = isoMs(rec.time);
        const now = (obsMs != null ? obsMs : Date.now()) + FRESH_MS;
        let taf = null;
        if (obsMs != null) {
          // latest issued and still valid at now
          for (const t of tafsTimed) {
            if (t.iss > now) break;
            if (t.to != null && t.to <= now) continue;
            taf = t;
          }
        } else if (tafsTimed.length) taf = tafsTimed[tafsTimed.length - 1];
        if (taf) counts.tafs_attached += 1;

        let parsed = null;
        try {
          parsed = E.parseOfficial({ raw: rec.raw, time: obsMs != null ? obsMs : undefined }, now);
          const fail = parseFailReason(rec, parsed);
          if (fail) {
            counts.parse_failures += 1;
            st.parse_failures += 1;
            const typ = classifyParseFail(fail, rec.raw);
            bump(counts.parse_failures_by_type, typ);
            bump(parseFailTypes, typ);
            if (parseFailures.length < EXAMPLE_CAP) {
              parseFailures.push({ station: icao, reason: fail, type: typ, raw: rec.raw, time: rec.time, sources: rec.sources, parsed: parsed && { ws: parsed.ws, vis: parsed.vis, cavok: parsed.cavok } });
            }
          }
        } catch (err) {
          counts.parse_failures += 1;
          st.parse_failures += 1;
          bump(counts.parse_failures_by_type, "parseOfficial threw");
          if (parseFailures.length < EXAMPLE_CAP) {
            parseFailures.push({ station: icao, reason: "parseOfficial threw: " + err.message, type: "parseOfficial threw", raw: rec.raw, time: rec.time });
          }
        }

        const weather = { metar: { raw: rec.raw, time: obsMs != null ? obsMs : undefined } };
        if (taf) weather.taf = { raw: taf.rec.raw };

        for (const phase of ["depart", "land"]) {
          counts.metar_evaluations += 1;
          ranMetar += 1;
          try {
            const result = E.evaluate({
              field, weather, profile: PROFILE, aircraftId: AIRCRAFT, rules: RULES, phase, now,
            });
            const status = (result && result.status) || "null";
            bump(counts.byStatus["metar_" + phase], status);
            bump(st["metar_" + phase], status);
            if (result && result.code === "parse") counts.malformed_incomplete += 1;
            const why = String((result && result.why) || "");
            if (result && result.status === "nogo" && !field.hasRunways && whyIsWorstCaseXw(why)) {
              counts.nogo_worst_case_xw_no_runway += 1;
              st.nogo_worst_case_xw += 1;
            }
            if (result && result.status === "nogo" && /Night not selected/i.test(why))
              counts.nogo_night_no_rating += 1;
            if (result && result.status === "nogo" && /Visibility not in METAR/i.test(why))
              counts.nogo_vis_not_in_metar += 1;
            const o = oddReasons(rec, result, parsed, field, { now, phase });
            if (o.length) {
              counts.odd += 1;
              st.odd += 1;
              const timing = o.filter((x) => /look-ahead|min after now/i.test(x));
              if (timing.length) {
                counts.odd_forecast_timing += 1;
                if (forecastTiming.length < EXAMPLE_CAP) {
                  forecastTiming.push({
                    kind: "metar-pass", station: icao, phase, time: rec.time, raw: rec.raw,
                    taf: taf ? taf.rec.raw : null, status, why, reasons: timing,
                  });
                }
              }
              if (odd.length < EXAMPLE_CAP) {
                odd.push({
                  kind: "metar-pass", station: icao, phase, time: rec.time, raw: rec.raw,
                  taf: taf ? taf.rec.raw : null, status, code: result && result.code, why, reasons: o,
                });
              }
            }
          } catch (err) {
            counts.crashes += 1;
            st.crashes += 1;
            bump(counts.byStatus["metar_" + phase], "crash");
            bump(st["metar_" + phase], "crash");
            if (crashes.length < EXAMPLE_CAP) {
              crashes.push({ kind: "metar-pass", station: icao, phase, time: rec.time, raw: rec.raw, error: String(err && err.stack || err) });
            }
          }
        }
      }
    }

    // ---- FORECAST pass: each TAF at several times across its validity ----
    if (!META_ONLY) {
      for (let i = 0; i < tafsTimed.length; i++) {
        if (ranFcst >= (args["forecast-limit"] ? parseInt(args["forecast-limit"], 10) : Infinity)) break;
        const t = tafsTimed[i];
        const nextIssue = tafsTimed[i + 1] ? tafsTimed[i + 1].iss : null;
        const times = evalTimesForTaf(t.rec.raw, t.iss, t.from, t.to, nextIssue);
        if (!times.length) continue;
        counts.tafs_scanned += 1;
        counts.forecast_time_points += times.length;
        for (const tp of times) {
          const now = tp.t;
          const met = metarInForce(metars, now);
          const weather = { taf: { raw: t.rec.raw } };
          if (met) weather.metar = { raw: met.raw, time: isoMs(met.time) || undefined };
          const recForOdd = met || { raw: t.rec.raw, time: new Date(now).toISOString() };
          let parsed = null;
          if (met) {
            try { parsed = E.parseOfficial({ raw: met.raw, time: isoMs(met.time) || undefined }, now); }
            catch { parsed = null; }
          }
          const indep = independentTafState(t.rec.raw, now, t.iss);
          for (const phase of ["depart", "land"]) {
            counts.forecast_evaluations += 1;
            st.forecast_evaluations += 1;
            ranFcst += 1;
            try {
              const result = E.evaluate({
                field, weather, profile: PROFILE, aircraftId: AIRCRAFT, rules: RULES, phase, now,
              });
              const status = (result && result.status) || "null";
              bump(counts.byStatus["forecast_" + phase], status);
              bump(st["forecast_" + phase], status);
              const why = String((result && result.why) || "");
              if (result && result.status === "nogo" && !field.hasRunways && whyIsWorstCaseXw(why)) {
                counts.nogo_worst_case_xw_no_runway += 1;
                st.nogo_worst_case_xw += 1;
              }
              if (result && result.code === "parse") counts.malformed_incomplete += 1;
              if (result && result.status === "nogo" && /Night not selected/i.test(why))
                counts.nogo_night_no_rating += 1;
              if (result && result.status === "nogo" && /Visibility not in METAR/i.test(why))
                counts.nogo_vis_not_in_metar += 1;

              // US TAF statute-mile vis below VFR, permanent period in force, but engine still GO
              // and the why does not mention vis — possible engine gap (tokenWeather ignores SM).
              if (result && result.status === "go" && indep.usedSm && indep.vis != null && indep.vis < 5000) {
                counts.go_with_taf_low_sm_vis += 1;
                if (smVisGaps.length < EXAMPLE_CAP) {
                  smVisGaps.push({
                    station: icao, phase, now: new Date(now).toISOString(),
                    taf: t.rec.raw, metar: met ? met.raw : null,
                    independent_vis_m: indep.vis, status, why, tags: tp.tags,
                  });
                }
              }

              const o = oddReasons(recForOdd, result, parsed, field, { now, phase });
              // Also flag forecast-pass timing even if METAR is not CAVOK
              const timing = forecastTimingIssue(why, now, phase);
              if (timing && !o.includes(timing)) o.push(timing);
              if (o.length) {
                counts.odd += 1;
                st.odd += 1;
                if (timing || o.some((x) => /look-ahead|min after now/i.test(x))) {
                  counts.odd_forecast_timing += 1;
                  if (forecastTiming.length < EXAMPLE_CAP) {
                    forecastTiming.push({
                      kind: "forecast-pass", station: icao, phase,
                      now: new Date(now).toISOString(), tags: tp.tags,
                      metar: met ? met.raw : null, taf: t.rec.raw,
                      status, why, reasons: o.filter((x) => /look-ahead|min after now|FM start|BECMG start/i.test(x) || x === timing),
                    });
                  }
                }
                if (odd.length < EXAMPLE_CAP) {
                  odd.push({
                    kind: "forecast-pass", station: icao, phase,
                    now: new Date(now).toISOString(), tags: tp.tags,
                    metar: met ? met.raw : null, taf: t.rec.raw,
                    status, code: result && result.code, why, reasons: o,
                  });
                }
              }
            } catch (err) {
              counts.crashes += 1;
              st.crashes += 1;
              bump(counts.byStatus["forecast_" + phase], "crash");
              bump(st["forecast_" + phase], "crash");
              if (crashes.length < EXAMPLE_CAP) {
                crashes.push({
                  kind: "forecast-pass", station: icao, phase,
                  now: new Date(now).toISOString(), taf: t.rec.raw,
                  metar: met ? met.raw : null,
                  error: String(err && err.stack || err),
                });
              }
            }
          }
        }
      }
    }

    byStation.push(st);
    if ((counts.stations % 10) === 0) {
      const sec = ((Date.now() - started) / 1000).toFixed(1);
      console.error(`… ${counts.stations}/${stations.length} stations, metar_evals=${counts.metar_evaluations}, forecast_evals=${counts.forecast_evaluations}, crashes=${counts.crashes}, ${sec}s`);
    }
    if (ranMetar >= LIMIT && (META_ONLY || ranFcst >= (args["forecast-limit"] ? parseInt(args["forecast-limit"], 10) : Infinity))) break;
  }

  const elapsedMs = Date.now() - started;
  const results = {
    ran_at: new Date().toISOString(),
    engine: {
      path: ENGINE_PATH,
      branch: "fix/engine-parser-fm-16nov",
      commit: "5a5e60b212e417385176dff07e6d0b9b3032a89a",
      version: E.RULES_VERSION,
      checksum: E.RULES_LOCK && E.RULES_LOCK.checksum,
    },
    profile: {
      licence: "ppl", aircraftId: AIRCRAFT, rules: RULES,
      note: "METAR pass: 'now' is 5 minutes after each report, with the TAF then in force, Depart and Land. Forecast pass: each TAF is evaluated at hourly ticks and at 5 minutes before/after every FM/BECMG/TEMPO/PROB/validity/month-roll boundary, while that TAF is still the one in force, paired with the METAR then in force. Default PPL / Cessna 172 / VFR.",
    },
    field_defaults: {
      runways: "The SA runway database has no foreign airports. field.runways is empty. The engine then treats the whole wind as worst-case crosswind. That is stated engine policy, not a bug, and those NO-GOs are counted separately.",
      lat_lon: "Taken from aviationweather.gov stationinfo (not invented). Night is only computed when lat/lon are present.",
      elev: "Taken from aviationweather.gov stationinfo, metres converted to feet. Density altitude needs elevation.",
    },
    counts,
    elapsed_ms: elapsedMs,
    crashes,
    parse_failures: parseFailures,
    odd,
    forecast_timing: forecastTiming,
    sm_vis_gaps: smVisGaps,
    stations: byStation,
  };
  if (!NO_WRITE) {
    writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\n");
    writeFileSync(join(HERE, "RESULTS.md"), renderMarkdown(results));
  }
  console.log(JSON.stringify({ counts, elapsed_ms: elapsedMs, results: join(HERE, "RESULTS.md") }, null, 2));
}

function fmt(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ") || "(none)";
}

function renderMarkdown(r) {
  const c = r.counts;
  const lines = [];
  lines.push("# Global real-weather engine run (16 Nov 2026)");
  lines.push("");
  lines.push(`Ran at ${r.ran_at} (dataset times are UTC; this stamp is ISO-8601).`);
  lines.push("");
  lines.push("The engine files under `site/engine/` were imported read-only and were not modified. This run uses the fixed engine on branch `fix/engine-parser-fm-16nov`, commit `5a5e60b21`.");
  lines.push("");
  lines.push("## How it was run");
  lines.push("");
  lines.push(`- Engine: \`${r.engine.path}\`, rules ${r.engine.version}, lock ${r.engine.checksum || "n/a"}.`);
  lines.push("- Profile: PPL, Cessna 172, VFR — the same default the site tests use.");
  lines.push("- **METAR pass:** each real METAR/SPECI, with the TAF then in force (if we have one). `now` is 5 minutes after the report. Depart and Land.");
  lines.push("- **Forecast pass (separate counts):** each TAF is evaluated at hourly times across its validity, and at 5 minutes before and after every FM, BECMG, TEMPO, PROB, validity and month-rollover boundary, only while that TAF is still the one in force. Each time is paired with the METAR then in force. Depart and Land.");
  lines.push("- Foreign stations are not in the SA runway database. `field.runways` is left empty (the same as the SA runner does when a station has no runways). The engine then treats the whole wind as worst-case crosswind. Latitude, longitude and elevation come from aviationweather.gov station metadata so night and density altitude can still run. No runway headings were invented.");
  lines.push(`- Elapsed: ${(r.elapsed_ms / 1000).toFixed(1)} s.`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Stations run: **${c.stations}** (runway headings: ${c.stations_with_runways}, lat/lon: ${c.stations_with_latlon}, elevation: ${c.stations_with_elev})`);
  lines.push(`- METARs / SPECIs fed in: **${c.metars}**`);
  lines.push(`- TAFs on file: **${c.tafs}**; TAFs scanned on the forecast pass: **${c.tafs_scanned}**; METAR-pass reports that had a TAF in force: **${c.tafs_attached}**`);
  lines.push(`- METAR-pass evaluations: **${c.metar_evaluations}** (depart + land)`);
  lines.push(`- Forecast-pass time points: **${c.forecast_time_points}**`);
  lines.push(`- Forecast-pass evaluations: **${c.forecast_evaluations}** (depart + land)`);
  lines.push(`- Crashes: **${c.crashes}**`);
  lines.push(`- Parse failures: **${c.parse_failures}**`);
  lines.push(`- Odd results flagged: **${c.odd}** (of which forecast-timing: **${c.odd_forecast_timing}**)`);
  lines.push(`- Evaluations INCOMPLETE because a required group was malformed: **${c.malformed_incomplete || 0}**`);
  lines.push(`- NO-GOs from worst-case crosswind because no runway headings were available: **${c.nogo_worst_case_xw_no_runway}** (expected engine policy, not counted as odd)`);
  lines.push(`- NO-GOs because night was not selected on the default PPL profile: **${c.nogo_night_no_rating}**`);
  lines.push(`- NO-GOs because the engine did not read visibility from the METAR (and had no TAF/model fill): **${c.nogo_vis_not_in_metar}**`);
  lines.push(`- Forecast-pass GOs where an in-force TAF permanent period had statute-mile visibility below 5 km: **${c.go_with_taf_low_sm_vis}**`);
  lines.push("");
  lines.push("### Verdicts — METAR pass, depart");
  lines.push("");
  lines.push(fmt(c.byStatus.metar_depart));
  lines.push("");
  lines.push("### Verdicts — METAR pass, land");
  lines.push("");
  lines.push(fmt(c.byStatus.metar_land));
  lines.push("");
  lines.push("### Verdicts — forecast pass, depart");
  lines.push("");
  lines.push(fmt(c.byStatus.forecast_depart));
  lines.push("");
  lines.push("### Verdicts — forecast pass, land");
  lines.push("");
  lines.push(fmt(c.byStatus.forecast_land));
  lines.push("");
  lines.push("## Crashes");
  lines.push("");
  if (!r.crashes.length) lines.push("None.");
  else {
    for (const x of r.crashes.slice(0, 25)) {
      lines.push(`- **${x.station}** ${x.kind || ""} ${x.phase} ${x.time || x.now || ""}`);
      if (x.raw) lines.push(`  - \`${x.raw}\``);
      if (x.taf) lines.push(`  - TAF: \`${x.taf}\``);
      lines.push(`  - \`${String(x.error).split("\n")[0]}\``);
    }
    if (r.crashes.length > 25) lines.push(`- … and ${r.crashes.length - 25} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Parse failures");
  lines.push("");
  lines.push("A parse failure means `parseOfficial` threw, returned null on a non-NIL report, or missed a wind/visibility group that is clearly in the raw text. The 16 Nov parser fix already covers directional visibility, glued weather, COR, and garbled required groups (INCOMPLETE, no guess). New shapes from this worldwide set, if any, are grouped below.");
  lines.push("");
  if (c.parse_failures) {
    lines.push("By type: " + fmt(c.parse_failures_by_type));
    lines.push("");
  }
  if (!r.parse_failures.length) lines.push("None.");
  else {
    for (const x of r.parse_failures.slice(0, 30)) {
      lines.push(`- **${x.station}** ${x.time || ""} — ${x.type || ""} — ${x.reason}`);
      lines.push(`  - \`${x.raw}\``);
    }
    if (r.parse_failures.length > 30) lines.push(`- … and ${r.parse_failures.length - 30} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Statute-mile METAR visibility (US / Canada style)");
  lines.push("");
  lines.push("A large share of North American METARs write visibility as `10SM`, `P6SM`, `3SM` or `1/2SM` rather than a four-digit metre group. `parseOfficial`, when given only the raw text (no separate visib field), does not set `vis` or `cavok` on those reports. The engine then says \"Visibility not in METAR, no TAF or model value\" and returns NO-GO. US TAFs have the same SM groups, so the TAF cannot fill the hole either. This is a real engine gap, not a bad report: `10SM` is clearly in the text. It was not visible on the South African set, which uses metre visibility and CAVOK. These cases are counted as parse failures (type: statute-mile visibility) and as `nogo_vis_not_in_metar`. They are not crashes.");
  lines.push("");
  lines.push("## Forecast timing");
  lines.push("");
  lines.push("These are cases where a TAF `FM` or `BECMG` start cited in the verdict looks to fall more than 2 hours after `now` (the engine's depart/land-now look-ahead). TEMPO/PROB overlaps are not listed. This is the same class as the six FAGG false NO-GOs found on the South African set before the 16 Nov fix. If this list is empty, that fix held on the worldwide set.");
  lines.push("");
  if (!r.forecast_timing.length) lines.push("None flagged.");
  else {
    for (const x of r.forecast_timing.slice(0, 25)) {
      lines.push(`- **${x.station}** ${x.kind} ${x.phase} ${x.time || x.now || ""} — ${(x.reasons || []).join("; ")}`);
      if (x.raw) lines.push(`  - METAR: \`${x.raw}\``);
      if (x.metar) lines.push(`  - METAR: \`${x.metar}\``);
      if (x.taf) lines.push(`  - TAF: \`${x.taf}\``);
      lines.push(`  - verdict: ${x.status} — ${x.why || ""}`);
    }
    if (r.forecast_timing.length > 25) lines.push(`- … and ${r.forecast_timing.length - 25} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Statute-mile TAF visibility (US-style)");
  lines.push("");
  lines.push("The engine's TAF token reader looks for a four-digit metre group or CAVOK. A US TAF period written with `P6SM`, `2SM` or `1/2SM` may not be read as visibility. The forecast pass compares an independent SM reading of the in-force permanent period. Cases where that visibility is below 5 km but the verdict is still GO are listed here. These are suspicious and may be a real engine gap; they are not a crash.");
  lines.push("");
  if (!r.sm_vis_gaps.length) lines.push("None flagged.");
  else {
    for (const x of r.sm_vis_gaps.slice(0, 20)) {
      lines.push(`- **${x.station}** ${x.phase} ${x.now} — independent vis ${x.independent_vis_m} m`);
      lines.push(`  - TAF: \`${x.taf}\``);
      if (x.metar) lines.push(`  - METAR: \`${x.metar}\``);
      lines.push(`  - verdict: ${x.status} — ${x.why || ""}`);
    }
    if (r.sm_vis_gaps.length > 20) lines.push(`- … and ${r.sm_vis_gaps.length - 20} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Other odd results");
  lines.push("");
  lines.push("These are not automatically bugs. Worst-case crosswind on a station with no runway headings, night without a night rating, density altitude, METAR trend/TEMPO/BECMG, and a TAF FM/BECMG that starts inside the 2 h look-ahead and is below the PPL minima (8 km / 2 500 ft) are treated as expected. What remains: a surprising NO-GO on CAVOK, a GO in very low visibility or a very low ceiling, an incomplete verdict despite a usable official report, a non-finite weather value, a NO-GO with no reason text, or a forecast-timing flag.");
  lines.push("");
  if (!r.odd.length) lines.push("None flagged.");
  else {
    for (const x of r.odd.slice(0, 25)) {
      lines.push(`- **${x.station}** ${x.kind || ""} ${x.phase} ${x.time || x.now || ""} — ${(x.reasons || []).join("; ")}`);
      if (x.raw) lines.push(`  - METAR: \`${x.raw}\``);
      if (x.metar) lines.push(`  - METAR: \`${x.metar}\``);
      if (x.taf) lines.push(`  - TAF: \`${x.taf}\``);
      lines.push(`  - verdict: ${x.status} (${x.code || ""}) — ${x.why || ""}`);
    }
    if (r.odd.length > 25) lines.push(`- … and ${r.odd.length - 25} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Per station");
  lines.push("");
  lines.push("| Station | METARs | TAFs | Rwys | METAR Depart GO/CAU/NOGO/other | METAR Land GO/CAU/NOGO/other | Fcst evals | Fcst Depart GO/CAU/NOGO/other | Crashes | Parse fail | Odd |");
  lines.push("| --- | ---: | ---: | --- | --- | --- | ---: | --- | ---: | ---: | ---: |");
  const pack = (obj) => {
    const g = obj.go || 0, cau = obj.caution || 0, n = obj.nogo || 0;
    const rest = Object.entries(obj).filter(([k]) => !["go", "caution", "nogo"].includes(k)).map(([k, v]) => `${k} ${v}`).join(", ");
    return `${g}/${cau}/${n}` + (rest ? `/${rest}` : "");
  };
  for (const s of r.stations) {
    lines.push(`| ${s.station} | ${s.metars} | ${s.tafs} | ${s.hasRunways ? "yes" : "no"} | ${pack(s.metar_depart)} | ${pack(s.metar_land)} | ${s.forecast_evaluations} | ${pack(s.forecast_depart)} | ${s.crashes} | ${s.parse_failures} | ${s.odd} |`);
  }
  lines.push("");
  return lines.join("\n");
}

main();

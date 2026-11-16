#!/usr/bin/env node
/**
 * Feed each real METAR (and the TAF in force at that time) through the REAL
 * engine, read-only. Does not modify site/engine/*.
 *
 * Usage (from the repo root, or from this folder):
 *   node tests/sa-weather/run-engine.mjs
 *   node tests/sa-weather/run-engine.mjs --limit=500
 *   node tests/sa-weather/run-engine.mjs --station=FACT
 *
 * Writes tests/sa-weather/RESULTS.md and tests/sa-weather/results.json
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
// --engine=<file> runs another copy of the engine (e.g. the production baseline) for a verdict diff.
// --dump=<file> writes one line per evaluation (station, time, phase, status, code, why) for diffing.
// --no-write keeps RESULTS.md / results.json unchanged.
const ENGINE_PATH = args.engine ? String(args.engine) : join(ROOT, "site/engine/ga-core-v2.js");
const E = require(ENGINE_PATH);
const DUMP = args.dump ? String(args.dump) : null;
const dumpLines = [];
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const ONLY = args.station ? String(args.station).toUpperCase() : null;
const FA_ONLY = args["all-icao"] ? false : true; // default: South African FA** only

const PROFILE = { licence: "ppl" }; // same default the site tests use
const PROFILE_MIN = { visKm: 8, ceilFt: 2500 }; // PPL preset in site/engine/ga-core-v2.js (PRE.ppl)
const AIRCRAFT = "C172";
const RULES = "vfr";
const FRESH_MS = 5 * 60 * 1000; // evaluate as if "now" is 5 minutes after the report
const OK_STATUS = new Set(["go", "caution", "nogo", "incomplete", "none"]);

function loadRunways() {
  const dir = join(ROOT, "site/wst");
  const name = readdirSync(dir).find((f) => /^ad-rwy-db\..*\.json$/.test(f));
  const map = {};
  if (name) {
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
  }
  return map;
}

function loadLatLon() {
  const map = {};
  const wx = JSON.parse(readFileSync(join(ROOT, "netlify/lib/wx_core.json"), "utf8"));
  for (const row of wx) map[row[0]] = { lat: row[1], lon: row[2] };
  const mp = JSON.parse(readFileSync(join(ROOT, "netlify/lib/model_points.json"), "utf8"));
  for (const row of mp) {
    if (!map[row[0]]) map[row[0]] = { lat: row[1], lon: row[2] };
  }
  return map;
}

function fieldOf(icao, rwyMap, llMap) {
  const r = rwyMap[icao] || {};
  const ll = llMap[icao] || {};
  return {
    icao,
    ic: icao,
    lat: ll.lat ?? null,
    la: ll.lat ?? null,
    lon: ll.lon ?? null,
    lo: ll.lon ?? null,
    elevFt: r.elevFt ?? null,
    el: r.elevFt ?? null,
    runways: r.runways || [],
    rw: (r.runways || []).map((x) => x.id),
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

/** TAF issue time from the record or from the TAF date/time group, relative to `around`. */
function tafIssueMs(rec, around) {
  const t = isoMs(rec.time);
  if (t != null) return t;
  const m = rec.raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!m || around == null) return null;
  const day = +m[1], hh = +m[2], mm = +m[3];
  const d = new Date(around);
  d.setUTCDate(day);
  d.setUTCHours(hh, mm, 0, 0);
  // month wrap: if more than 20 days off, step a month
  if (d.getTime() - around > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
  if (around - d.getTime() > 20 * 86400e3) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

function tafValidToMs(raw, issueMs) {
  // 1518/1624 or 151812/162400
  const m = raw.match(/\b(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\b/);
  const end = m || raw.match(/\b\d{6}Z\s+(\d{2})(\d{2})\/(\d{2})(\d{2})\b/);
  if (!end || issueMs == null) return issueMs != null ? issueMs + 30 * 3600e3 : null;
  let day, hour, minute;
  if (m) {
    day = +m[4]; hour = +m[5]; minute = +m[6];
  } else {
    day = +end[3]; hour = +end[4]; minute = 0;
  }
  const d = new Date(issueMs);
  d.setUTCDate(day);
  d.setUTCHours(hour, minute, 0, 0);
  if (d.getTime() < issueMs) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

function tafInForce(tafs, nowMs) {
  let best = null, bestIssue = -Infinity;
  for (const rec of tafs) {
    const iss = tafIssueMs(rec, nowMs);
    if (iss == null || iss > nowMs) continue;
    const until = tafValidToMs(rec.raw, iss);
    if (until != null && until <= nowMs) continue;
    if (iss >= bestIssue) { bestIssue = iss; best = rec; }
  }
  return best;
}

function looksLikeWind(raw) {
  return /\b(?:VRB|\d{3}|\/\/\/)(\d{2}|\/\/)(?:G\d{2})?KT\b/.test(raw) || /\b\/\/\/{0,2}\/\/KT\b/.test(raw);
}
/* 16 Nov 2026: the visibility zone of the report itself: before the TREND / RMK, before the first
   temperature group (so a garbled AUTO tail after 17/14 is not counted), RVR and QNH removed. */
function visZone(raw) {
  const body = metarBodyOf(raw);
  const cut = body.search(/\sM?\d{2}\/(?:M?\d{2})?(?:\s|$)/);
  return (cut >= 0 ? body.slice(0, cut) : body).replace(/\bR\d{2}[LCR]?\/[PM]?\d{4}[A-Z]*\b/g, " ").replace(/\b[QA]\d{4}\b/g, " ");
}
function looksLikeVisOrCavok(raw) {
  const z = visZone(raw);
  if (/\bCAVOK\b/.test(z) || /\b\d{1,2}(?:SM|KM)\b/.test(z) || /\bP\d(?:SM)?\b/.test(z)) return true;
  // Prevailing vis: 9999, 0400, 0400W, 4500SE, or 9999-RA (missing space).
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
/** Lowest visibility group in the report itself (CAVOK / 9999 = 10 km). Independent of the engine. */
function visMeters(raw) {
  const z = visZone(raw);
  if (/\bCAVOK\b/.test(z)) return 10000;
  let low = null;
  for (const t of z.split(/\s+/)) {
    const m = /^(\d{4})(?:[A-Z]{0,3}|[+-]?[A-Z]{2,})$/.exec(t);
    if (m && /^\d{4}(?:Z|KT|MPS|FT)$/.test(t)) continue; // a time or wind fragment, not visibility
    if (m) { const v = m[1] === "9999" ? 10000 : Number(m[1]); if (low == null || v < low) low = v; }
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
  const m = raw.match(/\b(?:VRB|\d{3})(\d{2})(?:G(\d{2}))?KT\b/);
  if (!m) return null;
  const ws = Number(m[1]);
  const g = m[2] != null ? Number(m[2]) : ws;
  return { ws, g };
}

function parseFailReason(rec, parsed) {
  if (isNil(rec.raw)) return null;
  if (!parsed) return "parseOfficial returned null";
  if (parsed.parseUnknown) return null; // 16 Nov 2026: malformed required group -> engine says INCOMPLETE (counted separately)
  const raw = rec.raw;
  if (looksLikeWind(raw) && !/\/\/\/{0,2}\/\//.test(raw) && !/\b\/\/KT\b/.test(raw) && parsed.ws == null && !parsed.vrb && !/\bVRB\d{2}KT\b/.test(raw)) {
    // VRB sets vrb and ws should still be set; /////KT is missing wind — not a fail
    if (/\b(?:VRB|\d{3})\d{2}(?:G\d{2})?KT\b/.test(raw) && parsed.ws == null)
      return "wind group present but ws is null";
  }
  if (looksLikeVisOrCavok(raw) && parsed.vis == null && !parsed.cavok)
    return "visibility/CAVOK present but vis/cavok not set";
  return null;
}

function oddReasons(rec, result, parsed) {
  const odds = [];
  if (!result) return ["no result"];
  if (!OK_STATUS.has(result.status)) odds.push(`unexpected status ${result.status}`);
  const raw = rec.raw;
  if (isNil(raw)) return odds;
  const vis = visMeters(raw);
  const ceil = lowCeilingFt(raw);
  const wind = windKt(raw);
  // A clear CAVOK / 9999 + no low cloud + modest wind should not be a NO-GO
  // (night without a night rating can still be caution; density altitude can caution/nogo — those are noted separately).
  if (result.status === "nogo" && isCavok(raw) && wind && wind.g < 20) {
    const why = String(result.why || "");
    // Crosswind, tailwind, gust, night, density altitude, or a METAR trend/TEMPO/BECMG
    // are expected rule hits, not surprises.
    /* 16 Nov 2026: a TAF FM/BECMG period that starts inside the look-ahead (depart: next 2 h; land: ETA +/- 1 h,
       CAR 91.07.7) and is below the pilot's OWN minima (PPL default 8 km / 2 500 ft) is an expected NO-GO. */
    const tc = /^TAF forecast: (?:FM|BECMG|BASE)?.*?ceiling (\d+) ft/.exec(why), tv = /^TAF forecast: (?:FM|BECMG|BASE)?.*?vis ([\d.]+) km/.exec(why);
    const tafBelowOwn = (tc && Number(tc[1]) < PROFILE_MIN.ceilFt) || (tv && Number(tv[1]) < PROFILE_MIN.visKm);
    if (!tafBelowOwn && !/night|density altitude|instrument|heliport|crosswind|tailwind|gust|trend|tempo|becmg/i.test(why))
      odds.push(`NO-GO on CAVOK with gust ${wind.g} kt (${why})`);
  }
  if (result.status === "go" && vis != null && vis < 5000)
    odds.push(`GO with visibility ${vis} m (below the 5 km VFR minimum)`);
  if (result.status === "go" && ceil != null && ceil <= 200)
    odds.push(`GO with ${ceil} ft ceiling`);
  if (result.status === "incomplete" && result.code === "parse") return odds; // malformed required group: expected INCOMPLETE
  if (result.status === "incomplete" && parsed && (parsed.ws != null || parsed.cavok || parsed.vis != null) && !isNil(raw))
    odds.push(`incomplete despite a usable official report (${result.code || ""} ${result.why || ""})`);
  const used = result.weatherUsed;
  if (used) {
    for (const [k, v] of Object.entries(used)) {
      if (typeof v === "number" && !Number.isFinite(v)) odds.push(`weatherUsed.${k} is ${v}`);
    }
  }
  if (result.status === "nogo" && !result.why) odds.push("NO-GO with empty why");
  return odds;
}

function listIcaos(kind) {
  const dir = join(HERE, "raw", kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt.gz") || f.endsWith(".txt"))
    .map((f) => f.replace(/\.txt(\.gz)?$/, ""))
    .sort();
}

function main() {
  const started = Date.now();
  const rwyMap = loadRunways();
  const llMap = loadLatLon();
  const stations = listIcaos("metar").filter((id) => (!ONLY || id === ONLY) && (!FA_ONLY || /^FA[A-Z]{2}$/.test(id)));

  const counts = {
    stations: 0,
    metars: 0,
    tafs_attached: 0,
    evaluations: 0,
    byStatus: { depart: {}, land: {} },
    crashes: 0,
    parse_failures: 0,
    odd: 0,
    malformed_incomplete: 0,
  };
  const crashes = [];
  const parseFailures = [];
  const odd = [];
  const byStation = [];

  const addStatus = (phase, status) => {
    const b = counts.byStatus[phase];
    b[status] = (b[status] || 0) + 1;
  };

  let ran = 0;
  for (const icao of stations) {
    const metars = readGzLines(join(HERE, "raw/metar", icao + ".txt.gz"));
    const tafs = readGzLines(join(HERE, "raw/taf", icao + ".txt.gz"));
    if (!metars.length) continue;
    counts.stations += 1;
    const field = fieldOf(icao, rwyMap, llMap);
    const st = {
      station: icao,
      metars: metars.length,
      tafs: tafs.length,
      depart: {},
      land: {},
      crashes: 0,
      parse_failures: 0,
      odd: 0,
    };

    for (const rec of metars) {
      if (ran >= LIMIT) break;
      counts.metars += 1;
      const obsMs = isoMs(rec.time);
      const now = (obsMs != null ? obsMs : Date.now()) + FRESH_MS;
      const taf = obsMs != null ? tafInForce(tafs, now) : (tafs[tafs.length - 1] || null);
      if (taf) counts.tafs_attached += 1;

      let parsed = null;
      try {
        parsed = E.parseOfficial({ raw: rec.raw, time: obsMs != null ? obsMs : undefined }, now);
        const fail = parseFailReason(rec, parsed);
        if (fail) {
          counts.parse_failures += 1;
          st.parse_failures += 1;
          if (parseFailures.length < 120) {
            parseFailures.push({ station: icao, reason: fail, raw: rec.raw, time: rec.time, parsed: parsed && { ws: parsed.ws, vis: parsed.vis, cavok: parsed.cavok, t: parsed.t, qnh: parsed.qnh } });
          }
        }
      } catch (err) {
        counts.parse_failures += 1;
        st.parse_failures += 1;
        if (parseFailures.length < 120) {
          parseFailures.push({ station: icao, reason: "parseOfficial threw: " + err.message, raw: rec.raw, time: rec.time });
        }
      }

      const weather = { metar: { raw: rec.raw, time: obsMs != null ? obsMs : undefined } };
      if (taf) weather.taf = { raw: taf.raw };

      for (const phase of ["depart", "land"]) {
        counts.evaluations += 1;
        ran += 1;
        try {
          const result = E.evaluate({
            field,
            weather,
            profile: PROFILE,
            aircraftId: AIRCRAFT,
            rules: RULES,
            phase,
            now,
          });
          const status = (result && result.status) || "null";
          if (DUMP) dumpLines.push([icao, rec.time, phase, status, (result && result.code) || "", String((result && result.why) || "").replace(/\s+/g, " "), rec.raw].join("\t"));
          addStatus(phase, status);
          if (result && result.code === "parse") counts.malformed_incomplete += 1;
          st[phase][status] = (st[phase][status] || 0) + 1;
          const o = oddReasons(rec, result, parsed);
          if (o.length) {
            counts.odd += 1;
            st.odd += 1;
            if (odd.length < 120) {
              odd.push({
                station: icao, phase, time: rec.time, raw: rec.raw,
                taf: taf ? taf.raw : null,
                status: result && result.status, code: result && result.code, why: result && result.why,
                reasons: o,
              });
            }
          }
        } catch (err) {
          counts.crashes += 1;
          st.crashes += 1;
          addStatus(phase, "crash");
          st[phase].crash = (st[phase].crash || 0) + 1;
          if (crashes.length < 120) {
            crashes.push({ station: icao, phase, time: rec.time, raw: rec.raw, error: String(err && err.stack || err) });
          }
        }
      }
    }
    byStation.push(st);
    if (ran >= LIMIT) break;
  }

  const elapsedMs = Date.now() - started;
  const results = {
    ran_at: new Date().toISOString(),
    engine: {
      path: "site/engine/ga-core-v2.js",
      version: E.RULES_VERSION,
      checksum: E.RULES_LOCK && E.RULES_LOCK.checksum,
      engineVersion: null,
    },
    profile: { licence: "ppl", aircraftId: AIRCRAFT, rules: RULES, note: "Evaluated as if 'now' was 5 minutes after each report, so historical METARs are treated as fresh, the same way the site treats a current report." },
    counts,
    elapsed_ms: elapsedMs,
    crashes,
    parse_failures: parseFailures,
    odd,
    stations: byStation,
  };
  // pick engineVersion from a dummy call if needed — already on first result; leave from RULES
  if (DUMP) writeFileSync(DUMP, dumpLines.join("\n") + "\n");
  if (!args["no-write"]) {
    writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\n");
    writeFileSync(join(HERE, "RESULTS.md"), renderMarkdown(results));
  }
  console.log(JSON.stringify({ counts, elapsed_ms: elapsedMs, results: join(HERE, "RESULTS.md") }, null, 2));
}

function renderMarkdown(r) {
  const c = r.counts;
  const fmt = (obj) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ") || "(none)";
  const lines = [];
  lines.push("# South African real-weather engine run");
  lines.push("");
  lines.push(`Ran at ${r.ran_at} (times in the dataset are UTC; this stamp is ISO-8601).`);
  lines.push("");
  lines.push("The engine files under `site/engine/` were imported read-only and were not modified.");
  lines.push("");
  lines.push("## How it was run");
  lines.push("");
  lines.push(`- Engine: \`${r.engine.path}\`, rules ${r.engine.version}, lock ${r.engine.checksum || "n/a"}.`);
  lines.push(`- Profile: PPL, Cessna 172, VFR — the same default the site tests use.`);
  lines.push("- For each real METAR (and SPECI), the TAF that was in force at that time (if we have one) is attached.");
  lines.push("- `now` is set to 5 minutes after the report, so a historical METAR is treated as a fresh official report, the same way the live site treats the current one.");
  lines.push("- Each report is evaluated twice: Depart now, and Land now.");
  lines.push(`- Elapsed: ${(r.elapsed_ms / 1000).toFixed(1)} s.`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Stations run: **${c.stations}**`);
  lines.push(`- METARs / SPECIs fed in: **${c.metars}**`);
  lines.push(`- Evaluations: **${c.evaluations}** (depart + land)`);
  lines.push(`- Reports that had a TAF in force: **${c.tafs_attached}**`);
  lines.push(`- Crashes: **${c.crashes}**`);
  lines.push(`- Parse failures: **${c.parse_failures}**`);
  lines.push(`- Odd results flagged: **${c.odd}**`);
  lines.push(`- Evaluations INCOMPLETE because a required group was malformed (engine does not guess): **${c.malformed_incomplete || 0}**`);
  lines.push("");
  lines.push("### Verdicts — depart");
  lines.push("");
  lines.push(fmt(c.byStatus.depart));
  lines.push("");
  lines.push("### Verdicts — land");
  lines.push("");
  lines.push(fmt(c.byStatus.land));
  lines.push("");
  lines.push("## Crashes");
  lines.push("");
  if (!r.crashes.length) lines.push("None.");
  else {
    for (const x of r.crashes.slice(0, 25)) {
      lines.push(`- **${x.station}** ${x.phase} ${x.time || ""}`);
      lines.push(`  - \`${x.raw}\``);
      lines.push(`  - \`${String(x.error).split("\\n")[0]}\``);
    }
    if (r.crashes.length > 25) lines.push(`- … and ${r.crashes.length - 25} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Parse failures");
  lines.push("");
  lines.push("A parse failure means `parseOfficial` threw, returned null on a non-NIL report, or missed a wind/visibility group that is clearly in the raw text.");
  lines.push("");
  if (!r.parse_failures.length) lines.push("None.");
  else {
    lines.push("On the 15 Nov 2026 run (before the 16 Nov parser fix) these clustered into a few real-report shapes (not invented):");
    lines.push("");
    lines.push("- Directional or split visibility, which the parser did not take as prevailing vis: for example `0400W`, `0800NE`, `2000S`, `3000N`, `4500SE`, `1000SW`, and two-group vis such as `4500W 9999` or `2500SW 8000NE`.");
    lines.push("- A missing space before weather: `9999-RA`, `9999-DZ`, `9999-SHRA`.");
    lines.push("- `METAR COR` (a correction) before the station id.");
    lines.push("- Garbled but real archive groups: `23016VKT`, `01006K6002KT`, and a couple of AUTO reports with `////` then a later `9999`.");
    lines.push("- One thunderstorm report with only an RVR group (`R02/P2000N TS`) and no prevailing vis — that flag is weaker, because there may be no prevailing vis to parse.");
    lines.push("");
    for (const x of r.parse_failures.slice(0, 30)) {
      lines.push(`- **${x.station}** ${x.time || ""} — ${x.reason}`);
      lines.push(`  - \`${x.raw}\``);
    }
    if (r.parse_failures.length > 30) lines.push(`- … and ${r.parse_failures.length - 30} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Odd results");
  lines.push("");
  lines.push("These are not automatically bugs. Crosswind, tailwind, gust, night, density altitude, and METAR trend/TEMPO/BECMG hits on an otherwise CAVOK report are treated as expected and are not listed here. What remains is worth a second look: a surprising NO-GO on CAVOK, a GO in very low visibility or a very low ceiling, an incomplete verdict despite a usable official report, a non-finite weather value, or a NO-GO with no reason text. A NIL METAR with no TAF, or a report with a malformed required group (garbled wind, visibility or cloud), is INCOMPLETE by design. A TAF FM/BECMG NO-GO is expected when the period starts inside the look-ahead and is below the pilot's own minima (PPL default 8 km / 2 500 ft). Land shows more CAUTION than depart, mostly because many reports fall at night on the default PPL profile (no night rating).");
  lines.push("");
  if (!r.odd.length) lines.push("None flagged.");
  else {
    for (const x of r.odd.slice(0, 25)) {
      lines.push(`- **${x.station}** ${x.phase} ${x.time || ""} — ${x.reasons.join("; ")}`);
      lines.push(`  - METAR: \`${x.raw}\``);
      if (x.taf) lines.push(`  - TAF in force: \`${x.taf}\``);
      lines.push(`  - verdict: ${x.status} (${x.code || ""}) — ${x.why || ""}`);
    }
    if (r.odd.length > 25) lines.push(`- … and ${r.odd.length - 25} more (see results.json).`);
  }
  lines.push("");
  lines.push("## Per station");
  lines.push("");
  lines.push("| Station | METARs | TAFs on file | Depart GO / CAUTION / NO-GO / other | Land GO / CAUTION / NO-GO / other | Crashes | Parse fail | Odd |");
  lines.push("| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |");
  const pack = (obj) => {
    const g = obj.go || 0, c = obj.caution || 0, n = obj.nogo || 0;
    const rest = Object.entries(obj).filter(([k]) => !["go", "caution", "nogo"].includes(k)).map(([k, v]) => `${k} ${v}`).join(", ");
    return `${g} / ${c} / ${n}` + (rest ? ` / ${rest}` : "");
  };
  for (const s of r.stations) {
    lines.push(`| ${s.station} | ${s.metars} | ${s.tafs} | ${pack(s.depart)} | ${pack(s.land)} | ${s.crashes} | ${s.parse_failures} | ${s.odd} |`);
  }
  lines.push("");
  return lines.join("\n");
}

main();

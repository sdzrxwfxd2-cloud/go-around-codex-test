// Write site/wst/ad-rwy-db.<hash>.json from the locked runway/elevation DB (15 Nov 2026, MT 14:23 SAST).
// Public runtime file: runway end ids, true headings (whole degrees) and field elevation (ft) ONLY. No source names, URLs or
// dates (those stay in the locked JSON for the admin dashboard). usage: node tools/rwdb/emit.mjs [locked.vN.json]
// Packed string, one field per ';':  ID=elev|A/B:hdgA,C:hdgC   (A/B = reciprocal pair, B = A + 180; a lone end has no '/').
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = process.argv[2] || path.join(ROOT, "site/data/ad-runways-elev.locked.v2.json");
const db = JSON.parse(fs.readFileSync(SRC, "utf8"));
const parts = []; let nrw = 0, nel = 0;
const dd = (a, b) => Math.abs(((b - a) % 360 + 540) % 360 - 180);
for (const a of db.aerodromes) {
  const rw = [];
  for (const r of a.runways || []) {
    const es = (r.ends || []).filter((e) => e.true_hdg && e.true_hdg.v != null && e.id);
    if (es.length === 2 && dd(+es[0].true_hdg.v + 180, +es[1].true_hdg.v) < 0.6) rw.push(es[0].id + "/" + es[1].id + ":" + (Math.round(+es[0].true_hdg.v) % 360));
    else for (const e of es) rw.push(e.id + ":" + (Math.round(+e.true_hdg.v) % 360));
  }
  const el = a.elevation_ft && a.elevation_ft.v != null ? Math.round(+a.elevation_ft.v) : null;
  if (el == null && !rw.length) continue;
  if (/[=|;:,/]/.test(a.id) || rw.some((x) => /[=|;]/.test(x))) throw new Error("bad id " + a.id);
  parts.push(a.id + "=" + (el == null ? "" : el) + (rw.length ? "|" + rw.join(",") : ""));
  if (rw.length) nrw++; if (el != null) nel++;
}
const body = parts.join(";"), sum = crypto.createHash("sha1").update(body).digest("hex").slice(0, 10);
// 15 Nov 2026 (MT 14:55 SAST): a separate cached JSON, not a script on the page; the content hash is in the file name
// (/wst/* is cached for a year), and the two readers (engine/ga-core-v2-wire.js, wst/wst-ad.js) are pointed at it here.
const json = JSON.stringify({ v: db.version, n: { runways: nrw, elevation: nel }, s: body }) + "\n";
const h = crypto.createHash("sha256").update(json).digest("hex").slice(0, 10), name = "ad-rwy-db." + h + ".json";
const dir = path.join(ROOT, "site/wst");
for (const f of fs.readdirSync(dir)) if (/^ad-rwy-db(\.[0-9a-f]{10}\.json|\.js)$/.test(f) && f !== name) fs.unlinkSync(path.join(dir, f));
fs.writeFileSync(path.join(dir, name), json);
for (const rel of ["site/engine/ga-core-v2-wire.js", "site/wst/wst-ad.js"]) {
  const f = path.join(ROOT, rel), s = fs.readFileSync(f, "utf8"), o = s.replace(/\/wst\/ad-rwy-db\.[0-9a-f]{10}\.json/g, "/wst/" + name);
  if (!/\/wst\/ad-rwy-db\.[0-9a-f]{10}\.json/.test(s)) throw new Error(rel + ": no RWDB_URL");
  if (o !== s) fs.writeFileSync(f, o);
}
console.log("wrote site/wst/" + name, json.length, "bytes,", nrw, "with runways,", nel, "with elevation (" + sum + ")");

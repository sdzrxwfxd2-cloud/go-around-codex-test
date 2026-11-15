// tools/engine-bench/fixtures.mjs — made-up but realistic weather for the speed and correctness checks (12 Nov 2026).
// The sandbox cannot reach the live site, so /api/wx-now, /api/metar, /api/taf and /api/model-weather are built here with the
// repo's OWN composer (reference/.../files/cloudflare/lib/fast_compose.mjs), so the shapes are exactly what live serves.
// The weather is deterministic (by aerodrome index and hour), and every hour is different, so a wrong forecast hour shows.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";
const HERE = dirname(fileURLToPath(import.meta.url));
// Port 13 Nov 2026: in Go-Around-Cloudflare the composer and the site live in the repo itself.
export const REF = join(HERE, "../..");
// wx_snapshot.mjs imports @netlify/blobs (not installed here, not needed to compose): give it an empty stand-in.
register("data:text/javascript," + encodeURIComponent(
  'export async function resolve(s, c, n) { return s === "@netlify/blobs" ? { url: "data:text/javascript,export const getStore=()=>null", shortCircuit: true } : n(s, c); }'));
const { fastCompose } = await import(join(REF, "cloudflare/lib/fast_compose.mjs"));
const { ALL_POINTS, VARS } = await import(join(REF, "netlify/lib/wx_snapshot.mjs"));
const H = 3600e3, MIN = 60e3;
const p2 = (n) => String(n).padStart(2, "0");
const ddhhmm = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()); };
const ddhh = (t) => ddhhmm(t).slice(0, 4);

/** Model value of one variable for aerodrome i at hour step h (0 = one hour ago). */
export function modelValue(k, i, h) {
  switch (k) {
    case "temperature_2m": return 16 + (i % 15) + (h % 4);
    case "dew_point_2m": return 8 + (i % 7);
    case "wind_speed_10m": return 3 + ((i * 7) % 16) + h * 2;                 // rises 2 kt every hour
    case "wind_direction_10m": return (i * 37 + h * 15) % 360;                 // veers 15 degrees every hour
    case "wind_gusts_10m": return 3 + ((i * 7) % 16) + h * 2 + (i % 5) * 4;
    case "visibility": return [24140, 16000, 9000, 7000, 5500, 4200, 2500][(i + h) % 7];
    case "pressure_msl": return 1012 + (i % 9);
    case "cloud_cover": return (i * 13 + h * 9) % 101;
    case "cloud_cover_low": return (i * 17 + h * 11) % 101;
    case "cloud_base": return null;                                            // always null from Open-Meteo
    case "freezing_level_height": return 3800 + (i % 10) * 60;
  }
  return null;
}
const METAR_BODIES = [
  "22008KT CAVOK 24/10 Q1021 NOSIG", "18012G22KT 9999 FEW040 25/09 Q1019", "09018KT 9999 SCT035 23/11 Q1018",
  "VRB03KT 0400 FG VV002 12/12 Q1022", "27015G28KT 6000 TSRA SCT030CB BKN045 21/17 Q1012 TEMPO 3000 +TSRA",
  "NIL", "15006KT BKN012 19/15 Q1020", "00000KT 4500 BR OVC008 14/13 Q1023 BECMG 9999 SCT020",
  "AUTO 21010KT 9999 ////// 22/08 Q1020", "33025G38KT 9999 SCT050 28/05 Q1009", "/////KT 9999 FEW030 20/10 Q1018",
  "12009KT 090V160 8000 SCT018 BKN030 20/14 Q1017 TEMPO 4000 SHRA", "24004KT 9999 BKN016 18/12 Q1021 NOSIG",
];
const TAF_BODIES = [
  (f) => `22010KT 9999 SCT040 TEMPO ${ddhh(f + 1 * H)}/${ddhh(f + 4 * H)} 25018G30KT 5000 TSRA SCT030CB`,
  (f) => `VRB03KT 0800 FG VV002 BECMG ${ddhh(f + 1 * H)}/${ddhh(f + 2 * H)} 18008KT 9999 SCT030`,
  (f) => `18008KT CAVOK FM${ddhhmm(f + 3 * H)} 27025G38KT 6000 -SHRA BKN020`,
  (f) => `09012KT 9999 FEW030 PROB30 TEMPO ${ddhh(f + 2 * H)}/${ddhh(f + 6 * H)} 3000 TSRA BKN025CB`,
  (f) => `15010KT 9999 BKN014 BECMG ${ddhh(f + 2 * H)}/${ddhh(f + 4 * H)} BKN008`,
  (f) => `24006KT 9999 SCT045`,
];
/** Everything the page asks the server for, for the instant `now`. */
export function build(now = Date.now()) {
  const t0 = Math.floor(now / H) * H - H, HOURS = 20;
  const time = Array.from({ length: HOURS }, (_, h) => new Date(t0 + h * H).toISOString().slice(0, 16));
  const model = {};
  ALL_POINTS.forEach((p, i) => {
    model[p[0]] = { ft: new Date(now - (10 + (i % 60)) * MIN).toISOString(), el: 100 + (i * 53) % 5500, fz: true, time,
      v: Object.fromEntries(VARS.map((k) => [k, k === "cloud_base" ? null : time.map((_, h) => modelValue(k, i, h))])) };
  });
  const icaos = ALL_POINTS.map((p) => p[0]).filter((id) => /^FA[A-Z]{2}$/.test(id));
  const metarRows = icaos.slice(0, 65).map((id, j) => {
    const age = j % 11 === 10 ? 100 : j % 11 === 9 ? 75 : 5 + (j % 7) * 6, t = now - age * MIN, body = METAR_BODIES[j % METAR_BODIES.length];
    const rawOb = body === "NIL" ? `METAR ${id} ${ddhhmm(t)}Z NIL` : `METAR ${id} ${ddhhmm(t)}Z ${body}`;
    return rowFromRaw(id, rawOb, t);
  });
  const tafFrom = Math.floor(now / H) * H - 2 * H;
  const tafRows = icaos.slice(0, 30).map((id, j) => ({ icaoId: id,
    rawTAF: `TAF ${id} ${ddhhmm(tafFrom - 30 * MIN)}Z ${ddhh(tafFrom)}/${ddhh(tafFrom + 24 * H)} ${TAF_BODIES[j % TAF_BODIES.length](Math.floor(now / H) * H)}` }));
  const iso = new Date(now - 4 * MIN).toISOString();
  const out = fastCompose({ metar: { fetchedAt: iso, rows: metarRows }, taf: { fetchedAt: iso, rows: tafRows }, model,
    units: { wind_speed_10m: "kn", visibility: "m", temperature_2m: "°C" }, state: { model: {} } }, now);
  const snap = JSON.parse(out.text);
  return { now, wxNow: out.now, snapshot: out.text, modelWeather: JSON.stringify({ ...snap.model, state: {} }),
    metar: JSON.stringify(metarRows), taf: JSON.stringify(tafRows), icaos, points: ALL_POINTS, time, t0 };
}
/** An aviationweather.gov-style METAR row from the raw text (the fields wst-engine obsOf reads). */
export function rowFromRaw(id, rawOb, t) {
  const b = " " + rawOb.split(/ (?:TEMPO|BECMG|NOSIG|RMK)\b/)[0] + " ", o = { icaoId: id, obsTime: Math.round(t / 1000), rawOb, clouds: [] };
  let m;
  if ((m = / (\d{3}|VRB)(\d{2})(?:G(\d{2}))?KT /.exec(b))) { o.wdir = m[1] === "VRB" ? "VRB" : +m[1]; o.wspd = +m[2]; if (m[3]) o.wgst = +m[3]; }
  if (/ CAVOK /.test(b)) o.visib = "6+"; else if ((m = /KT (?:\d{3}V\d{3} )?(\d{4}) /.exec(b))) o.visib = +m[1] >= 9999 ? "6+" : +(+m[1] / 1609.344).toFixed(2);
  const re = / (FEW|SCT|BKN|OVC|VV)(\d{3})/g; let x; while ((x = re.exec(b))) o.clouds.push({ cover: x[1] === "VV" ? "OVX" : x[1], base: +x[2] * 100 });
  if ((m = / (M?\d{2})\/(M?\d{2}) /.exec(b))) { o.temp = +m[1].replace("M", "-"); o.dewp = +m[2].replace("M", "-"); }
  if ((m = / Q(\d{4}) /.exec(b))) o.altim = +m[1];
  return o;
}

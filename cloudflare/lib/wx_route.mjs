// /api/metar and /api/taf on Cloudflare: same JSON array as netlify/functions/wx.mjs, but served from the shared snapshot
// (the companion Worker already applies the 2 h METAR / 6 h TAF last-good limits). If the snapshot has nothing, one live
// server-side fetch is tried (never from the browser), with no storage write.
import { readSnap } from "./snap_read.mjs";
import { awcUrls, mergeAwc, parseAwc } from "../../netlify/lib/wx_awc.mjs";
// pilot-safety P0-1 (13 Nov 2026): bbox + every listed ICAO by id (the bbox reply misses stations such as FALA / FAWB).
const J = (body, status, h = {}) => new Response(body, { status, headers: { "Content-Type": "application/json", ...h } });
export async function wxRoute(kind, request, env) {
  const s = await readSnap(env);
  if (s) {
    let rows = s.part(kind), at = s.meta[kind + "At"] || null;
    if (rows == null) { const f = s.full(); rows = JSON.stringify((f[kind] && f[kind].rows) || []); at = f[kind] && f[kind].fetchedAt; }
    if (rows && rows !== "[]") {
      return J(rows, 200, { "Cache-Control": "public, max-age=60", "X-WX-Source": "snapshot", ...(at ? { "X-WX-Updated": at } : {}) });
    }
  }
  const one = async (u) => {
    try { const r = await fetch(u, { headers: { "User-Agent": "GoAround-cloudflare/1.0" }, signal: AbortSignal.timeout(6000) });
      return r.ok ? parseAwc(await r.text()) : null; } catch (e) { console.warn("wx_route " + kind + " live fetch failed", String(e && e.message || e).slice(0, 120)); return null; }
  };
  const got = await Promise.all(awcUrls(kind).map(async (u) => (await one(u)) || one(u)));   // one retry per URL (AWC 502s)
  const rows = mergeAwc(kind, got.filter(Array.isArray));
  if (rows.length) return J(JSON.stringify(rows), 200, { "Cache-Control": "public, max-age=60", "X-WX-Source": "live" });
  return J('{"error":"upstream failed"}', 502, { "Cache-Control": "no-store" });
}

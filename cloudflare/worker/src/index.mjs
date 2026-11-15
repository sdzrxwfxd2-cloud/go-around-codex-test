// go-around-weather: the companion Worker for the Cloudflare Pages copy of Go Around (feat/cloudflare-pages, 7 Nov 2026).
// Cron Trigger every 10 min runs the SAME tick as netlify/functions/weather-snapshot-tick.mjs (netlify/lib/wx_snapshot.mjs):
// persisted due times METAR 20 min / TAF 40 min / model 80-min target, free Open-Meteo budget (9,500 weighted calls/day,
// one request of <= 100 locations per tick, <= 110/min vs the 600/min limit), 429 cool-down ladder, 90-min fresh guard,
// last-good kept. Storage: Workers KV instead of Netlify Blobs, 2 writes per tick (see cloudflare/lib/kv_bundle.mjs).
// Paid Open-Meteo later: `wrangler secret put OPEN_METEO_KEY` (never in the repo) switches to customer-api and 3 requests/tick.
import { tick, windowDue, sastHM } from "../../../netlify/lib/wx_snapshot.mjs";
import { bundleStore, flush, KV_KEYS } from "../../lib/kv_bundle.mjs";
import { fastCompose } from "../../lib/fast_compose.mjs";

/* 15 Nov 2026 (MT 14:23 SAST): 1-minute cron with fetch windows (netlify/lib/wx_snapshot.mjs windowDue).
   - every 10 min (:00 :10 ... :50): the full tick as before (METAR + TAF + model), work + snapshot + now = 3 KV writes, so
     the wx-now file the CURRENT live pages read is never older than 10 min (they drop it after 15);
   - the other minutes: METAR and/or TAF only when their window asks, and KV is written (snapshot + now = 2 writes) ONLY when
     a report changed: the signature of the served rows is kept in the snapshot's KV metadata (sig);
   - a daily write guard (metadata wd/wn, UTC day) keeps the 10-min writes left today in reserve and stops minute writes at
     WRITE_CAP, so the free plan's 1,000 writes/day is never reached. */
export const WRITE_CAP = 990;
export const BEAT_WRITES = 3;
const day = (t) => new Date(t).toISOString().slice(0, 10);

export async function runTick(env, opts = {}) {
  const now = opts.now ? opts.now() : Date.now(), { m } = sastHM(now), beat = opts.beat != null ? opts.beat : m % 10 === 0;
  const want = beat ? ["metar", "taf"] : ["metar", "taf"].filter((k) => windowDue(k, now));
  if (!want.length) return { ran: false, why: "no fetch this minute" };
  const g = await env.WX.getWithMetadata(KV_KEYS.snapshot, { type: "stream" }).catch(() => null);
  if (g && g.value) await g.value.cancel();
  const meta = (g && g.metadata) || {}, sig0 = meta.sig || {};
  const today = day(now), dayStart = Date.parse(today + "T00:00:00Z");
  /* writes so far today: from the metadata; a snapshot written by the previous Worker (no wd yet) is counted as its
     3 writes per 10-min tick since 00:00 UTC, so the first day after the deploy stays under the limit too */
  const wn = meta.wd === today ? +meta.wn || 0 : meta.wd ? 0 : Math.ceil((now - dayStart) / 600e3) * BEAT_WRITES;
  const beatsLeft = Math.floor((Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + 1) - now - 1) / 600e3);
  const s = bundleStore(await env.WX.get(KV_KEYS.work, "text"));
  let last = null;
  const r = await tick(s, { key: env.OPEN_METEO_KEY || "", seed: false, compose: (...a) => (last = fastCompose(...a)), want, noModel: !beat, now: () => now, ...opts.tickOpts });
  const changed = want.filter((k) => r.sig && r.sig[k] !== sig0[k]);
  let writes = 0, why = "";
  if (beat || changed.length) {
    if (!beat && wn + 2 + beatsLeft * BEAT_WRITES > WRITE_CAP) why = "daily write guard";
    else {
      const extra = last && last.off ? { off: last.off, metarAt: last.metarAt, tafAt: last.tafAt } : { slow: true };
      extra.sig = r.sig; extra.wd = today; extra.wn = wn + (beat ? BEAT_WRITES : 2);
      writes = await flush(env.WX, s, extra, last && last.now, { work: beat });
    }
  } else why = "no report changed";
  console.log(JSON.stringify({ job: "go-around-weather", minute: m, beat, want, changed, kvWrites: writes, writesToday: wn + writes, ...(why ? { skip: why } : {}), ...r.log }));
  return { ...r, writes, changed, why };
}

export default {
  async scheduled(controller, env, ctx) { await runTick(env, { now: () => controller.scheduledTime || Date.now() }); },
  // No public trigger: a manual refresh from a browser could burn the free Open-Meteo quota. Status only.
  async fetch(req, env) {
    const g = await env.WX.getWithMetadata(KV_KEYS.snapshot, { type: "stream" });
    if (g.value) await g.value.cancel();
    return new Response(JSON.stringify({ worker: "go-around-weather", snapshotComposedAt: (g.metadata && g.metadata.composedAt) || null }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  },
};

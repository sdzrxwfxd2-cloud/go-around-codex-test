// baked_purge: no weather is baked into the site, and old weather is purged from WMST before anyone reads it.
// Pilot-safety P0-2, 13 Nov 2026 (FALA / FAWB showed GO from the TAF baked into wst-data.js on 21 Oct).
import test from "node:test";
import assert from "node:assert/strict";
import { page, src } from "./harness.mjs";

const U = (d, h, m = 0) => Date.UTC(2026, 10, d, h, m);
function common(now) {
  const w = page({ now });
  w.load("wst/wst-data.js"); w.load("wst/wst-engine.js"); w.load("engine/ga-core-v2.js"); w.load("engine/ga-core-v2-wire.js"); w.load("wst/wst-common.js");
  return w;
}

test("wst-data.js (and its /c copy) carry the 65 aerodromes but no METAR, TAF or model weather", () => {
  for (const p of ["wst/wst-data.js", "c/wst/wst-data.js"]) {
    const w = page(); w.load(p);
    assert.equal(w.WMST.ads.length, 65, p);
    assert.deepEqual([Object.keys(w.WMST.metar).length, Object.keys(w.WMST.taf).length, Object.keys(w.WMST.om).length], [0, 0, 0], p + " baked weather");
  }
});

test("wst-cards-data.js: no baked METAR / TAF text, weather values, verdicts or flight-category chips", () => {
  const w = page(); w.load("wst/wst-cards-data.js");
  const H = w.WM_CARD_HTML.join("");
  assert.equal(w.WM_CARD_HTML.length, 582);
  assert.doesNotMatch(H, /<span class="mono">(METAR|SPECI|TAF) /, "raw reports");
  assert.doesNotMatch(H, /Wind <b class="num">[^—<]/, "wind values");
  assert.doesNotMatch(H, /QNH <b class="num">\d/, "QNH values");
  assert.doesNotMatch(H, /class="temp">\d/, "temperatures");
  assert.doesNotMatch(H, /data-s="(go|caution|nogo)"/, "verdicts");
  assert.doesNotMatch(H, /<span class="badge">(GO|CAUTION|NO-GO)</, "badges");
  assert.doesNotMatch(H, /data-wx='\{/, "card wx snapshot");
});

test("purge(): METAR > 3 h, TAF not valid now and model current > 180 min are removed; fresh data stays", () => {
  const now = U(13, 14), w = common(now), S = w.WMST;
  S.metar.FAOR = { icaoId: "FAOR", obsTime: (now - 30 * 6e4) / 1e3 };
  S.metar.FALA = { icaoId: "FALA", obsTime: (now - 3.5 * 3600e3) / 1e3 };
  S.taf.FAOR = "TAF FAOR 131100Z 1312/1418 CAVOK";
  S.taf.FALA = "TAF FALA 211100Z 2112/2218 34008KT CAVOK";
  S.om.FAOR = { current: { time: "2026-11-13T13:45" } };
  S.om.FALA = { current: { time: "2026-11-13T10:30" } };
  const gone = w.WSTC.purge(now);
  assert.deepEqual(Object.keys(S.metar), ["FAOR"]);
  assert.deepEqual(Object.keys(S.taf), ["FAOR"]);
  assert.deepEqual(Object.keys(S.om), ["FAOR"]);
  assert.equal(gone.length, 3);
  assert.match(w.attrs["data-wx-stale"] || "", /removed stale weather/);
  assert.ok(w.warns.some((x) => /removed stale weather/.test(x)), "console.warn, not silent");
});

test("purge runs before every 'wst:data' listener (window, capture phase) and on each status pass", () => {
  const now = U(13, 14), w = common(now);
  assert.ok(w.listeners.some((l) => l.on === "window" && l.t === "wst:data" && l.c === true), "window capture listener");
  w.WMST.taf.FALA = "TAF FALA 211100Z 2112/2218 34008KT CAVOK";
  w.WSTC.all();
  assert.equal(w.WMST.taf.FALA, undefined, "all() purges first");
  assert.match(src("wst/wst-common.js"), /C\.purge&&C\.purge\(\);document\.dispatchEvent\(new Event\('wst:data'\)\)/, "live() purges before it dispatches");
});

test("the clock moving on purges data that was fresh at load", () => {
  const now = U(13, 14), w = common(now);
  w.WMST.metar.FAOR = { icaoId: "FAOR", obsTime: (now - 30 * 6e4) / 1e3 };
  w.WSTC.purge(now); assert.ok(w.WMST.metar.FAOR);
  w.setNow(now + 3 * 3600e3); w.WSTC.purge();
  assert.equal(w.WMST.metar.FAOR, undefined);
});

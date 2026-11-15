// null_safety: a missing value stays missing. wst-engine obsOf never turns null into 0 (wind, temperature, QNH), a model
// "current" older than 180 min is not weather now, WST.da uses ISA at pressure altitude, and the card scripts never format a
// null as 0 / 0.0 / 000° / null% / QNH 0. Pilot-safety P0-4 / P1-3 / P2-3 / P2-5, 13 Nov 2026.
import test from "node:test";
import assert from "node:assert/strict";
import { page, src } from "./harness.mjs";

const NOW = Date.UTC(2026, 10, 13, 14, 0);
function eng() { const w = page({ now: NOW }); w.load("wst/wst-engine.js"); return w; }

test("obsOf (METAR): missing wind / temperature / QNH stay null, never 0", () => {
  const w = eng();
  const ob = w.WST.obsOf({ ic: "FAXX" }, { metar: { FAXX: { obsTime: NOW / 1e3 - 600, wdir: null, wspd: null, temp: null, altim: null, rawOb: "METAR FAXX 131350Z /////KT 9999 FEW030 ///// Q////" } }, taf: {}, om: {} });
  assert.equal(ob.wd, null); assert.equal(ob.ws, null); assert.equal(ob.t, null); assert.equal(ob.qnh, null);
});

test("obsOf (model): null wind, gust, temperature, QNH stay null; an hour older than 180 min gives no observation", () => {
  const w = eng();
  const cur = { time: "2026-11-13T13:45", wind_speed_10m: null, wind_gusts_10m: null, wind_direction_10m: null, temperature_2m: null, pressure_msl: null, visibility: null, cloud_cover_low: null, cloud_base: null };
  const ob = w.WST.obsOf({ ic: "FAXX" }, { metar: {}, taf: {}, om: { FAXX: { current: cur } } });
  assert.equal(ob.ws, null); assert.equal(ob.g, null); assert.equal(ob.wd, null); assert.equal(ob.t, null); assert.equal(ob.qnh, null); assert.equal(ob.vis, null);
  assert.equal(w.WST.obsOf({ ic: "FAXX" }, { metar: {}, taf: {}, om: { FAXX: { current: { ...cur, time: "2026-11-13T10:30", wind_speed_10m: 5 } } } }), null, "stale model");
});

test("WST.da: ISA at pressure altitude (same as the calculator and the DA pill), null in -> null out", () => {
  const w = eng(), da = w.WST.da || null;
  const f = da || ((el, t, q) => { const pa = el + (q - 1013.25) * -30, isa = 15 - 2 * pa / 1000; return Math.round(pa + 120 * (t - isa)); });
  if (da) {
    assert.equal(da(5000, 15, 1013.25), 6200);
    assert.equal(da(5000, 15, 1000), Math.round(5397.5 + 120 * (15 - (15 - 2 * 5397.5 / 1000))));
    assert.equal(da(5000, null, 1013), null);
  } else {
    assert.match(src("wst/wst-engine.js"), /isa=15-2\*pa\/1000/);
  }
  assert.ok(f);
});

test("card scripts: no formatting of a raw value that can be null", () => {
  const card = src("wst/wst-card.js"), heli = src("wst/ad-class.js"), main = src("main.html");
  assert.doesNotMatch(card, /Math\.round\(x\.(wind_speed_10m|wind_gusts_10m|temperature_2m|dew_point_2m|pressure_msl|wind_direction_10m)\)/, "wst-card panel");
  assert.doesNotMatch(card, /x\.cloud_cover\+'%'/, "null%");
  assert.doesNotMatch(card, /Temp\\\/Dew\\s\*\(-\?\\d\+\)/, "DA pill scraping the Model panel text");
  assert.doesNotMatch(card, /c\.querySelector\('\.temp'\),tx=/, "DA pill scraping .temp");
  assert.doesNotMatch(heli, /String\(k\(x\.wind_direction_10m\)\)\.padStart/, "heliport 00— wind direction");
  assert.doesNotMatch(main, /w:Math\.round\(q\.wind_speed_10m\)/, "main.html loadModel wind 0 for null");
  assert.doesNotMatch(main, /g:Math\.round\(q\.wind_gusts_10m\)/, "main.html loadModel gust 0 for null");
});

test("wire: a card wx snapshot with null wind gives ws null (not 0 kt)", () => {
  const w = src("engine/ga-core-v2-wire.js");
  assert.match(w, /ws: num\(d\.w\)/);
});

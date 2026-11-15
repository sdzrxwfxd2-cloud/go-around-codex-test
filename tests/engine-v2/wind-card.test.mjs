// tests/engine-v2/wind-card.test.mjs — MT wind rule (13 Nov 2026): the card wind row shows the wind the verdict used;
// source labels live in the i note, not after Wind. Unknown wind is "—", never "undefined°", "000°" or a fake "Calm".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), "utf8");
function page() {
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
    dispatchEvent() {}, documentElement: { classList: { add() {}, remove() {}, contains: () => false } }, readyState: "complete", body: {} };
  const win = { document, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, console, Date, Math, JSON, Promise, setTimeout, clearTimeout,
    queueMicrotask, performance: { now: () => 0, mark() {}, measure() {} }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    CustomEvent: function () {} };
  win.window = win; win.self = win; win.globalThis = win; win.location = { search: "", pathname: "/main.html", href: "http://x/main.html" };
  win.fetch = () => new Promise(() => {}); win.setInterval = () => 0; win.clearInterval = () => {}; win.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; };
  vm.createContext(win);
  vm.runInContext(src("site/wst/wst-engine.js"), win);
  vm.runInContext(src("site/engine/ga-core-v2.js"), win);
  vm.runInContext(src("site/engine/ga-core-v2-wire.js"), win);
  return win;
}

test("wind text: real values, VRB, calm, and '—' for unknown (never undefined° / 000° / fake Calm)", () => {
  const W = page().GA_WIND_TEXT;
  assert.equal(W({ wd: 250, ws: 20, g: null }), "250° 20 kt");
  assert.equal(W({ wd: 5, ws: 12, g: 24 }), "005° 12 kt G24");
  assert.equal(W({ vrb: true, wd: null, ws: 3 }), "VRB 3 kt");
  assert.equal(W({ wd: 0, ws: 0 }), "Calm");
  assert.equal(W({ wd: null, ws: 7 }), "—° 7 kt");
  assert.equal(W({ wd: null, ws: null }), "—");
  assert.equal(W(null), "—");
  for (const u of [{}, { wd: undefined, ws: undefined }, { wd: null, ws: null }]) assert.doesNotMatch(W(u), /undefined|null|000°|Calm/);
});

test("card row: painted from the verdict's wind — no source tag, unknown is '—'", () => {
  const win = page();
  const span = { textContent: "Wind —", innerHTML: 'Wind <b class="num">—</b>', attrs: { "data-ad-empty": "" },
    hasAttribute(a) { return a in this.attrs; }, removeAttribute(a) { delete this.attrs[a]; } };
  Object.defineProperty(span, "innerHTML", { get() { return this._h; }, set(v) { this._h = v; this.textContent = v.replace(/<[^>]+>/g, ""); } });
  span.innerHTML = 'Wind <b class="num">—</b>';
  const icao = { textContent: "FACT" };
  const card = { querySelector: (q) => (q === ".icao" ? icao : null), querySelectorAll: (q) => (q === ".wxd span" ? [span] : []), dataset: {} };
  const NOW = Date.UTC(2026, 10, 13, 10, 0);
  const p2 = (n) => String(n).padStart(2, "0");
  const res = win.GACoreV2.evaluate({ field: { icao: "FACT", lat: -33.965, lon: 18.602, elevFt: 151, runways: [{ id: "19", true: 181 }] },
    weather: { metar: { raw: "METAR FACT 130950Z AUTO /////KT 9999 NCD 22/10 Q1018", time: NOW - 10 * 6e4 },
      taf: "TAF FACT 130530Z 1306/1412 25020KT 9999 FEW030" }, profile: { licence: "ppl", night: true }, aircraftId: "C172", phase: "depart", now: NOW });
  assert.equal(res.windSource, "taf");
  win.GA_PAINT_WIND(card, res);
  assert.equal(span.innerHTML, 'Wind <b class="num">250° 20 kt</b>');
  assert.ok(!span.hasAttribute("data-ad-empty"), "the row is shown");
  const m = win.GACoreV2.evaluate({ field: { icao: "FACT", runways: [{ id: "19", true: 181 }] },
    weather: { metar: { raw: "METAR FACT 130950Z 16010KT 9999 FEW030 22/10 Q1018", time: NOW - 10 * 6e4 } }, profile: { licence: "ppl", night: true }, phase: "depart", now: NOW });
  assert.equal(m.windSource, "metar");
  win.GA_PAINT_WIND(card, m);
  assert.equal(span.innerHTML, 'Wind <b class="num">160° 10 kt</b>');
  const mod = win.GACoreV2.evaluate({ field: { icao: "FACT", runways: [{ id: "19", true: 181 }] },
    weather: { metar: { raw: "METAR FACT 130950Z AUTO /////KT 9999 NCD 22/10 Q1018", time: NOW - 10 * 6e4 },
      model: { time: NOW, fetchedAt: NOW - 20 * 6e4, wd: 250, ws: 20, g: 24, vis: 20 } }, profile: { licence: "ppl", night: true }, phase: "depart", now: NOW });
  win.GA_PAINT_WIND(card, mod);
  assert.equal(span.innerHTML, 'Wind <b class="num">250° 20 kt G24</b>');
  const none = win.GACoreV2.evaluate({ field: { icao: "FACT", runways: [{ id: "19", true: 181 }] },
    weather: { metar: { raw: "METAR FACT 130950Z AUTO /////KT 9999 NCD 22/10 Q1018", time: NOW - 10 * 6e4 } }, profile: { licence: "ppl", night: true }, phase: "depart", now: NOW });
  win.GA_PAINT_WIND(card, none);
  assert.equal(span.innerHTML, 'Wind <b class="num">—</b>');
  void card; void p2;
});

test("wst-card fillModel: model with no wind shows '—', no direction shows '—°' (both copies)", () => {
  for (const f of ["site/wst/wst-card.js", "site/c/wst/wst-card.js"]) {
    const s = src(f);
    assert.match(s, /ob\.ws==null\|\|!isFinite\(ob\.ws\)\?'—'/, f);
    assert.match(s, /ob\.wd==null\|\|!isFinite\(ob\.wd\)\?'—°'/, f);
  }
});

test("fv3 never hides the Wind row", () => {
  assert.match(src("site/fv3.js"), /if\(\/\^\\s\*Wind\\b\/\.test\(e\.textContent\)\)\{mark\(e,false\);return\}/);
});

/* 13 Nov 2026: wst-card.js / wst-main.js index the wind row's siblings by c.querySelectorAll('.wxd span')[1] (Vis · Sky).
   Source tags used to live inside the Wind span; they must not return (and must never be a <span>). */
test("paintWind does not put a METAR / TAF / Model tag on the Wind row", () => {
  const W = readFileSync(new URL("../../site/engine/ga-core-v2-wire.js", import.meta.url), "utf8");
  const f = W.slice(W.indexOf("function paintWind"), W.indexOf("window.GA_WIND_TEXT"));
  assert.ok(!/wmtag|wwtag|windTag/.test(f));
  assert.match(f, /'Wind <b class="num">' \+ windText\(u\) \+ '<\/b>'/);
});

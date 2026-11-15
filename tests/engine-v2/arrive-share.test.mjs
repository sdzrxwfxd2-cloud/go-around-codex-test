// tests/engine-v2/arrive-share.test.mjs — E-04 (13 Nov 2026): the Arrive time picked on Status reaches the aerodrome list frame.
// Status saves 'wm.arriveAt'; another frame (its own phase.js) picks it up on load and on 'storage', and fires wm:phase so the
// wire re-runs its cards for that time.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const PHASE = readFileSync(new URL("../../site/wst/phase.js", import.meta.url), "utf8");
function frame(store) {
  const winL = {}, docL = {};
  const on = (m) => (t, f) => { (m[t] = m[t] || []).push(f); };
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } });
  const document = { body: null, addEventListener: on(docL), dispatchEvent: (e) => (docL[e.type] || []).forEach((f) => f(e)),
    createElement: el, querySelector: () => null, querySelectorAll: () => [], head: { appendChild() {} }, documentElement: { appendChild() {} } };
  const win = { document, console, Date, Math, JSON, setTimeout: () => 0, clearTimeout() {}, addEventListener: on(winL),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    CustomEvent: function (t, d) { this.type = t; this.detail = d && d.detail; } };
  win.MutationObserver = function () { this.observe = () => {}; this.takeRecords = () => []; };
  win.window = win; win.WeakSet = WeakSet; win.Set = Set;
  vm.createContext(win); vm.runInContext(PHASE, win);
  const fired = []; document.addEventListener("wm:phase", (e) => fired.push(e.detail));
  return { win, fired, storage: (key) => (winL.storage || []).forEach((f) => f({ key })) };
}

test("E-04: a fresh frame reads the saved Arrive time (+2h)", () => {
  const store = { "wm.phaseMode": "land", "wm.arriveAt": JSON.stringify({ off: 2, at: null, t: Date.now() }) };
  const { win } = frame(store);
  assert.equal(win.WMPHASE.mode, "land");
  assert.equal(win.WMPHASE.arrive.off, 2);
});

test("E-04: the list frame follows a Status pick through 'storage' and re-runs (wm:phase)", () => {
  const store = { "wm.phaseMode": "land" };
  const list = frame(store);
  assert.equal(list.win.WMPHASE.arrive.off, 0);
  store["wm.arriveAt"] = JSON.stringify({ off: 3, at: null, t: Date.now() });
  list.storage("wm.arriveAt");
  assert.equal(list.win.WMPHASE.arrive.off, 3);
  assert.equal(list.fired.length, 1);
  assert.equal(list.fired[0].mode, "land");
  assert.ok(Math.abs(list.fired[0].arriveAt - (Date.now() + 3 * 36e5)) < 5000);
  store["wm.arriveAt"] = JSON.stringify({ off: 2, at: null, t: Date.now() });
  list.storage("wm.arriveAt");
  assert.equal(list.win.WMPHASE.arrive.off, 2);
  list.storage("wm.arriveAt");                                  // same value again: no extra re-run
  assert.equal(list.fired.length, 2);
});

test("E-04: an old save (over 60 min) or a time already past means Now", () => {
  assert.equal(frame({ "wm.arriveAt": JSON.stringify({ off: 3, at: null, t: Date.now() - 61 * 6e4 }) }).win.WMPHASE.arrive.off, 0);
  assert.equal(frame({ "wm.arriveAt": JSON.stringify({ off: 0, at: Date.now() - 1000, t: Date.now() }) }).win.WMPHASE.arrive.at, null);
});

/* MT t1973u (13 Nov 2026): Land arrive is Now / +1h / +2h / +3h only; the free "Pick time" chooser is gone. */
test("no custom time: a saved custom arrive time (old 'at') falls back to Now, on load and on 'storage'", () => {
  const f = frame({ "wm.phaseMode": "land", "wm.arriveAt": JSON.stringify({ off: 0, at: Date.now() + 5 * 36e5, t: Date.now() }) });
  assert.equal(f.win.WMPHASE.arrive.at, null); assert.equal(f.win.WMPHASE.arrive.off, 0);
  const store = { "wm.phaseMode": "land" }, g = frame(store);
  store["wm.arriveAt"] = JSON.stringify({ off: 1, at: null, t: Date.now() }); g.storage("wm.arriveAt");
  assert.equal(g.win.WMPHASE.arrive.off, 1);
  store["wm.arriveAt"] = JSON.stringify({ off: 0, at: Date.now() + 2 * 36e5, t: Date.now() }); g.storage("wm.arriveAt");
  assert.equal(g.win.WMPHASE.arrive.at, null); assert.equal(g.win.WMPHASE.arrive.off, 0);
});
test("no custom time: offsets are clamped to 0..3 hours (nothing beyond +3h)", () => {
  for (const [o, want] of [[5, 3], [3, 3], [-2, 0], ["x", 0], [1.4, 1]]) {
    assert.equal(frame({ "wm.arriveAt": JSON.stringify({ off: o, at: null, t: Date.now() }) }).win.WMPHASE.arrive.off, want, String(o));
  }
});
test("no custom time: phase.js has no time input or 'Pick time' control", () => {
  assert.ok(!/datetime-local|<span>Pick time|class="pk"|onchange/.test(PHASE));
  assert.match(PHASE, /data-o="0">Now<.*data-o="1">\+1h<.*data-o="2">\+2h<.*data-o="3">\+3h<\/button><\/div>/);
});

// tests/engine-v2/night-pill.test.mjs — 13 Nov 2026 (FAAE): the "Night not enabled" pill follows the engine, never the old
// WMB profile. Runs the real pill block from site/wst/wq.js against the real engine and wire profile.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const WQ = readFileSync(new URL("../../site/wst/wq.js", import.meta.url), "utf8");
const start = WQ.indexOf("(function(){const list=document.getElementById('list');if(!list)return;const ic=");
const end = WQ.indexOf("})();", start) + 5;
const PILL = WQ.slice(start, end);
const ENGINE = readFileSync(new URL("../../site/engine/ga-core-v2.js", import.meta.url), "utf8");

function run({ oldProfile, engineNight, result, when }) {
  const made = [];
  const why = { after: (e) => made.push(e) };
  const card = { querySelector: (q) => (q === ".why" ? why : q === ".wq-nn" ? null : q === ".icao" ? { textContent: "FAAE" } : q === ".cp[data-p=model]" ? { dataset: { la: "-28.43", lo: "29.07" } } : null), dataset: {} };
  const list = { querySelectorAll: () => [card] };
  const ctx = { console, Date: class extends Date { static now() { return when; } }, Math, JSON, Number, setInterval: () => 0, requestAnimationFrame: () => 0,
    MutationObserver: function () { this.observe = () => {}; } };
  ctx.window = ctx;
  ctx.document = { getElementById: (id) => (id === "list" ? list : null), createElement: () => ({ className: "", innerHTML: "" }), addEventListener() {}, hidden: false };
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx);
  ctx.WST = { sunInfo: () => ({ isNight: true }) };
  ctx.WMB = { prof: () => oldProfile, results: result ? { FAAE: { r: { v2: result } } } : {} };
  ctx.GA_ENGINE_PROFILE = () => ({ profile: { night: engineNight }, rules: "vfr" });
  vm.runInContext(PILL, ctx);
  return made.length > 0;
}
const NIGHT = Date.UTC(2026, 10, 13, 0, 0);   // 02:00 SAST, dark at FAAE
const DAY = Date.UTC(2026, 10, 13, 10, 0);

test("engine profile night ON, old profile night OFF: no pill (FAAE case)", () => {
  assert.equal(run({ oldProfile: { night: false, licence: "ppl" }, engineNight: true, result: { status: "caution", findings: [{ ruleId: "POL-MODEL-BORDERLINE" }] }, when: NIGHT }), false);
});
test("engine verdict has POL-NIGHT-UNSELECTED: pill shown even if the old profile says night on", () => {
  assert.equal(run({ oldProfile: { night: true }, engineNight: false, result: { status: "nogo", findings: [{ ruleId: "POL-NIGHT-UNSELECTED" }] }, when: NIGHT }), true);
});
test("no engine verdict (incomplete): engine profile + engine sun decide", () => {
  assert.equal(run({ oldProfile: { night: true }, engineNight: false, result: { status: "incomplete", findings: [] }, when: NIGHT }), true);
  assert.equal(run({ oldProfile: { night: false }, engineNight: false, result: null, when: DAY }), false);
  assert.equal(run({ oldProfile: { night: false }, engineNight: true, result: null, when: NIGHT }), false);
});

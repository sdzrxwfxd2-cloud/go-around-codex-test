// tests/engine-v2/summary-labels.test.mjs — Status "Most CAUTION / Most NO-GO" uses plain words for every engine v2 key
// (13 Nov 2026: "Low" read as nothing; it is "low cloud"). Runs the real site/wm-core.js summarize().
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, document: { addEventListener() {} }, console };
ctx.globalThis = ctx; ctx.self = ctx.window; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../../site/wm-core.js", import.meta.url), "utf8"), ctx);
const K = ctx.window.WMCore || ctx.WMCore || Object.values(ctx.window).find((x) => x && x.summarize);
const KEYS = ["vis", "ceil", "low", "xw", "vrb", "tw", "ws", "g", "wind", "cnr", "wx", "trend", "night", "age", "iap", "rating", "acx", "da", "nil", "model", "nodata"];

test("every engine key has a plain-words label (no raw keys like 'low', 'ws', 'g')", () => {
  for (const k of KEYS) {
    const s = K.summarize([{ status: "caution", reasons: [{ check: k }] }]);
    const r = s.main.caution[0].reason;
    if (k !== "night" && k !== "rating") assert.notEqual(r, k, "raw key shown for " + k); // "night", "rating" are already words
    assert.ok(r.length >= 5, k + " -> " + r);
  }
  assert.equal(K.summarize([{ status: "caution", reasons: [{ check: "low" }] }]).main.caution[0].reason, "low cloud");
  assert.equal(K.summarize([{ status: "nogo", reasons: [{ check: "ws" }] }]).main.nogo[0].reason, "strong wind");
  assert.equal(K.summarize([{ status: "nogo", reasons: [{ check: "g" }] }]).main.nogo[0].reason, "gusty wind");
});

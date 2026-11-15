// /api/wx-now "now" file (13 Nov 2026, MT t2863u): the DA pill trend needs the model temperature of the hour AFTER the clock hour.
// The file is composed for hour hc and stays in use until the next 10-minute tick, so at hc+1 the card reads row[1] as now and
// row[2] as next. With hours=2 row[2] was missing and the trend vanished at the top of every hour. Composer: cloudflare/lib/fast_compose.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { build, modelValue } from "../../tools/engine-bench/fixtures.mjs";
const H = 3600e3;
function file(now) { const fx = build(now); return { fx, n: JSON.parse(fx.wxNow) }; }
// the same reading wm-model.js fromNow() + tAt() does: row j*NH + h, null past the packed hours
function temp(n, i, h) { const NH = n.hours || 2, j = n.vars.indexOf("temperature_2m"); return h >= 0 && h < NH ? n.c[i][j * NH + h] : null; }

test("now file packs 3 model hours (current + next two) and 5 FZL hours", () => {
  const { n } = file(Date.UTC(2026, 10, 13, 14, 55));
  assert.equal(n.hours, 3); assert.equal(n.fzlHours, 5);
  assert.equal(n.t0, "2026-11-13T14:00");
  n.c.forEach((row) => assert.equal(row.length, n.vars.length * 3));
  n.fzl.forEach((row) => assert.equal(row.length, 5));
});

test("DA trend inputs exist in BOTH the composed hour (h=0) and after the top of the hour, before the next tick (h=1)", () => {
  const now = Date.UTC(2026, 10, 13, 14, 55), { fx, n } = file(now);
  const base = Math.round((Date.parse(n.t0 + "Z") - fx.t0) / H);   // fixture hour step of t0 (fixtures start one hour before now)
  let checked = 0;
  for (let i = 0; i < n.pts.length; i++) {
    const id = n.pts[i][0], k = fx.points.findIndex((p) => p[0] === id); if (k < 0) continue;
    for (const h of [0, 1]) {
      const t = temp(n, i, h), tNext = temp(n, i, h + 1);
      assert.notEqual(t, null, id + " h=" + h + " t"); assert.notEqual(tNext, null, id + " h=" + h + " tNext");
      assert.equal(t, modelValue("temperature_2m", k, base + h)); assert.equal(tNext, modelValue("temperature_2m", k, base + h + 1));
    }
    checked++;
  }
  assert.ok(checked >= 600, "checked " + checked + " points");
});

test("an old 2-hour file still reads (no crash, trend only at h=0)", () => {
  const n = { hours: 2, vars: ["temperature_2m"], c: [[20, 21]] };
  assert.equal(temp(n, 0, 0), 20); assert.equal(temp(n, 0, 1), 21); assert.equal(temp(n, 0, 2), null);
});

test("now file stays small (KV value + phone download)", () => {
  const { fx } = file(Date.UTC(2026, 10, 13, 14, 55));
  assert.ok(fx.wxNow.length < 260_000, "now file " + fx.wxNow.length + " B");
});

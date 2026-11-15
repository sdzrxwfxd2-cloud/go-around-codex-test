// tests/engine-v2/wind-display.test.mjs — E-03 (13 Nov 2026). A METAR with no wind group (/////KT, NIL) must never show
// "undefined°" or a made-up "0 kt" on a card. Checks every page and script under site/ for the old formatter, and runs the
// new card formatter on the edge cases.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SITE = new URL("../../site/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "node_modules" ? [] : walk(p)) : /\.(html|js)$/.test(n) ? [p] : []; });

// The single-aerodrome pages (site/ad/*.html) and fact.html are generated outside this repo; their own formatter
// (set('Wind', ...)) has the same fault. Fix it in that generator (ENGINE-REPORT.md, E-03b). Until then they are listed here.
const GENERATED = (f) => /^(c\/)?ad\//.test(f) || f === "fact.html";
test("E-03: no list or status page, and no script, under site/ formats a METAR wind with String(m.wdir).padStart", () => {
  const bad = walk(SITE).map((f) => f.slice(SITE.length)).filter((f) => !GENERATED(f) && readFileSync(join(SITE, f), "utf8").includes("String(m.wdir).padStart(3,'0')"));
  assert.deepEqual(bad, []);
});
test.todo("E-03b: the generated aerodrome pages (site/ad, site/c/ad, fact.html) still print 'undefined°' — fix in their generator");

test("E-03: the card formatter shows '—' for no wind group, VRB, calm and gusts correctly", () => {
  const src = readFileSync(join(SITE, "main.html"), "utf8");
  const i = src.indexOf("/* E-03 (13 Nov 2026): no wind group");
  assert.ok(i > 0, "the fixed formatter is in main.html");
  const body = src.slice(src.indexOf("if(sp[0]){", i), src.indexOf("</b>'}", i) + 6);
  const run = (m) => { const sp = [{ innerHTML: "" }]; new Function("m", "sp", body)(m, sp); return sp[0].innerHTML.replace(/<[^>]+>/g, ""); };
  assert.equal(run({}), "Wind —", "/////KT: nothing reported");
  assert.equal(run({ wdir: null, wspd: null }), "Wind —");
  assert.equal(run({ wdir: 240, wspd: 12, wgst: 25 }), "Wind 240° 12 kt G25");
  assert.equal(run({ wdir: "VRB", wspd: 3 }), "Wind VRB 3 kt");
  assert.equal(run({ wdir: 0, wspd: 0 }), "Wind 000° 0 kt", "00000KT stays calm, as reported");
  assert.equal(run({ wspd: 8 }), "Wind —° 8 kt", "speed without direction keeps the speed");
});

// International filter + INTL stat must be exactly the official SARS/DoT 10.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
function load(p) {
  const ctx = { window: {} };
  vm.runInContext(read(p), vm.createContext(ctx));
  return ctx.window;
}

// Official SARS / Department of Transport international airports.
export const OFFICIAL_INTL = ["FAOR", "FACT", "FALE", "FALA", "FAKN", "FABL", "FAPE", "FAPP", "FAPN", "FAUP"];

test("data-cat international and the INTL stat are exactly the official SARS/DoT 10", () => {
  const pub = load("site/wst/wst-cards-data.js").WM_CARD_HTML;
  const intl = [];
  for (const h of pub) {
    const cat = (h.match(/data-cat="([^"]*)"/) || [])[1];
    const icao = (h.match(/class="icao">([^<]+)/) || [])[1];
    assert.ok(icao, "card missing icao");
    if (cat === "international") intl.push(icao);
  }
  assert.deepEqual([...intl].sort(), [...OFFICIAL_INTL].sort());
  assert.equal(intl.length, 10);

  const S = load("site/wst/wm-public-stats.js").WM_PUBLIC_STATS;
  assert.equal(S.international, 10);

  const main = read("site/main.html");
  const status = read("site/status_demo.html");
  const tile = /data-c="International"[^>]*>\s*<span class="n">10<\/span>/;
  assert.match(main, tile);
  assert.match(status, tile);

  // Filter must use exclusive data-cat, not type=major (FAEL/FAGG/FAKM are controlled majors).
  const fv3 = read("site/fv3.js");
  assert.equal(
    /international['"]\s*&&[\s\S]{0,80}major/.test(fv3),
    false,
    "fv3 still treats type=major as International"
  );
  assert.match(fv3, /ctcnt=v=>baseC\(\)\.filter\(c=>c\.dataset\.cat===v\)\.length/);
  assert.match(main, /c\.dataset\.cat!==cf/);
});

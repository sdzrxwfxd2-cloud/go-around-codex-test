// Public list no longer includes the 58 closed cards; the records are kept; stats come from real data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
function load(p) {
  const ctx = { window: {} };
  vm.runInContext(read(p), vm.createContext(ctx));
  return ctx.window;
}
function icaos(arr) {
  return arr.map((h) => {
    const m = h.match(/class="icao">([^<]+)/);
    assert.ok(m, "card missing icao");
    return m[1].trim();
  });
}

test("closed cards are out of the public list and kept in the closed file", () => {
  const pub = load("site/wst/wst-cards-data.js").WM_CARD_HTML;
  const cl = load("site/wst/wst-cards-closed.js");
  const closedHtml = cl.WM_CARD_HTML_CLOSED;
  const closedIds = cl.WM_CLOSED_IDENTS;
  assert.equal(pub.length, 582);
  assert.equal(closedHtml.length, 58);
  assert.equal(closedIds.length, 58);
  const pIds = icaos(pub);
  const cIds = icaos(closedHtml);
  assert.deepEqual([...cIds].sort(), [...closedIds].sort());
  assert.equal(new Set(pIds).size, 582);
  assert.equal(new Set(cIds).size, 58);
  for (const id of cIds) assert.equal(pIds.includes(id), false, id + " still in the public list");
  const union = new Set([...pIds, ...cIds]);
  assert.equal(union.size, 640, "nothing lost: public + closed = the previous 640");
  const doc = path.join(root, "docs/closed-aerodromes-15nov/closed-aerodromes.json");
  assert.ok(existsSync(doc));
  const recs = JSON.parse(readFileSync(doc, "utf8"));
  assert.equal(recs.count, 58);
  assert.deepEqual([...recs.records.map((r) => r.ident)].sort(), [...cIds].sort());
  // not loaded by public pages
  const main = read("site/main.html");
  const status = read("site/status_demo.html");
  assert.equal(main.includes("wst-cards-closed.js"), false);
  assert.equal(status.includes("wst-cards-closed.js"), false);
});

test("WM_PUBLIC_STATS matches the live card list and Valid ATO/DFE records", () => {
  const chk = spawnSync(process.execPath, [path.join(root, "tools/wm-public-stats.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(chk.status, 0, chk.stderr || chk.stdout);
  const S = load("site/wst/wm-public-stats.js").WM_PUBLIC_STATS;
  assert.equal(S.airports, 582);
  assert.equal(S.international, 10);
  assert.equal(S.controlled, 23);
  assert.equal(S.uncontrolled, 497);
  assert.equal(S.heliport_or_other, 52);
  assert.equal(S.airports, S.international + S.controlled + S.uncontrolled + S.heliport_or_other);
  assert.equal(S.ato, 271);
  assert.equal(S.atoWithDto, 271);
  assert.equal(S.atoAll, 299);
  assert.equal(S.dfe, 126);
  assert.equal(S.dfeValidRows, 134);
  assert.equal(S.dfeListed, 219);
  assert.equal(S.dfeAll, 234);
  assert.equal(S.atoSub, "271 with DTOs · 299 listed");
  assert.equal(S.dfeSub, "134 valid rows");
  const main = read("site/main.html");
  assert.match(main, /<span class="n">582<\/span><span class="k"><span class="d"><\/span>AIRPORTS<\/span>/);
  assert.match(main, /<span class="n">10<\/span><span class="k"><span class="d"><\/span>INTL<\/span>/);
  assert.match(main, /<span class="n">23<\/span><span class="k"><span class="d"><\/span>CTRL<\/span>/);
  assert.match(main, /<span class="n">497<\/span><span class="k"><span class="d"><\/span>UNCTRL<\/span>/);
  assert.match(main, /<span class="n">271<\/span><span class="k"><span class="d"><\/span>ATO\/DTO<\/span><\/button>/);
  assert.match(main, /<span class="n">126<\/span><span class="k"><span class="d"><\/span>DFE<\/span><\/button>/);
  assert.equal(main.includes('class="s2"'), false);
  assert.equal(main.includes(".a1stats .st .s2{"), false);
  assert.match(read("site/fv3.js"), /WM_PUBLIC_STATS:begin/);
  assert.match(main, /fv3\.js\?v=/);
  assert.equal(main.includes("wm-public-stats.js"), false);
  assert.equal(main.includes("wm-stats-box.js"), false);
});

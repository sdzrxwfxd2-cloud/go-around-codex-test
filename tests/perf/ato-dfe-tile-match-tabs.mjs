// Main-page ATO/DFE tiles must show the same default counts as the ATO and DFE tabs.
// Counts are computed from the data with the tab rules (no hard-coded tile numbers).
// The three "Pexo Test Three Cm Person" rows stay in the data; they are hidden from the count, not deleted.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { atoDfeCounts, isDto, isValidStatus, HIDE_DFE } from "../../tools/ato-dfe-counts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
function load(p) {
  const ctx = { window: {} };
  vm.runInContext(read(p), vm.createContext(ctx));
  return ctx.window;
}
function parseJsonArray(text, key) {
  const i = text.indexOf('"' + key + '": [');
  assert.ok(i >= 0, "no " + key);
  const start = text.indexOf("[", i);
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, j + 1));
    }
  }
  assert.fail("unterminated " + key);
}

// Independent recount of the tab defaults, written here so a bug in the shared
// module still fails this test.
function tabAtoDefault(atos) {
  // New tab default: valid ATO and DTO (Include DTO is on).
  return atos.filter((a) => /^valid/i.test(String(a.status || ""))).length;
}
function tabDfeDefault(dfes) {
  const hide = "pexo test three cm person";
  const M = new Map();
  for (const d of dfes) {
    const k = String(d.name || "").trim().toLowerCase();
    if (!M.has(k)) M.set(k, false);
    if (/^valid/i.test(String(d.status || ""))) M.set(k, true);
  }
  let n = 0;
  for (const [k, ok] of M) if (ok && k !== hide) n++;
  return n;
}

test("main ATO/DFE tile numbers equal the ATO and DFE tab default counts", () => {
  const app = read("site/c/appdata/app-data.51cdd70f78.js");
  const atos = parseJsonArray(app, "atos");
  const dfes = parseJsonArray(app, "dfes");

  const pexo = dfes.filter((d) => HIDE_DFE.has(String(d.name || "").trim().toLowerCase()));
  assert.equal(pexo.length, 3, "the three Pexo test rows must stay in the data");
  assert.ok(pexo.every((d) => /^valid/i.test(d.status)));

  const atoDefault = tabAtoDefault(atos);
  const dfeDefault = tabDfeDefault(dfes);
  const counts = atoDfeCounts(atos, dfes);
  assert.equal(counts.ato, atoDefault, "shared ATO count must match the tab default rule");
  assert.equal(counts.dfe, dfeDefault, "shared DFE count must match the tab default rule");

  const chk = spawnSync(process.execPath, [path.join(root, "tools/wm-public-stats.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(chk.status, 0, chk.stderr || chk.stdout);

  const S = load("site/wst/wm-public-stats.js").WM_PUBLIC_STATS;
  assert.equal(S.ato, atoDefault);
  assert.equal(S.dfe, dfeDefault);
  assert.equal(S.atoWithDto, counts.atoWithDto);
  assert.equal(S.atoAll, counts.atoAll);
  assert.equal(S.dfeValidRows, counts.dfeValidRows);
  assert.equal(S.dfeListed, counts.dfeListed);
  assert.equal(S.atoSub, counts.atoSub);
  assert.equal(S.dfeSub, counts.dfeSub);

  const fv3 = read("site/fv3.js");
  assert.match(fv3, new RegExp('"ato":' + atoDefault));
  assert.match(fv3, new RegExp('"dfe":' + dfeDefault));
  assert.equal(fv3.includes('S.atoSub'), false);
  assert.equal(fv3.includes('class="s2"'), false);

  const atoBtn = '<span class="n">' + atoDefault + '</span><span class="k"><span class="d"></span>ATO/DTO</span></button>';
  const dfeBtn = '<span class="n">' + dfeDefault + '</span><span class="k"><span class="d"></span>DFE</span></button>';
  for (const rel of ["site/main.html", "site/c/main.html", "site/status_demo.html"]) {
    const html = read(rel);
    assert.ok(html.includes(atoBtn), rel + " first-paint ATO tile must match the tab default");
    assert.ok(html.includes(dfeBtn), rel + " first-paint DFE tile must match the tab default");
    assert.equal(html.includes('class="s2"'), false, rel + " must not have a second line under the tile");
    assert.equal(html.includes(".a1stats .st .s2{"), false, rel + " must not style a second line");
    assert.ok(html.includes(">ATO/DTO<"), rel + " visible label should stay ATO/DTO");
  }

  assert.match(read("site/c/app.html"), /<input type="checkbox" id="dto" checked>/);
  assert.match(read("site/c/wst/wmf9.js"), /dto\.checked=true;inv\.checked=false/);
  assert.match(read("site/c/wst/wmf9.js"), /\(dto\.checked\?0:1\)/);

  // Shared helpers stay aligned with the tab source.
  const appCode = read("site/c/appdata/app-code.03838b9873.js");
  assert.match(appCode, /const isDto=a=>\/\\\/DTO\/i\.test\(a\.certificate_number\)\|\|\/paraglid\|hang\.\?glid\/i\.test\(a\.name\+a\.approved_courses\)/);
  const appHtml = read("site/c/app.html");
  assert.match(appHtml, /const HIDE_DFE=new Set\(\['pexo test three cm person'\]\)/);
  const wmf = read("site/c/wst/wmf9.js");
  assert.match(wmf, /HIDE=new Set\(\['pexo test three cm person'\]\)/);
  assert.equal(isDto({ certificate_number: "SACAA/0048/DTO", name: "1st Flight", approved_courses: "" }), true);
  assert.equal(isValidStatus("Valid"), true);
});

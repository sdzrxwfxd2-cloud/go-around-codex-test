// MT 13 Nov 2026: build scripts must not be served by the live site. site/profile-preview/*.py moved to tools/profile-preview/,
// and (MT t1968u) site/calculator_v5/*.py moved to tools/calculator_v5/.
// Fails if a .py file is back in site/profile-preview/, or if anything in site/ links to the moved scripts.
// Any other .py file under site/ now fails too (none left after the two moves).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = new URL("../../", import.meta.url).pathname;
const GROUPS = { "profile-preview": ["d2badges.py", "d2pass.py", "dref.py", "mocks4.py", "more.py", "share.py"],
  "calculator_v5": ["cmp.py", "serve.py", "shots5.py", "verify.py", "video.py", "zero_calc_patch.py"] };
let bad = [];
for (const [dir, files] of Object.entries(GROUPS)) {
  for (const f of readdirSync(join(ROOT, "site", dir))) if (f.endsWith(".py")) bad.push("site/" + dir + "/" + f);
  for (const f of files) { try { statSync(join(ROOT, "tools", dir, f)); } catch { bad.push("missing tools/" + dir + "/" + f); } }
}
const LINKS = Object.entries(GROUPS).flatMap(([dir, files]) => files.map((f) => new RegExp(dir + "/" + f.replace(".", "\\."))));
const others = [];
(function walk(d) {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) { if (!/node_modules|\/ad$/.test(p)) walk(p); continue; }
    if (p.endsWith(".py")) { others.push(p); continue; }
    if (!/\.(html|js|json|css|txt|md)$|_redirects$|_headers$/.test(p)) continue;
    const s = readFileSync(join(ROOT, p), "utf8");
    for (const re of LINKS) if (re.test(s)) bad.push(p + " links to " + re.source);
  }
})("site");
if (bad.length) { console.error("FAIL no-public-py:", bad); process.exit(1); }
if (others.length) { console.error("FAIL no-public-py: .py files under site/ (served if deployed):", others); process.exit(1); }
console.log("no-public-py: ok");

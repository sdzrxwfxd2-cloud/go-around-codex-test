// Bump ?v= (first 10 hex of sha1, the site's convention) for the files this fix changes, on every page that loads them,
// Protected paths are never touched. (15 Nov 2026: main.html no longer loads wst/ad-elev.js; the runway DB is a lazy JSON.)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site");
const FILES = ["engine/ga-core-v2.js", "engine/ga-core-v2-wire.js", "wst/wst-card.js"];
const SKIP = /(^|\/)(appdata|ARCHIVE_DO_NOT_TOUCH[^/]*|node_modules)(\/|$)/;
const v = (f) => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, f))).digest("hex").slice(0, 10);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => { const p = path.join(d, e.name), r = path.relative(ROOT, p);
  if (SKIP.test(r)) return []; return e.isDirectory() ? walk(p) : e.name.endsWith(".html") ? [p] : []; });
const tags = Object.fromEntries(FILES.map((f) => [f, v(f)]));
let changed = 0;
for (const p of walk(ROOT)) {
  let s = fs.readFileSync(p, "utf8"); const o = s;
  // only tags whose URL resolves to the changed file from this page (a relative wst/... in /c/main.html is /c/wst/...)
  const dir = "/" + path.relative(ROOT, path.dirname(p)).split(path.sep).filter(Boolean).join("/");
  s = s.replace(/((?:src|href)=["'])([^"'?#]+)\?v=([0-9a-f]+)/g, (all, pre, url, old) => {
    if (/^[a-z]+:|^\/\//i.test(url)) return all;
    const abs = path.posix.normalize(url.startsWith("/") ? url : path.posix.join(dir, url)).replace(/^\//, "");
    return tags[abs] ? pre + url + "?v=" + tags[abs] : all;
  });
  if (s !== o) { fs.writeFileSync(p, s); changed++; }
}
console.log(JSON.stringify(tags), "pages changed:", changed);

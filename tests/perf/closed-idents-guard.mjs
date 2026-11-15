// Guard: the 58 closed aerodromes (plus the FAWW→ZA-0166 alias) must never appear
// on a public page, list, search, Status or count. The test fails if they do.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
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

const ALIAS = { FAWW: "ZA-0166" }; // same place; OurAirports ident for the FAWW card
const cl = load("site/wst/wst-cards-closed.js");
const closed = [...cl.WM_CLOSED_IDENTS];
assert.equal(closed.length, 58);
const banned = [...new Set(closed.concat(Object.values(ALIAS)))];

const identRe = (ids) =>
  new RegExp("(?:^|[^A-Z0-9-])(" + ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?:[^A-Z0-9-]|$)");

function icaosFromCards(arr) {
  return arr.map((h) => {
    const m = String(h).match(/class="icao">([^<]+)/);
    return m ? m[1].trim() : "";
  }).filter(Boolean);
}

test("closed idents are absent from the public list, search, Status, counts and public pages", () => {
  const pub = load("site/wst/wst-cards-data.js").WM_CARD_HTML;
  const pIds = icaosFromCards(pub);
  assert.equal(pub.length, 582);
  for (const id of banned) assert.equal(pIds.includes(id), false, id + " still in the public card list");

  const stats = load("site/wst/wm-public-stats.js").WM_PUBLIC_STATS;
  assert.equal(stats.airports, 582);
  assert.equal(stats.international + stats.controlled + stats.uncontrolled + stats.heliport_or_other, 582);

  const fsD = load("site/fs/fs-data.js").FS_D;
  const searchIds = fsD.a.map((r) => r[0]);
  for (const id of banned) assert.equal(searchIds.includes(id), false, id + " still in Spotlight search (fs-data.js)");
  const cFs = load("site/c/fs/fs-data.js").FS_D;
  const cSearch = cFs.a.map((r) => r[0]);
  for (const id of banned) assert.equal(cSearch.includes(id), false, id + " still in /c/ Spotlight search");

  // Public HTML lists (virtualized main/status, baked /c/main)
  const pages = ["site/main.html", "site/status_demo.html", "site/c/main.html"];
  const cardIcao = identRe(banned);
  for (const p of pages) {
    const html = read(p);
    assert.equal(html.includes("wst-cards-closed.js"), false, p + " loads the closed archive");
    // card icao spans or list links to a closed ad page
    const inCard = [...html.matchAll(/class="icao">([^<]+)/g)].map((m) => m[1]);
    const inHref = [...html.matchAll(/\b(?:href|src)="(?:\.?\/)?(?:ad|c\/ad)\/([^"]+)\.html/g)].map((m) => m[1]);
    for (const id of banned) {
      assert.equal(inCard.includes(id), false, id + " card still baked in " + p);
    }
    for (const id of inHref) {
      assert.equal(banned.includes(id), false, "list in " + p + " still links to ad/" + id + ".html");
    }
  }

  // Deployed aerodrome pages must not exist
  for (const id of banned) {
    for (const rel of ["site/ad/" + id + ".html", "site/c/ad/" + id + ".html"]) {
      assert.equal(existsSync(path.join(root, rel)), false, rel + " is still a public page");
    }
  }

  // Archive still has the records (nothing lost)
  assert.ok(existsSync(path.join(root, "site/wst/wst-cards-closed.js")));
  assert.ok(existsSync(path.join(root, "docs/closed-aerodromes-15nov/closed-aerodromes.json")));
  const adArch = path.join(root, "docs/closed-aerodromes-15nov/pages/ad");
  const have = existsSync(adArch) ? readdirSync(adArch) : [];
  // FAWW had no site/ad page (the OurAirports file is ZA-0166); the other 57 should be archived
  for (const id of closed) {
    if (id === "FAWW") continue;
    assert.ok(have.includes(id + ".html"), "missing archived page for " + id);
  }
});

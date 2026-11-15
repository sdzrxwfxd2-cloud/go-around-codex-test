// 15 Nov 2026: renamed/updated aerodromes must appear consistently on every public list
// (Aerodromes cards, Status, Spotlight FS_D, /c/main, ad pages, model points, runway DB).
// Old public names/coords must be gone. Ident codes in this batch are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
function load(p) {
  const ctx = { window: {} };
  vm.runInContext(read(p), vm.createContext(ctx));
  return ctx.window;
}

const FAKG_ARP = { la: -33.13333333333333, lo: 26.58138888888889 };

// Source-backed updates on this branch. Ident codes are unchanged. FAKG is the only public name change.
const POSITION = {
  "ZA-0017": { name: "Alberta", new: [-28.010845, 28.322514], old: [-27.984167098999023, 28.39444351196289] },
  "ZA-0093": { name: "Britstown", new: [-30.60212, 23.502614], old: [-30.58333396911621, 23.516666412353516] },
  FADP: { name: "Darlington Dam Lodge", new: [-33.096683, 25.256839], old: [-33.18320083618164, 25.193199157714844] },
  FAED: { name: "Edenburg", new: [-29.74625, 25.920452], old: [-29.75, 25.899999618530273] },
  FAGJ: { name: "Gifvlei", new: [-30.368249, 20.016341], old: [-30.38330078125, 20.033300399780273] },
  FAIA: { name: "Itala", new: [-27.531834, 31.299856], old: [-27.4867000579834, 31.171100616455078] },
  FAOL: { name: "Othawa", new: [-24.758414, 31.405406], old: [-24.732999801635742, 31.399999618530273] },
  FARZ: { name: "Reitz", new: [-27.784303, 28.430192], old: [-22.784201, 28.4303] },
  "ZA-0046": { name: "Schmidtsdrif", new: [-28.691594, 24.043819], old: [-28.66666603088379, 24.03333282470703] },
  "ZA-0028": { name: "Wakkerstroom", new: [-27.333669, 30.148343], old: [-27.350000381469727, 30.166667938232422] },
  FAKG: {
    name: "Kwandwe",
    oldName: "Komati Power Station",
    new: [FAKG_ARP.la, FAKG_ARP.lo],
    old: [-26.093299865722656, 29.45560073852539],
  },
};

const PUBLIC = [
  "site/wst/wst-cards-data.js",
  "site/fs/fs-data.js",
  "site/c/fs/fs-data.js",
  "site/c/main.html",
  "site/ad/FAKG.html",
  "site/c/ad/FAKG.html",
  "site/wst/wst-data.js",
  "site/c/wst/wst-data.js",
  "site/calculator_v5/fs/fs-data.js",
  "site/calculator_v5/assets/aerodromes.js",
];

function parseCards(htmlList) {
  const out = {};
  for (const h of htmlList) {
    const icao = (h.match(/class="icao">([^<]+)/) || [])[1];
    const name = (h.match(/<h2>([^<]+)/) || [])[1];
    const prov = (h.match(/class="icao">[^<]+<\/span><span>·<\/span><span>([^<]+)/) || [])[1];
    const la = (h.match(/data-la="([^"]+)"/) || [])[1];
    const lo = (h.match(/data-lo="([^"]+)"/) || [])[1];
    const cat = (h.match(/data-cat="([^"]*)"/) || [])[1];
    if (icao) out[icao] = { name, prov, la: la && +la, lo: lo && +lo, cat, html: h };
  }
  return out;
}

function near(a, b, eps = 1.5e-4) {
  return Math.abs(a - b) <= eps;
}

function loadFs(p) {
  const w = load(p);
  const a = w.FS_D && w.FS_D.a;
  assert.ok(Array.isArray(a), p + " missing FS_D.a");
  const map = {};
  for (const row of a) map[row[0]] = { ident: row[0], name: row[1], city: row[2], province: row[3], cat: row[4], rw: row[6] };
  return map;
}

function cmainArticle(html, ident) {
  const needle = `class="icao">${ident}`;
  const idx = html.indexOf(needle);
  if (idx < 0) return null;
  const start = html.lastIndexOf("<article", idx);
  const end = html.indexOf("</article>", idx);
  return html.slice(start, end + 10);
}

test("FAKG public name is Kwandwe and Komati Power Station is gone from public lists", () => {
  for (const p of PUBLIC) {
    const t = read(p);
    assert.equal(t.includes("Komati Power Station"), false, p + " still has old FAKG name");
    assert.match(t, /Kwandwe/, p + " missing Kwandwe");
    if (/fs-data|wst-cards-data|c\/main|aerodromes\.js/.test(p)) assert.match(t, /Komatipoort|FAKP/, p + " accidentally removed FAKP Komatipoort");
  }
  const cards = parseCards(load("site/wst/wst-cards-data.js").WM_CARD_HTML);
  assert.equal(cards.FAKG.name, "Kwandwe");
  assert.equal(cards.FAKG.prov, "Eastern Cape");
  assert.equal(cards.FAKG.cat, "uncontrolled");
  assert.ok(near(cards.FAKG.la, FAKG_ARP.la), "card lat " + cards.FAKG.la);
  assert.ok(near(cards.FAKG.lo, FAKG_ARP.lo), "card lon " + cards.FAKG.lo);
  // Card chrome is unchanged: same classes, badge, runway SVG and View link. Text/coords only.
  assert.match(cards.FAKG.html, /class="card glass"/);
  assert.match(cards.FAKG.html, /data-cat="uncontrolled"/);
  assert.match(cards.FAKG.html, /<svg class="rwd"/);
  assert.match(cards.FAKG.html, /href="ad\/FAKG.html"/);
  // ZA-0240 stays a separate public card (~90 m from the AIP ARP)
  assert.equal(cards["ZA-0240"].name, "Kwande Airstrip");
  assert.ok(cards.FAKP, "FAKP Komatipoort must remain on the public list");
});

test("Status uses the same public card list as Aerodromes", () => {
  const s = read("site/status_demo.html");
  assert.match(s, /wst-cards-data\.js/);
  const cards = parseCards(load("site/wst/wst-cards-data.js").WM_CARD_HTML);
  assert.equal(Object.keys(cards).length, 582);
  assert.equal(cards.FAKG.name, "Kwandwe");
});

test("Spotlight FS_D carries the new names and not the old FAKG or FARZ place names", () => {
  for (const p of ["site/fs/fs-data.js", "site/c/fs/fs-data.js"]) {
    const map = loadFs(p);
    assert.equal(map.FAKG.name, "Kwandwe");
    assert.equal(map.FAKG.city, "Makhanda");
    assert.equal(map.FAKG.province, "Eastern Cape");
    assert.equal(JSON.stringify(map.FAKG.rw), JSON.stringify(["11","29"]));
    assert.equal(map.FARZ.name, "Reitz Airport");
    assert.equal(map.FARZ.city, "Petsana");
    assert.equal(map.FARZ.province, "Free State");
    assert.equal(map.FAKP.name.includes("Komatipoort"), true);
    const raw = read(p);
    assert.equal(raw.includes("Komati Power Station"), false);
    assert.equal(raw.includes("Maasstroom"), false);
  }
});

test("/c/main baked cards match the live card list for every updated ident", () => {
  const cards = parseCards(load("site/wst/wst-cards-data.js").WM_CARD_HTML);
  const html = read("site/c/main.html");
  assert.equal((html.match(/<article class="card /g) || []).length, 582);
  for (const [ident, fx] of Object.entries(POSITION)) {
    const art = cmainArticle(html, ident);
    assert.ok(art, "/c/main missing " + ident);
    const name = (art.match(/<h2>([^<]+)/) || [])[1];
    const prov = (art.match(/class="icao">[^<]+<\/span><span>·<\/span><span>([^<]+)/) || [])[1];
    const la = +(art.match(/data-la="([^"]+)"/) || [])[1];
    const lo = +(art.match(/data-lo="([^"]+)"/) || [])[1];
    assert.equal(name, cards[ident].name, ident + " baked name");
    assert.equal(prov, cards[ident].prov, ident + " baked province");
    assert.ok(near(la, fx.new[0]), ident + " baked lat " + la);
    assert.ok(near(lo, fx.new[1]), ident + " baked lon " + lo);
    assert.equal(art.includes(String(fx.old[0])), false, ident + " old lat still in /c/main");
  }
});

test("deep-link ad pages show the new name and position, not the old ones", () => {
  for (const [ident, fx] of Object.entries(POSITION)) {
    for (const p of [`site/ad/${ident}.html`, `site/c/ad/${ident}.html`]) {
      assert.equal(existsSync(path.join(root, p)), true, "missing " + p);
      const t = read(p);
      assert.match(t, new RegExp(`WMLL=\\[${fx.new[0]},${fx.new[1]}\\]`), p + " WMLL");
      assert.equal(t.includes(String(fx.old[0])), false, p + " still has exact old lat");
      if (fx.oldName) {
        assert.equal(t.includes(fx.oldName), false, p + " still has " + fx.oldName);
        assert.match(t, new RegExp(fx.name));
      }
      if (ident === "FAKG") {
        assert.match(t, /990 ft/);
        assert.match(t, /Makhanda/);
        assert.match(t, /EASTERN CAPE/);
        assert.match(t, /33°08′S 026°35′E/);
        assert.equal(t.includes("5289"), false);
        assert.equal(t.includes("MPUMALANGA"), false);
      }
      if (ident === "FARZ") {
        assert.match(t, />Free State</);
        assert.match(t, /Petsana/);
        assert.match(t, /FREE STATE/);
        assert.equal(t.includes("Maasstroom"), false);
        assert.equal(t.includes(" · LIMPOPO"), false);
        // DFE listings in Limpopo may remain — they are people, not the aerodrome province
        assert.match(t, /Flight examiners · Limpopo/);
      }
    }
  }
});

test("model points and the packed runway DB follow the new FAKG ARP, elevation and 11/29", () => {
  const pts = JSON.parse(read("netlify/lib/model_points.json"));
  for (const [ident, fx] of Object.entries(POSITION)) {
    const r = pts.find((x) => x[0] === ident);
    assert.ok(r, ident + " missing from model_points");
    assert.ok(near(r[1], fx.new[0], 5e-4), ident + " model lat " + r[1]);
    assert.ok(near(r[2], fx.new[1], 5e-4), ident + " model lon " + r[2]);
  }

  const db = JSON.parse(read("site/data/ad-runways-elev.locked.v2.json"));
  const a = db.aerodromes.find((x) => x.id === "FAKG");
  assert.equal(a.name, "Kwandwe");
  assert.equal(a.province, "Eastern Cape");
  assert.ok(near(a.lat.v, FAKG_ARP.la));
  assert.ok(near(a.lon.v, FAKG_ARP.lo));
  assert.equal(a.elevation_ft.v, 990);
  assert.deepEqual(a.runways[0].designators, ["11", "29"]);
  assert.equal(a.runways[0].ends[0].true_hdg.v, 83);
  assert.equal(a.runways[0].ends[1].true_hdg.v, 263);
  assert.equal(a.runways[0].length_ft.v, 6759); // 2060 m from AIP AD 2.12
  assert.match(a.source_tag.v, /SACAA AIP AD 2-FAKG/);
  assert.equal((read("site/wst/ad-elev.js").match(/"FAKG":(\d+)/) || [])[1], "990");

  const files = readdirSync(path.join(root, "site/wst")).filter((f) => /^ad-rwy-db\.[0-9a-f]{10}\.json$/.test(f));
  assert.equal(files.length, 1, "expected one hashed runway DB");
  const rwName = files[0];
  assert.equal(rwName, "ad-rwy-db.d1aeb2149a.json");
  const rwBody = read("site/wst/" + rwName);
  const hash = createHash("sha256").update(rwBody).digest("hex").slice(0, 10);
  assert.equal(hash, rwName.slice(-15, -5), "ad-rwy-db filename hash");
  assert.match(rwBody, /FAKG=990\|11\/29:83/);
  assert.match(read("site/wst/wst-ad.js"), /ad-rwy-db\.d1aeb2149a\.json/);
  assert.match(read("site/engine/ga-core-v2-wire.js"), /ad-rwy-db\.d1aeb2149a\.json/);
});

test("stats and filters are unchanged: 582 cards, official INTL 10, FAKG still uncontrolled", () => {
  const cards = parseCards(load("site/wst/wst-cards-data.js").WM_CARD_HTML);
  assert.equal(Object.keys(cards).length, 582);
  const intl = Object.entries(cards).filter(([, c]) => c.cat === "international").map(([id]) => id).sort();
  assert.deepEqual(intl, ["FABL", "FACT", "FAKN", "FALA", "FALE", "FAOR", "FAPE", "FAPN", "FAPP", "FAUP"]);
  assert.equal(cards.FAKG.cat, "uncontrolled");
  assert.equal("FAKG" in cards, true);
  const main = read("site/main.html") + read("site/c/main.html");
  assert.match(main, />582</);
});

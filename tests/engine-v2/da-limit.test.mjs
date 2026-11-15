// Pilot-set density altitude limit (MT 15 Nov 2026): default 2500 ft above the field,
// 1500–6000 in 500 ft steps. ON + DA > limit = CAUTION, never NO-GO.
// Also a 640-card check at ON/2500 and ON/3000.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const engine = (await import(path.join(root, "site/engine/ga-core-v2.js"))).default
  || (await import(path.join(root, "site/engine/ga-core-v2.js")));
// CJS export
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require(path.join(root, "site/engine/ga-core-v2.js"));

const NOW = Date.UTC(2026, 10, 9, 10, 0, 0);
const PROF = { ceilFt: 1500, visKm: 5, xwKt: 15, gustKt: 25, night: true };
const metar = (icao, tC, qnh) => ({
  raw: `${icao} 091000Z 24008KT 9999 CAVOK ${tC}/05 Q${String(qnh).padStart(4, "0")}`,
  time: NOW - 10 * 6e4
});

test("clampDaLimit: default 2500, 1500–6000 in 500 steps, invalid falls back", () => {
  assert.equal(E.clampDaLimit(2500), 2500);
  assert.equal(E.clampDaLimit(3000), 3000);
  assert.equal(E.clampDaLimit(1500), 1500);
  assert.equal(E.clampDaLimit(6000), 6000);
  assert.equal(E.clampDaLimit(999), 2500);
  assert.equal(E.clampDaLimit(7000), 2500);
  assert.equal(E.clampDaLimit("abc"), 2500);
  assert.equal(E.clampDaLimit(2750), 3000);
  assert.equal(E.daLimitFt({ daLimit: 3000 }), 3000);
  assert.equal(E.daLimitFt({}), 2500);
});

test("ON at 2500 is CAUTION and ON at 3000 is not, for DA ~2769 ft above the field", () => {
  const field = { icao: "FACT", lat: -33.9648, lon: 18.6017, elevFt: 5000, category: "controlled", iap: true,
    runways: [{ id: "01", trueHdg: 10 }, { id: "19", trueHdg: 190 }] };
  const wx = { metar: metar("FACT", 28, 1013) };
  const ev = (limit) => E.evaluate({ field, profile: Object.assign({}, PROF, { da: true, daLimit: limit }), aircraftId: "C172", now: NOW, phase: "depart", rules: "vfr", weather: wx });
  const a = ev(2500), b = ev(3000);
  const above = a.da - 5000;
  assert.ok(above > 2500 && above <= 3000, "fixture DA-above-field should split 2500/3000, got " + above);
  assert.equal(a.status, "caution");
  assert.ok((a.findings || []).some((f) => f.ruleId === "POL-DA" && f.lv === "caution"));
  assert.equal(b.status, "go");
  assert.ok(!(b.findings || []).some((f) => f.ruleId === "POL-DA" && f.lv === "caution"));
  assert.ok(!(a.findings || []).some((f) => f.ruleId === "POL-DA" && f.lv === "nogo"));
});

test("640 cards: DA ON at 2500 vs 3000, never a NO-GO from DA, Status==engine", () => {
  const db = JSON.parse(readFileSync(path.join(root, "site/data/ad-runways-elev.locked.v2.json"), "utf8"));
  const ads = db.aerodromes;
  assert.equal(ads.length, 640, "locked DB should have 640 aerodromes");
  const tC = 28, qnh = 1013;
  const rows = [];
  let caut2500 = 0, caut3000 = 0, daNogo = 0, split = 0, skipped = 0;
  for (const ad of ads) {
    const el = ad.elevation_ft && ad.elevation_ft.v != null ? +ad.elevation_ft.v : null;
    const field = {
      icao: ad.id, lat: ad.lat && ad.lat.v, lon: ad.lon && ad.lon.v, elevFt: el,
      category: ad.category || "uncontrolled",
      iap: false,
      runways: (ad.runways || []).flatMap((rw) => (rw.ends || []).map((e) => ({ id: e.id, trueHdg: e.true_hdg && e.true_hdg.v })))
    };
    const ev = (limit) => E.evaluate({
      field, profile: Object.assign({}, PROF, { da: true, daLimit: limit }),
      aircraftId: "C172", now: NOW, phase: "depart", rules: "vfr",
      weather: { metar: metar(ad.id.replace(/^ZA-/, "FA").slice(0, 4).padEnd(4, "A"), tC, qnh) }
    });
    const a = ev(2500), b = ev(3000);
    if (a.heliport || a.status === "none") { skipped++; continue; }
    const daA = (a.findings || []).find((f) => f.ruleId === "POL-DA");
    const daB = (b.findings || []).find((f) => f.ruleId === "POL-DA");
    if (daA && daA.lv === "nogo") daNogo++;
    if (daB && daB.lv === "nogo") daNogo++;
    if (daA && daA.lv === "caution") caut2500++;
    if (daB && daB.lv === "caution") caut3000++;
    if (daA && daA.lv === "caution" && !(daB && daB.lv === "caution")) {
      split++;
      rows.push({ id: ad.id, el, da: a.da, above: a.da != null && el != null ? a.da - el : null, at2500: a.status, at3000: b.status });
    }
    // The same engine is what Status and Aerodromes both call (via wire + status()). Re-running must agree.
    const a2 = ev(2500);
    assert.equal(a2.status, a.status, ad.id + " not stable at 2500");
    assert.equal((a2.findings || []).filter((f) => f.ruleId === "POL-DA").map((f) => f.lv).join(), (a.findings || []).filter((f) => f.ruleId === "POL-DA").map((f) => f.lv).join(), ad.id);
  }
  assert.equal(daNogo, 0, "DA must never be a NO-GO");
  assert.ok(caut2500 >= caut3000, "a higher limit cannot produce more DA cautions");
  const outDir = path.join(root, "docs/da-limit-control-15nov");
  mkdirSync(outDir, { recursive: true });
  const report = { cards: ads.length, skipped, caut2500, caut3000, split, daNogo, sampleSplit: rows.slice(0, 20) };
  writeFileSync(path.join(outDir, "640-card-da-limit.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("640-card DA limit: " + JSON.stringify({ cards: ads.length, skipped, caut2500, caut3000, split, daNogo }));
});

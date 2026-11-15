# ad-runways-elev.locked.v1.json — aerodrome runways + elevation database (v1, 15 Nov 2026)

> **LOCKED. Never edit `ad-runways-elev.locked.v1.json` in place. A new version is a new file
> (`ad-runways-elev.locked.v2.json`, built by `tools/rwdb/build.py` from new raw inputs) with its own section in this README.**
> The engine is NOT wired to this file yet (see "Integration proposal").

## What is in it
One record per card (640: 588 aerodromes + 51 heliports + 1 balloonport), one record per line in the `aerodromes` array:
`id`, `name`, `category`, `province`, `lat`, `lon`, `mag_declination_deg`, `match` (which OurAirports row and OSM ways were used and how),
`elevation_ft` (chosen value), `elevation_candidates` (every source's value), `existing_site_elevation_ft` (what the engine uses today, for comparison),
`runways[]` (`designators`, `length_ft`, `width_ft`, `surface`, `ends[]` with `id`, `true_hdg`, `mag_hdg`, optional `cross_check` / `rejected`), `has_heading`, `flags`.
**Every value is an object `{v, src, url, retrieved}`.** `null` = no source had it. Nothing is guessed.
Top level: `sources`, `coverage`, `rules`, `unmatched` (list), `review` (rejected matches).

## Sources and priority
| Field | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| Runway true heading | SACAA AIP AD 2.12 published true bearing (site/rwy/rwy-data.js, AIP 15 JUL 2026) | OurAirports `runways.csv` `le/he_heading_degT` (rejected when it equals the designator, see below) | OurAirports threshold coordinates (bearing between them) | OpenStreetMap `aeroway=runway` way geometry (tagged **OSM-derived**) |
| Magnetic heading | AIP published magnetic bearing | derived: true minus WMM2025 declination at the field (tagged **derived**) | | |
| Length / width / surface | AIP | OurAirports | OSM geometry length / tags | |
| Elevation | SACAA AIP AD 2.2 (site/wst/wst-data.js) | OurAirports `airports.csv` `elevation_ft` | Open-Meteo elevation API, Copernicus DEM GLO-90 at the card position (tagged **terrain_derived**) | |

Downloads (retrieved 15 Nov 2026): OurAirports CSVs from https://davidmegginson.github.io/ourairports-data/ (11:26 UTC);
OSM from Geofabrik `africa/south-africa-261114.osm.pbf` (OSM data of 14 Nov 2026, ODbL, © OpenStreetMap contributors);
Open-Meteo `https://api.open-meteo.com/v1/elevation` (11:40 UTC); WMM2025 via pygeomag.
SACAA AIP: no public machine-readable aerodrome directory beyond the AD 2 PDFs already extracted in the repo (65 aerodromes); used as is.

## Matching rules (not just ICAO)
- OurAirports: a row is accepted when its `ident`, `gps_code`, `icao_code` or `local_code` equals the card id, **or** its name shares a word with the card name, **and** it lies within **2 km** of the card coordinates. If nothing matches, the nearest OurAirports aerodrome within 1 km (same heliport/non-heliport kind) is used and tagged "coordinates only". Same-id rows further than 2 km are **rejected** and listed in `review`.
- OSM runway ways: midpoint within 3 km of the card, the card must be the nearest card to that way, **and** the nearest OurAirports aerodrome to that way must be the card's own match (so a neighbour strip is never borrowed). Heliports get no OSM runway.
- OSM gives a line; its bearing is measured from the geometry. The `ref` tag (e.g. `11/29`) only says which end is which. Each end carries `designator_check_deg` (how far the measured heading is from designator x 10 + declination).
- OurAirports `heading_degT` values that equal the designator x 10 (or the bare designator number, e.g. Klipriver `07` = 7.0) are not true headings (in SA true = magnetic − 20 to 28°). They are replaced by measured OSM geometry where it exists and kept under `rejected`. Same when OurAirports and OSM disagree by more than 15°.

## Coverage (588 aerodromes, heliports excluded)
| | Before (live b0496a909) | After (this file) |
|---|---|---|
| Runway headings | **146/588** (63 AIP set, but 29 of those partly designator x 10; 83 only designator x 10 from FS_D) | **487/588**, all published or measured: AIP 65, OurAirports 52, OSM-derived 370 |
| No heading | 442 | **101** |
| Elevation | **523/588** | **588/588**: published 520 (AIP or OurAirports), terrain-derived 68 |
- Of the 442 with no heading before, 341 now have one; all 83 designator-only fields now have published or measured headings.
- Cross-check where two sources exist (356 runway ends): OSM geometry vs AIP/OurAirports median difference **0.3°**, 90% within **1.2°**. Larger differences: FADD, FADY, FAVG, FAWV, ZA-0120, ZA-0161, ZA-0245, ZA-0297, ZA-0351 (see `cross_check` / `rejected`).
- 19 OurAirports runway ends were replaced by OSM geometry (designator-like or >15° off).

## Lists
**No runway heading from any source (101):** ZA-0025 ZA-0017 ZA-0015 ZA-0082 ZA-0058 ZA-0062 ZA-0020 ZA-0010 ZA-0012 ZA-0048 ZA-0221 ZA-0108 FABT FABZ ZA-0109 ZA-0068 ZA-0087 ZA-0315 ZA-0093 ZA-0006 ZA-0132 ZA-0222 FACX FACK FACB ZA-0195 FACH FADP ZA-0030 FADV FADG ZA-0341 FADH FAED FAEG ZA-0153 ZA-0031 FAFG ZA-0036 ZA-0303 FAFU ZA-0130 FAGJ FAGH FAGV FAHK ZA-0184 ZA-0148 FAHB FAHH ZA-0142 FAHD FAID FAIW FAIA FAOF ZA-0145 FAJF FAJV FAKW ZA-0136 FAKF FADM FAKO ZA-0111 ZA-0147 ZA-0040 FALH ZA-0144 FAMF FAML FAMX FAMT ZA-0033 FAMZ FANH FANL ZA-0032 FANA FAOD FAOL FAOT FAPW ZA-0116 FARZ ZA-0064 ZA-0046 ZA-0056 FAWW ZA-0133 ZA-0065 ZA-0024 FAGA FAUB FAVP ZA-0034 FAVE ZA-0023 FAVI ZA-0028 ZA-0276

**Elevation only terrain-derived (68):** ZA-0017 ZA-0188 ZA-0315 ZA-0093 ZA-0195 FACH FADP ZA-0177 ZA-0314 FADG FADC ZA-0187 FAED FAGJ ZA-0146 ZA-0141 ZA-0184 ZA-0148 ZA-0353 ZA-0099 ZA-0142 FAIA ZA-0145 FAJV FAKW ZA-0115 ZA-0003 ZA-0240 ZA-0181 ZA-0147 ZA-0197 ZA-0189 ZA-0155 ZA-0144 ZA-0308 ZA-0309 ZA-0033 ZA-0183 ZA-0157 ZA-0239 FANV ZA-0371 ZA-0143 FAOL ZA-0156 ZA-0192 ZA-0199 ZA-0116 FARZ ZA-0370 ZA-0238 ZA-0101 ZA-0046 ZA-0176 ZA-0185 ZA-0154 ZA-0186 ZA-0352 ZA-0179 ZA-0139 ZA-0248 ZA-0310 ZA-0150 ZA-0149 ZA-0028 ZA-0182 ZA-0372 ZA-0354

**OurAirports says CLOSED (57; still on our cards, worth checking):** ZA-0082 ZA-0058 ZA-0062 ZA-0020 ZA-0010 ZA-0108 FABT ZA-0068 ZA-0087 ZA-0075 ZA-0006 FACX ZA-0195 ZA-0030 FADV ZA-0341 FAEG ZA-0153 ZA-0031 FAFG ZA-0036 FAFU FAGH FAHK FAHB FAHH FAHD FAID FAOF FAJF FAKF FADM FAKO ZA-0147 ZA-0040 FAMF FAML FAMZ FANH FANL ZA-0032 FANA FAOD ZA-0116 ZA-0064 ZA-0056 FAWW ZA-0065 ZA-0024 FAGA ZA-0298 FAUB FAVP ZA-0034 ZA-0023 FAVI ZA-0276

**Same id in OurAirports but more than 2 km away, rejected (25):** FAKG (ZA-0240, 830.6 km), ZA-0017 (ZA-0017, 7.7 km), FABV (ZA-0376, 755.9 km), ZA-0093 (ZA-0093, 2.5 km), FACH (FACH, 5.3 km), FADP (FADP, 11.3 km), FADG (FADG, 2.2 km), FAED (FAED, 2.0 km), FAEG (ZA-0375, 1525.0 km), FAER (ZA-0374, 242.7 km), FAGJ (FAGJ, 2.3 km), FAHD (ZA-0038, 1239.8 km), FAIW (ZA-0350, 905.8 km), FAIA (FAIA, 13.7 km), FAJV (FAJV, 2.7 km), FAKW (FAKW, 2.1 km), FAMF (FAMQ, 492.3 km), FAMY (FAZP, 933.7 km), ZA-0033 (ZA-0033, 3.7 km), FANV (FANV, 3.1 km), FAOL (FAOL, 2.9 km), FARZ (FARZ, 556.0 km), ZA-0046 (ZA-0046, 3.0 km), FAGA (FAHV, 426.8 km), ZA-0028 (ZA-0028, 2.6 km)

**Elevation sources disagree by more than 150 ft (43):** FAUS 167 ft, ZA-0015 574 ft, ZA-0029 858 ft, ZA-0063 185 ft, ZA-0012 543 ft, ZA-0048 171 ft, ZA-0055 173 ft, ZA-0039 157 ft, ZA-0071 363 ft, ZA-0019 257 ft, ZA-0011 172 ft, ZA-0006 350 ft, FACE 404 ft, ZA-0061 245 ft, FADZ 380 ft, FAFG 154 ft, ZA-0036 1323 ft, FAFO 164 ft, FAFU 425 ft, ZA-0229 176 ft, FAHB 240 ft, ZA-0316 247 ft, FAIV 170 ft, ZA-0104 164 ft, ZA-0163 617 ft, FAKF 279 ft, ZA-0040 153 ft, FALF 192 ft, FAMQ 277 ft, FAMP 807 ft, FAMY 508 ft, FAZP 164 ft, FABA 210 ft, ZA-0096 199 ft, FACA 238 ft, ZA-0032 198 ft, FANG 1897 ft, FAOD 3027 ft, ZA-0056 857 ft, FATM 297 ft, ZA-0024 223 ft, FASL 158 ft, FATB 315 ft

## Integration proposal (not done; needs MT's yes)
Today the engine gets runways and elevation from these places:
1. `site/engine/ga-core-v2-wire.js`
   - `adFromCard()` (~line 854): uses `WSTC.AD[ic]` / `WMST.ads` (AIP 65), else builds an aerodrome from the card with elevation from `window.WM_AD_ELEV` (`site/wst/ad-elev.js`).
   - `ensureRunwayHeadings()` / `runwaysFromFsSlow()` (~lines 816-852): when no heading, reads designators from `FS_D.a[i][6]` (`site/fs/fs-data.js`) and makes **heading = designator x 10 + declination**. That is a heading from a name; it should go.
   - ~line 91 and ~line 840: read `a.rw || a.runways`.
2. `site/wst/wst-data.js` (`WMST.ads[].rw`): 83 runway ends at 29 AIP aerodromes (incl. FAOR, FALE, FAEL, FAMM) carry `src: "designator x10 + WMM2025 variation"` although rwy-data.js has the AIP true bearing (off by up to 9°, e.g. FAPG 12: 90 vs 99).
3. `site/wst/wst-card.js` ~line 121 (elevation from `WM_AD_ELEV`, label "aerodrome page"), `site/wst/wm-bridge.js` ~line 80 (runways from `a.rw`), `site/wst/wst-engine.js` ~lines 211-218 ("Runway headings unavailable"), `site/wst/wst-ad.js` ~lines 41, 65 (FS_D).
4. Copies that must move together: `site/wx-check/engine-copy/ga-core-v2-wire.js`, `site/wx-check/wxc-core.js` (~lines 134-143, 260-273), and the `site/c/` and `site/calculator_v5/` copies of `fs-data.js`.

Proposed change, on a new branch:
- A build step (`tools/rwdb/emit.mjs`, new) writes a small `site/wst/ad-rwy-db.js` = `window.WM_RWDB = {id: {el, elSrc, rw: [{id, true, mag, src}]}}` from this locked file (about 60 to 80 KB; budget check needed, it can be lazy-loaded after first paint).
- `ensureRunwayHeadings()` and `adFromCard()`: AIP (`WSTC`/`WMST` with published bearings) first, then `WM_RWDB`, and **remove the designator x 10 fallback** (`runwaysFromFsSlow`). With no heading, keep today's "Runway headings unavailable" CAUTION.
- Fix `WMST.ads[].rw` designator entries to the AIP bearings (new data file, not in place).
- Elevation: `WM_RWDB.el` replaces `WM_AD_ELEV` as the second source after AIP; the card shows the source (AIP / OurAirports / terrain). Terrain-only and flagged (>150 ft disagreement) fields could get a small "elevation estimated" note in density altitude.
- Status page must load the same file (today it skips `ad-elev.js`, which is the 3-airport DA mismatch).
- Tests: compare.test, wind-fill, wire, plus a new test that no runway heading comes from a designator.

---

# ad-runways-elev.locked.v2.json — v2 (15 Nov 2026, MT 14:23 / 14:25 SAST)

> **LOCKED** like v1. v1 is unchanged. Rebuild check: `python3 tools/rwdb/verify_v2.py . /tmp/rep && git diff --exit-code site/data/ad-runways-elev.locked.v2.json`.

How it is made: `tools/rwdb/build.py` on `tools/rwdb/raw-v2/` (the v1 inputs with 11 card positions corrected, see
`raw-v2/card-position-fixes.json`), then `tools/rwdb/verify_v2.py` checks every record and resolves disagreements.
Every record now has `verification{checked, heading[], elevation, position, card_position_fix?}`; replaced values keep the old
one under `v1_true_hdg` / `v1_elevation_ft`; dropped runways are kept under `v1_duplicate_runways` / `v2_unlabelled_osm_not_used`.
Full list of every change and every flag: `docs/RWDB-V2-VERIFICATION-15nov.md`.

What v2 fixes against v1:
- **AIP elevations** now come from the AD 2 PDFs (AD 2.2 item 3, `tools/rwdb/aip_elev_pdf.py`). v1 took them from `wst-data.js`,
  where about 20 "AIP" values were really the terrain model (FAOR 5502 → 5558 ft, FAPG 443 → 465, FALA 4459 → 4521, ...).
- **FAKG**: the AIP FAKG pages are Kwandwe (830 km from this card, Komati Power Station). Kwandwe's runway 11/29 and elevation are no
  longer given to this card.
- **APPROX headings**: `rwy-data.js` has 4 runway ends (FAVG, FAHL) whose "true_brg" is designator × 10 marked APPROX; they are no
  longer treated as published (replaced by measured OSM / OurAirports geometry).
- **Non-reciprocal AIP bearings** (FAWN 14/32, FACO 14/32): the bearing between the AIP threshold coordinates is used.
- **Duplicates**: the same strip from a second source under another name is kept once (parallel L/R runways are kept).
- **Unlabelled OSM ways**: not used where the field has labelled runways; where they are the only runway, the end label is worked out
  from the measured magnetic heading (`id_from_heading: true`).
- **Elevation**: OurAirports values more than 100 ft off the terrain at the measured runway (or more than 300 ft off the ground at
  both its own position and the card) are replaced by the terrain value (tagged `terrain_derived`).
- **11 card positions corrected** (ZA-0017, ZA-0093, FACH, FADP, FAED, FAGJ, FAIA, FAOL, FARZ, ZA-0046, ZA-0028): same ident and
  name in OurAirports and a runway mapped in OSM there, none at the old card position. FARZ was 5° of latitude off (Limpopo → Free State).

Runtime: `tools/rwdb/emit.mjs` writes `site/wst/ad-rwy-db.js` (ids, true headings and elevation only; no sources or dates).

## Change log

- **15 Nov 2026, 17:24 SAST (MT):** FAKG record reassigned from Komati Power Station (Mpumalanga, OurAirports FAKG, elev 5289 ft, OSM 08/26) to **Kwandwe** (Eastern Cape). Source: SACAA AIP AD 2-FAKG, AMDT 4/20 (15 OCT 20), `site/aip/fakg/ad2-fakg.pdf`. ARP `330800S 0263453E` (−33.133333, 26.581389); reference elevation **990 FT**; runway **11/29**, 2060 × 25 m, true bearings 083°T / 263°T. Packed runtime record: `FAKG=990|11/29:83`. OurAirports ident FAKG remains the Komati strip, 830 km away; ZA-0240 Kwande Airstrip is ~90 m from the AIP ARP and stays a separate public card. Engine access was approved only to rotate `RWDB_URL` in `site/engine/ga-core-v2-wire.js` (~line 1499), `site/wst/wst-ad.js` (~line 64), and `site/wx-check/engine-copy` + manifest after `tools/rwdb/emit.mjs`.

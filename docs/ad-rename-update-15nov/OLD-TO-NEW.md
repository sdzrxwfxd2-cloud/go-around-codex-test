# Aerodrome name / position updates — 15 Nov 2026

Old → new table for `fix/ad-rename-update-15nov`. Sources stay in this docs folder only; public cards were not given source footnotes, and card HTML structure, CSS and spacing were left as live.

Ident codes in this batch are unchanged. The only public **name** change is FAKG.

## Changed on this branch

| Ident | Old name / place | New name / place | What changed | Source |
|---|---|---|---|---|
| **FAKG** | Komati Power Station, Mpumalanga, 26°06′S 029°27′E, elev 5289 ft, no AIP runway on the v2 card | **Kwandwe**, Eastern Cape, ARP 33°08′00″S 026°34′53″E (−33.133333, 26.581389), elev **990 ft**, runway **11/29** 2060 × 25 m (6759 × 82 ft), true bearings 083°T / 263°T, nearest town Makhanda | Official SACAA AIP AD 2-FAKG is KWANDWE, about 830 km from the OurAirports “FAKG” Komati Power Station strip. The public card, `/c/main` bake, Spotlight (`FS_D`), Status (same card list), `/ad/FAKG.html` + `/c/ad/FAKG.html`, model point, `ad-elev.js`, `wst-data.js`, `rwy-data.js`, locked v2 and the packed runtime runway DB were pointed at the AIP ARP. Deep link stays `/ad/FAKG.html`. | SACAA AIP AD 2-FAKG (AMDT 4/20, 15 OCT 20), on the site at `site/aip/fakg/ad2-fakg.pdf`. AD 2.1 name KWANDWE; AD 2.2 item 1 ARP `330800S 0263453E`; AD 2.2 item 3 reference elevation 990 FT; AD 2.2 item 2 “19 KM north of Makhanda”; AD 2.2 item 5 MAG VAR 27°W; AD 2.12 / 2.13 runway 11/29, 2060 × 25 m, THR 11 1048 FT / 330804.16S 0263416.85E, THR 29 932 FT / 330756.18S 0263535.04E, declared distances 2060 m. |
| **FARZ** | Reitz, **Limpopo**, 22°47′S 028°26′E (and nearest town Maasstroom on the ad page / Spotlight) | Reitz, **Free State**, 27°47′S 028°26′E; nearest town **Petsana** | The public list card already had the corrected coordinates and Free State (applied earlier to `wst-cards-data.js` only). This branch copies that into `/c/main`, both ad pages, Spotlight, calculator and chart, and changes the ad-page province / header / nearest town. DFE “Limpopo” lines on the ad page were left (they are examiner regions, not the aerodrome). | OurAirports `airports.csv` retrieved 15 Nov 2026 13:26 SAST: ident FARZ, Reitz Airport, −27.784303, 28.430192, municipality Petsana, region ZA-FS. Lat was 5° too far north on the stale copies. |
| ZA-0017 | Alberta at −27.984167, 28.394444 | Alberta at **−28.010845, 28.322514** | Position only, already on the live list card; this branch updated ad pages, `/c/main`, calculator, chart. | OSM way 222485266 (08/26); `tools/rwdb/raw-v2/card-position-fixes.json`. |
| ZA-0093 | Britstown at −30.583334, 23.516666 | Britstown at **−30.60212, 23.502614** | Same pattern as ZA-0017. | OSM / card-position-fixes.json. |
| FADP | Darlington Dam Lodge at −33.183201, 25.193199 | **−33.096683, 25.256839** | Same pattern. | OSM / card-position-fixes.json. |
| FAED | Edenburg at −29.75, 25.900000 | **−29.74625, 25.920452** | Same pattern. | OSM / card-position-fixes.json. |
| FAGJ | Gifvlei at −30.383301, 20.033300 | **−30.368249, 20.016341** | Same pattern. | OSM / card-position-fixes.json. |
| FAIA | Itala at −27.486700, 31.171101 | **−27.531834, 31.299856** | Same pattern. | OSM / card-position-fixes.json. |
| FAOL | Othawa at −24.733000, 31.400000 | **−24.758414, 31.405406** | Same pattern. Province stays Limpopo. | OSM / card-position-fixes.json. |
| ZA-0046 | Schmidtsdrif at −28.666666, 24.033333 | **−28.691594, 24.043819** | Same pattern. | OSM / card-position-fixes.json. |
| ZA-0028 | Wakkerstroom at −27.350000, 30.166668 | **−27.333669, 30.148343** | Same pattern. | OSM / card-position-fixes.json. |
| FACH | Cookhouse at −32.744701, 25.796301 | **−32.789329, 25.817592** (closed archive) | Position was already corrected on the archived closed card. Public ad pages are gone (Part A). Calculator catalogues on this branch now use the new coordinates. | OSM / card-position-fixes.json; closed in Part A (`docs/closed-aerodromes-15nov/`). |

## Already correct on the live list card (no name/code/position change on this branch)

These were in the 15 Nov evidence as “card correct” or “already corrected on the card”. No invented name expansions (for example Alberta stays Alberta, not “Alberta Airport”).

| Ident | Name | Notes |
|---|---|---|
| FABV | Brandviei | Card matches the evidence spelling. |
| FAEG | Egnep | Card correct. |
| FAER | Ellisras Matima | Card correct. |
| FAHD | Humansdorp | Card correct. |
| FAIW | Indwe | Card correct. |
| FAMF | Malabar | Card correct. |
| FAMY | Malmesbury | Card correct. |
| FAGA | The Grange | Card correct. |

Several of the “card correct” rows were later removed from the public list as closed (Part A) and stay in the closed archive.

## Not moved (no runway evidence — nothing invented)

| Ident | Name | Why not changed |
|---|---|---|
| FADG | Dordrecht | OurAirports is 2.2 km from the card; no OSM runway. |
| FAJV | Jansenville | 2.7 km; no OSM runway. |
| FAKW | Kareedouw | OurAirports closed record 2.1 km; no OSM runway. |
| ZA-0033 | Mooivlei | 3.7 km; no OSM runway. |
| FANV | Nieuwoudtville | Two strips; not clear which one. |

## FAKG notes (runway DB, model point, verdict, near-duplicate)

- **Runtime runway DB (17:24 SAST, MT approved emit for FAKG only).** Locked v2 and the public packed file now key FAKG as Kwandwe at the AIP ARP, elevation **990 ft**, runway **11/29** at 083°T/263°T, length 6759 ft (2060 m). Packed record: `FAKG=990|11/29:83` in `site/wst/ad-rwy-db.d1aeb2149a.json`. The only engine edit is the `RWDB_URL` pointer (~line 1499 in `site/engine/ga-core-v2-wire.js`, ~line 64 in `site/wst/wst-ad.js`, and the wx-check engine-copy + manifest). Change log: `site/data/README-ad-runways-elev.md`.
- **Locked v1** was left as a historical snapshot (Komati coordinates mixed with a Kwandwe AIP runway). It is not what the engine reads.
- **Model point** moved from (−26.0933, 29.4556) to (−33.1333, 26.5814). Opening Model on the FAKG card will fetch Eastern Cape weather, not Mpumalanga. A verdict harness against live (depart, land now / +1h / +2h / +3h) showed **0 list-badge diffs** across all 582 cards, including FAKG — both sides stayed **NO DATA** (no METAR), so the badge did not move. Density altitude and a model-backed verdict will change once the packed runway DB can be emitted (5289 ft → 990 ft) and when model weather at the new ARP is used. The other 10 public position rows already had the new coordinates on the live list cards, so their list verdicts should match live.
- **ZA-0240 Kwande Airstrip** remains a separate public card. OurAirports puts it at −33.133964, 26.581936, about 90 m from the AIP ARP. It was not removed or merged.
- **OurAirports ident FAKG** is still the Komati Power Station strip. We follow the official AIP for the FAKG code. The Komati name is gone from public lists, Spotlight and ad pages. Searching “Komati Power Station” will no longer find FAKG; ident FAKG and the name Kwandwe will. FAKP Komatipoort is unchanged.
- **FIR** on the FAKG ad page was Johannesburg FIR (FAJA) from the Komati location. AIP AD 2.17 ATS airspace is NIL, so the page now uses Cape Town FIR (FACA), the same FIR as other Eastern Cape ad pages (for example FADP).
- **Magnetic variation** in the v2 DB is the AIP value 27°W (east-positive −27), not a new WMM2025 computation.
- **`site/sat/fakg.jpg`** was not replaced and may still show the old Komati site.
- A third-party figure of “about 1000 ft” for the runway is the AIP **elevation** (990 FT), not the runway length. Acukwik’s 6400 × 90 ft asphalt is **not** used; the official declared length is 2060 × 25 m. Approval number 139/05/0155 was not found in the AD 2-FAKG PDF we have, so it is not cited.
- **Protected / left stale:** `site/appdata/*` and `site/c/appdata/app-data.51cdd70f78.js` still have the old Komati / old-position catalogue (protected-since-live). `site/c/appdata/app-data-d.7c09bcfc6c.js` was also left so a hashed app bundle was not silently rewritten.

## Stats and filters

No ident was added or removed, so public counts stay **582 / 10 / 23 / 497 / 271 / 134**. FAKG stays uncontrolled. The official SARS/DoT International 10 is unchanged.

## Tests

- `tests/perf/ad-rename-consistency-15nov.mjs` — new name/ident present and consistent across Aerodromes cards, Status, Spotlight, `/c/main`, ad pages, model points and the runway DB; old FAKG name and old coordinates gone from those public surfaces.
- Existing engine, closed-ident, official INTL, cache-header and first-visit (locked DB) tests.

## Screenshots

390px Amethyst (night + purple) before/after shots are in `docs/ad-rename-update-15nov/shots/`.

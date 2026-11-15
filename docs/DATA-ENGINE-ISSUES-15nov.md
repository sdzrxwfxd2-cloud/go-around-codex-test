# Other engine / data issues found while building the runway DB and the WX schedule (15 Nov 2026)

Report only. Nothing changed in the engine. Times SAST.

1. **The engine makes runway headings from designators.** `site/engine/ga-core-v2-wire.js` `runwaysFromFsSlow()` sets heading = designator x 10 + declination for 83 aerodromes (FS_D designators), although the comment says "only published". In SA that is usually 2 to 10° off. The locked DB now has a measured or published heading for all 83.
2. **AIP aerodromes partly use the same guess.** `site/wst/wst-data.js` `WMST.ads[].rw`: 83 runway ends at 29 AIP aerodromes (FAOR, FALE, FAEL, FAMM, FAPG, ...) have `src: "designator x10 + WMM2025 variation"`, while `site/rwy/rwy-data.js` has the AIP published true bearing for 67 of them (up to 9° off, e.g. FAPG 12: 90 vs 99, FAPM 16: 133 vs 142).
3. **`rwy-data.js` elevation field is mis-parsed** (`"elev": "Remarks"` for 45 of 65 aerodromes). Elevation for those comes from `wst-data.js` instead; works, but the field is wrong.
4. **57 aerodromes on our cards are marked CLOSED in OurAirports** (list in site/data/README-ad-runways-elev.md). Worth checking before launch whether they still operate.
5. **Identity / coordinate conflicts:** 25 cards where an OurAirports aerodrome with the same ident is more than 2 km away, some hundreds of km (FARZ 556 km, FAKG 831 km, FAEG 1,525 km, FAHD 1,240 km) — the ident is reused or one dataset is wrong. 9 more (FACH, FADP, FAIA, ZA-0017 ...) are 2 to 14 km off: card position may be wrong, which also moves the model weather point.
6. **Elevation disagreements:** 43 aerodromes where OurAirports and terrain height differ by more than 150 ft, 16 by more than 300 ft (FAOD 3,027 ft, FANG 1,897, ZA-0036 1,323, ZA-0029 858, ZA-0056 857, FAMP 807). Density altitude at these fields may be off. Flagged in the DB.
7. **OurAirports headings are not always real:** some rows hold the designator as the heading (Klipriver ZA-0161: 7, 13, 20; FADY 12 = 120.0 but the runway is 97°). The DB rejects these (kept under `rejected`).
8. **TAF gap (known):** AWC's normal TAF call returns only the newest TAF, which starts 1 to 2 hours after issue, so the still-valid older TAF is dropped (MT chose "use the early TAF").
9. **Night has no TAF at 8 stations** (FAEL, FAHS, FAKM, FAKN, FALM, FAPP, FAUT, FAWB: short daytime TAFs end about 21:00 SAST) and **no METAR at FABL, FAEL, FAUT** from about 20:00 to 05:00 SAST. Real, not a bug; the card could say "station closed at night" instead of "No current METAR".
10. **FALM** has a TAF but no METAR; **FAEO, FAGM, FASB** only send occasional reports (mostly SPECI). They should not be counted as METAR stations.
11. **Late AUTO stations:** FALW, FAWB, FAWK, FAPN reach AWC 12 to 18 min after the hour. With fetches at xx:10/:30/:50 they wait until xx:30, about 30 min late every hour.
12. **KV write budget:** the worker writes the ~770 KB snapshot every 10 min. Any faster fetch must write only when a new report arrives (free plan 1,000 KV writes a day).
13. The fetch bbox also pulls 7 neighbour stations not on our cards (FBSK, FDMS, FQMA, FXMM, FYKT, FYOG, FYWH). Harmless, small cost.

# Go Around — Codex test brief (16 Nov 2026)

Please read the repository README first, then this brief.

**Repository:** https://github.com/sdzrxwfxd2-cloud/go-around-codex-test  
**Tag:** `codex-freeze-16nov`  
**Frozen on:** 16 November 2026 (Africa/Johannesburg, SAST)  
**Site snapshot:** production commit `5a5e60b21` (tag `live-16nov-engine-fix`, branch `live/model-3h-11nov`)

South African weather set: `tests/sa-weather/` (branch `test/sa-weather-dataset-15nov`, plus the corrected runner from `fix/engine-parser-fm-16nov`).

Worldwide weather set: `tests/global-weather/` (branch `test/global-weather-1m-16nov`, commit `28e2168c4`).

The previous freeze, `codex-freeze-15nov`, is still in the repository history.

This is a cleaned, frozen snapshot of the Go Around aviation site. It is not the live private repository. Engine files under `site/engine/` are reference only. Report bugs. Do not rewrite the engine. Do not deploy.

---

You are testing the Go Around aviation app from this frozen public snapshot.

## Hard rules

- Do **not** modify anything under `site/engine/`. The engine is locked. Engine files are reference only; report bugs, do not rewrite them.
- Do **not** deploy, and do not push to `main` or any live or production branch.
- Do **not** invent or mutate weather reports. Only use `tests/sa-weather/raw/` and `tests/global-weather/raw/`.
- You may add notes, extra result files, or tests under the test folders if they help, but leave the raw reports and the engine alone.
- Output a single `BUGS.md`-style report. For every bug, give exact reproducing input, expected vs actual, file and line, and severity.

# Phase 1 — ENGINE first (use high or extra-high reasoning)

Work on both real weather sets. From the repository root, run:

```bash
node tests/sa-weather/run-engine.mjs
node tests/global-weather/run-engine.mjs
```

Each runner imports `site/engine/ga-core-v2.js` read-only and writes `RESULTS.md` plus `results.json` in its own folder. Official 16 November 2026 result files are already there. Read those, then go deeper than the summary.

Optional South African flags: `--station=FACT`, `--limit=500`, `--all-icao`, `--no-write`.

Optional worldwide flags: `--station=EGLL`, `--limit=500`.

The worldwide run is large (about 2.8 million real METARs, 152,244 TAFs, about 7 million checks, including forecast-timing checks at TAF change times) and takes a few minutes.

## What was fixed on 16 November 2026 (already in this engine)

These are already in production commit `5a5e60b21`. They are not open bugs:

- Directional and split visibility, for example `0400W` or `4500W 9999` (use the lower value).
- Glued weather groups with a missing space, for example `9999-RA`.
- Garbled required groups now yield INCOMPLETE instead of a guess.
- A CAVOK in a TREND / BECMG / TEMPO no longer counts as CAVOK now.

The official South African rerun after the fix was:

- 33 stations, 190,645 real METARs, 381,290 departure and landing checks.
- 0 crashes, 0 parse failures, 0 odd results.
- 137 checks changed verdict, almost all of them stricter (false GOs removed). Today's live cards were unchanged.

The 6 FAGG CAVOK NO-GOs from the 15 November run were **not** an engine bug. The TAF `FM` period fell inside the 2-hour look-ahead, and 2,000 ft / 6 km are below the default PPL minima (2,500 ft and 8 km). The first test script had compared them against the wrong limits (the Part 91 VFR floors of 1,000 ft / 5 km). The engine logic was right. Do not treat those six cases as open defects.

## Known open gaps — confirm and analyse

These were found on the worldwide set and have **not** been fixed. Confirm each one with exact raw reports, expected vs actual, file and line, and severity.

1. **Statute-mile visibility is not read.** Groups such as `10SM`, `3SM`, `P6SM`, `15SM`, `1/2SM` (and the same groups in US and Canadian TAFs) are not turned into a visibility value. Example: `METAR CYFB 160000Z 31006KT 15SM BKN025 M06/M09 A3020 RMK SC7 SLP231` — `parseOfficial` returns `vis: null`. This is the large worldwide gap. South African reports use metres and CAVOK, so it does not show on the SA set. Until this is fixed, US and Canadian verdict totals from a raw-text feed are not a fair accuracy measure.

2. **Directional visibility with a slash**, for example `8000NW/N` or `8000NE/E`. The 16 November fix already reads `0400W` and `8000NE`. It does not read the slash form. Example: `METAR MDSD 211800Z 10006KT 8000NW/N VCSH FEW020CB BKN022 30/23 Q1014 CB/NW/N`.

3. **Missing space before a cloud group**, for example `9999FEW010`, `9999BKN014`, `9999OVC015`, `9999SCT023`.

4. **Visibility in kilometres written as `8KM`**, for example `8KM BR` or `8KM RA` (HAAB). The engine does not read a `KM` group.

5. **Foreign airports have no runway headings** in the site database, so `field.runways` is empty and the engine treats the whole wind as worst-case crosswind. That is current policy, not a crash. The worldwide runner did not invent headings. Many worldwide NO-GOs come from this policy.

Also check verdict logic against **Part 91 VFR**, the default **PPL preset minima** (8 km visibility, 2,500 ft ceiling), and look-ahead windows (including `FM` / `BECMG` / `TEMPO`).

**Density altitude over the limit must be CAUTION only, never NO DEPART.** This product has no mass and balance.

You may also call `parseOfficial`, `tafSegs`, `conditionsAt` / the TAF helpers, and `evaluate` yourself on individual reports. Still do not edit the engine.

The runners already use the real engine the same way the site does: `evaluate({ field, weather: { metar, taf }, profile: { licence: "ppl" }, aircraftId: "C172", rules: "vfr", phase, now })`, with `now` equal to the observation time plus five minutes, and the TAF that was in force at that time attached when we have one. Field elevation, runways, latitude and longitude come from the site's own runway database and model points when the station is in that list.

# Phase 2 — site bugs (use medium reasoning)

After the engine work, look at the static site (serve with `python3 -m http.server 8080 --directory site`).

Check:

- Pages load and navigate cleanly.
- Filters: ATO should show **271** schools, DFE should show **126**. Course-name search in the ATO filter must match any word of a course name, in any order (for example `night` and `rating night` should agree; “Find a course or rating” should also find Flight Instructor).
- Status bar numbers: 2-digit and 3-digit values the same size, 15 px in the docked bar at 390 px width.
- E6B calculator: free mode only, plus the size (zoom) control.
- Nav: if the nav is collapsed and you open it, then pick a page, it should fold back up.
- Themes, including theme-switch speed.
- Mobile layout at **390 px**.

# What to write

Write a single `BUGS.md`-style report in plain words, with exact raw reports or UI steps as examples, covering:

- How many stations, METARs, TAFs, and evaluations you ran on each set, and the verdict mix (GO / CAUTION / NO-GO / incomplete).
- Crashes, if any, with reproductions.
- Confirmation of the 16 November South African baseline (0 parse failures, 0 odd results) and of the FAGG explanation above.
- The known open gaps, with examples, expected vs actual, file and line, and severity.
- Odd results you believe are bugs, versus odd results you believe are correct Part 91 VFR or PPL-minima behaviour (say why).
- Density-altitude handling (CAUTION only, never NO DEPART).
- Site bugs from phase 2, each with exact steps, expected vs actual, file and line, and severity.
- Anything you did not have enough TAF history to judge (outside the US, TAF coverage is only about 30 days).

Do not “fix” the engine in this pass. If you want to suggest a fix, describe it in words only and leave the engine code unchanged. Do not deploy.

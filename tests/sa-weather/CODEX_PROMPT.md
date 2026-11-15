# Codex prompt — Go Around engine and site test brief (15 Nov 2026)

Read the repository README first. Do not change `site/engine/*`. Do not deploy.

---

You are testing the Go Around aviation app from this frozen public snapshot (tag `codex-freeze-15nov`, 15 November 2026 SAST).

Hard rules:

- Do **not** modify anything under `site/engine/`. The engine is locked. Engine files are reference only; report bugs, do not rewrite them.
- Do **not** deploy, and do not push to `main` or any live or production branch.
- Do **not** invent or mutate weather reports. Only use `tests/sa-weather/raw/`.
- You may add notes, extra result files, or tests under `tests/sa-weather/` if they help, but leave the raw reports and the engine alone.
- Output a single `BUGS.md`-style report. For every bug, give exact reproducing input, expected vs actual, file and line, and severity.

# Phase 1 — ENGINE first (use high or extra-high reasoning)

Work on the real South African METAR / SPECI / TAF set.

1. Read `README.md`, `tests/sa-weather/README.md` and `tests/sa-weather/manifest.json` so you know the coverage and the known limits (METARs: 12 months; TAFs: about 30 days).
2. From the repository root, run:

   ```bash
   node tests/sa-weather/run-engine.mjs
   ```

   This imports `site/engine/ga-core-v2.js` read-only and writes `tests/sa-weather/RESULTS.md` plus `tests/sa-weather/results.json`.

   Optional flags: `--station=FACT`, `--limit=500`, `--all-icao`.

3. Read `RESULTS.md` and `results.json`. Then go deeper than the summary.

## Investigate the 54 parse failures

`parseOfficial` should read a normal official report the same way the site does. Confirm each failure against the raw text. Ignore true NIL reports. Note `/////KT`, `//////` cloud groups, AUTO, and other legal but awkward groups separately — those should parse as “missing field”, not crash.

On the 15 Nov 2026 run the 54 failures clustered into these real-report shapes (not invented):

- Directional or split visibility, which the parser did not take as prevailing vis: for example `0400W`, `0800NE`, `2000S`, `3000N`, `4500SE`, `1000SW`, and two-group vis such as `4500W 9999` or `2500SW 8000NE`.
- A missing space before weather: `9999-RA`, `9999-DZ`, `9999-SHRA`.
- `METAR COR` (a correction) before the station id.
- Garbled but real archive groups: `23016VKT`, `01006K6002KT`, and a couple of AUTO reports with `////` then a later `9999`.

Exact raw reports are listed in `tests/sa-weather/RESULTS.md` and `results.json`. Open every parse failure. Open every crash (uncaught exception), if any, and write a short, exact reproduction: station, raw METAR/TAF, phase, and the thrown error.

## Investigate the 6 FAGG NO-GOs

These are odd results, not automatically bugs. Decide which ones are real mistakes.

All six are at **FAGG**, where a current CAVOK METAR was given a NO-GO from a future TAF `FM` group that had not yet started, and that was not below limits:

- 16 Oct 2026, 19:00Z and 20:00Z land: METAR `METAR FAGG 161900Z AUTO 02002KT CAVOK 16/14 Q1015` (and the 20:00Z CAVOK report). TAF `FM162000 35005KT 9999 BKN020`. The engine said NO-GO for a 2 000 ft ceiling. A 2 000 ft ceiling is above the 1 000 ft Part 91 VFR floor. At 19:00Z the `FM` has also not started yet.
- 5 Nov 2026, 10:00Z and 11:00Z depart and land: METAR is CAVOK. The engine said NO-GO because of `FM051200 20010KT 6000 -RA BKN010` (“vis 6.0 km”). 6 km is above the 5 km VFR floor, and at 10:05Z that `FM` is still in the future.

Check verdict logic against **Part 91 VFR** rules.

Also pay attention to:

- A NO-GO on CAVOK / 9999 with only modest wind, unless the reason is night, density altitude, or another rule that still applies.
- A GO in fog or very low ceiling (for example visibility 800 m or less, or BKN/OVC/VV at 200 ft or less) on the default PPL VFR profile.
- `incomplete` when the METAR is a complete official report and should have been usable (this run sets `now` to five minutes after the report, so staleness should not be the cause).
- Non-finite numbers in `weatherUsed`, or a NO-GO with an empty `why`.
- Systematic patterns: one station, one kind of report (NIL, AUTO, VRB, CAVOK, TS, FG, strong gusts, `BKN///`, missing QNH, SPECI vs METAR), or a TAF TEMPO/BECMG/FM applied at the wrong time.

**Density altitude over the limit must be CAUTION only, never NO DEPART.** This product has no mass and balance.

You may also call `parseOfficial`, `tafSegs`, `conditionsAt` / the TAF helpers, and `evaluate` yourself on individual reports. Still do not edit the engine.

The runner already uses the real engine the same way the site does: `evaluate({ field, weather: { metar, taf }, profile: { licence: "ppl" }, aircraftId: "C172", rules: "vfr", phase, now })`, with `now` equal to the observation time plus five minutes, and the TAF that was in force at that time attached when we have one. Field elevation, runways, latitude and longitude come from the site’s own runway database and model points.

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

- How many stations, METARs, TAFs, and evaluations you ran, and the verdict mix (GO / CAUTION / NO-GO / incomplete).
- Crashes, if any, with reproductions.
- Parse failures, with examples, especially the 54 known cases above.
- The 6 FAGG CAVOK NO-GOs, and whether the future TAF `FM` group was applied wrongly.
- Odd results you believe are bugs, with examples, versus odd results you believe are correct Part 91 VFR behaviour (say why).
- Density-altitude handling (CAUTION only, never NO DEPART).
- Site bugs from phase 2, each with exact steps, expected vs actual, file and line, and severity.
- Anything you did not have enough TAF history to judge (TAF coverage is only about 30 days).

Do not “fix” the engine in this pass. If you want to suggest a fix, describe it in words only and leave the engine code unchanged. Do not deploy.

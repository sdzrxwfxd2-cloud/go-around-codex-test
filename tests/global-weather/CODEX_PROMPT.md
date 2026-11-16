# Codex prompt — Go Around engine and site test brief (16 Nov 2026)

Read the repository README and `GO-AROUND-CODEX-TEST-BRIEF.md` first. Do not change `site/engine/*`. Do not deploy.

You are testing the Go Around aviation app from this frozen public snapshot (tag `codex-freeze-16nov`, 16 November 2026 SAST), production commit `5a5e60b21`.

Hard rules:

- Do **not** modify anything under `site/engine/`. The engine is locked. Engine files are reference only; report bugs, do not rewrite them.
- Do **not** deploy, and do not push to `main` or any live or production branch.
- Do **not** invent or mutate weather reports. Only use `tests/sa-weather/raw/` and `tests/global-weather/raw/`.
- You may add notes, extra result files, or tests under the test folders if they help, but leave the raw reports and the engine alone.
- Output a single `BUGS.md`-style report. For every bug, give exact reproducing input, expected vs actual, file and line, and severity.

# Phase 1 — ENGINE first (use high or extra-high reasoning)

Run both official runners from the repository root:

```bash
node tests/sa-weather/run-engine.mjs
node tests/global-weather/run-engine.mjs
```

Each imports `site/engine/ga-core-v2.js` read-only.

## 16 November 2026 fixes already in this engine

Confirm the official `tests/sa-weather/RESULTS.md` baseline, then go deeper if you wish. On 16 November the engine was updated to:

- Read directional and split visibility (`0400W`, `4500W 9999` — use the lower value)
- Split glued weather groups (`9999-RA`)
- Return INCOMPLETE on garbled required groups instead of guessing
- Stop treating a TREND / BECMG / TEMPO CAVOK as CAVOK now

The official South African rerun was 190,645 real METARs, 381,290 evaluations, 0 crashes, 0 parse failures, 0 odd results.

The 6 FAGG CAVOK NO-GOs from the 15 November run were **correct** under the default PPL minima (8 km / 2,500 ft) and the 2-hour look-ahead. They were not an engine bug. Do not treat them as open defects.

## Known open gaps — confirm and analyse

These were found on the worldwide set (`tests/global-weather/`, official `RESULTS.md`) and have not been fixed:

1. **Statute-mile visibility not read:** `10SM`, `3SM`, `P6SM`, `15SM`, `1/2SM`, and the same SM groups in US and Canadian TAFs. Example: `METAR CYFB 160000Z 31006KT 15SM BKN025 M06/M09 A3020 RMK SC7 SLP231` — `parseOfficial` returns `vis: null`. This is the large worldwide gap; South African reports use metres and CAVOK, so it does not show on the SA set.
2. **Directional visibility with a slash:** `8000NW/N`, `8000NE/E`. The 16 November fix already reads `0400W` and `8000NE`. It does not read the slash form. Example: `METAR MDSD 211800Z 10006KT 8000NW/N VCSH FEW020CB BKN022 30/23 Q1014 CB/NW/N`.
3. **Missing space before a cloud group:** `9999FEW010`, `9999BKN014`, `9999OVC015`, `9999SCT023`.
4. **Visibility in kilometres written as `8KM`:** for example `8KM BR`, `8KM RA` (HAAB).
5. **Foreign airports have no runway headings** in the site database, so `field.runways` is empty and the engine treats the whole wind as worst-case crosswind. That is current policy. The worldwide runner did not invent headings.

Also check verdict logic against **Part 91 VFR**, the default **PPL preset minima** (8 km visibility, 2,500 ft ceiling), and look-ahead windows (including `FM` / `BECMG` / `TEMPO`).

**Density altitude over the limit must be CAUTION only, never NO DEPART.** This product has no mass and balance.

You may also call `parseOfficial`, `tafSegs`, `conditionsAt` / the TAF helpers, and `evaluate` yourself on individual reports. Still do not edit the engine.

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

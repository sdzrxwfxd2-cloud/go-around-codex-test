# Go Around core engine v2: change history

This was the header comment of `site/engine/ga-core-v2.js`. It was moved here word for word on 16 Nov 2026 to keep `main.html` under its brotli budget after the parser fix. No rule changed when it moved.

Based on the 30 Oct 2026 overlay rules (wst-engine.js), consolidated with
a single source-priority ladder, real Depart/Land timing, and the
33rd Amendment (GG 55226, 21 August 2026) VMC minima.

Rule pack 2.4.0 — 13 November 2026 (Africa/Johannesburg).
2.1.0: gust, variable-wind and model-wind triggers tied to the user's own limits.
2.2.0: missing METAR visibility is filled from the TAF prevailing value, then the model;
       a fill below the legal / user minimum is NO DEPART / NO LAND, not caution;
       a clearly good fill is a plain GO, explained in the verdict text, not a note.
2.3.0: LAND after dark without night rating is CAUTION (night checked at ETA, not now);
       TEMPO / PROB wind and gust in the landing window and the departure 2-hour scan
       are checked against the user's limits (over the limit is NO DEPART / NO LAND).
2.3.1: the user's gust limit is capped at 35 kt; 9999 and CAVOK mean 10 km or more,
       so they meet any visibility limit up to 10 km and do not trigger the near-limit
       caution (the same applies to TAF values and visibility fills).
2.3.2: model weather is fresh for up to 3 hours and may be GO; the POL-MODEL-OLDER
       caution cap is removed, because data older than 180 min is already unused.
2.4.0 (13 Nov 2026, MT wind rule): when the chosen report has no wind (no wind group,
       /////KT, AUTO without wind, a stale METAR without wind, a NOSIG / TREND without
       wind, a TAF period without wind), the wind is taken from the TAF for that time;
       with no TAF wind, from the model. Crosswind, tailwind and gust checks run on that
       wind, and the verdict says where it came from. Only with no wind anywhere is it
       CAUTION "Wind not reported" (POL-WIND-MISSING). A stale METAR (older than
       policy.metarFreshMin) that does report a wind has it replaced the same way, TAF
       then model (policy.windReplaceStale, MT 13 Nov 2026); with neither it is kept.

## 16 Nov 2026 (Africa/Johannesburg): parser fix from the real South African METAR set (MT approved)

Rules 2.5.0, the limits, and `RULES_LOCK` are unchanged. Only the way a METAR is **read** changed:

1. **Directional visibility.** Groups like `0400W`, `4500SE`, `9999E` and `6000NDV` are read, and the direction is ignored. Every visibility group between the time group and the first cloud, temperature or QNH group is read, and the **lowest** one is used. For example `4500W 9999` gives 4 500 m, and `9999 1200S` gives 1 200 m. RVR (`R02/P2000N`), `////`, and groups after the temperature are never read as visibility.
2. **Glued weather.** `9999-RA`, `9999-SHRA` and `9999TSRA` are split into `9999 -RA` before reading, so the weather check sees them too. Only real WMO 4678 codes are split. The raw report is still shown exactly as it was sent.
3. **Malformed required groups.** A wind such as `23016VKT` or `01006K6002KT`, a visibility such as `5000VE`, or a cloud such as `BKN49` gives **INCOMPLETE** (`POL-PARSE-INCOMPLETE`, code `parse`) instead of a guess. A validly coded missing group (`/////KT`, `////`) keeps the locked fill and missing-data rules. `COR`, `AMD`, `AUTO` and `CCA` are skipped before the weather check.
4. **CAVOK in a TREND.** `... 2500 BCFG NSC ... BECMG CAVOK` used to be read as CAVOK now, which gave a false GO in 2.5 km fog. CAVOK is now read only from the report itself.
5. **TAF FM / TEMPO / BECMG / PROB timing** was checked and is unchanged. The FAGG NO-GOs flagged on 15 Nov are correct. The `FM` period starts inside the look-ahead (depart: the next 2 h; land: ETA ±1 h, CAR 91.07.7) and is below the PPL preset minima of 2 500 ft and 8 km. Day and month rollover is correct.

Tests: `tests/engine-v2/sa-weather-parser.test.mjs` (real report strings), and `node tests/sa-weather/run-engine.mjs` over the full set.

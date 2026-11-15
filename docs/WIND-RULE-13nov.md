# Wind rule — 13 Nov 2026 (rule pack 2.4.0)

MT (13 Nov 2026, SAST): **when the METAR wind is unknown, use the TAF wind; with no TAF, use the model wind.**

## What the engine does (site/engine/ga-core-v2.js, `fillWind`)

1. The source is picked as before (METAR / SPECI / TREND / TAF / model).
2. If that source has no wind speed (no wind group, `/////KT`, AUTO without wind, stale METAR without wind, NOSIG / TREND
   without wind, TAF period without wind), the wind is taken from the **TAF prevailing wind at the planning time** (now, ETD, ETA).
3. No TAF wind: the **model** row for that time (usable = fetched within 180 min; for Land +1h/+2h/+3h a row inside ETA ±1 h).
4. Crosswind, tailwind, variable-wind and gust checks run on that wind. A model wind keeps the model margins
   (NO DEPART only when clearly beyond the limit; borderline is CAUTION).
5. The verdict text ends "— wind from TAF" / "— wind from model"; a note `POL-WIND-FILL` says what was taken.
   `result.windSource` and `weatherUsed.windSrc` = `metar` | `speci` | `trend` | `taf` | `model`.
6. No wind anywhere: CAUTION "Wind not reported — crosswind and tailwind not checked" (`POL-WIND-MISSING`), as before.
7. A reported METAR wind (including calm `00000KT`) is never replaced.

Example (the MT test case): METAR `AUTO /////KT 9999`, TAF `25020KT`, FACT RWY 19, C172 (12 kt) → **NO DEPART, crosswind 19 kt — wind from TAF**.

## Card

The wind row shows the wind the verdict used, with a small **TAF** or **Model** tag when it came from there. "—" only when
there is no wind anywhere. Never "undefined°", "000°" (unknown direction is "—°") or a fake "Calm". The row is never hidden.

## Where the rule is written

- This repo: `docs/engine-v2/POLICY.md` (the old line "Missing wind = CAUTION" is replaced), `docs/engine-v2/DECISIONS.md`,
  this file, the engine header (rule pack 2.4.0) and `tests/engine-v2/wind-fill.test.mjs`.
- **Not in this repo:** `DECISIONS-MASTER.md` and the `RULES-*` files live in `sdzrxwfxd2-cloud/go-around-launch-11nov`,
  branch `fix/audit-fixes-12nov`. They were **not** changed by this branch. The same text should be added there
  (one entry under the engine rules), on MT's say-so.

## Stale METAR that reports a wind (MT t1968u, 13 Nov 2026)

MT answered the open question: a **stale** METAR (older than `policy.metarFreshMin` = 60 min, the same threshold as the
"getting stale" CAUTION `POL-METAR-STALE-60`) that **does** report a wind has its wind replaced the same way: the TAF wind
for that time, else a usable model wind, labelled "wind from TAF" / "wind from model" (TAF / Model tag on the card). The
note `POL-WIND-FILL` says "METAR is stale (N min old), its wind ddd° ss kt replaced from the TAF/model". With no TAF wind
and no usable model, the stale METAR's own wind is kept. A fresh METAR (60 min or less) is never replaced. Policy flag
`windReplaceStale: true` (rule pack 2.4.0 checksum updated). Tests: `tests/engine-v2/wind-fill.test.mjs` (stale cases).

# Go Around — Codex test snapshot

A cleaned, frozen copy of the Go Around aviation site, made so Codex can test the weather engine and look for site bugs.

This is **not** the live private repository.

- **Frozen on:** 16 November 2026 (Africa/Johannesburg, SAST)
- **Site snapshot:** production commit `5a5e60b21` (tag `live-16nov-engine-fix`, branch `live/model-3h-11nov`)
- **South African weather test set:** `tests/sa-weather/` from branch `test/sa-weather-dataset-15nov`, with the corrected runner and post-fix results from `fix/engine-parser-fm-16nov`
- **Worldwide weather test set:** `tests/global-weather/` from branch `test/global-weather-1m-16nov`, commit `28e2168c4`
- **Tag in this repo:** `codex-freeze-16nov`
- The previous freeze, `codex-freeze-15nov`, is kept in this repository's history.

Engine files under `site/engine/` are **reference only**. Report bugs. Do not rewrite them. Do not deploy.

## What was fixed on 16 November 2026 (already in this snapshot)

These parser and trend fixes are already on this production engine. They are not open bugs:

- Directional and split visibility, for example `0400W` or `4500W 9999` (use the lower value)
- Glued weather groups with a missing space, for example `9999-RA`
- Garbled required groups now yield INCOMPLETE instead of a guess
- A CAVOK in a TREND / BECMG / TEMPO no longer counts as CAVOK now

On a rerun of all 381,290 South African checks: 0 crashes, 0 parse failures, 0 odd results. 137 verdicts changed, almost all of them stricter (false GOs removed).

The 6 FAGG CAVOK NO-GOs from the 15 November run were **not** an engine bug. The TAF `FM` period fell inside the 2-hour look-ahead, and 2,000 ft / 6 km are below the default PPL minima (2,500 ft and 8 km). The first test script had compared them against the wrong limits (the Part 91 VFR floors of 1,000 ft / 5 km). The engine logic was right.

## Run the engine tests

From the repository root:

```bash
node tests/sa-weather/run-engine.mjs
node tests/global-weather/run-engine.mjs
```

Useful South African flags: `--station=FACT`, `--limit=500`, `--all-icao`, `--no-write`.

Useful worldwide flags: `--station=EGLL`, `--limit=500`.

Each runner imports `site/engine/ga-core-v2.js` read-only and writes `RESULTS.md` and `results.json` in its own folder. Official 16 November 2026 result files are already in those folders. See `tests/sa-weather/README.md` and `tests/global-weather/README.md`.

The worldwide run is large (about 2.8 million METARs, 152,244 TAFs, about 7 million checks) and takes a few minutes.

## Known open gaps (please confirm)

These were found on the worldwide set and have **not** been fixed:

1. Statute-mile visibility is not read: `10SM`, `3SM`, `P6SM`, `15SM`, `1/2SM`, and the same groups in US and Canadian TAFs.
2. Directional visibility with a slash: `8000NW/N`, `8000NE/E`.
3. Missing space before a cloud group: `9999FEW010`, `9999BKN014`.
4. Visibility in kilometres written as `8KM`.
5. Foreign airports are not in the site's runway list, so `field.runways` is empty and the engine treats the whole wind as worst-case crosswind. That is current policy, not a crash. No runway headings were invented for the test.

## Serve the site locally (static)

From the repository root:

```bash
python3 -m http.server 8080 --directory site
```

Then open http://127.0.0.1:8080/

Live weather APIs, admin tools, the private Zalaota hub, and investigator pages are not included in this copy. Cloudflare account, D1, KV, and Netlify IDs were replaced with placeholders. This snapshot cannot be used to deploy the live site.

## Rules for Codex

1. Read this README first, then `GO-AROUND-CODEX-TEST-BRIEF.md`, `tests/sa-weather/README.md` and `tests/global-weather/README.md`.
2. Phase 1: engine work on both real weather sets (high / extra-high reasoning). Do not edit `site/engine/*`.
3. Check verdict logic against Part 91 VFR, the default PPL preset minima (8 km / 2,500 ft), and look-ahead windows. Density altitude over the limit must be CAUTION only, never NO DEPART (there is no mass and balance in this product).
4. Phase 2: site bugs (medium reasoning): pages, filters (ATO 271 / DFE 126, course search), status bar, E6B, nav, themes, mobile 390 px.
5. Report every bug with exact reproducing input, expected vs actual, file and line, and severity.
6. Write a single `BUGS.md`-style report. Do not deploy.

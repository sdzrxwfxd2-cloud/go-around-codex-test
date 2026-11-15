# Go Around — Codex test snapshot

A cleaned, frozen copy of the Go Around aviation site, made so Codex can test the weather engine and look for site bugs.

This is **not** the live private repository. Git history was not copied.

- **Frozen on:** 15 November 2026 (Africa/Johannesburg, SAST)
- **Site snapshot:** production commit `b92318387` (tag `live-15nov-final-3`)
- **Weather test set:** `tests/sa-weather/` from commit `702d601f3` (branch `test/sa-weather-dataset-15nov`)
- **Tag in this repo:** `codex-freeze-15nov`

Engine files under `site/engine/` are **reference only**. Report bugs. Do not rewrite them. Do not deploy.

## Run the engine test

From the repository root:

```bash
node tests/sa-weather/run-engine.mjs
```

Useful flags: `--station=FACT`, `--limit=500`, `--all-icao`.

The runner imports `site/engine/ga-core-v2.js` read-only and writes `tests/sa-weather/RESULTS.md` and `tests/sa-weather/results.json`. A previous run (15 Nov 2026) is already in those files. See `tests/sa-weather/README.md`.

## Serve the site locally (static)

From the repository root:

```bash
python3 -m http.server 8080 --directory site
```

Then open http://127.0.0.1:8080/

Live weather APIs, admin tools, the private Zalaota hub, and investigator pages are not included in this copy. Cloudflare account, D1, KV, and Netlify IDs were replaced with placeholders. This snapshot cannot be used to deploy the live site.

## Rules for Codex

1. Read this README first, then `tests/sa-weather/README.md` and `tests/sa-weather/CODEX_PROMPT.md`.
2. Phase 1: engine work on the real South African weather set (high / extra-high reasoning). Do not edit `site/engine/*`.
3. Phase 2: site bugs (medium reasoning): pages, filters (ATO 271 / DFE 126, course search), status bar, E6B, nav, themes, mobile 390 px.
4. Report every bug with exact reproducing input, expected vs actual, file and line, and severity.
5. Write a single `BUGS.md`-style report. Do not deploy.

Part 91 VFR only. Density altitude over the limit must be CAUTION, never NO DEPART (there is no mass and balance in this product).

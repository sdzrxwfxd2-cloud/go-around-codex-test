# South African real-weather test dataset

A large set of **real** METAR, SPECI and TAF reports for South African (`FA**`) stations, so the Go Around engine can be tested against actual weather, not made-up cases.

Nothing in this folder is synthetic. Every report was copied from a named public archive or from the Go Around site’s own weather feed. The engine under `site/engine/` is **locked**: this dataset and its runner only import it read-only.

## What is in here

| Path | What it is |
| --- | --- |
| `raw/metar/{ICAO}.txt.gz` | Deduplicated METARs and SPECIs for one station |
| `raw/taf/{ICAO}.txt.gz` | Deduplicated TAFs for one station |
| `manifest.json` | Station list, date ranges, counts, and the source of each file |
| `run-engine.mjs` | Feeds each METAR (plus the TAF in force at that time, if we have one) through the real engine |
| `RESULTS.md` | Summary of one run: verdict counts, crashes, parse failures, odd results |
| `results.json` | The same run, machine-readable, with examples |
| `CODEX_PROMPT.md` | A ready-to-paste prompt for Codex to re-run the hunt and look for bugs without changing engine files |
| `tools/fetch.py` | The script that gathered the reports (re-run only if you want a newer snapshot) |
| `sources/` | Provenance: live API copies, box snapshots, IEM station list |

Each raw line is:

```
{time UTC}	{metar|speci|taf}	{raw report}	{comma-separated sources}
```

## Coverage (gathered 15 Nov 2026)

- **METARs / SPECIs:** 190,645 South African reports over 12 months, 16 Nov 2025 00:00 UTC to 15 Nov 2026 21:30 UTC (192,515 including neighbouring stations from the live feed).
- **TAFs:** 2,206 South African TAFs from the last 30 days that public TAF archives will give, 15 Oct 2026 to 15 Nov 2026, plus a few older reports from saved Go Around snapshots (2,956 including neighbouring stations).
- South African `FA**` stations with at least one METAR: 33. With at least one TAF: 18.
- Neighbouring stations that appear in the live Go Around weather feed (for example FYWH, FBSK, FQMA) are kept in `raw/` and tagged `south_africa_fa: false` in the manifest. The runner skips them unless you pass `--all-icao`.

See `manifest.json` for exact per-station counts and date ranges. The big METAR archive is the Iowa Environmental Mesonet `ZA__ASOS` network (hourly and special reports, including fronts in Cape Town, Highveld thunderstorms, fog and strong winds). TAFs come mainly from aviationweather.gov’s dataserver, which caps history at about 30 days.

## How to run the engine over it

From the repository root:

```bash
node tests/sa-weather/run-engine.mjs
```

Useful flags:

```bash
node tests/sa-weather/run-engine.mjs --station=FACT
node tests/sa-weather/run-engine.mjs --limit=500
node tests/sa-weather/run-engine.mjs --all-icao
```

The script imports `site/engine/ga-core-v2.js` read-only (the same `evaluate` / `parseOfficial` entry points the site uses). It does **not** write to `site/engine/`.

Each report is judged as if “now” were five minutes after the observation, with the TAF that was in force at that time attached, for both Depart and Land, using the default PPL / Cessna 172 / VFR profile. That is the same path the live site uses for a current official report. Using wall-clock “now” would make every historical METAR look stale, which would not test the rules.

A full run writes `RESULTS.md` and `results.json`.

## Sources

1. **Go Around live site** (15 Nov 2026): `https://go-around-aero.pages.dev/api/wx-now`, `/api/metar`, `/api/taf`, `/api/weather-snapshot`. Copies are under `sources/go-around-live/`.
2. **Saved snapshots on the box** (read only): public `/api/metar`, `/api/taf` and weather-snapshot copies, plus `docs/wx-history-15nov` report rows already saved earlier. No production Worker/KV or go-around-db weather dump was present beyond those public snapshots.
3. **Iowa Environmental Mesonet** ASOS/METAR archive, network `ZA__ASOS`: [station list](https://mesonet.agron.iastate.edu/sites/networks.php?network=ZA__ASOS&format=csv&nohtml=on) and [asos.py](https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py) with `data=metar` for 16 Nov 2025–16 Nov 2026 (end exclusive). This is the 12-month METAR backbone.
4. **aviationweather.gov data API / dataserver**: METARs and TAFs for about the last 30 days (the service rejects longer date ranges; `hoursBeforeNow=2160` still started on 15 Oct 2026).
5. **Ogimet** `display_metars2.php` (`fmt=txt`): last ~36 hours only. Older windows from this host came back as an empty page, so Ogimet is a recent complement, not the long archive.

Every report in `raw/` carries its source tag. If the same report appeared in more than one place, it is stored once and the tags are joined.

## Limitations (please quote these honestly)

- TAF history from public APIs is about **30 days**, not 12 months.
- Many smaller `FA**` fields the site shows on the map have no METAR/TAF station, so they do not appear here.
- No weather was invented to pad the set.

A landing-page claim such as “tested on 100,000 scenarios” should be replaced with the real numbers from `RESULTS.md` (for example “run against N real South African METARs covering 12 months at 33 stations”).

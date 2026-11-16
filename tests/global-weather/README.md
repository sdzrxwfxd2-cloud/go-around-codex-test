# Global real-weather test dataset (16 Nov 2026)

A set of **real** METAR, SPECI and TAF reports from airports outside South Africa, so the Go Around engine can be tested on worldwide weather, including forecast time windows. Nothing in this folder is synthetic. Every report was copied from a named public archive and carries a source tag.

The engine under `site/engine/` is **locked**. This dataset and its runner only import it read-only. The run in `RESULTS.md` used the fixed engine on branch `fix/engine-parser-fm-16nov`, commit `5a5e60b21`.

South African `FA**` stations are not repeated here; they already have their own 12-month set under `tests/sa-weather/`.

## What is in here

| Path | What it is |
| --- | --- |
| `raw/metar/{ICAO}.txt.gz` | Deduplicated METARs and SPECIs for one station |
| `raw/taf/{ICAO}.txt.gz` | Deduplicated TAFs for one station |
| `manifest.json` | Station list, date ranges, counts, and the source of each file |
| `run-engine.mjs` | METAR pass plus a separate forecast-timing pass through the real engine |
| `RESULTS.md` | Summary of the 16 Nov 2026 run |
| `results.json` | The same run, machine-readable, with examples |
| `tools/fetch.py` | The script that gathered the reports |
| `sources/` | Station metadata, fetch log, and rare parse-failure examples |

Each raw line is:

```
{time UTC}	{metar|speci|taf}	{raw report}	{comma-separated sources}
```

## Coverage (gathered 16 Nov 2026)

- **METARs / SPECIs: 2,811,809** real reports over 12 months, 16 Nov 2025 00:00 UTC to 15 Nov 2026 22:47 UTC, at 209 airports in 84 countries across Europe, the US, Canada, the Caribbean, Mexico, Australia, New Zealand, Asia, Africa (not South Africa) and South America.
- **TAFs: 152,244** real TAFs. US NWS TAFs cover the same 12-month window (IEM AFOS full text). International TAFs from aviationweather.gov cover about the last 30 days (the public dataserver cap), 17 Oct 2026 to 16 Nov 2026, plus a short Ogimet complement and the current cache snapshot.
- 212 airports were requested. Three had no usable archive data in IEM or aviationweather.gov for this window: OKBK, HSSS and HLLT. SEQU has METARs but no TAF.

The aim was about one million real METARs. The true count is **2,811,809**. No weather was invented to reach a round number, and none was thrown away to sit on one million either.

See `manifest.json` for exact per-station counts and date ranges. Stations were chosen for varied climates and plenty of bad weather (fog, monsoon, typhoon, hurricane, winter icing, desert dust, Amazon rain, high-elevation fields).

## How to run the engine over it

From the repository root (this branch includes the fixed engine):

```bash
node tests/global-weather/run-engine.mjs
```

Useful flags:

```bash
node tests/global-weather/run-engine.mjs --station=EGLL
node tests/global-weather/run-engine.mjs --limit=500
node tests/global-weather/run-engine.mjs --metar-only
node tests/global-weather/run-engine.mjs --forecast-only
```

`ENGINE_ROOT` or `--engine=` can point at another engine copy. The script does **not** write to `site/engine/`.

Two passes:

1. **METAR pass.** Each real METAR/SPECI, with the TAF then in force if we have one. `now` is five minutes after the report, Depart and Land, default PPL / Cessna 172 / VFR.
2. **Forecast pass (counts reported separately).** Each TAF is evaluated at hourly times across its validity, and at five minutes before and after every FM, BECMG, TEMPO, PROB, validity and month-rollover boundary, only while that TAF is still the one in force, paired with the METAR then in force. Depart and Land.

### Foreign stations and missing runway data

The SA runway database has no foreign airports, so `field.runways` is left empty — the same approach the SA runner uses when a station has no runways. No runway headings were invented. The engine then treats the whole wind as worst-case crosswind. That is stated engine policy, not a bug, and those NO-GOs are counted separately.

Latitude, longitude and elevation come from aviationweather.gov stationinfo so night and density altitude can still run. All 209 stations in the run had lat/lon and elevation.

## Sources

1. **Iowa Environmental Mesonet** ASOS/METAR archive (`asos.py`, `data=metar`) for the 12-month METAR backbone, requested per ICAO, 16 Nov 2025–16 Nov 2026 (end exclusive).
2. **IEM AFOS** (`retrieve.py`, product `TAFxxx`) for full raw US NWS TAF text over the same 12 months. IEM's processed `taf.py` CSV only has period fragments, so it was not used as the TAF text.
3. **aviationweather.gov dataserver** for METARs and TAFs over about the last 30 days (international TAF history lives here).
4. **aviationweather.gov cache** (`metars.cache.xml.gz`, `tafs.cache.xml.gz`): one current worldwide snapshot, kept only for the curated stations.
5. **Ogimet** `display_metars2.php` (`fmt=txt`): last ~36 hours at a sample of stations, as a recent complement. Older Ogimet windows are often empty.

Every report in `raw/` carries its source tag. If the same report appeared in more than one place, it is stored once and the tags are joined. Requests were rate-limited and identified with a research user agent.

## Limitations (please quote these honestly)

- International TAF history from public APIs is about **30 days**, not 12 months. US NWS TAFs are the exception (12 months from IEM AFOS).
- Three requested airports produced no reports.
- The engine does not read statute-mile visibility (`10SM`, `3SM`, `P6SM`) from raw METAR or TAF text. That dominates US and Canadian verdict counts until it is fixed. See `RESULTS.md`.
- No weather was invented to pad the set.

## Suggested landing-page line

Use the real numbers, and do not claim an accuracy percentage from this run alone:

**"Tested on 2,811,809 real METARs and 152,244 real TAFs from 209 airports in 84 countries, covering 12 months: 5,623,618 departure and landing checks, plus 1,453,898 forecast-timing checks, with zero crashes."**

Add, if there is room, that international TAF history is about 30 days, and that US TAF history is 12 months.

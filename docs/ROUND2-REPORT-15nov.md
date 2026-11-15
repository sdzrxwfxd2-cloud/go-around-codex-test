# Round 2 report: fix/engine-gaps-15nov (15 Nov 2026)

Times are SAST (UTC+2). This round had no merge to main and no Pages deploy. The Worker deploy was approved by MT at 14:26 and done at 15:28. No force-push. Author: Grok Bot (same as earlier commits).

## Commits this round (on top of 6ab1b7af1)

| Commit | Files | What | Why |
|---|---|---|---|
| 3d23338c8 (merge) | brings in b8ebc8469: site/data/ad-runways-elev.locked.v1.json, README, docs/WX-ISSUE-SCHEDULE-15nov.md, docs/DATA-ENGINE-ISSUES-15nov.md, docs/wx-history-15nov/* | Locked runway/elevation DB v1 merged (data only, not wired yet) | MT 14:23 |
| 8a68a2ff0 | cloudflare/functions/_middleware.js, cloudflare/test/middleware_etag.test.mjs, site/index.html | Reverts 4c23e6ce6 (FAHS→FAHT page redirect for ten cards) | MT 14:23 |
| 57de9d948 | site/engine/ga-core-v2.js, ga-core-v2-wire.js, wm-core.js, wm-filters-reset.js, wst/status-v4.js/.css, wst/wst-engine.js, c/wst/wst-engine.js, wst/wst-main.js | Pilot density-altitude switch (localStorage wm-da-verdict). Default OFF means DA is shown as info only; ON means DA caution counts in the verdict, as before | MT 14:23 |
| 5ba96bf4c | site/data/ad-runways-elev.locked.v2.json (v1 untouched), README, docs/RWDB-V2-VERIFICATION-15nov.md, tools/rwdb/verify_v2.py, report_v2.py, aip_elev_pdf.py, fix_rwy_elev.py, tools/rwdb/raw-v2/*, site/rwy/rwy-data.js and site/c/rwy/rwy-data.js (one AIP elevation) | DB v2: every record checked against OurAirports, OSM and the AIP PDFs | MT 14:23: "DB v2 verification" |
| cb624d814 | site/wst/wst-cards-data.js | 11 card positions corrected where the evidence is clear; FARZ province changed from Limpopo to Free State | Wrong positions; evidence in tools/rwdb/raw-v2/card-position-fixes.json |
| f2ba3fdba | site/engine/ga-core-v2-wire.js, wst/wst-ad.js, wst/wst-card.js, tools/rwdb/emit.mjs, tools/first-visit/stamp.mjs, ?v= tags in the main pages and 1,258 site/ad + site/c/ad pages, wx-check engine copy, cloudflare/test/first_visit.test.mjs, tests/perf/pilot-safety-gate.mjs | Engine uses DB runway headings and field elevation | Wire the locked DB into the engine |
| 65a52dcda | site/wst/ad-rwy-db.aba7cb0482.json (replaces ad-rwy-db.js), wire, wst-ad.js, emit.mjs, main/status script tags, 629 ad pages ?v=; netlify/lib/wx_snapshot.mjs, cloudflare/worker/src/index.mjs, wrangler.jsonc (cron `* * * * *`), cloudflare/lib/kv_bundle.mjs, fast_compose.mjs, new cloudflare/test/worker_windows.test.mjs, first_visit test | (1) The DB is a separate, hashed, cached JSON. It is fetched only when the engine needs it, and cards show "Loading runway data…" until it arrives. (2) Worker weather windows: METAR every minute at :04–:20 and :30–:34, otherwise every 5 min. TAF every minute for 45 min after 00/05/06/08/11/12/18 SAST, otherwise every 10 min. KV is written only when a report changed, with a daily write guard of 990. The page polls /api/wx-now only in those minutes. taf.prev keeps the previous TAF | MT 14:55: main page must not grow. Weather windows were requested earlier |
| 14b176b6f | site/wx-check/wxc-core.js, wxc.js, admin-weather-check.html (sha1 ?v= set by hand), wire ?v= tags, cloudflare/test/wx_check.test.mjs | The admin weather-check sandbox gets the lazy DB | It was stuck on "Loading runway data" |
| 07787f595 | cloudflare/worker/src/index.mjs, worker_windows.test.mjs | On the first run after deploy, the Worker counts the old Worker's writes from earlier today | Keeps deploy day under the 1,000/day KV limit |
| 57e52fb23 | site/engine/ga-core-v2-wire.js, wx-check copy, ?v= tags | Heliport cards are not held while the DB loads | With a late DB their text became "No current weather". The same-clock check now has 0 differences |
| (this commit) | docs/AERODROME-CLOSED-AND-POSITION-EVIDENCE-15nov.md, docs/ROUND2-REPORT-15nov.md, docs/fix-engine-gaps-15nov/round2/* | Evidence list, this report, test logs, comparison, screenshots | Items 4–5 |

## Bytes (page:main.html:assets_br, brotli q5, tools/perf-budget.mjs)

- Live (b0496a909): 308,412
- Branch at the start of round 2: 309,809 (over budget)
- DB loaded as a script (rejected): 313,117
- Now: **308,280**. The budget is **308,500, unchanged**. perf-budget passes.
- c/main.html: 193,427 live, 196,040 now (within its budget)
- The DB JSON loads only when needed and is cached: 13,422 bytes raw, 5,289 at br q5. It is not counted in main.html's assets.

## Tests (final full run after the last code commit 57e52fb23)

docs/fix-engine-gaps-15nov/round2/tests-final.txt. All 47 suites/checks passed (rc=0) plus node-check bad=0. That covers:
- engine-v2 tests
- safety tests
- engine-v2/run.js
- perf tests, including perf-budget, pilot-safety-gate and first-load
- cloudflare tests: 63/63
- vbump --check

Two earlier full runs are in tests-run1/2.txt.

## Lazy-load check

lazy.mjs / lazy-db-check.json: 640 cards in 2 modes, with the DB loaded before first render and after it, on the same clock. Result: 0 differences.

## 640-card comparison (live vs branch, C172, same weather snapshot)

The harness bug: the init script took `([mode, off, ac])` without `da`. It threw, so nothing was seeded. The old invalid run is kept in round2/broken-seed (local only).

After the fix: verdict-changes.md lists every changed card with the live text and the branch text.

| Mode | Changed | Real headings (before: "runway headings unavailable", worst-case gust) | Crosswind/tailwind on new headings | DA switch (OFF = info) |
|---|---|---|---|---|
| depart, DA OFF | 162 | 146 | 7 | 9 |
| land1, DA OFF | 113 | 102 | 6 | 5 |
| land3, DA OFF | 129 | 118 | 2 | 9 |
| depart, DA ON | 139 | 130 | 9 | 0 |
| land1, DA ON | 94 | 88 | 6 | 0 |
| land3, DA ON | 110 | 108 | 2 | 0 |

Stricter verdicts, depart DA OFF:
- FAKG, FABA, FARD: caution→nogo (crosswind on real headings).
- FAMS, FATF: caution→nogo. The analyzer filed these under "density altitude switch", but with DA ON the same cards are also stricter and are filed under crosswind. The real cause is crosswind on the real headings.
- FAWI: go→nogo. Only 04/22 has a verified heading.

Every other change is less strict:
- caution→go: 50
- nogo→go: 41
- nogo→caution: 65

With DA ON, no change is caused by DA.

Status vs Aerodromes: on the branch, 0 differences for all 12 aircraft, both phases and both DA modes (live has 10).

Hand check: hand-check-30.md has 30 random changed cards recomputed by hand. All 30 were OK.

## Worker production check (go-around-weather, deployed 15:28, version f70770d2)

- The tail from 15:30 to 15:49 shows 17 runs, 0 errors, CPU at most 63 ms (worker-tail-summary.txt). The tail dropped some runs; the daily write counter confirms they ran.
- The minute windows behave as designed:
  - Fetch and write at :32/:34/:35.
  - No-ops at :36–:38 and :41–:44.
  - :45 fetched but wrote nothing ("no report changed").
  - The 10-min beat writes 3 keys.
- The daily KV count at 15:45 was 260. Expected about 720–800 per day; the hard guard is 990.
- /api/wx-now, /api/metar and /api/taf returned 200 every minute, with 29 METAR and 24 TAF rows (prod-poll.log). The 13:30 UTC (15:30 SAST) observation was served at 15:30:52. Before this, reports could be up to 20 min old.
- Rollback, if ever needed:
  1. `wrangler rollback 0c76ff3c-98ff-4eb6-8024-cbf0ab3283f8`
  2. Set the cron back to `*/10 * * * *` in wrangler.jsonc and redeploy the triggers, because triggers are not versioned.

## Pictures

docs/fix-engine-gaps-15nov/round2/ contains:
- before-/after-aerodromes-{depart,land0,land1,land3}-da{OFF,ON}-390.png
- before-/after-status-c172-depart-da{0,1}-390.png
- status-da-switch-{off,on}(-page)-390.png
- mockup-taf-tab-next-period-390.png. This is a picture only, using a fixture TAF. It is not built.

## Open issues

1. FAKG: the card is Komati Power Station, but the SACAA AIP FAKG is Kwandwe. MT needs to decide (see the evidence file).
2. FACO and FAHS have no AIP PDF on the site, so their elevation comes from other sources.
3. Card positions were corrected in wst-cards-data.js only. Other coordinate copies were not changed.
4. 8 fields have only partial heading coverage: FAWI, FASY, FADA, ZA-0317, ZA-0115, FANG, FARD, ZA-0245.
5. taf.prev is stored but no page uses it yet.
6. site/wst/ad-elev.js is still in the repo but no page loads it.
7. Aerodrome pages now show the AD elevation from the DB.
8. The v2 JSON is public under site/data.
9. On very busy days the 990/day guard may limit late-day minute writes. The 10-min writes are kept in reserve.
10. Worker CPU peaks at 63 ms on the 10-min beat.
11. Pages are not deployed. Live still serves b0496a909, while the Worker is already new. The new Worker's APIs are backward compatible; taf.prev is extra and optional.

# Eye icon on every aerodrome card (15 Nov 2026)

Branch: `fix/eye-icon-all-cards-15nov`
Page: Aerodromes (`main.html`), 390 px, Amethyst (night / purple). Not merged, not deployed.

## Cause

The circular info button (`.inote`, the “eye”) lived in `.fcb2` on the card’s tab row, next to the flight-condition chip. Static card HTML has an empty `.fcb2` and no button.

Only one writer added the button: `fillModel()` in `site/wst/wst-card.js`, and only when a **heliport** (or other card with no engine `weatherUsed`) got a VFR / MVFR / IFR / LIFR category. The main weather painter (`paintRules` in `ga-core-v2-wire.js`, used for METAR / TAF / model via the card weather chain) wrote the badges and **never** included an `.inote`. The LOW CLOUD path in both painters also omitted it. `ad-card.js` only filled `data-t` / `data-n` **if** a button was already there, and it only walked cards currently mounted in `#list` (about 10–30), not the 640-card store.

## Counts (same frozen live weather, 640 cards)

| | With eye | Without eye | LOW CLOUD |
|---|---:|---:|---:|
| Before | **36** | **604** | 87 (all missing the eye) |
| After | **640** | **0** | 87 (all have the eye) |

**36 that already had it:** heliports with a category, e.g. ZA-0319 (Anglo Coal Highveld Hospital), ZA-0215 (Benoni), ZA-0119 (Cape Town Waterfront). `paintCardWeather` returns early for heliports, so `fillModel` could add the button.

**604 that lacked it:**

- **517** — engine weather painter (`paintRules` / `GA_PAINT_WX`) wrote VFR·VMC / etc. with no button. Examples: FAAE (model), FACT (METAR), plus 17 METAR, 3 SPECI, 4 TAF, and the rest model.
- **87** — LOW CLOUD (visibility known, cloud base unknown, low cover ≥ 63 %). Examples: **FAAR** (Arathusa Safari Lodge), FAAS, FAGC, FAVC-path FAVG, FAWK.

## Fix

- Every painter that writes `.fcb2` now keeps `<button class="inote">i</button>` (category, LOW CLOUD, or empty).
- `ad-card.js` creates the button if it is missing, walks all 640 cards (`WM_ALL_CARDS`), and writes the existing flight-conditions note.
- For LOW CLOUD, the opened note’s Now row shows the amber **LOW CLOUD** chip plus: “Visibility known, cloud base unknown — a category is not assumed.” Sources stay in the existing M / T / F grid (METAR > TAF > model). No runway or elevation sources or dates were added on the card.

The long fallback paragraph previously baked into `fillModel`’s button was dropped; `ad-card.js` already writes the full note on this page (saves bytes).

## Files changed

- `site/wst/ad-card.js` — create the button; all 640 cards; LOW CLOUD sentence
- `site/wst/wst-card.js` — `fillModel` / `clearModel` always keep the button
- `site/engine/ga-core-v2-wire.js` — `paintRules` always keeps the button
- `site/wst/wst-common.js`, `site/wst/wst-main.js` — same when they clear or paint `.fcb2`
- `site/wx-check/engine-copy/ga-core-v2-wire.js` + `manifest.json` — sandbox copy kept in sync
- `?v=` bumps on the pages that load those scripts (`vbump`)

## Tests

- `tests/engine-v2/*.test.mjs` — all pass (one existing todo in wind-display)
- `tests/engine-v2/run.js` — OK, 170 rule cases
- `tests/safety/*.test.mjs` — all pass
- `tests/deeplink-route.mjs`, `gps-near-me.mjs`, `search-glow.mjs` — ok
- `cloudflare` `npm test` — 63 pass, 0 fail
- `node tools/vbump.mjs --check` — current
- `node tools/perf-budget.mjs` — ok

`page:main.html:assets_br` = **308,447** (limit 308,500). Measured after rebasing onto live `5927ba600` (DA-limit merge). Was 308,280 on the previous live head before this change.

## Screenshots (390 px, Amethyst)

Saved here and in `/workspace/eye-icon-15nov/`.

- Before, card missing the eye: `before-missing-eye-FAAR-390.png` (LOW CLOUD chip, no button)
- After, same card with the eye: `after-missing-eye-FAAR-390.png` (same file as `after-lowcloud-FAAR-390.png`)
- After, that eye panel: `after-missing-eye-FAAR-panel-390.png` / `after-lowcloud-FAAR-panel-390.png` (LOW CLOUD + the new sentence)
- After, another card that was missing the eye (FACT, METAR, VFR·VMC): `after-missing-eye-FACT-390.png` and `after-missing-eye-FACT-panel-390.png`

No merge, no deploy.

---

# Follow-up: LOW CLOUD details and a flexible panel (15 Nov 2026)

Same branch `fix/eye-icon-all-cards-15nov`. MT reviewed the first pictures and asked for the actual low-cloud details (not only the generic sentence) and a layout that wraps and grows. Not merged, not deployed.

## Now row (opened eye)

The generic sentence is gone. The Now subtitle is a short line:

`Vis {value} · {cloud that is known} · {METAR | TAF | Forecast} {time} SAST {(age)}`

- Visibility comes from the card’s Vis line.
- Cloud comes from the report itself when it is there: AUTO / NCD / NSC / SKC / CLR / CAVOK, or FEW/SCT/BKN/OVC/VV groups (including `///`). A lone AUTO is shown as “AUTO, no cloud group”. Otherwise the painted Sky / Cloud / Ceil text, then low-cloud or total-cloud %, else “no cloud group”.
- For LOW CLOUD the known cloud text is followed by “, base unknown”.
- The source is the weather source (METAR / TAF / Forecast), not the runway DB. Model cards say Forecast plus the valid window. METAR and TAF include the report time in SAST and an age (“38 min ago”, or “0 min ago” when under a minute).
- The same line is used on non-low-cloud cards.

Examples from this weather snapshot (Africa/Johannesburg):

- FAAR (model, LOW CLOUD): `Vis 10+ km · Cloud 98%, base unknown · Forecast 16:00–17:00 SAST`
- ZA-0058 Alverstone (model, LOW CLOUD; no TAF LOW CLOUD card in this snapshot): `Vis 5.8 km · Cloud 100%, base unknown · Forecast 16:00–17:00 SAST`
- FACT (METAR, VFR·VMC): `Vis 10+ km · FEW035 · METAR 16:00 SAST (38 min ago)`
- FAUT (TAF, long cloud groups, used for the narrow shot): `Vis 10+ km · BKN018 BKN012 FEW050 BKN008 SCT045 · TAF 11:00 SAST (0 min ago)`

86 LOW CLOUD cards in this snapshot, all from the model (none from a TAF).

## Layout

- `.ad-in-r`, `.ad-in-src` and `.ad-in-c` use flexible columns and `overflow-wrap: anywhere`. The old nowrap/clip rule is gone, so long values wrap instead of being cut.
- The frosted `.ipop` can grow with its content up to `calc(100dvh - 24px)` (it used to cap at `min(70dvh, 560px)`, which clipped IFR / LIFR on FAAR). Width is `min(420px, calc(100vw - 24px))`.
- Checked at 390 px and 320 px. No clipped or overlapping text. IFR and LIFR stay visible. Works in all four themes (Amethyst, Midnight, Pearl, Champagne); layout metrics reported no issues.

## Files changed (this commit)

- `site/wst/ad-card.js` — Now subtitle with vis / known cloud / source / time
- `site/wst/ad-card.css` — flexible wrapping columns
- `site/wm-info-modal.js` — panel can grow to the viewport
- `?v=` bumps, including the 639 + 639 aerodrome pages that load `wm-info-modal.js`

## Tests (rerun)

- `tests/engine-v2/*.test.mjs` — all pass (one existing todo in wind-display)
- `tests/engine-v2/run.js` — OK, 175 rule cases
- `tests/safety/*.test.mjs` — all pass
- `tests/deeplink-route.mjs`, `gps-near-me.mjs`, `search-glow.mjs` — ok
- `cloudflare` `npm test` — 64 pass, 0 fail
- `node tools/vbump.mjs --check` — current
- `node tools/perf-budget.mjs` — ok

`page:main.html:assets_br` = **308,404** (limit 308,500).

## Screenshots (390 px, Amethyst, unless noted)

Saved here and in `/workspace/eye-icon-15nov/`.

- FAAR opened: `detail-lowcloud-FAAR-panel-390.png` / `detail-lowcloud-FAAR-panel-page-390.png`
- Other LOW CLOUD (ZA-0058, model): `detail-lowcloud-ZA-0058-panel-390.png` / `detail-lowcloud-ZA-0058-panel-page-390.png`
- FACT opened: `detail-FACT-panel-390.png` / `detail-FACT-panel-page-390.png`
- Narrow long-text (FAUT TAF cloud groups, 320 px): `detail-narrow-longtext-FAUT-320.png` / `detail-narrow-longtext-FAUT-page-320.png`
- Theme checks of FAAR (not required, for the four-theme layout pass): `detail-theme-amethyst-FAAR-panel-390.png`, `detail-theme-midnight-FAAR-panel-390.png`, `detail-theme-pearl-FAAR-panel-390.png`, `detail-theme-champagne-FAAR-panel-390.png`

No merge, no deploy.

---

# Follow-up: LOW CLOUD in the flight-category legend (15 Nov 2026)

Same branch `fix/eye-icon-all-cards-15nov`. MT asked to add LOW CLOUD to the flight category, and what it means. Not merged, not deployed.

## Change

The opened eye panel’s category key (under “Flight category · set by the worse of ceiling or visibility”) now lists amber **LOW CLOUD** after VFR / MVFR / IFR / LIFR, with: “Visibility known, cloud base not reported, so no category is assumed. Check the cloud base yourself.”

The first column of that key grows to fit the LOW CLOUD label; the meaning wraps. The panel still grows with the extra row (FAAR 674 px at 390 px Amethyst, fully on screen, nothing clipped).

The Status page has no METAR flight-category legend (its “Flight rules” text is the VFR / IFR legal minima). The Aerodromes filter chips name VFR / MVFR / IFR / LIFR as filters but do not explain them, so this wording was added only in the eye-panel key, which is the place those categories are explained.

## Files

- `site/wst/ad-card.js` — LOW CLOUD row in `CATS`
- `site/wst/ad-card.css` — flexible first column (`auto`), labels stay on one line
- `site/main.html` — `?v=` bump

## Tests (rerun)

- `tests/engine-v2/*.test.mjs` — all pass (one existing todo in wind-display)
- `tests/engine-v2/run.js` — OK, 175 rule cases
- `tests/safety/*.test.mjs` — all pass
- `tests/deeplink-route.mjs`, `gps-near-me.mjs`, `search-glow.mjs` — ok
- `cloudflare` `npm test` — 64 pass, 0 fail
- `node tools/vbump.mjs --check` — current
- `node tools/perf-budget.mjs` — ok

`page:main.html:assets_br` = **308,456** (limit 308,500).

## Screenshots (390 px, Amethyst)

Saved here and in `/workspace/eye-icon-15nov/`.

- FAAR panel (legend with LOW CLOUD): `legend-lowcloud-FAAR-panel-390.png` / `legend-lowcloud-FAAR-page-390.png` / `legend-lowcloud-FAAR-key-390.png`
- FACT panel (same key on a VFR·VMC card): `legend-lowcloud-FACT-panel-390.png` / `legend-lowcloud-FACT-page-390.png` / `legend-lowcloud-FACT-key-390.png`

No merge, no deploy.

---

# Follow-up: restore live category-key spacing, stack LOW CLOUD (15 Nov 2026)

Same branch `fix/eye-icon-all-cards-15nov`. MT asked to put the category explanations back the way live has them, and to add LOW CLOUD in that same style. Not merged, not deployed.

## What live actually is

Compared with live `e1cfce3a7` / base `5927ba600` (the key CSS is the same on both). Each VFR / MVFR / IFR / LIFR row is a 48 px label column, a 10 px gap, then the meaning on the same row. Indent of the meaning is 58 px, row height 21 px, padding `2px 0`.

The previous branch CSS (`auto` first column, `nowrap`) made the label column as wide as “LOW CLOUD”, so every meaning shifted right, and “LOW CLOUD” itself overflowed the 48 px column and sat on top of its own text (no gap).

## Change

- Restored the live `.ad-in-c` and `.wfc-flat` rules exactly.
- LOW CLOUD is added at the end, stacked: the amber label on its own line, the meaning underneath at the same 58 px indent as the other rows (so the long label does not overlap the text).
- VFR / MVFR / IFR / LIFR indent, gap, and row height match live (58 / 10 / 21). Measured on FAAR and FACT.
- The Now line and the flexible panel height are unchanged. (Live FAAR’s key footer was clipped by the old 560 px cap; the branch panel is tall enough to show the full key.)

## Files

- `site/wst/ad-card.css` — live key grid restored; LOW CLOUD row stacks
- `site/main.html` — `?v=` bump

## Tests (rerun)

- `tests/engine-v2/*.test.mjs` — all pass (one existing todo in wind-display)
- `tests/engine-v2/run.js` — OK, 175 rule cases
- `tests/safety/*.test.mjs` — all pass
- `tests/deeplink-route.mjs`, `gps-near-me.mjs`, `search-glow.mjs` — ok
- `cloudflare` `npm test` — 64 pass, 0 fail
- `node tools/vbump.mjs --check` — current
- `node tools/perf-budget.mjs` — ok

`page:main.html:assets_br` = **308,473** (limit 308,500).

## Screenshots (390 px, Amethyst)

Saved here and in `/workspace/eye-icon-15nov/`.

- Live key (FAAR / FACT): `key-before-live-FAAR-panel-390.png`, `key-before-live-FACT-panel-390.png` (and `key-before-live-*-key-390.png`, `key-before-live-*-keyclean-390.png`)
- After: `key-after-FAAR-panel-390.png`, `key-after-FACT-panel-390.png` (and key / keyclean)
- Side-by-side live vs after: `key-side-by-side-FAAR-390.png`, `key-side-by-side-FACT-390.png`

No merge, no deploy.

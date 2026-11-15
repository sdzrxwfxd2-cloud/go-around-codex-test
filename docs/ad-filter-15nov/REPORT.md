# Aerodrome filter "Show all" — 15 Nov 2026

Branch: `fix/ad-filter-show-all-15nov` (from `live/model-3h-11nov` at `6a8bbfd6b`, after the closed-aerodrome removal). Not merged, not deployed.

## Cause

Picking **How many → All** (or any page size above 50) made `wst/wst-list.js` set `PER` to `1e6` and call `WMCards.mount(visPage)` with every matching card at once.

`wst/wst-cards.js` is built to keep only the current page (~10–50 cards) in `#list` and leave the rest in a document fragment. **All** bypassed that and inserted all **582** card subtrees into the live list in one synchronous burst.

That is the freeze. On a 390×844 phone profile with **4× CPU throttle** (Amethyst: night + purple), Chrome recorded a **22,020 ms** main-thread long task when All was tapped. The page stayed "successful" in desktop Chrome (no tab crash, no JS error) but was unusable for ~22 s, which matches "it will crash the page" on a phone. 50-per-page already works; the jump to all 582 is what blows the budget.

What it is not, primarily:

- Per-card verdict / weather compute — `run()` already walks the full catalogue through the patched `querySelectorAll`, including cards still in the store, even on a 10-card page.
- Images — cards are CSS, text and SVG, not photo grids.
- A JS exception — no page errors were logged.

Memory was modest (~21 MB JS heap with 582 nodes mounted). The failure mode here is a long task / layout storm, not a huge heap. On a tighter iOS WebKit heap the same 582-node mount could still OOM; WebKit was not installed in this environment (`webkit-2388` missing), so that was not re-run.

## Fix

`WMCards.mount` now **virtualizes** any list longer than 50 (the largest non-All page size):

- Only a viewport window (about 8 cards at 390 px, plus 1,400 px overscan) is in `#list`.
- Invisible top/bottom spacers (`.wm-vsp`, `grid-column: 1 / -1`) hold the scroll height so the list is still "all 582".
- Further cards are moved in from the existing fragment store as you scroll (`requestAnimationFrame`), with a `requestIdleCallback` pass to remeasure heights.
- 10 / 20 / 50 still mount the whole page at once, unchanged.
- Card HTML, CSS, spacing and verdicts are not changed. Engine / Status / filters still see the full set via `WM_ALL_CARDS`.

Pager text for All is still `Page 1 of 1 · 582 aerodromes`.

## Timings (390 px, Amethyst, CPU 4×, Chromium)

| | Before (mount all 582) | After (window of ~8) |
|---|---|---|
| Cards in `#list` after All | 582 | 8 (window `{a:0,b:8,n:582}`) |
| After scroll to y=6000 | 582 | 9 (later cards, e.g. Alexander Bay / FAAB) |
| Longest long-task | **22,020 ms** | **1,039 ms** (during initial page load, before All). After All, longest was ~754 ms |
| Long tasks ≥ 200 ms | 16 | 12 (most are page-load, not All) |
| Long tasks ≥ 1,000 ms | 5 | 1 (page load) |
| Time until All click handler returned | ~22 s (blocked on the long task) | **593 ms** (`clickEvalMs`) |
| Time until first All window was readable | after that 22 s freeze | **1,824 ms** including the click |
| JS heap (used) after All | 20.7 MB | 32.9 MB at first paint, 20.9 MB after scroll |
| JS errors | 0 | 0 |
| Page crash | no (desktop Chrome) | no |
| Still interactive after All | yes, once the 22 s task ended | yes (evaluate returned in 4 ms) |

Scripts and raw JSON: `measure.mjs`, `before-chromium.json`, `after-chromium.json`.

## Screenshots (390 px Amethyst)

All under `docs/ad-filter-15nov/` and `/workspace/ad-filter-15nov/`:

- `before-amethyst-390-default.png` / `after-amethyst-390-default.png` — 10 per page
- `before-amethyst-390-filter-open.png` / `after-amethyst-390-filter-open.png` — filter open
- `before-amethyst-390-all.png` — All applied (panel still open in this shot)
- `after-amethyst-390-all.png` / `after-amethyst-390-all-top.png` — All, first card still FAAE Aberdeen, layout unchanged
- `after-amethyst-390-all-scrolled.png` — scrolled through the virtual list (ZA-0015, Alexander Bay)
- `before-amethyst-390-all-scrolled.png` / `before-amethyst-390-all-top.png` — All with all 582 mounted

## Checks

- Verdict harness (same frozen `/api`, C172, 390 px Amethyst): **How many 10 vs All**, modes depart, land now, +1 h, +2 h, +3 h: **0 diffs**. 582 cards in both. All mounts 8. See `verdict-harness.json`.
- Status vs Aerodromes: **0**. Status bar 194 / 143 / 193 equals `WM_COUNTS` on Aerodromes (depart).
- No JS errors in the measure run or the harness.
- `page:main.html:assets_br` = **307,501** (budget 308,500). `vbump --check` current. `perf-budget` ok (34 limits).
- engine-v2 (11) and safety (6) tests: all pass. Log: `tests.log`.

## Not done

- No merge, no deploy.
- iOS-like WebKit profile: Playwright WebKit is not installed here, so no WebKit timings.

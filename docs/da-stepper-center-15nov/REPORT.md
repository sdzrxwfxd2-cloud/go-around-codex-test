# DA stepper centering (15 Nov 2026)

Branch: `fix/da-stepper-center-15nov` from live `live/model-3h-11nov` @ `5927ba600`.
Page: Status (`status_demo.html`), density-altitude limit control. Not merged, not deployed.

## Problem

The plus and minus on the density-altitude limit control used font glyphs (`+` and U+2212) inside 44×40 px rounded rectangles (`border-radius: 14px`). They were not circles. Font metrics also sit the ink slightly off-centre, which is worse on iOS Safari.

Measured before (Chrome, 390 px, Amethyst): buttons **44×40**, radius 14 px, not circular. The text box was 0.5 px high of the button centre (`dy: -0.5`).

## Fix

- Buttons are now **40×40 px circles** (`border-radius: 50%`).
- The signs are **CSS-drawn bars**, not font glyphs, so the shape does not depend on the font or on iOS Safari metrics.
- Each bar is placed with `left: 50%; top: 50%; transform: translate(-50%, -50%)`.
- Horizontal bar (12×2 px) on both buttons; vertical bar (2×12 px) on plus only.
- Visible label text was removed from the buttons; the existing `aria-label` (“Lower limit” / “Raise limit”) is unchanged.
- Tap target, step size (500 ft), range (1500–6000), default (2500) and CAUTION-only behaviour are unchanged.

Files: `site/wst/status-v4.css`, `site/wst/status-v4.js`, `?v=` bump on `site/status_demo.html`.

## Checks

All 4 themes at 390 px and 320 px: Amethyst (night / purple), Midnight (night / black), Pearl (day / white), Champagne (day / beige). Buttons stay 40×40 circles. No overflow or clipped signs.

After (same Chrome measurement): `40×40`, `border-radius: 50%`, `isCircle: true`. Pseudo-element transform is `translate(-50%, -50%)` from the button centre. Ink centroid of the zoomed Amethyst plus and minus (device scale 3) is at the centre of the 40 px circle.

## Tests

All ran clean (exit 0):

- `tests/engine-v2/*.test.mjs` and `tests/safety/*.test.mjs` — all pass
- `tests/engine-v2/run.js` — OK, **175** rule cases, pack 2.5.0
- `tests/deeplink-route.mjs`, `gps-near-me.mjs`, `search-glow.mjs` — ok
- `tests/perf/*.mjs` — all pass (includes cache-headers / vbump and perf-budget)
- `cloudflare` `npm test` — **64** pass, 0 fail
- `node tools/vbump.mjs --check` — current
- `node tools/perf-budget.mjs` — ok

`page:main.html:assets_br` = **308,433** (limit 308,500). Status v4 is not part of the main-page asset set; the budget did not move because of this change.

## Screenshots

Saved here and in `/workspace/da-stepper-15nov/`. 390 px Amethyst unless noted.

- Before, section: `before-amethyst-390-section.png`
- After, section: `after-amethyst-390-section.png`
- Before / after stepper: `before-amethyst-390-stepper.png`, `after-amethyst-390-stepper.png`
- Zoomed buttons (device scale 3): `before-amethyst-390-zoom-minus.png`, `before-amethyst-390-zoom-plus.png`, and the matching `after-` files
- 3× nearest zoom of those: `*-zoom-*-x3.png`
- Side-by-side zoom: `compare-amethyst-390-minus-before-after-zoom.png`, `compare-amethyst-390-plus-before-after-zoom.png`, `compare-amethyst-390-stepper-before-after-zoom.png`
- After, other themes and 320 px: `after-{midnight,pearl,champagne,amethyst}-{390,320}-stepper.png`

No merge, no deploy.

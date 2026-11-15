# TAF tab — next period (15 Nov 2026)

UI only. The engine and verdict rules are not changed.

When a station has a TAF that has not started yet, the TAF tab shows:

- **NEXT TAF PERIOD · FROM 17:00 SAST (1500Z)**
- the raw TAF
- **Not valid yet: the verdict does not use it until 17:00.**

Stations with a current TAF, or with no TAF, look the same as live.

The paint routine and its CSS live inline in `site/main.html` so the main-page linked-asset budget stays under 308,500 bytes brotli. `wst-common.js` and `wst-main.js` only call `window.GA_PAINT_TAF` when it exists. A `?demo=taf-next` test fixture is included in that same inline script and does nothing unless the URL has that param.

A future window is only shown if it starts within 48 hours. That stops a day/month wrap in the existing TAF window parser from presenting an already-ended TAF as a next period. Verdicts are unchanged.

On a local or preview check, open `/main.html?solo=1&demo=taf-next`, search for FACT, and open the TAF tab.

Base: `live/model-3h-11nov` (`3b2fb3e60`), ported from `fix/taf-next-period-15nov` (`4ed4b112f`).

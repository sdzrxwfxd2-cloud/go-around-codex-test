# Handover: PR #60 (fix/first-visit-engine)

Written 11 Nov 2026 (SAST) for the bot that built the engine, core and rule pack, which will review and merge this PR.
This is a docs-only note. No website file is changed by this commit.

- PR: https://github.com/sdzrxwfxd2-cloud/Go-Around-Cloudflare/pull/60 (draft)
- Base: `live/model-3h-11nov` at `b23c060f`. That is the production source, and its engine hashes and HTML match production byte for byte.
- Status: tested, **not merged and not deployed**.

## 1. What the two commits do

### 8637128d: first visit, "Variable wind, direction unknown"
- **Cause:** on a first visit, the cards ran before `wm-model.js` had stored the model weather. `ga-core-v2-wire.js` cached that "no model" miss for 5 s, so every card fell back to the card snapshot (`data-wxm`). The snapshot dropped the wind direction, so the card read it as a variable wind with no direction.
- **Fix:**
  - A miss is never cached now.
  - The snapshot keeps its wind direction (`d`).
  - `?v=` is bumped for `ga-core-v2-wire.js`.
- **Result:** 352 cards showed "Variable wind, direction unknown" on a first visit. Now 0 do.
- The engine is unchanged: v2, rule pack 2.3.2, same checksum. It is the same engine Land/Depart uses, and no newer one exists.

### 482615af: density altitude on every card
- **Engine:** v2 `da()` now uses the calculator formula: ISA at the pressure altitude, 120 ft/°C. These are the same steps as `calc.js` `C.atmos` and the aerodrome page `wq.js`. Before, ISA was taken at the elevation. The rule tables are unchanged (2.3.2, same checksum).
- **Field elevation order:**
  1. AIP (`wst/wst-data.js`, 65 fields)
  2. The aerodrome page value (new `site/wst/ad-elev.js`, 562 fields, built by `tools/first-visit/ad-elev.mjs` from the `site/ad/*.html` "Elevation" row)
  3. The model ground height (85 fields)
- The DA pill uses the same formula and elevation, and its title names the elevation source. The pill's design is unchanged.
- **Result:** the DA pill matches the calculator on **584/584** cards.
- **Behaviour change. MT must say yes before this goes live.** The existing POL-DA rule (caution when DA is more than 2,500 ft above the field) now reaches every card that has an elevation, not only the 65 AIP fields. In the test snapshot:
  - Before: go 207 / caution 247 / no-go 134
  - After: go 61 / caution 393 / no-go 134
  - About **146 cards go from DEPART to CAUTION**. One example is FAAG, which already showed a red DA pill but still said DEPART.

### DA history (why MT thought this was already done)
- The POL-DA rule landed on 30 Oct (Wingmam `feature/engine-claude-rules` 51db923, then `engine/core-alpha`). It is live.
- On 29 Oct MT asked for the calculator formula. It never landed before this PR (`git log -S` finds no commit).
- The DA pill came in PR #51 (`1660b14b`), with a ground-height fallback (`27d9fcbd`). Both are live.
- 575 cards had no elevation, because the cards only read `wst-data.js` (65 AIP fields). Meanwhile `site/ad/*.html` had elevations for 566 of 639 fields.

### Can the commits be taken separately?
- **8637128d can go alone.** It is the safe one, with no verdict change beyond the fixed wind.
- **482615af depends on 8637128d.** Both edit `site/engine/ga-core-v2-wire.js` and the same `?v=` lines in the HTML pages, so cherry-picking 482615af on its own will conflict. To ship only the first-visit fix now:
  1. Merge or cherry-pick 8637128d.
  2. Hold 482615af until MT says yes to the ~146 CAUTION change.
  3. Then rebase 482615af on top and re-run `tools/first-visit/stamp.mjs` to re-bump `?v=`.

### Tests (at 482615af)
- Engine: 163 pass.
- Cloudflare: `cd cloudflare && npm test` gives 25 pass, 5 of them new in `test/first_visit.test.mjs`.
- One failure is old: "protected files untouched" flags `site/wm-core.js` from base-branch history. This PR does not touch it.
- Pictures (390 px, Amethyst, before and after) are on the box in `/workspace/first_visit_fix/`.

## 2. The 4 page elevations left out as suspect

`tools/first-visit/ad-elev.mjs` (`SUSPECT`) leaves out these 4 page values because they disagree with the terrain at the card's own coordinates by more than 1,000 ft. For now those cards use the model ground height.

**How they were checked, in this order:**
1. **AIP.** None of the 4 is in AIP AD 2 (not in `wst-data.js`, and not in the AD2 extracts in `Wingman-resources/aerodromes/changes/2026-11-09/evidence/aip-ad2-extracts.json`). AIP GEN 2.4 lists the indicators FANG = NGALA and FARZ = REITZ only, with no elevation or coordinates. The SACAA approved-aerodrome register has a PDF for Ngala, which gives coordinates but no elevation. **None of the 4 has an official elevation.**
2. **Web.** OurAirports (live CSV, `davidmegginson.github.io/ourairports-data/airports.csv`, read 11 Nov 2026) and the sites that copy it (airportguide.com, airport-data.com, aip.aero, sprinkle.com, fallingrain).
3. **Our own data.**
   - The SRTM 30 m terrain (opentopodata), at the point and over a ±2 km grid.
   - The Open-Meteo 90 m terrain that the model ground height uses.
   - Our `site/ad` pages, the calculator list and the 9 Nov audit in `Wingman-resources/aerodromes/changes/2026-11-09/`.

### Verified elevation table

| Ident | Name / place | Site now | Verified value | Confidence | Key evidence |
|---|---|---|---|---|---|
| **FAOD** | Odendaalsrus, Free State, -27.871, 26.6934 | 1,340 ft | **≈4,396 ft (1,340 m).** The page number is metres labelled as feet. Terrain: 4,344–4,426 ft (SRTM 1,324–1,349 m). | High that 1,340 ft is wrong. Medium on the exact value (no official source). | SRTM at the point is 1,335 m = 4,380 ft; Open-Meteo is 1,331 m = 4,367 ft. A field on the Free State highveld can't be at 1,340 ft. OurAirports lists it as **closed**, with the note "this airfield no longer exists" (2012). |
| **FANG** | Ngala, Timbavati / Greater Kruger, Mpumalanga | 3,357 ft | **≈1,480 ft (≈450 m).** Terrain: 1,401–1,591 ft (SRTM 427–485 m). | High that 3,357 ft is wrong. The exact value is **unverified** officially. | SRTM 453 m = 1,486 ft; Open-Meteo 447 m = 1,467 ft. Every web site repeats OurAirports' 3,357 ft / 1,023 m, so there's only one source and the terrain doesn't support it (lowveld). SACAA approval 139/05/0013 gives S24°23'14" E031°19'27" (-24.38722, 31.32417), about 200 m from the card's -24.389, 31.326, and no elevation. |
| **ZA-0036** | Forel, near Carolina, Mpumalanga, -25.95, 30.116667 | 6,464 ft | **Unverified. The terrain says ≈5,150–5,180 ft (≈1,570 m).** Terrain within 2 km: 4,921–5,348 ft. | High that 6,464 ft is wrong. The exact value is unverified, and the coordinates are only rounded to the minute. | SRTM 1,578 m = 5,177 ft; Open-Meteo 1,567 m = 5,141 ft. Nothing within 2 km comes near 6,464 ft. No official listing. OurAirports lists it as **closed**. |
| **FARZ** | **Reitz, Free State.** The ident and name are right; the **coordinates are wrong**. | 5,331 ft at -22.784201, 28.4303 (Limpopo, "Maasstroom") | **5,312 ft (1,619 m)** at **-27.784303, 28.430192** (Free State, near Petsana/Reitz). The page's 5,331 ft is close (19 ft off). | High | AIP GEN 2.4: "FARZ REITZ". The current OurAirports CSV, row 30328, gives -27.784303, 28.430192, 5,312 ft, ZA-FS, Petsana. Our site still has an older copy with a latitude typo (22 instead of 27; the longitude is the same). Terrain at the corrected point: SRTM 1,618 m = 5,308 ft, matching the 5,312 ft. At the site's Limpopo point the terrain is 862 m = 2,828 ft. The 9 Nov audit already flagged this as deferred (`notable-coordinate-discrepancies.csv`, 556 km). |

Sources:
- https://ourairports.com/airports/FAOD/ , /FANG/ , /ZA-0036/ , /FARZ/
- https://davidmegginson.github.io/ourairports-data/airports.csv
- https://caasanwebsitestorage.blob.core.windows.net/approved-aerodromes/Ngala.pdf
- https://airportguide.com/airport/info/FAOD
- https://aip.aero/za/vfr/?FANG=
- https://api.opentopodata.org/v1/srtm30m
- https://api.open-meteo.com/v1/elevation
- AIP GEN 2.4 and the SACAA register extracts in `Wingman-resources/aerodromes/changes/2026-11-09/evidence/`

Unit check: 1 m = 3.28084 ft.

### Recommended data fixes (need MT's yes; none are applied here)

- **FAOD:** keep it in `SUSPECT`. The card then uses the model ground height (~4,367 ft), which is within 30 ft of the corrected value, so no change is needed now. Two things to ask MT:
  - Should the AD page say 4,396 ft (1,340 m)?
  - The field is listed as closed. Should it stay on the site?
- **FANG:** keep it in `SUSPECT` (the ground fallback is ~1,460 ft). Ask MT whether the page should show ≈1,480 ft and be marked "terrain-derived, not official", or show "—" until an official value is found. If MT wants it, the coordinates can be moved to the SACAA register value (-24.38722, 31.32417).
- **ZA-0036:** keep it in `SUSPECT`, because the value is unverified. The field is listed as closed, so MT should decide whether it stays on the site.
- **FARZ:** this is a **coordinate fix**, not an elevation fix.
  - The correct point is -27.784303, 28.430192. The province is Free State, and the nearest town is Reitz (Petsana).
  - Once the coordinates are fixed, the 5,331 ft page value (or 5,312 ft) is consistent and FARZ can come out of `SUSPECT`.
  - Until then, the card's model weather and ground height come from the wrong place, 556 km away in Limpopo.
  - The coordinates live in several files, and one of them is protected:
    - `site/appdata/aerodromes-ll.*.json` and `site/appdata/app-data.*.js` are in **appdata/ (protected, do not edit without MT's explicit yes)**.
    - `site/c/appdata/app-data.*.js` is also **protected**.
    - Not protected: `netlify/lib/model_points.json`, `site/calculator_v5/assets/aerodromes.js` (+ the tests copy), `site/fs/fs-data.js`, `site/c/fs/fs-data.js`, `site/calculator_v5/fs/fs-data.js`, `site/c/wst/ad-types-data.js`, and `site/ad/FARZ.html` / `site/c/ad/FARZ.html` (Position row and province).
  - Because appdata is protected, take this to MT as a separate data PR. Don't fold it into #60.

### How to apply elevation corrections as data-only edits (no design or behaviour change)
1. Change data only. Edit the `SUSPECT` map (and, if MT approves values, add a small `OVERRIDE` map) in `tools/first-visit/ad-elev.mjs`. Then regenerate with `node tools/first-visit/ad-elev.mjs`.
   - This rewrites only `site/wst/ad-elev.js` (a `window.WM_AD_ELEV` object of numbers).
   - Don't hand-edit engine logic, card markup, CSS or pills.
2. If MT approves page text changes, edit only the Elevation value (and the Position row for FARZ) in `site/ad/<ID>.html` and `site/c/ad/<ID>.html`. Leave the layout alone.
3. Bump `?v=` with `node tools/first-visit/stamp.mjs`. `ad-elev.js` is loaded from `site/main.html`.
4. Run the tests: engine (163) and `cd cloudflare && npm test`.
5. Take before and after pictures of the affected cards (390 px, Amethyst).
6. Re-run the DA parity check (pill vs calculator) so it still reads 584/584.

## 3. Other data issues found (not fixed)
- **FAKG:** the DA box (990 ft) disagrees with the Elevation row (5,289 ft).
- **FAHG:** the DA box (362 ft) disagrees with the Elevation row (5,067 ft).
- **FAOR:** the AIP data says 5,502 ft and its page says 5,558 ft.
- The `/c/` pages run their own card file, which this PR doesn't change.

## 4. Rules for whoever merges
- Never touch `gate.ts`, `appdata/`, `c/appdata/`, auth, `wm-pin.js`, `site/wm-core.js`, `_middleware.js` or `ARCHIVE_DO_NOT_TOUCH`.
- Never force-push. Branch every change. Tests must pass before any push.
- Bump `?v=` for every changed JS or CSS file.
- Don't change any pill's design. Use dvh, and add no new `position:fixed`.
- **Anything merged into the live branch must go live.** Before deploying:
  - Fetch the remote live head (currently `live/model-3h-11nov`, `b23c060f`).
  - Deploy from `cloudflare/` with `--branch main` and with functions, to project `go-around-aero`.
  - State the rollback point (the current production deploy and `b23c060f`).
- **The ~146 DEPART→CAUTION change (482615af) needs MT's explicit yes** before it is merged or deployed.
- Never contact SACAA.
- Keep secrets out of the repo and chat.

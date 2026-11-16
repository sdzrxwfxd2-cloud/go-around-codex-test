# South African real-weather engine run

Ran at 2026-11-15T22:16:10.937Z (times in the dataset are UTC; this stamp is ISO-8601).

The engine files under `site/engine/` were imported read-only and were not modified.

## How it was run

- Engine: `site/engine/ga-core-v2.js`, rules 2.5.0, lock 90d2ba46f3478c597c502d607193a4a3e072962da4eedace4b0d3131a3922cb1.
- Profile: PPL, Cessna 172, VFR — the same default the site tests use.
- For each real METAR (and SPECI), the TAF that was in force at that time (if we have one) is attached.
- `now` is set to 5 minutes after the report, so a historical METAR is treated as a fresh official report, the same way the live site treats the current one.
- Each report is evaluated twice: Depart now, and Land now.
- Elapsed: 12.9 s.

## Totals

- Stations run: **33**
- METARs / SPECIs fed in: **190645**
- Evaluations: **381290** (depart + land)
- Reports that had a TAF in force: **12087**
- Crashes: **0**
- Parse failures: **0**
- Odd results flagged: **0**
- Evaluations INCOMPLETE because a required group was malformed (engine does not guess): **8**

### Verdicts — depart

nogo: 130110, go: 49563, caution: 10963, incomplete: 9

### Verdicts — land

nogo: 98589, go: 53404, caution: 38643, incomplete: 9

## Crashes

None.

## Parse failures

A parse failure means `parseOfficial` threw, returned null on a non-NIL report, or missed a wind/visibility group that is clearly in the raw text.

None.

## Odd results

These are not automatically bugs. Crosswind, tailwind, gust, night, density altitude, and METAR trend/TEMPO/BECMG hits on an otherwise CAVOK report are treated as expected and are not listed here. What remains is worth a second look: a surprising NO-GO on CAVOK, a GO in very low visibility or a very low ceiling, an incomplete verdict despite a usable official report, a non-finite weather value, or a NO-GO with no reason text. A NIL METAR with no TAF, or a report with a malformed required group (garbled wind, visibility or cloud), is INCOMPLETE by design. A TAF FM/BECMG NO-GO is expected when the period starts inside the look-ahead and is below the pilot's own minima (PPL default 8 km / 2 500 ft). Land shows more CAUTION than depart, mostly because many reports fall at night on the default PPL profile (no night rating).

None flagged.

## Per station

| Station | METARs | TAFs on file | Depart GO / CAUTION / NO-GO / other | Land GO / CAUTION / NO-GO / other | Crashes | Parse fail | Odd |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| FABL | 8589 | 145 | 3329 / 592 / 4668 | 3607 / 3629 / 1353 | 0 | 0 | 0 |
| FABM | 622 | 0 | 212 / 26 / 383 / incomplete 1 | 216 / 26 / 379 / incomplete 1 | 0 | 0 | 0 |
| FACT | 10456 | 160 | 3327 / 1066 / 6063 | 3591 / 4177 / 2688 | 0 | 0 | 0 |
| FACV | 1447 | 0 | 1230 / 36 / 181 | 1230 / 45 / 172 | 0 | 0 | 0 |
| FADY | 694 | 0 | 493 / 22 / 179 | 495 / 20 / 179 | 0 | 0 | 0 |
| FAEL | 7269 | 95 | 3376 / 756 / 3136 / incomplete 1 | 3646 / 1527 / 2095 / incomplete 1 | 0 | 0 | 0 |
| FAEO | 798 | 0 | 387 / 21 / 390 | 387 / 28 / 383 | 0 | 0 | 0 |
| FAGC | 2 | 0 | 0 / 0 / 1 / incomplete 1 | 0 / 0 / 1 / incomplete 1 | 0 | 0 | 0 |
| FAGG | 13962 | 172 | 3681 / 745 / 9536 | 3953 / 4069 / 5940 | 0 | 0 | 0 |
| FAGM | 506 | 0 | 264 / 109 / 132 / incomplete 1 | 269 / 106 / 130 / incomplete 1 | 0 | 0 | 0 |
| FAHS | 6388 | 94 | 155 / 144 / 6089 | 172 / 153 / 6063 | 0 | 0 | 0 |
| FAIR | 75 | 0 | 11 / 2 / 62 | 11 / 2 / 62 | 0 | 0 | 0 |
| FAJB | 5298 | 0 | 0 / 0 / 5298 | 0 / 0 / 5298 | 0 | 0 | 0 |
| FAKM | 8448 | 92 | 3874 / 407 / 4167 | 4167 / 1161 / 3120 | 0 | 0 | 0 |
| FAKN | 8840 | 103 | 2301 / 786 / 5753 | 2542 / 1381 / 4917 | 0 | 0 | 0 |
| FALA | 8570 | 142 | 2910 / 1093 / 4567 | 3216 / 2686 / 2668 | 0 | 0 | 0 |
| FALE | 11243 | 159 | 3970 / 820 / 6453 | 4244 / 4199 / 2800 | 0 | 0 | 0 |
| FALW | 7676 | 0 | 0 / 0 / 7676 | 0 / 0 / 7676 | 0 | 0 | 0 |
| FAMM | 8672 | 0 | 2993 / 460 / 5218 / incomplete 1 | 3241 / 1184 / 4246 / incomplete 1 | 0 | 0 | 0 |
| FAOR | 13497 | 159 | 4517 / 1536 / 7444 | 5017 / 5897 / 2583 | 0 | 0 | 0 |
| FAPE | 11260 | 129 | 3580 / 816 / 6863 / incomplete 1 | 3851 / 3956 / 3452 / incomplete 1 | 0 | 0 | 0 |
| FAPM | 3 | 136 | 0 / 0 / 3 | 0 / 0 / 3 | 0 | 0 | 0 |
| FAPN | 2821 | 0 | 0 / 0 / 2821 | 0 / 0 / 2821 | 0 | 0 | 0 |
| FAPP | 9002 | 101 | 2766 / 698 / 5538 | 3026 / 1283 / 4693 | 0 | 0 | 0 |
| FAPR | 1 | 0 | 1 / 0 / 0 | 1 / 0 / 0 | 0 | 0 | 0 |
| FARB | 1 | 100 | 0 / 0 / 1 | 0 / 0 / 1 | 0 | 0 | 0 |
| FASB | 977 | 0 | 548 / 14 / 414 / incomplete 1 | 549 / 22 / 405 / incomplete 1 | 0 | 0 | 0 |
| FASI | 4852 | 0 | 0 / 0 / 4852 | 0 / 0 / 4852 | 0 | 0 | 0 |
| FAUP | 9501 | 128 | 4200 / 288 / 5012 / incomplete 1 | 4452 / 2321 / 2727 / incomplete 1 | 0 | 0 | 0 |
| FAUT | 8813 | 100 | 1120 / 328 / 7365 | 1182 / 554 / 7077 | 0 | 0 | 0 |
| FAVV | 5502 | 0 | 0 / 0 / 5502 | 0 / 0 / 5502 | 0 | 0 | 0 |
| FAWB | 7216 | 99 | 318 / 198 / 6700 | 339 / 217 / 6660 | 0 | 0 | 0 |
| FAWK | 7644 | 0 | 0 / 0 / 7643 / incomplete 1 | 0 / 0 / 7643 / incomplete 1 | 0 | 0 | 0 |
## Notes on this run (16 Nov 2026, after the parser fix on `fix/engine-parser-fm-16nov`)

- Same 190 645 real METARs, same 381 290 checks, same PPL / C172 / VFR profile. **0 crashes, 0 parse failures, 0 odd results.**
- Before the fix (production engine, same harness): 52 parse failures and 32 odd results (mostly GO while the report itself showed less than 5 km).
- What changed in how a report is **read** (no rule, limit or lock changed; rules 2.5.0, checksum unchanged):
  1. Directional visibility (`0400W`, `4500SE`, `9999E`) is read; with two visibility groups the **lowest** is used.
  2. Glued weather (`9999-RA`, `9999-SHRA`) is split, so the visibility and the weather are both read.
  3. A malformed required group (`23016VKT`, `01006K6002KT`, `5000VE`, `BKN49`) gives **INCOMPLETE** instead of a guess (8 checks, 4 reports).
  4. `CAVOK` in a TREND (`... 2500 BCFG NSC ... BECMG CAVOK`) is no longer read as CAVOK now. This was a false GO in fog.
- The six FAGG TAF `FM` NO-GOs from the 15 Nov run are **correct and unchanged**: the `FM` period starts inside the look-ahead (depart: next 2 h; land: ETA ±1 h, CAR 91.07.7) and is below the PPL preset minima (2 500 ft / 8 km). With a CPL profile (1 500 ft / 5 km) the same reports are GO. The 15 Nov harness wrongly compared them with 1 000 ft / 5 km.
- Verdict diff against production: 634 checks changed text, 137 changed status, **0 became GO**, **0 unexplained**. See `/workspace/engine-fix-16nov/verdict-diff.json` on the box.

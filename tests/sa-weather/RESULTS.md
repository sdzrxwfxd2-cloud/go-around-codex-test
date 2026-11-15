# South African real-weather engine run

Ran at 2026-11-15T21:41:02.461Z (times in the dataset are UTC; this stamp is ISO-8601).

The engine files under `site/engine/` were imported read-only and were not modified.

## How it was run

- Engine: `site/engine/ga-core-v2.js`, rules 2.5.0, lock 90d2ba46f3478c597c502d607193a4a3e072962da4eedace4b0d3131a3922cb1.
- Profile: PPL, Cessna 172, VFR — the same default the site tests use.
- For each real METAR (and SPECI), the TAF that was in force at that time (if we have one) is attached.
- `now` is set to 5 minutes after the report, so a historical METAR is treated as a fresh official report, the same way the live site treats the current one.
- Each report is evaluated twice: Depart now, and Land now.
- Elapsed: 9.0 s.

## Totals

- Stations run: **33**
- METARs / SPECIs fed in: **190645**
- Evaluations: **381290** (depart + land)
- Reports that had a TAF in force: **12087**
- Crashes: **0**
- Parse failures: **54**
- Odd results flagged: **6**

### Verdicts — depart

nogo: 130071, go: 49606, caution: 10963, incomplete: 5

### Verdicts — land

nogo: 98527, go: 53447, caution: 38666, incomplete: 5

## Crashes

None.

## Parse failures

A parse failure means `parseOfficial` threw, returned null on a non-NIL report, or missed a wind/visibility group that is clearly in the raw text.

On the 15 Nov 2026 run these clustered into a few real-report shapes (not invented):

- Directional or split visibility, which the parser did not take as prevailing vis: for example `0400W`, `0800NE`, `2000S`, `3000N`, `4500SE`, `1000SW`, and two-group vis such as `4500W 9999` or `2500SW 8000NE`.
- A missing space before weather: `9999-RA`, `9999-DZ`, `9999-SHRA`.
- `METAR COR` (a correction) before the station id.
- Garbled but real archive groups: `23016VKT`, `01006K6002KT`, and a couple of AUTO reports with `////` then a later `9999`.
- One thunderstorm report with only an RVR group (`R02/P2000N TS`) and no prevailing vis — that flag is weaker, because there may be no prevailing vis to parse.

- **FABL** 2025-12-04T16:17:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FABL 041617Z 32014G24KT 270V350 R02/P2000N TS SCT020 FEW035CB 21/14 Q1021 TEMPO 5000 TSRA SCT035CB`
- **FABL** 2026-03-23T05:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FABL 230500Z 33005KT 290V360 7000W R02/P2000N FEW000 18/17 Q1022 NOSIG`
- **FABL** 2026-06-17T07:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FABL 170700Z VRB01KT 5000E BR NSC 10/05 Q1031 NOSIG`
- **FABL** 2026-06-23T06:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FABL 230600Z 03006KT 360V060 0400W R02/1900U FG VV002 09/08 Q1025 TEMPO 1500 BR OVC008`
- **FABL** 2026-06-23T07:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FABL 230700Z 05008KT 0600W R02/P2000N FG VV002 09/09 Q1025 TEMPO 3000 BR OVC008`
- **FAGM** 2026-05-07T09:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAGM 070900Z 23016VKT 9999 OVC017 08/03 Q1018`
- **FAKM** 2025-12-27T01:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAKM 270100Z AUTO 35006KT //// // ////// 17/14 9999 SCT018 BKN035 FEW045CB 20/18 Q1013 NOSIG`
- **FAKN** 2025-12-22T03:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAKN 220300Z AUTO 15004KT //// // /////004KT 0800 R25/1700 R07/1900 FG VV/// 13/11 Q1019 NOSIG`
- **FALA** 2025-11-27T17:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FALA 271700Z 03003KT 340V060 9999-RA BKN030 17/14 Q1024 NOSIG`
- **FALA** 2026-03-19T05:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FALA 190500Z 21004KT 0800NE FG NSC 15/14 Q1021 TEMPO 0500`
- **FAMM** 2026-01-22T18:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAMM 221800Z 01006K6002KT 9999 FEW012 SCT080 17/16 Q1019 NOSIG`
- **FAMM** 2026-09-21T15:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAMM 211500Z 01004KT 9999-DZ FEW035TCU BKN080 17/15 Q1022 TEMPO TSRA FEW035CB`
- **FAPE** 2025-12-16T03:27:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 160327Z VRB02KT 2000S BR SCT002 SCT027 17/17 Q1009 TEMPO 1500 BKN009`
- **FAPE** 2025-12-16T04:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 160400Z VRB02KT 2000S BR SCT002 BKN025 17/17 Q1009 NOSIG`
- **FAPE** 2026-01-02T16:56:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 021656Z 23006KT 4500W 9999 R26/P2000N FU FEW010 21/19 Q1014 TEMPO FM1800 BKN009`
- **FAPE** 2026-01-02T17:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 021700Z 23006KT 4500W 9999 R26/P2000N FU FEW010 21/19 Q1014 TEMPO FM1800 BKN009`
- **FAPE** 2026-01-07T10:45:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071045Z 23019KT 190V250 4500SE 9999 R26/P2000N FU FEW026 26/11 Q1015 NOSIG`
- **FAPE** 2026-01-07T10:55:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071055Z 23021G31KT 4500SE 9999 R26/P2000N FU NSC 25/12 Q1015 NOSIG`
- **FAPE** 2026-01-07T11:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071100Z 24021G31KT 4500SE 9999 R26/P2000N FU NSC 25/12 Q1015 NOSIG`
- **FAPE** 2026-01-07T12:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR COR FAPE 071200Z 22018KT 3500SE 9000 R26/P2000N FU FEW023 23/14 Q1016 NOSIG`
- **FAPE** 2026-01-07T12:19:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071219Z 22017G27KT 190V250 3500SE 9000 R26/P2000N FU FEW023 24/15 Q1016 NOSIG`
- **FAPE** 2026-01-07T12:31:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071231Z 21017G28KT 180V240 3500SE 9000 R26/P2000N FU SCT023 23/15 Q1016 NOSIG`
- **FAPE** 2026-01-07T13:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071300Z 19017KT 170V230 4500SE 9000 R26/P2000N FU FEW020 23/15 Q1016 NOSIG`
- **FAPE** 2026-01-07T13:08:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071308Z 20017G27KT 160V220 4500SE 9000 R26/P2000N FU FEW020 23/15 Q1015 NOSIG`
- **FAPE** 2026-01-07T13:38:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071338Z 20015G25KT 170V230 4500SE 9000 R26/P2000N FU FEW022 23/14 Q1015 NOSIG`
- **FAPE** 2026-01-07T14:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071400Z 18013KT 150V220 4000E 9000 R26/P2000N FU FEW025 22/15 Q1016 NOSIG`
- **FAPE** 2026-01-07T15:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071500Z 18010KT 140V230 4500E 9000 R26/P2000N FU FEW030 23/13 Q1015 NOSIG`
- **FAPE** 2026-01-07T16:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 071600Z 17008KT 110V220 4500E 9999 R26/P2000N FU SCT030 22/13 Q1016 NOSIG`
- **FAPE** 2026-01-12T13:31:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 121331Z 22018G29KT 3700W 7000E FU NSC 27/21 Q1009 NOSIG`
- **FAPE** 2026-01-12T14:00:00Z — visibility/CAVOK present but vis/cavok not set
  - `METAR FAPE 121400Z 23019KT 3700W 7000E FU NSC 27/22 Q1009 NOSIG`
- … and 24 more (see results.json).

## Odd results

These are not automatically bugs. Crosswind, tailwind, gust, night, density altitude, and METAR trend/TEMPO/BECMG hits on an otherwise CAVOK report are treated as expected and are not listed here. What remains is worth a second look: a surprising NO-GO on CAVOK, a GO in very low visibility or a very low ceiling, an incomplete verdict despite a usable official report, a non-finite weather value, or a NO-GO with no reason text. On the 15 Nov 2026 run, every incomplete verdict was a genuine NIL METAR (`METAR FAxx NIL`). Land shows more CAUTION than depart, mostly because many reports fall at night on the default PPL profile (no night rating).

- **FAGG** land 2026-10-16T19:00:00Z — NO-GO on CAVOK with gust 2 kt (TAF forecast: FM from 1620Z: ceiling 2000 ft)
  - METAR: `METAR FAGG 161900Z AUTO 02002KT CAVOK 16/14 Q1015`
  - TAF in force: `TAF FAGG 161600Z 1618/1718 35005KT 9999 SCT012 TX20/1712Z TN14/1703Z FM162000 35005KT 9999 BKN020 FM170700 23015KT 9999 SCT005 BKN010 TEMPO 1710/1718 2500 RA BKN008`
  - verdict: nogo (nogo) — TAF forecast: FM from 1620Z: ceiling 2000 ft
- **FAGG** land 2026-10-16T20:00:00Z — NO-GO on CAVOK with gust 0 kt (TAF forecast: FM from 1620Z: ceiling 2000 ft)
  - METAR: `METAR FAGG 162000Z AUTO 00000KT CAVOK 16/15 Q1015`
  - TAF in force: `TAF FAGG 161600Z 1618/1718 35005KT 9999 SCT012 TX20/1712Z TN14/1703Z FM162000 35005KT 9999 BKN020 FM170700 23015KT 9999 SCT005 BKN010 TEMPO 1710/1718 2500 RA BKN008`
  - verdict: nogo (nogo) — TAF forecast: FM from 1620Z: ceiling 2000 ft
- **FAGG** depart 2026-11-05T10:00:00Z — NO-GO on CAVOK with gust 8 kt (TAF forecast: FM from 0512Z: vis 6.0 km)
  - METAR: `METAR FAGG 051000Z 21008KT 180V240 CAVOK 24/12 Q1006`
  - TAF in force: `TAF FAGG 050930Z 0506/0606 23010KT CAVOK TX23/0509Z TN15/0604Z FM051100 23015KT 9999 FEW012 FM051200 20010KT 6000 -RA BKN010 OVC020 PROB30 TEMPO 0514/0520 4000 -RA BR BKN008 FM060000 35005KT 9999 SCT015 BKN040`
  - verdict: nogo (nogo) — TAF forecast: FM from 0512Z: vis 6.0 km
- **FAGG** land 2026-11-05T10:00:00Z — NO-GO on CAVOK with gust 8 kt (TAF forecast: FM from 0512Z: vis 6.0 km)
  - METAR: `METAR FAGG 051000Z 21008KT 180V240 CAVOK 24/12 Q1006`
  - TAF in force: `TAF FAGG 050930Z 0506/0606 23010KT CAVOK TX23/0509Z TN15/0604Z FM051100 23015KT 9999 FEW012 FM051200 20010KT 6000 -RA BKN010 OVC020 PROB30 TEMPO 0514/0520 4000 -RA BR BKN008 FM060000 35005KT 9999 SCT015 BKN040`
  - verdict: nogo (nogo) — TAF forecast: FM from 0512Z: vis 6.0 km
- **FAGG** depart 2026-11-05T11:00:00.000Z — NO-GO on CAVOK with gust 14 kt (TAF forecast: FM from 0512Z: vis 6.0 km)
  - METAR: `METAR FAGG 051100Z 21014KT CAVOK 22/13 Q1007`
  - TAF in force: `TAF FAGG 050930Z 0506/0606 23010KT CAVOK TX23/0509Z TN15/0604Z FM051100 23015KT 9999 FEW012 FM051200 20010KT 6000 -RA BKN010 OVC020 PROB30 TEMPO 0514/0520 4000 -RA BR BKN008 FM060000 35005KT 9999 SCT015 BKN040`
  - verdict: nogo (nogo) — TAF forecast: FM from 0512Z: vis 6.0 km
- **FAGG** land 2026-11-05T11:00:00.000Z — NO-GO on CAVOK with gust 14 kt (TAF forecast: FM from 0512Z: vis 6.0 km)
  - METAR: `METAR FAGG 051100Z 21014KT CAVOK 22/13 Q1007`
  - TAF in force: `TAF FAGG 050930Z 0506/0606 23010KT CAVOK TX23/0509Z TN15/0604Z FM051100 23015KT 9999 FEW012 FM051200 20010KT 6000 -RA BKN010 OVC020 PROB30 TEMPO 0514/0520 4000 -RA BR BKN008 FM060000 35005KT 9999 SCT015 BKN040`
  - verdict: nogo (nogo) — TAF forecast: FM from 0512Z: vis 6.0 km

## Per station

| Station | METARs | TAFs on file | Depart GO / CAUTION / NO-GO / other | Land GO / CAUTION / NO-GO / other | Crashes | Parse fail | Odd |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| FABL | 8589 | 145 | 3337 / 588 / 4664 | 3615 / 3625 / 1349 | 0 | 5 | 0 |
| FABM | 622 | 0 | 212 / 26 / 383 / incomplete 1 | 216 / 26 / 379 / incomplete 1 | 0 | 0 | 0 |
| FACT | 10456 | 160 | 3332 / 1066 / 6058 | 3596 / 4177 / 2683 | 0 | 0 | 0 |
| FACV | 1447 | 0 | 1230 / 36 / 181 | 1230 / 45 / 172 | 0 | 0 | 0 |
| FADY | 694 | 0 | 493 / 22 / 179 | 495 / 20 / 179 | 0 | 0 | 0 |
| FAEL | 7269 | 95 | 3378 / 757 / 3133 / incomplete 1 | 3648 / 1528 / 2092 / incomplete 1 | 0 | 0 | 0 |
| FAEO | 798 | 0 | 387 / 21 / 390 | 387 / 28 / 383 | 0 | 0 | 0 |
| FAGC | 2 | 0 | 0 / 0 / 1 / incomplete 1 | 0 / 0 / 1 / incomplete 1 | 0 | 0 | 0 |
| FAGG | 13962 | 172 | 3684 / 751 / 9527 | 3956 / 4091 / 5915 | 0 | 0 | 6 |
| FAGM | 506 | 0 | 264 / 109 / 133 | 269 / 106 / 131 | 0 | 1 | 0 |
| FAHS | 6388 | 94 | 156 / 144 / 6088 | 173 / 153 / 6062 | 0 | 0 | 0 |
| FAIR | 75 | 0 | 11 / 2 / 62 | 11 / 2 / 62 | 0 | 0 | 0 |
| FAJB | 5298 | 0 | 0 / 0 / 5298 | 0 / 0 / 5298 | 0 | 0 | 0 |
| FAKM | 8448 | 92 | 3879 / 404 / 4165 | 4172 / 1158 / 3118 | 0 | 1 | 0 |
| FAKN | 8840 | 103 | 2301 / 786 / 5753 | 2542 / 1381 / 4917 | 0 | 1 | 0 |
| FALA | 8570 | 142 | 2910 / 1093 / 4567 | 3216 / 2686 / 2668 | 0 | 2 | 0 |
| FALE | 11243 | 159 | 3970 / 820 / 6453 | 4244 / 4200 / 2799 | 0 | 0 | 0 |
| FALW | 7676 | 0 | 0 / 0 / 7676 | 0 / 0 / 7676 | 0 | 0 | 0 |
| FAMM | 8672 | 0 | 2993 / 460 / 5219 | 3241 / 1184 / 4247 | 0 | 2 | 0 |
| FAOR | 13497 | 159 | 4519 / 1536 / 7442 | 5019 / 5898 / 2580 | 0 | 0 | 0 |
| FAPE | 11260 | 129 | 3586 / 820 / 6854 | 3857 / 3965 / 3438 | 0 | 37 | 0 |
| FAPM | 3 | 136 | 0 / 0 / 3 | 0 / 0 / 3 | 0 | 0 | 0 |
| FAPN | 2821 | 0 | 0 / 0 / 2821 | 0 / 0 / 2821 | 0 | 0 | 0 |
| FAPP | 9002 | 101 | 2770 / 695 / 5537 | 3030 / 1280 / 4692 | 0 | 0 | 0 |
| FAPR | 1 | 0 | 1 / 0 / 0 | 1 / 0 / 0 | 0 | 0 | 0 |
| FARB | 1 | 100 | 0 / 0 / 1 | 0 / 0 / 1 | 0 | 0 | 0 |
| FASB | 977 | 0 | 548 / 14 / 414 / incomplete 1 | 549 / 22 / 405 / incomplete 1 | 0 | 0 | 0 |
| FASI | 4852 | 0 | 0 / 0 / 4852 | 0 / 0 / 4852 | 0 | 0 | 0 |
| FAUP | 9501 | 128 | 4207 / 287 / 5007 | 4459 / 2320 / 2722 | 0 | 4 | 0 |
| FAUT | 8813 | 100 | 1120 / 328 / 7365 | 1182 / 554 / 7077 | 0 | 1 | 0 |
| FAVV | 5502 | 0 | 0 / 0 / 5502 | 0 / 0 / 5502 | 0 | 0 | 0 |
| FAWB | 7216 | 99 | 318 / 198 / 6700 | 339 / 217 / 6660 | 0 | 0 | 0 |
| FAWK | 7644 | 0 | 0 / 0 / 7643 / incomplete 1 | 0 / 0 / 7643 / incomplete 1 | 0 | 0 | 0 |

## Notes on this run (15 Nov 2026)

- There were **no crashes**.
- The five **incomplete** verdicts (depart and land) were all genuine NIL reports such as `METAR FABM NIL`. That is the expected result.
- Land has more CAUTION than depart mainly because many reports fall after dark, and the default PPL profile has no night rating.
- Most CAVOK NO-GO verdicts are the 12 kt PPL crosswind limit doing its job (Cape Town and other windy days). Those were not listed as odd.
- The six odd results below are all at **FAGG**, where a current CAVOK METAR was given a NO-GO from a TAF `FM` group:
  - 16 Oct 2026, 19:00Z and 20:00Z land: the METAR is CAVOK, the TAF `FM162000` is `BKN020` (2 000 ft), and the engine said NO-GO for a 2 000 ft ceiling. A 2 000 ft ceiling is above the 1 000 ft VFR floor, so this is worth a closer look. At 19:00Z the `FM` has also not started yet, so applying it to Land now is itself surprising.
  - 5 Nov 2026, 10:00Z and 11:00Z: the METAR is CAVOK, and the engine said NO-GO because of `FM051200 20010KT 6000 -RA BKN010` (“vis 6.0 km”). 6 km is above the 5 km VFR floor, and at 10:05Z that `FM` is still in the future.
- The **54 parse failures** are clustered, not random. The main systematic gap is directional or split visibility (`0400W`, `0800NE`, `4500SE`, `2500SW 8000NE`). Also: `9999-RA` (missing space), `METAR COR`, and a handful of garbled archive groups (`23016VKT`, `01006K6002KT`). Exact raw reports are listed above and in `results.json`.
- The dataset includes real bad weather: 2 411 thunderstorm reports, 4 896 fog or mist, 1 998 gusts of 30 kt or more, 1 029 visibilities of 500 m or less, and 5 383 ceilings of 500 ft or less (South African `FA**` METARs only).

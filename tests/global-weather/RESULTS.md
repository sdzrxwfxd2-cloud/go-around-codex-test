# Global real-weather engine run (16 Nov 2026)

Ran at 2026-11-15T22:56:56Z (dataset times are UTC; this stamp is ISO-8601). In Africa/Johannesburg that is 16 Nov 2026, 00:56 SAST.

The engine files under `site/engine/` were imported read-only and were not modified. This run uses the fixed engine on branch `fix/engine-parser-fm-16nov`, commit `5a5e60b212e417385176dff07e6d0b9b3032a89a`, rules 2.5.0, lock `90d2ba46f3478c597c502d607193a4a3e072962da4eedace4b0d3131a3922cb1`.

## How it was run

- Profile: PPL, Cessna 172, VFR — the same default the site tests use.
- **METAR pass:** each real METAR/SPECI, with the TAF then in force (if we have one). `now` is 5 minutes after the report. Depart and Land.
- **Forecast pass (separate counts):** each TAF is evaluated at hourly times across its validity, and at 5 minutes before and after every FM, BECMG, TEMPO, PROB, validity and month-rollover boundary, only while that TAF is still the one in force. Each time is paired with the METAR then in force. Depart and Land.
- Foreign stations are not in the SA runway database. `field.runways` is empty (the same as the SA runner when a station has no runways). The engine then treats the whole wind as worst-case crosswind. Latitude, longitude and elevation come from aviationweather.gov station metadata so night and density altitude can still run. No runway headings were invented.
- Elapsed: 233.8 s.

## Totals

- Stations run: **209** of 212 requested (runway headings: 0, lat/lon: 209, elevation: 209). No data: OKBK, HSSS, HLLT.
- METARs / SPECIs fed in: **2,811,809** (the aim was about one million; this is the true count of real reports gathered).
- TAFs on file: **152,244**; TAFs scanned on the forecast pass: **146,445**; METAR-pass reports that had a TAF in force: **577,723**.
- METAR-pass evaluations: **5,623,618** (depart + land).
- Forecast-pass time points: **726,949**.
- Forecast-pass evaluations: **1,453,898** (depart + land).
- Crashes: **0**.
- Parse failures: **571,976** (see the breakdown below; almost all are statute-mile visibility).
- Odd results flagged: **262** (forecast-timing: **0**).
- Evaluations INCOMPLETE because a required group was malformed: **1,404**.
- NO-GOs from worst-case crosswind because no runway headings were available: **433,270** (expected engine policy, not counted as odd).
- NO-GOs because night was not selected on the default PPL profile: **758,037**.
- NO-GOs because the engine did not read visibility from the METAR (and had no TAF/model fill): **2,076,666**.
- Forecast-pass GOs where an in-force TAF permanent period had statute-mile visibility below 5 km: **18**.

Date range of METARs: 16 Nov 2025 00:00 UTC to 15 Nov 2026 22:47 UTC. Countries: 84. Regions: Europe 919,243 METARs; Asia 586,371; US 436,972; Africa 250,140; South America 213,304; Australia 173,719; Canada 87,392; New Zealand 69,985; Caribbean 44,339; Mexico 30,344. US TAFs (12 months): 133,021. All other TAFs are mostly the last 30 days.

### Verdicts — METAR pass, depart

nogo: 2,157,122, go: 427,709, caution: 226,456, incomplete: 522

### Verdicts — METAR pass, land

nogo: 1,431,671, go: 470,742, caution: 908,874, incomplete: 522

### Verdicts — forecast pass, depart

nogo: 702,108, go: 15,183, caution: 9,474, incomplete: 184

### Verdicts — forecast pass, land

nogo: 671,592, go: 16,682, caution: 38,491, incomplete: 184

These NO-GO totals are **not** a fair picture of engine accuracy worldwide. More than two million NO-GOs are the statute-mile visibility gap below, and a further 433,270 are worst-case crosswind because foreign airports have no runway headings. Land also shows more CAUTION than depart, mostly night on the default PPL profile.

## Crashes

None. The engine did not throw on any of the 5,623,618 METAR-pass evaluations or the 1,453,898 forecast-pass evaluations.

## Parse failures

A parse failure means `parseOfficial` threw, returned null on a non-NIL report, or missed a wind/visibility group that is clearly in the raw text. A later rescan (same engine, parse only) was used to group examples. The first 80 examples stored in `results.json` were all statute-mile reports, which had filled the cap; rarer shapes are in `sources/rare-parse-examples.json`.

Corrected type counts from that rescan (statute-mile classified first, so a `METAR COR … 10SM` report is counted as statute-mile, which is the actual miss):

- **statute-mile visibility: 571,932**
- **other: 34**
- **glued weather after vis (missing space): 5**
- **directional visibility: 5**
- COR-as-its-own-type: 0 (the 359 “COR” flags in the first `results.json` count were US corrections that also used `10SM`)

### 1. Statute-mile visibility — a real engine gap

This is the big finding. A large share of North American METARs write visibility as `10SM`, `P6SM`, `15SM`, `3SM` or `1/2SM` rather than a four-digit metre group. `parseOfficial`, when given only the raw text (no separate visib field), does not set `vis` or `cavok`. The engine then says “Visibility not in METAR, no TAF or model value” and returns NO-GO. US and Canadian TAFs use the same SM groups, so the TAF cannot fill the hole either.

Example (CYFB, a perfectly ordinary official report):

`METAR CYFB 160000Z 31006KT 15SM BKN025 M06/M09 A3020 RMK SC7 SLP231`

`parseOfficial` returns `vis: null`, `cavok: false`. The same happens for `METAR KJFK 160051Z 19015KT 10SM BKN039 OVC047 11/06 A2950 …`.

This was not visible on the South African set, which uses metre visibility and CAVOK. It is not a bad report and not a crash. It accounts for almost all 571,976 parse flags and for the 2,076,666 “visibility not in METAR” NO-GOs. Until this is fixed, US and Canadian verdict totals from a raw-text feed are not a fair accuracy measure. If the live site always passes a numeric visib field from the aviationweather.gov API, the gap may not show on the site; any path that only has the raw text will hit it.

The engine's TAF token reader has the same hole. See “Statute-mile TAF visibility” below.

### 2. Directional visibility with a slash — a small remaining parser gap

Five reports at MDSD (Santo Domingo), for example:

`METAR MDSD 211800Z 10006KT 8000NW/N VCSH FEW020CB BKN022 30/23 Q1014 CB/NW/N`

The 16 Nov fix already reads `0400W` and `8000NE`. It does not read `8000NW/N` or `8000NE/E`. Real reports, rare.

### 3. Glued weather leftovers — mostly garbled archive text

Five reports at DNMM. The 16 Nov fix splits `9999-RA` when the weather is a normal WMO 4678 code. These leftovers are messier: `8000- RA` (hyphen then a space), `3000-TRSA` and `5000-REA` (typos), `6000-RAAAAA` (garbage). The typo and garbage cases should stay INCOMPLETE (the engine must not guess). `8000- RA` could fairly be read as 8,000 m.

### 4. Other leftover shapes (34)

These cluster into a few real-report shapes:

- Missing space before a cloud group, which the 16 Nov glued-weather fix does not cover: `9999FEW010`, `9999BKN014`, `9999OVC015`, `9999SCT023`.
- Visibility in kilometres: `8KM BR`, `8KM RA` (HAAB). The engine does not read a `KM` group.
- Garbled but real archive lines: `CAVOK4KT 6000`, `18/06KT`, a missing `Z` on the time group, a DFFD line that looks like two reports stuck together (`CAVOK 27/Z 24009KT 9999 BKN008`).

The missing-space-before-cloud and `8KM` cases are small, real parser gaps. The garbled lines should stay incomplete.

## Forecast timing

These are cases where a TAF `FM` or `BECMG` start cited in the verdict looks to fall more than 2 hours after `now` (the engine's depart/land-now look-ahead). TEMPO/PROB overlaps are not listed. This is the same class as the six FAGG false NO-GOs found on the South African set before the 16 Nov fix.

**None flagged.** The 16 Nov FM look-ahead fix held on this worldwide set, including month-rollover samples and 726,949 forecast time points.

## Statute-mile TAF visibility (US-style)

The engine's TAF token reader looks for a four-digit metre group or CAVOK. A US-style period written with `P6SM`, `3SM` or `2SM` is not read as visibility. The forecast pass compared an independent SM reading of the in-force permanent period. **18** evaluations (all at MMGL, Guadalajara) were GO with “Within limits” while that period was `FM161000 12005KT 3SM HZ VC BCFG SCT020` (about 4.8 km, below the 5 km VFR minimum). Example TAF:

`TAF MMGL 151639Z 1518/1618 22010KT P6SM SCT025 … FM161000 12005KT 3SM HZ VC BCFG SCT020 TEMPO 1611/1615 2SM BR`

This is a real engine gap, the TAF side of the same SM hole. It is not a crash. The count is small only because many other US/Canadian forecast checks were already NO-GO from the METAR-side SM miss or from worst-case crosswind.

## Other odd results

The 262 odd flags are not automatically bugs. They came from only two stations, and both have a better explanation than a new timing bug:

- **DNAA (260 flags).** A CAVOK METAR was paired with a TAF `BECMG 2709/2711 24010KT BKN013` (and some TS/CB periods). During the BECMG window the engine takes the worse ceiling (1,300 ft), which is below the 1,500 ft CTR/ATZ VFR minimum, and says NO-GO. That is stated engine policy for a BECMG already in force, not an early FM. The METAR at 07:00Z is also more than 90 minutes old by 09:00Z, so the engine is judging the TAF. The odd detector fired only because the METAR text still said CAVOK and the why text did not contain the word BECMG.
- **DFFD (2 flags).** One garbled archive line contains both `CAVOK` and `BKN008`: `METAR DFFD 282300Z 23007KT 200V260 CAVOK 27/Z 24009KT 9999 BKN008 22/20 Q1015 NOSIG`. The NO-GO for an 800 ft ceiling is consistent with the second half of the line. This looks like two reports stuck together in the archive, not an engine logic bug.

Worst-case crosswind on a station with no runway headings, night without a night rating, density altitude, METAR trend, and a TAF FM/BECMG that starts inside the 2 h look-ahead and is below the PPL minima, were treated as expected and were not listed as odd.

## Suggested landing-page line

**"Tested on 2,811,809 real METARs and 152,244 real TAFs from 209 airports in 84 countries, covering 12 months: 5,623,618 departure and landing checks, plus 1,453,898 forecast-timing checks, with zero crashes."**

Do not add an accuracy percentage from this run. The statute-mile visibility gap still needs a parser fix, and nobody has yet marked a sample of verdicts against what a real instructor would decide.


## Per station

| Station | METARs | TAFs | Rwys | METAR Depart GO/CAU/NOGO/other | METAR Land GO/CAU/NOGO/other | Fcst evals | Fcst Depart GO/CAU/NOGO/other | Crashes | Parse fail | Odd |
| --- | ---: | ---: | --- | --- | --- | ---: | --- | ---: | ---: | ---: |
| BIAR | 8974 | 97 | no | 1950/1000/6024 | 2130/3559/3285 | 682 | 9/35/297 | 0 | 0 | 0 |
| BIKF | 17502 | 99 | no | 1942/1455/14105 | 2132/4677/10693 | 696 | 24/24/300 | 0 | 0 | 0 |
| CYFB | 10442 | 66 | no | 0/0/10442 | 0/0/10442 | 912 | 4/0/452 | 0 | 10442 | 0 |
| CYHZ | 12935 | 111 | no | 0/0/12935 | 0/0/12935 | 988 | 2/0/492 | 0 | 12935 | 0 |
| CYOW | 10955 | 103 | no | 0/0/10955 | 0/0/10955 | 996 | 2/3/493 | 0 | 10955 | 0 |
| CYUL | 11007 | 98 | no | 0/0/11007 | 0/0/11007 | 1012 | 0/0/506 | 0 | 11007 | 0 |
| CYVR | 10319 | 101 | no | 0/0/10319 | 0/0/10319 | 1004 | 0/7/495 | 0 | 10319 | 0 |
| CYWG | 10315 | 64 | no | 0/0/10315 | 0/0/10315 | 950 | 3/5/467 | 0 | 10315 | 0 |
| CYYC | 10630 | 99 | no | 0/0/10630 | 0/0/10630 | 960 | 5/0/475 | 0 | 10630 | 0 |
| CYYZ | 10789 | 125 | no | 0/0/10789 | 0/0/10789 | 1064 | 0/0/532 | 0 | 10789 | 0 |
| DBBB | 6827 | 124 | no | 708/1296/4823 | 771/3417/2639 | 1858 | 111/177/641 | 0 | 0 | 0 |
| DFFD | 6774 | 96 | no | 1922/850/4002 | 2076/3362/1336 | 1356 | 146/153/379 | 0 | 1 | 2 |
| DGAA | 8261 | 93 | no | 958/1112/6190/incomplete 1 | 1030/3579/3651/incomplete 1 | 1598 | 149/119/531 | 0 | 0 | 0 |
| DNAA | 3279 | 36 | no | 749/286/2233/incomplete 11 | 827/1390/1051/incomplete 11 | 1616 | 167/105/530/incomplete 6 | 0 | 1 | 82 |
| DNMM | 6904 | 81 | no | 412/484/5967/incomplete 41 | 517/2758/3588/incomplete 41 | 1764 | 60/28/793/incomplete 1 | 0 | 6 | 0 |
| DTTA | 17195 | 94 | no | 5087/2220/9888 | 5524/8624/3047 | 1468 | 189/104/441 | 0 | 0 | 0 |
| DTTJ | 17375 | 93 | no | 3761/2657/10957 | 4060/8466/4849 | 1434 | 187/149/381 | 0 | 1 | 0 |
| DXXX | 8673 | 105 | no | 1444/1610/5618/incomplete 1 | 1547/5138/1987/incomplete 1 | 1964 | 296/134/552 | 0 | 0 | 0 |
| EBBR | 17504 | 84 | no | 4477/1817/11210 | 4917/6897/5690 | 1246 | 97/39/487 | 0 | 0 | 0 |
| EDDB | 17516 | 91 | no | 4289/1761/11466 | 4727/6718/6071 | 1318 | 75/29/555 | 0 | 0 | 0 |
| EDDF | 17518 | 107 | no | 4822/1610/11086 | 5248/6877/5393 | 1356 | 122/68/488 | 0 | 0 | 0 |
| EDDH | 17519 | 108 | no | 3465/1583/12471 | 3828/5535/8156 | 1440 | 47/36/637 | 0 | 0 | 0 |
| EDDK | 17518 | 81 | no | 4832/1552/11134 | 5297/6811/5410 | 1164 | 135/42/405 | 0 | 0 | 0 |
| EDDL | 17522 | 92 | no | 4138/1881/11503 | 4557/6833/6132 | 1322 | 126/61/474 | 0 | 0 | 0 |
| EDDM | 17521 | 104 | no | 5128/1182/11211 | 5619/5533/6369 | 1422 | 78/32/601 | 0 | 0 | 0 |
| EDDS | 17517 | 78 | no | 5797/1286/10434 | 6346/6862/4309 | 1144 | 85/50/437 | 0 | 0 | 0 |
| EFHK | 17511 | 126 | no | 3173/1495/12841/incomplete 2 | 3514/4892/9103/incomplete 2 | 1108 | 23/26/505 | 0 | 0 | 0 |
| EGAA | 17382 | 81 | no | 3090/2176/12116 | 3449/6653/7280 | 1092 | 71/114/361 | 0 | 0 | 0 |
| EGBB | 17350 | 96 | no | 4017/1874/11458/incomplete 1 | 4416/6843/6090/incomplete 1 | 1122 | 48/55/458 | 0 | 0 | 0 |
| EGCC | 17616 | 98 | no | 4348/1510/11758 | 4769/6597/6250 | 1186 | 88/73/432 | 0 | 0 | 0 |
| EGKK | 17478 | 100 | no | 4160/2006/11312 | 4597/7170/5711 | 1258 | 51/59/519 | 0 | 0 | 0 |
| EGLL | 17626 | 100 | no | 3338/1898/12390 | 3624/7022/6980 | 1200 | 55/59/486 | 0 | 0 | 0 |
| EGPF | 17514 | 94 | no | 2943/2026/12545 | 3267/6366/7881 | 1112 | 37/120/399 | 0 | 0 | 0 |
| EGPH | 17435 | 74 | no | 3421/2118/11896 | 3785/7287/6363 | 1002 | 55/108/338 | 0 | 0 | 0 |
| EGSS | 17513 | 113 | no | 3498/2087/11928 | 3881/6698/6934 | 1256 | 28/73/527 | 0 | 0 | 0 |
| EHAM | 17468 | 91 | no | 3079/1969/12420 | 3413/6000/8055 | 1520 | 89/58/613 | 0 | 0 | 0 |
| EHRD | 17513 | 87 | no | 3541/1967/12005 | 3954/5900/7659 | 1506 | 71/39/643 | 0 | 0 | 0 |
| EIDW | 17508 | 104 | no | 3354/1911/12243 | 3705/6713/7090 | 1498 | 130/86/533 | 0 | 0 | 0 |
| EINN | 17513 | 102 | no | 2848/1786/12879 | 3171/6255/8087 | 1456 | 101/51/576 | 0 | 0 | 0 |
| EKCH | 17578 | 120 | no | 2885/1949/12744 | 3180/5727/8671 | 1028 | 58/15/441 | 0 | 0 | 0 |
| ENBR | 17329 | 59 | no | 3161/1250/12918 | 3475/5453/8401 | 830 | 52/25/338 | 0 | 0 | 0 |
| ENGM | 17429 | 65 | no | 4263/1376/11790 | 4645/5277/7507 | 838 | 35/13/371 | 0 | 0 | 0 |
| ENTC | 17251 | 69 | no | 5065/1789/10397 | 5275/4581/7395 | 854 | 17/8/402 | 0 | 0 | 0 |
| ENZV | 17351 | 58 | no | 2851/1520/12980 | 3156/5996/8199 | 800 | 51/26/323 | 0 | 0 | 40 |
| EPWA | 17509 | 115 | no | 4035/1625/11849 | 4442/6014/7053 | 904 | 55/36/361 | 0 | 0 | 0 |
| ESGG | 17494 | 132 | no | 3268/2016/12210 | 3626/5840/8028 | 894 | 28/37/382 | 0 | 0 | 0 |
| ESSA | 17409 | 121 | no | 3213/2085/12111 | 3577/6319/7513 | 826 | 57/19/337 | 0 | 0 | 0 |
| EVRA | 17509 | 100 | no | 4256/1376/11877 | 4663/5697/7149 | 884 | 63/29/350 | 0 | 0 | 0 |
| FBSK | 7971 | 92 | no | 2458/700/4808/incomplete 5 | 2695/3303/1968/incomplete 5 | 1228 | 198/45/371 | 0 | 1 | 2 |
| FIMP | 8777 | 96 | no | 1449/1311/6017 | 1636/4269/2872 | 1504 | 105/156/491 | 0 | 0 | 0 |
| FQMA | 7641 | 92 | no | 1136/924/5581 | 1214/3040/3387 | 1186 | 48/76/469 | 0 | 0 | 0 |
| FYWH | 5817 | 97 | no | 2030/447/3339/incomplete 1 | 2189/1483/2144/incomplete 1 | 1438 | 123/31/565 | 0 | 0 | 0 |
| FZAA | 5203 | 39 | no | 23/215/4945/incomplete 20 | 25/377/4781/incomplete 20 | 978 | 0/8/480/incomplete 1 | 0 | 0 | 0 |
| GMAD | 17484 | 123 | no | 2152/3554/11778 | 2295/9433/5756 | 1730 | 148/153/564 | 0 | 0 | 0 |
| GMFO | 17503 | 119 | no | 3885/1612/12006 | 4151/7779/5573 | 1740 | 217/82/571 | 0 | 0 | 0 |
| GMMN | 18047 | 125 | no | 3273/2688/12085/incomplete 1 | 3619/7569/6858/incomplete 1 | 1974 | 204/114/669 | 0 | 0 | 4 |
| GOBD | 17234 | 111 | no | 2012/2855/12367 | 2209/7509/7516 | 1738 | 109/150/610 | 0 | 0 | 0 |
| HAAB | 6989 | 85 | no | 1182/929/4812/incomplete 66 | 1230/3024/2669/incomplete 66 | 1296 | 128/118/398/incomplete 4 | 0 | 8 | 0 |
| HECA | 17389 | 119 | no | 2941/1932/12507/incomplete 9 | 3047/6187/8146/incomplete 9 | 1692 | 102/115/628/incomplete 1 | 0 | 0 | 0 |
| HELX | 8510 | 99 | no | 3586/639/4284/incomplete 1 | 3905/4290/314/incomplete 1 | 1344 | 307/35/330 | 0 | 0 | 0 |
| HKJK | 12532 | 85 | no | 1568/1527/9358/incomplete 79 | 1613/4609/6231/incomplete 79 | 2074 | 82/115/833/incomplete 7 | 0 | 7 | 0 |
| HTDA | 9876 | 84 | no | 1792/1760/6296/incomplete 28 | 1930/5413/2505/incomplete 28 | 1698 | 196/190/463 | 0 | 9 | 0 |
| HUEN | 13879 | 110 | no | 626/734/12513/incomplete 6 | 790/4093/8990/incomplete 6 | 1856 | 33/4/891 | 0 | 1 | 2 |
| KATL | 10244 | 4675 | no | 0/0/10244 | 0/0/10244 | 30348 | 12/1/15161 | 0 | 10244 | 0 |
| KBNA | 9560 | 2577 | no | 0/0/9559/incomplete 1 | 0/0/9559/incomplete 1 | 25798 | 9/1/12887/incomplete 2 | 0 | 9558 | 0 |
| KBOS | 10219 | 2926 | no | 0/0/10212/incomplete 7 | 0/0/10212/incomplete 7 | 28018 | 15/6/13984/incomplete 4 | 0 | 10210 | 0 |
| KBUF | 12191 | 2043 | no | 0/0/12191 | 0/0/12191 | 27798 | 0/0/13899 | 0 | 12188 | 0 |
| KCLE | 10521 | 3309 | no | 0/0/10521 | 0/0/10521 | 27734 | 12/1/13854 | 0 | 10520 | 0 |
| KCLT | 10052 | 3898 | no | 0/0/10039/incomplete 13 | 0/0/10039/incomplete 13 | 28864 | 10/1/14401/incomplete 20 | 0 | 10038 | 0 |
| KDCA | 10477 | 3397 | no | 0/0/10477 | 0/0/10477 | 30656 | 6/2/15320 | 0 | 10473 | 0 |
| KDEN | 9856 | 3959 | no | 0/0/9847/incomplete 9 | 0/0/9847/incomplete 9 | 31904 | 16/5/15915/incomplete 16 | 0 | 9844 | 0 |
| KDFW | 9711 | 3421 | no | 0/0/9711 | 0/0/9711 | 26938 | 14/3/13452 | 0 | 9711 | 0 |
| KDTW | 11283 | 3383 | no | 0/0/11278/incomplete 5 | 0/0/11278/incomplete 5 | 30740 | 3/12/15352/incomplete 3 | 0 | 11277 | 0 |
| KEWR | 9909 | 3470 | no | 0/0/9909 | 0/0/9909 | 28602 | 0/10/14291 | 0 | 9909 | 0 |
| KIAD | 9899 | 3392 | no | 0/0/9899 | 0/0/9899 | 30556 | 5/2/15271 | 0 | 9899 | 0 |
| KIAH | 9959 | 3258 | no | 0/0/9958/incomplete 1 | 0/0/9958/incomplete 1 | 29740 | 1/12/14855/incomplete 2 | 0 | 9957 | 0 |
| KJFK | 9493 | 3516 | no | 0/0/9492/incomplete 1 | 0/0/9492/incomplete 1 | 28688 | 0/10/14333/incomplete 1 | 0 | 9489 | 0 |
| KLAS | 9099 | 3181 | no | 0/0/9099 | 0/0/9099 | 27106 | 22/1/13530 | 0 | 9099 | 0 |
| KLAX | 10178 | 3664 | no | 0/0/10177/incomplete 1 | 0/0/10177/incomplete 1 | 30848 | 16/1/15404/incomplete 3 | 0 | 10176 | 0 |
| KLGA | 9912 | 3436 | no | 0/0/9912 | 0/0/9912 | 28540 | 0/10/14260 | 0 | 9909 | 0 |
| KMCI | 10371 | 1943 | no | 0/0/10370/incomplete 1 | 0/0/10370/incomplete 1 | 25054 | 9/0/12517/incomplete 1 | 0 | 10370 | 0 |
| KMCO | 9758 | 3488 | no | 0/0/9757/incomplete 1 | 0/0/9757/incomplete 1 | 29292 | 6/9/14629/incomplete 2 | 0 | 9756 | 0 |
| KMDW | 10275 | 3469 | no | 0/0/10275 | 0/0/10275 | 29430 | 4/9/14702 | 0 | 10275 | 0 |
| KMEM | 10176 | 3322 | no | 0/0/10176 | 0/0/10176 | 28224 | 13/1/14098 | 0 | 10175 | 0 |
| KMIA | 9869 | 3175 | no | 0/0/9868/incomplete 1 | 0/0/9868/incomplete 1 | 27048 | 3/6/13513/incomplete 2 | 0 | 9867 | 0 |
| KMSP | 10935 | 3229 | no | 0/0/10935 | 0/0/10935 | 27866 | 4/0/13929 | 0 | 10935 | 0 |
| KMSY | 10276 | 1789 | no | 0/0/10276 | 0/0/10276 | 24176 | 0/1/12087 | 0 | 10276 | 0 |
| KOAK | 9865 | 1796 | no | 0/0/9864/incomplete 1 | 0/0/9864/incomplete 1 | 25012 | 13/0/12492/incomplete 1 | 0 | 9863 | 0 |
| KOKC | 9963 | 2110 | no | 0/0/9963 | 0/0/9963 | 24916 | 5/4/12449 | 0 | 9963 | 0 |
| KOMA | 10297 | 2431 | no | 0/0/10297 | 0/0/10297 | 26616 | 2/7/13299 | 0 | 10297 | 0 |
| KORD | 11061 | 3516 | no | 0/0/11060/incomplete 1 | 0/0/11060/incomplete 1 | 29338 | 6/9/14654 | 0 | 11045 | 0 |
| KPDX | 9992 | 3301 | no | 0/0/9991/incomplete 1 | 0/0/9991/incomplete 1 | 27590 | 7/0/13787/incomplete 1 | 0 | 9991 | 0 |
| KPHL | 11161 | 3510 | no | 0/0/11161 | 0/0/11161 | 28680 | 4/0/14336 | 0 | 11161 | 0 |
| KPHX | 9129 | 3299 | no | 0/0/9128/incomplete 1 | 0/0/9128/incomplete 1 | 28402 | 12/1/14186/incomplete 2 | 0 | 9127 | 0 |
| KRDU | 9742 | 2094 | no | 0/0/9738/incomplete 4 | 0/0/9738/incomplete 4 | 25092 | 10/0/12532/incomplete 4 | 0 | 9731 | 0 |
| KSAN | 10779 | 3475 | no | 0/0/10778/incomplete 1 | 0/0/10778/incomplete 1 | 28568 | 6/8/14269/incomplete 1 | 0 | 10778 | 0 |
| KSEA | 10620 | 3493 | no | 0/0/10619/incomplete 1 | 0/0/10619/incomplete 1 | 30080 | 10/2/15025/incomplete 3 | 0 | 10617 | 0 |
| KSFO | 9971 | 3329 | no | 0/0/9971 | 0/0/9971 | 28688 | 12/1/14331 | 0 | 9971 | 0 |
| KSLC | 9484 | 3684 | no | 0/0/9484 | 0/0/9484 | 29768 | 12/3/14869 | 0 | 9484 | 0 |
| KSTL | 10685 | 3364 | no | 0/0/10667/incomplete 18 | 0/0/10667/incomplete 18 | 29144 | 10/3/14543/incomplete 16 | 0 | 10665 | 0 |
| KTPA | 10478 | 3143 | no | 0/0/10471/incomplete 7 | 0/0/10471/incomplete 7 | 28968 | 12/0/14462/incomplete 10 | 0 | 10463 | 0 |
| LEBL | 17717 | 87 | no | 3973/2447/11297 | 4421/8664/4632 | 1238 | 159/92/368 | 0 | 0 | 0 |
| LEMD | 17772 | 84 | no | 5943/1193/10636 | 6454/7677/3641 | 1110 | 125/53/377 | 0 | 0 | 0 |
| LEPA | 18015 | 103 | no | 4377/2314/11324 | 4916/8564/4535 | 1442 | 165/61/495 | 0 | 0 | 0 |
| LEVC | 17706 | 90 | no | 5518/2132/10056 | 6050/8607/3049 | 1350 | 209/64/402 | 0 | 0 | 0 |
| LFBO | 17512 | 102 | no | 3929/1563/12020 | 4264/6236/7012 | 1282 | 83/52/506 | 0 | 0 | 0 |
| LFML | 17511 | 85 | no | 3959/1849/11703 | 4307/6823/6381 | 1124 | 68/40/454 | 0 | 0 | 0 |
| LFPG | 17536 | 133 | no | 3832/1914/11790 | 4212/6946/6378 | 1266 | 38/72/523 | 0 | 0 | 0 |
| LFPO | 17397 | 114 | no | 4435/1836/11126 | 4826/6898/5673 | 1262 | 66/68/497 | 0 | 0 | 0 |
| LGAV | 17312 | 51 | no | 3769/2147/11396 | 4197/8810/4305 | 724 | 61/45/256 | 0 | 0 | 0 |
| LHBP | 17983 | 51 | no | 4881/1605/11496/incomplete 1 | 5331/7109/5542/incomplete 1 | 904 | 82/35/335 | 0 | 0 | 0 |
| LIMC | 17377 | 89 | no | 6741/1078/9558 | 7317/7063/2997 | 1282 | 180/44/417 | 0 | 0 | 0 |
| LIPZ | 17413 | 86 | no | 6581/1290/9542 | 7172/7300/2941 | 1172 | 144/61/381 | 0 | 0 | 0 |
| LIRF | 17427 | 91 | no | 5589/2340/9498 | 6145/9076/2206 | 1378 | 183/59/447 | 0 | 0 | 0 |
| LIRN | 17183 | 85 | no | 6386/1887/8909/incomplete 1 | 6975/8750/1457/incomplete 1 | 1214 | 183/61/363 | 0 | 0 | 0 |
| LKPR | 17514 | 114 | no | 4476/1749/11289 | 4887/6884/5743 | 836 | 41/19/358 | 0 | 0 | 0 |
| LOWW | 17516 | 110 | no | 3936/1856/11724 | 4328/6832/6356 | 1012 | 50/28/428 | 0 | 0 | 0 |
| LPPR | 17507 | 53 | no | 4273/1728/11506 | 4699/6728/6080 | 746 | 31/23/319 | 0 | 0 | 0 |
| LPPT | 17403 | 56 | no | 3904/2086/11413 | 4193/7827/5383 | 790 | 62/15/318 | 0 | 0 | 0 |
| LROP | 17524 | 54 | no | 4718/1378/11428 | 5182/5746/6596 | 854 | 67/45/315 | 0 | 0 | 50 |
| LSGG | 17511 | 118 | no | 5910/1432/10169 | 6466/6871/4174 | 966 | 62/45/376 | 0 | 0 | 0 |
| LSZH | 17510 | 133 | no | 5507/1315/10688 | 6026/6196/5288 | 1064 | 50/15/467 | 0 | 0 | 0 |
| MDSD | 9061 | 54 | no | 1840/752/6460/incomplete 9 | 1981/3555/3516/incomplete 9 | 686 | 26/22/294/incomplete 1 | 0 | 5 | 2 |
| MKJP | 8740 | 53 | no | 49/91/8589/incomplete 11 | 52/234/8443/incomplete 11 | 972 | 71/138/277 | 0 | 0 | 0 |
| MMGL | 9458 | 65 | no | 0/0/9458 | 0/0/9458 | 1040 | 9/0/511 | 0 | 9458 | 0 |
| MMMX | 11941 | 351 | no | 0/0/11941 | 0/0/11941 | 1656 | 10/0/818 | 0 | 11941 | 0 |
| MMUN | 8945 | 62 | no | 0/0/8945 | 0/0/8945 | 988 | 10/0/484 | 0 | 8945 | 0 |
| NZAA | 17503 | 132 | no | 1295/1502/14706 | 1612/10026/5865 | 1078 | 23/58/458 | 0 | 0 | 0 |
| NZCH | 17505 | 128 | no | 1469/1469/14567 | 1804/9500/6201 | 1082 | 31/46/464 | 0 | 0 | 0 |
| NZQN | 17472 | 65 | no | 2620/1338/13514 | 3090/11100/3282 | 1020 | 48/30/432 | 0 | 0 | 0 |
| NZWN | 17505 | 115 | no | 602/797/16106 | 747/5309/11449 | 1008 | 2/19/483 | 0 | 0 | 0 |
| OBBI | 14948 | 114 | no | 3756/1875/9317 | 4114/7440/3394 | 1410 | 169/93/443 | 0 | 0 | 0 |
| OERK | 8895 | 113 | no | 3135/868/4892 | 3404/4396/1095 | 1484 | 298/55/389 | 0 | 0 | 0 |
| OMAA | 13700 | 85 | no | 3484/2218/7998 | 3683/7862/2155 | 1472 | 182/99/455 | 0 | 0 | 0 |
| OMDB | 15053 | 99 | no | 3339/2926/8786/incomplete 2 | 3655/8721/2675/incomplete 2 | 1470 | 173/97/465 | 0 | 0 | 0 |
| OMSJ | 15053 | 110 | no | 4357/2542/8154 | 4818/8162/2073 | 1744 | 252/112/508 | 0 | 0 | 0 |
| OPKC | 17478 | 109 | no | 0/0/17472/incomplete 6 | 0/0/17472/incomplete 6 | 1534 | 0/0/765/incomplete 2 | 0 | 0 | 0 |
| OTBD | 17404 | 94 | no | 4087/2700/10617 | 4453/9626/3325 | 1716 | 255/97/506 | 0 | 0 | 0 |
| OTHH | 8732 | 84 | no | 1760/1331/5641 | 1906/4476/2350 | 2100 | 234/160/656 | 0 | 0 | 0 |
| PAFA | 9889 | 1889 | no | 0/0/9887/incomplete 2 | 0/0/9887/incomplete 2 | 23422 | 8/0/11702/incomplete 1 | 0 | 9885 | 0 |
| PAJN | 10458 | 2254 | no | 0/0/10458 | 0/0/10458 | 26522 | 0/0/13261 | 0 | 10458 | 0 |
| PANC | 10526 | 2125 | no | 0/0/10526 | 0/0/10526 | 25882 | 7/0/12934 | 0 | 10524 | 14 |
| PHNL | 9225 | 3158 | no | 0/0/9198/incomplete 27 | 0/0/9198/incomplete 27 | 27482 | 0/0/13692/incomplete 49 | 0 | 9194 | 0 |
| PHOG | 9424 | 3130 | no | 0/0/9424 | 0/0/9424 | 27468 | 0/0/13734 | 0 | 9389 | 0 |
| RCTP | 19604 | 69 | no | 1822/1219/16563 | 2030/6655/10919 | 960 | 61/24/395 | 0 | 0 | 0 |
| RJAA | 17907 | 59 | no | 2108/1142/14657 | 2448/7486/7973 | 946 | 74/26/373 | 0 | 0 | 0 |
| RJBB | 17671 | 61 | no | 2505/983/14183 | 2775/7242/7654 | 888 | 47/17/380 | 0 | 0 | 0 |
| RJCC | 18183 | 98 | no | 1499/1233/15451 | 1766/6988/9429 | 1422 | 77/56/578 | 0 | 0 | 0 |
| RJFF | 17704 | 82 | no | 2420/1774/13510 | 2796/9546/5362 | 1358 | 119/50/510 | 0 | 0 | 0 |
| RJTT | 17659 | 66 | no | 1996/1003/14660 | 2201/6495/8963 | 916 | 74/23/361 | 0 | 0 | 0 |
| RKPC | 9153 | 106 | no | 1674/837/6642 | 1876/4374/2903 | 1564 | 139/70/573 | 0 | 0 | 0 |
| RKSI | 17517 | 72 | no | 3329/2165/12023 | 3746/8977/4794 | 1130 | 91/54/420 | 0 | 0 | 0 |
| RKSS | 9139 | 72 | no | 2162/1010/5967 | 2431/4733/1975 | 1116 | 110/47/401 | 0 | 0 | 0 |
| RPLL | 8933 | 66 | no | 1910/1255/5768 | 2117/5648/1168 | 932 | 120/67/279 | 0 | 0 | 0 |
| SABE | 9456 | 100 | no | 2508/835/6112/incomplete 1 | 2700/3633/3122/incomplete 1 | 1578 | 282/95/412 | 0 | 0 | 2 |
| SAEZ | 9745 | 100 | no | 2184/1169/6389/incomplete 3 | 2424/3915/3403/incomplete 3 | 1550 | 248/102/424/incomplete 1 | 0 | 0 | 0 |
| SBBR | 9140 | 124 | no | 2310/613/6217 | 2498/3971/2671 | 1208 | 55/17/532 | 0 | 0 | 0 |
| SBCT | 9603 | 94 | no | 1588/731/7284 | 1782/2138/5683 | 1012 | 36/25/445 | 0 | 0 | 0 |
| SBEG | 9440 | 90 | no | 2143/464/6833 | 2296/3357/3787 | 1096 | 45/29/474 | 0 | 0 | 0 |
| SBFI | 9628 | 126 | no | 2367/600/6661 | 2599/3462/3567 | 1202 | 122/38/441 | 0 | 0 | 0 |
| SBGL | 9029 | 123 | no | 2047/1116/5866 | 2222/3950/2857 | 1358 | 105/67/507 | 0 | 0 | 0 |
| SBGR | 9508 | 133 | no | 1776/784/6938/incomplete 10 | 1961/2694/4843/incomplete 10 | 1742 | 66/58/746/incomplete 1 | 0 | 0 | 0 |
| SBKP | 9228 | 95 | no | 2409/869/5950 | 2605/3916/2707 | 1312 | 112/77/467 | 0 | 0 | 0 |
| SBPA | 9342 | 91 | no | 1956/736/6650 | 2096/3385/3861 | 910 | 93/54/308 | 0 | 0 | 60 |
| SBRF | 9213 | 92 | no | 1364/1541/6308 | 1519/4447/3247 | 922 | 67/96/298 | 0 | 0 | 0 |
| SCEL | 8761 | 101 | no | 1849/1181/5728/incomplete 3 | 1975/4433/2350/incomplete 3 | 1472 | 219/73/443/incomplete 1 | 0 | 0 | 0 |
| SCFA | 8089 | 106 | no | 1342/1246/5501 | 1415/3195/3479 | 1394 | 127/78/492 | 0 | 0 | 0 |
| SEQU | 2 | 0 | no | 0/1/1 | 0/1/1 | 0 | 0/0/0 | 0 | 0 | 0 |
| SGAS | 10299 | 93 | no | 2327/1123/6848/incomplete 1 | 2488/3892/3918/incomplete 1 | 1272 | 112/117/407 | 0 | 0 | 0 |
| SKBO | 10710 | 89 | no | 3355/1332/6023 | 3610/5215/1885 | 1408 | 210/115/379 | 0 | 0 | 0 |
| SKCG | 9046 | 87 | no | 2367/1033/5645/incomplete 1 | 2603/4702/1740/incomplete 1 | 1368 | 104/83/497 | 0 | 0 | 0 |
| SLLP | 9075 | 128 | no | 1944/407/6723/incomplete 1 | 2068/2523/4483/incomplete 1 | 1834 | 180/10/727 | 0 | 0 | 0 |
| SLVR | 9241 | 121 | no | 1054/824/7359/incomplete 4 | 1210/3339/4688/incomplete 4 | 1620 | 114/76/620 | 0 | 0 | 0 |
| SPJC | 9029 | 103 | no | 1620/1475/5934 | 1739/3693/3597 | 1472 | 86/147/503 | 0 | 0 | 0 |
| SPZO | 16732 | 110 | no | 6853/1337/8540/incomplete 2 | 7343/8226/1161/incomplete 2 | 1434 | 254/115/348 | 0 | 1 | 0 |
| SUMU | 9982 | 91 | no | 1524/1083/7369/incomplete 6 | 1685/3516/4775/incomplete 6 | 1416 | 157/101/448/incomplete 2 | 0 | 0 | 0 |
| SVMI | 9006 | 82 | no | 2951/468/5549/incomplete 38 | 3172/3226/2570/incomplete 38 | 1274 | 157/31/448/incomplete 1 | 0 | 3 | 2 |
| TIST | 8858 | 1595 | no | 0/0/8854/incomplete 4 | 0/0/8854/incomplete 4 | 23808 | 9/18/11869/incomplete 8 | 0 | 8614 | 0 |
| TJSJ | 8823 | 1801 | no | 0/0/8821/incomplete 2 | 0/0/8821/incomplete 2 | 25206 | 14/5/12581/incomplete 3 | 0 | 8821 | 0 |
| TNCM | 8857 | 45 | no | 1615/1763/5476/incomplete 3 | 1772/5128/1954/incomplete 3 | 744 | 88/45/239 | 0 | 0 | 0 |
| VABB | 17549 | 131 | no | 0/0/17549 | 0/0/17549 | 862 | 0/0/431 | 0 | 0 | 0 |
| VCBI | 8682 | 105 | no | 1445/1259/5978 | 1541/3788/3353 | 1830 | 119/118/678 | 0 | 0 | 0 |
| VGHS | 17000 | 107 | no | 0/0/16981/incomplete 19 | 0/0/16981/incomplete 19 | 1656 | 0/0/828 | 0 | 0 | 0 |
| VHHH | 18856 | 169 | no | 3670/2158/13028 | 4076/9565/5215 | 1072 | 98/86/352 | 0 | 0 | 0 |
| VIDP | 17443 | 166 | no | 15/25/17402/incomplete 1 | 15/25/17402/incomplete 1 | 888 | 0/0/444 | 0 | 0 | 0 |
| VMMC | 13174 | 80 | no | 2361/1712/9101 | 2615/6768/3791 | 1074 | 96/76/365 | 0 | 0 | 0 |
| VOBL | 17470 | 124 | no | 966/2856/13647/incomplete 1 | 1062/3233/13174/incomplete 1 | 896 | 35/36/377 | 0 | 0 | 0 |
| VOMM | 17516 | 68 | no | 16/54/17446 | 19/59/17438 | 1084 | 0/0/542 | 0 | 0 | 0 |
| VRMM | 8492 | 99 | no | 697/451/7342/incomplete 2 | 757/1733/6000/incomplete 2 | 1432 | 4/19/693 | 0 | 0 | 0 |
| VTBS | 17506 | 77 | no | 4491/2620/10395 | 4856/10359/2291 | 1120 | 179/41/340 | 0 | 0 | 0 |
| VTSP | 17489 | 79 | no | 5040/2172/10277 | 5584/9673/2232 | 1144 | 203/37/332 | 0 | 0 | 0 |
| VYYY | 16998 | 110 | no | 0/1072/15925/incomplete 1 | 0/1097/15900/incomplete 1 | 1506 | 0/100/653 | 0 | 0 | 0 |
| WADD | 17529 | 112 | no | 2151/1997/13381 | 2339/8748/6442 | 1418 | 145/91/473 | 0 | 0 | 0 |
| WIII | 17806 | 115 | no | 746/2280/14778/incomplete 2 | 804/4504/12496/incomplete 2 | 1968 | 5/111/868 | 0 | 0 | 0 |
| WMKK | 17830 | 86 | no | 2343/1510/13977 | 2580/5814/9436 | 1220 | 65/49/496 | 0 | 0 | 0 |
| WSSS | 17881 | 98 | no | 1589/1365/14927 | 1753/8178/7950 | 1100 | 41/16/493 | 0 | 0 | 0 |
| YBBN | 18702 | 100 | no | 2309/2237/14149/incomplete 7 | 2757/12210/3728/incomplete 7 | 802 | 9/27/365 | 0 | 0 | 0 |
| YBCS | 20290 | 79 | no | 1956/1969/16365 | 2312/11523/6455 | 704 | 49/56/247 | 0 | 0 | 0 |
| YBTL | 19106 | 68 | no | 1100/2060/15946 | 1366/11753/5987 | 674 | 16/32/289 | 0 | 0 | 0 |
| YMML | 19719 | 97 | no | 1619/1714/16386 | 1971/8714/9034 | 782 | 24/38/329 | 0 | 0 | 0 |
| YPAD | 18717 | 92 | no | 2232/2141/14344 | 2614/10656/5447 | 772 | 12/59/315 | 0 | 0 | 0 |
| YPDN | 19002 | 142 | no | 2845/2232/13925 | 3362/10690/4950 | 1176 | 55/25/508 | 0 | 0 | 0 |
| YPPH | 18848 | 90 | no | 2817/2162/13869 | 3118/9700/6030 | 764 | 34/36/312 | 0 | 0 | 0 |
| YSSY | 19649 | 135 | no | 1499/1446/16702/incomplete 2 | 1739/9740/8168/incomplete 2 | 844 | 8/9/405 | 0 | 0 | 0 |
| YWLM | 19686 | 118 | no | 2353/2101/15232 | 2873/11342/5471 | 840 | 11/18/391 | 0 | 0 | 0 |
| ZBAA | 17770 | 93 | no | 4271/1476/12023 | 4737/8829/4204 | 982 | 96/46/349 | 0 | 0 | 0 |
| ZGGG | 18101 | 90 | no | 4133/2058/11910 | 4569/9507/4025 | 942 | 156/38/277 | 0 | 0 | 0 |
| ZSPD | 17768 | 96 | no | 1590/2443/13735 | 1786/8260/7722 | 1054 | 42/79/406 | 0 | 0 | 0 |
| ZUUU | 8778 | 93 | no | 2346/708/5724 | 2597/3577/2604 | 982 | 107/39/345 | 0 | 0 | 0 |

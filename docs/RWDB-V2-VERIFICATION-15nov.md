# Runway / elevation database v2: verification report (15 Nov 2026)

Built by `tools/rwdb/verify_v2.py` (inputs `tools/rwdb/raw-v2/`), report by `tools/rwdb/report_v2.py`. v1 is unchanged; the result is `site/data/ad-runways-elev.locked.v2.json`. Times SAST. Sources stay in the data file for the admin dashboard; the public cards never show them.

## Summary

| Check | Result |
|---|---|
| Aerodromes checked | 588 (plus 52 heliports/balloonport: elevation and position only) |
| Aerodromes with a runway heading | v1 487 → **v2 498** |
| Runway ends checked | 1412 |
| Ends with 2 or more independent sources | 336; all agree within 5° except 5 (listed) |
| Ends with one measured source | 1076: 763 pass the designator check (±10°), 59 fail it (listed), 254 have no designator (OSM way without ref: kept with a label from the measured heading when the field has no labelled runway, otherwise not used; see changes) |
| Elevations checked | 640; 72 with sources more than 100 ft apart (listed) |
| Changes v1 → v2 | 169 (every one listed below) |
| Card positions corrected | 11 (clear evidence) |

Resolution rules: heading AIP published true bearing > AIP threshold coordinates > OSM measured geometry > OurAirports; elevation AIP AD 2.2 (read from the AD 2 PDF) > terrain at the measured OSM runway (when OurAirports is more than 100 ft off it) > OurAirports (when consistent with the ground at its own position) > terrain at the card. AIP-extract values marked `APPROX` (designator × 10) are not treated as published.

## Every change v1 → v2

| # | Card | What | Change |
|---|---|---|---|
| 1 | FAPE | elevation | 190 -> 229 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 2 | FALE | elevation | 305 -> 307 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 3 | FAKN | runways | removed duplicate OSM runway None/None (same headings as SACAA AIP 05/23) |
| 4 | FAKN | runways | removed duplicate OSM runway None/None (same headings as SACAA AIP 05/23) |
| 5 | FALA | elevation | 4459 -> 4521 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 6 | FAOR | elevation | 5558 ft unchanged, source now the AIP AD 2 PDF |
| 7 | FAPP | runways | removed duplicate OSM runway None/None (same headings as SACAA AIP 05/23) |
| 8 | FAUP | elevation | 2756 -> 2791 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 9 | FAMM | elevation | 4181 ft unchanged, source now the AIP AD 2 PDF |
| 10 | FAWB | elevation | 4068 -> 4095 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 11 | FAHS | elevation | 1716 -> 1801 ft (published (OurAirports)) |
| 12 | FAGY | elevation | 3511 -> 3531 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 13 | FALM | elevation | 3055 -> 3069 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 14 | FAOH | elevation | 1053 -> 1063 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 15 | FAOB | elevation | 33 -> 52 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 16 | FAPG | elevation | 443 -> 465 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 17 | FASK | runways | unlabelled OSM way (343, 163) not used: the field has labelled runways 02/20, 06/24 |
| 18 | FAVG | heading 05 | 22.3 -> 27.9 (OSM geometry; sources {'OSM geometry': 27.9, 'OurAirports thresholds': 27.3, 'OurAirports heading': 28.0}) |
| 19 | FAVG | heading 23 | 202.3 -> 207.9 (OSM geometry; sources {'OSM geometry': 207.9, 'OurAirports thresholds': 207.3, 'OurAirports heading': 208.0}) |
| 20 | FAVG | elevation | 23 -> 20 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 21 | FACO | heading 14 | 118 -> 115.5 (AIP published bearings [118, 293] not reciprocal; AIP threshold coordinates used) |
| 22 | FACO | heading 32 | 293 -> 295.5 (AIP published bearings [118, 293] not reciprocal; AIP threshold coordinates used) |
| 23 | FACO | runways | unlabelled OSM way (292, 112) not used: the field has labelled runways 14/32 |
| 24 | FACO | runways | unlabelled OSM way (206, 26) not used: the field has labelled runways 14/32 |
| 25 | FACO | elevation | 3517 -> 3530 ft (published (OurAirports)) |
| 26 | FABW | runways | unlabelled OSM way (1, 181) not used: the field has labelled runways 08/26, 17/35 |
| 27 | FABW | elevation | 2936 -> 2929 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 28 | FAWN | heading 14 | 117.31 -> 114.8 (AIP published bearings [117.31, 293.57] not reciprocal; AIP threshold coordinates used) |
| 29 | FAWN | heading 32 | 293.57 -> 294.8 (AIP published bearings [117.31, 293.57] not reciprocal; AIP threshold coordinates used) |
| 30 | FAGR | runways | removed duplicate OurAirports runway 02/20 (same headings as SACAA AIP 04/22) |
| 31 | FAHL | heading 03 | 8 -> 9.5 (OSM geometry; sources {'OSM geometry': 9.5}) |
| 32 | FAHL | heading 21 | 188 -> 189.5 (OSM geometry; sources {'OSM geometry': 189.5}) |
| 33 | FAKG | runways | removed AIP runway(s) 11/29 that belong to KWANDWE |
| 34 | FAKR | runways | unlabelled OSM way (148, 328) not used: the field has labelled runways 08/26 |
| 35 | FAKR | elevation | 5486 -> 5500 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 36 | FAPA | runways | removed duplicate OSM runway None/None (same headings as SACAA AIP 10L/28R) |
| 37 | FAPA | elevation | 299 -> 315 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 38 | FAUL | runways | unlabelled OSM way (184, 4) not used: the field has labelled runways 05/23 |
| 39 | FAUL | elevation | 1680 -> 1720 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 40 | FASZ | elevation | 1011 -> 1040 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 41 | FAVM | elevation | 2326 -> 2333 ft (SACAA AIP AD 2.2 (read from the AD 2 PDF)) |
| 42 | ZA-0086 | runways | unlabelled OSM way (16, 196) not used: the field has labelled runways 18/36 |
| 43 | FAAG | runways | removed duplicate OSM runway None/None (same headings as OSM None/None) |
| 44 | FAAG | runways | removed duplicate OSM runway None/None (same headings as OSM None/None) |
| 45 | FAAG | runways | unlabelled OSM way (113, 293) not used: the field has labelled runways 07/25 |
| 46 | ZA-0017 | card position | [-27.984167098999023, 28.39444351196289] -> [-28.010845, 28.322514]; OSM way 222485266 (08/26) 0.7 km from the OurAirports position; no runway within 2 km of the card |
| 47 | ZA-0015 | elevation | 5105 -> 4531 ft (OurAirports 5105 ft is 574 ft off the ground at its own position and at the card) |
| 48 | ZA-0029 | elevation | 4500 -> 5374 ft (OurAirports 4500 ft is 874 ft off the ground at the measured runway) |
| 49 | ZA-0063 | elevation | 3900 -> 4075 ft (OurAirports 3900 ft is 175 ft off the ground at the measured runway) |
| 50 | ZA-0012 | elevation | 5500 -> 4905 ft (OurAirports 5500 ft is 595 ft off the ground at its own position and at the card) |
| 51 | ZA-0346 | elevation | 1575 -> 1719 ft (OurAirports 1575 ft is 144 ft off the ground at the measured runway) |
| 52 | ZA-0260 | runways | unlabelled OSM way (40, 220) not used: the field has labelled runways 16/34 |
| 53 | ZA-0078 | runways | unlabelled OSM way (244, 64) not used: the field has labelled runways 10/28 |
| 54 | FABF | elevation | 5940 -> 5830 ft (OurAirports 5940 ft is 110 ft off the ground at the measured runway) |
| 55 | ZA-0055 | elevation | 3300 -> 3130 ft (OurAirports 3300 ft is 170 ft off the ground at the measured runway) |
| 56 | ZA-0037 | elevation | 5100 -> 4948 ft (OurAirports 5100 ft is 152 ft off the ground at the measured runway) |
| 57 | ZA-0321 | heading 14 | 120.0 -> 117.2 (OSM geometry; sources {'OurAirports heading': 120.0, 'OSM geometry': 117.2}) |
| 58 | ZA-0321 | heading 32 | 300.0 -> 297.2 (OSM geometry; sources {'OurAirports heading': 300.0, 'OSM geometry': 297.2}) |
| 59 | ZA-0321 | runways | removed duplicate OSM runway None/None (same headings as OurAirports 14/32) |
| 60 | ZA-0039 | runways | unlabelled OSM way (70, 250) not used: the field has labelled runways 08/26 |
| 61 | ZA-0026 | runways | unlabelled OSM way (324, 144) not used: the field has labelled runways 09/27 |
| 62 | ZA-0071 | elevation | 4300 -> 3993 ft (OurAirports 4300 ft is 307 ft off the ground at the measured runway) |
| 63 | ZA-0075 | elevation | 1500 -> 1752 ft (OurAirports 1500 ft is 252 ft off the ground at the measured runway) |
| 64 | ZA-0019 | runways | removed duplicate OSM runway None/None (same headings as OSM None/None) |
| 65 | ZA-0019 | elevation | 4300 -> 4584 ft (OurAirports 4300 ft is 284 ft off the ground at the measured runway) |
| 66 | ZA-0011 | elevation | 4647 -> 4478 ft (OurAirports 4647 ft is 169 ft off the ground at the measured runway) |
| 67 | ZA-0093 | card position | [-30.58333396911621, 23.516666412353516] -> [-30.60212, 23.502614]; OSM ways 31870657 (02/20) and 125270827 (15/33) about 0.2 km from the OurAirports position; card coordinates are rounded (30.5833 S 23.5167 E); no runway within 2 km of the card |
| 68 | ZA-0006 | elevation | 5500 -> 5879 ft (OurAirports 5500 ft is 379 ft off the ground at its own position and at the card) |
| 69 | FACE | elevation | 1519 -> 1923 ft (OurAirports 1519 ft is 404 ft off the ground at the measured runway) |
| 70 | ZA-0061 | elevation | 2180 -> 2464 ft (OurAirports 2180 ft is 284 ft off the ground at the measured runway) |
| 71 | FACH | card position | [-32.74470138549805, 25.796300888061523] -> [-32.789329, 25.817592]; OSM runway way 1511295459 34 m from the OurAirports position; no runway within 2 km of the card (OurAirports lists it closed) |
| 72 | FADP | card position | [-33.18320083618164, 25.193199157714844] -> [-33.096683, 25.256839]; OSM way 202286836 (05/23) 3 m from the OurAirports position; card 11.3 km away with no runway within 2 km |
| 73 | FADS | runways | unlabelled OSM way (65, 245) not used: the field has labelled runways 08/26 |
| 74 | ZA-0177 | elevation | 203 -> 194 ft (no published value; terrain at the measured runway) |
| 75 | FADC | elevation | 3360 -> 3366 ft (no published value; terrain at the measured runway) |
| 76 | FADZ | elevation | 5948 -> 5459 ft (OurAirports 5948 ft is 489 ft off the ground at the measured runway) |
| 77 | ZA-0187 | elevation | 689 -> 682 ft (no published value; terrain at the measured runway) |
| 78 | ZA-0223 | elevation | 4070 -> 4180 ft (OurAirports 4070 ft is 110 ft off the ground at the measured runway) |
| 79 | FAED | card position | [-29.75, 25.899999618530273] -> [-29.74625, 25.920452]; OSM ways 220845509 (04/22), 220845512 (09/27), 220845513 (16/34) 0.16-0.26 km from the OurAirports position; card coordinates rounded (29.75 S 25.90 E) |
| 80 | ZA-0112 | elevation | 5300 -> 5197 ft (OurAirports 5300 ft is 103 ft off the ground at the measured runway) |
| 81 | ZA-0036 | elevation | 6464 -> 5141 ft (OurAirports 6464 ft is 1323 ft off the ground at its own position and at the card) |
| 82 | FAFO | elevation | 1581 -> 1745 ft (OurAirports 1581 ft is 164 ft off the ground at the measured runway) |
| 83 | FAFU | elevation | 4841 -> 4416 ft (OurAirports 4841 ft is 425 ft off the ground at its own position and at the card) |
| 84 | FAFF | runways | unlabelled OSM way (269, 89) not used: the field has labelled runways 01/19, 11/29 |
| 85 | FAGJ | card position | [-30.38330078125, 20.033300399780273] -> [-30.368249, 20.016341]; OSM ways 221103922/3/5 and 1229724246 0.25-0.40 km from the OurAirports position; no runway within 2 km of the card |
| 86 | FAGJ | runways | unlabelled OSM way (200, 20) not used: the field has labelled runways 17/35, 13/31, 09/27 |
| 87 | ZA-0229 | runways | unlabelled OSM way (85, 265) not used: the field has labelled runways 01/19 |
| 88 | ZA-0229 | elevation | 4300 -> 4132 ft (OurAirports 4300 ft is 168 ft off the ground at the measured runway) |
| 89 | ZA-0320 | runways | unlabelled OSM way (47, 227) not used: the field has labelled runways 14/32 |
| 90 | ZA-0316 | elevation | 5349 -> 5102 ft (OurAirports 5349 ft is 247 ft off the ground at the measured runway) |
| 91 | ZA-0038 | runways | removed duplicate OSM runway None/None (same headings as OurAirports 10/19) |
| 92 | ZA-0353 | elevation | 1768 -> 1772 ft (no published value; terrain at the measured runway) |
| 93 | ZA-0099 | elevation | 5545 -> 5541 ft (no published value; terrain at the measured runway) |
| 94 | FAIV | elevation | 2100 -> 2264 ft (OurAirports 2100 ft is 164 ft off the ground at the measured runway) |
| 95 | FAIA | card position | [-27.4867000579834, 31.171100616455078] -> [-27.531834, 31.299856]; OSM way 95066272 (07/25) 43 m from the OurAirports position; card 13.7 km away with no runway within 2 km |
| 96 | ZA-0045 | runways | unlabelled OSM way (90, 270) not used: the field has labelled runways 02/20 |
| 97 | ZA-0045 | runways | unlabelled OSM way (188, 8) not used: the field has labelled runways 02/20 |
| 98 | ZA-0104 | elevation | 3494 -> 3330 ft (OurAirports 3494 ft is 164 ft off the ground at the measured runway) |
| 99 | ZA-0163 | elevation | 2880 -> 3501 ft (OurAirports 2880 ft is 621 ft off the ground at the measured runway) |
| 100 | ZA-0003 | elevation | 4524 -> 4593 ft (no published value; terrain at the measured runway) |
| 101 | FAKS | runways | removed duplicate OSM runway None/None (same headings as OurAirports 07/25) |
| 102 | ZA-0181 | elevation | 262 -> 256 ft (no published value; terrain at the measured runway) |
| 103 | ZA-0189 | runways | unlabelled OSM way (276, 96) not used: the field has labelled runways 05/23 |
| 104 | ZA-0189 | elevation | 787 -> 774 ft (no published value; terrain at the measured runway) |
| 105 | FALF | elevation | 2997 -> 2808 ft (OurAirports 2997 ft is 189 ft off the ground at the measured runway) |
| 106 | FALL | runways | unlabelled OSM way (170, 350) not used: the field has labelled runways 04/22, 11/29 |
| 107 | FAMQ | elevation | 4106 -> 4396 ft (OurAirports 4106 ft is 290 ft off the ground at the measured runway) |
| 108 | FAMP | elevation | 2116 -> 1309 ft (OurAirports 2116 ft is 807 ft off the ground at the measured runway) |
| 109 | FAGW | elevation | 1823 -> 1713 ft (OurAirports 1823 ft is 110 ft off the ground at the measured runway) |
| 110 | FAMY | elevation | 971 -> 463 ft (OurAirports 971 ft is 508 ft off the ground at the measured runway) |
| 111 | FAMI | runways | removed duplicate OSM runway 04/22 (same headings as OurAirports 06/24) |
| 112 | ZA-0226 | runways | unlabelled OSM way (191, 11) not used: the field has labelled runways 16/34 |
| 113 | FAZP | elevation | 13 -> 177 ft (OurAirports 13 ft is 164 ft off the ground at the measured runway) |
| 114 | FABA | elevation | 5476 -> 5266 ft (OurAirports 5476 ft is 210 ft off the ground at the measured runway) |
| 115 | ZA-0096 | elevation | 560 -> 361 ft (OurAirports 560 ft is 199 ft off the ground at the measured runway) |
| 116 | FACA | elevation | 4995 -> 5253 ft (OurAirports 4995 ft is 258 ft off the ground at the measured runway) |
| 117 | ZA-0183 | elevation | 499 -> 495 ft (no published value; terrain at the measured runway) |
| 118 | FANG | elevation | 3357 -> 1450 ft (OurAirports 3357 ft is 1907 ft off the ground at the measured runway) |
| 119 | FANY | runways | removed duplicate OSM runway None/None (same headings as OurAirports 10/28) |
| 120 | ZA-0371 | elevation | 1280 -> 1286 ft (no published value; terrain at the measured runway) |
| 121 | FAOD | elevation | 1340 -> 4367 ft (OurAirports 1340 ft is 3027 ft off the ground at its own position and at the card) |
| 122 | ZA-0143 | elevation | 3642 -> 3638 ft (no published value; terrain at the measured runway) |
| 123 | FAOL | card position | [-24.732999801635742, 31.399999618530273] -> [-24.758414, 31.405406]; OSM way 221579621 (02/20) 28 m from the OurAirports position; card coordinates rounded (24.733 S 31.400 E) |
| 124 | ZA-0156 | elevation | 686 -> 679 ft (no published value; terrain at the measured runway) |
| 125 | ZA-0110 | runways | removed duplicate OSM runway None/None (same headings as OSM 12/30) |
| 126 | ZA-0110 | runways | unlabelled OSM way (224, 44) not used: the field has labelled runways 12/30, 02/20, 05/23 |
| 127 | FAPY | runways | unlabelled OSM way (54, 234) not used: the field has labelled runways 06/24, 11/29 |
| 128 | FAPV | elevation | 4116 -> 3999 ft (OurAirports 4116 ft is 117 ft off the ground at the measured runway) |
| 129 | FAPK | runways | unlabelled OSM way (82, 262) not used: the field has labelled runways 16/34, 13/31 |
| 130 | FAPC | elevation | 2001 -> 1785 ft (OurAirports 2001 ft is 216 ft off the ground at the measured runway) |
| 131 | FARZ | card position | [-22.784201, 28.4303] -> [-27.784303, 28.430192]; card latitude -22.784201 is 5 degrees off: OurAirports FARZ Reitz is at -27.784303, 28.430192 (same longitude), OSM way 125314774 (11/29) 0.17 km from it; Reitz is in the Free State, the old point is in Limpopo |
| 132 | FARZ | runways | unlabelled OSM way (48, 228) not used: the field has labelled runways 11/29 |
| 133 | ZA-0351 | runways | unlabelled OSM way (23, 203) not used: the field has labelled runways 09/27, 11/92 |
| 134 | ZA-0351 | runways | unlabelled OSM way (124, 304) not used: the field has labelled runways 09/27, 11/92 |
| 135 | FARD | runways | unlabelled OSM way (120, 300) not used: the field has labelled runways 06/24 |
| 136 | FARD | elevation | 591 -> 694 ft (OurAirports 591 ft is 103 ft off the ground at the measured runway) |
| 137 | ZA-0069 | runways | removed duplicate OSM runway 06/24 (same headings as OurAirports 06A/24D) |
| 138 | ZA-0370 | elevation | 3638 -> 3619 ft (no published value; terrain at the measured runway) |
| 139 | ZA-0238 | elevation | 1716 -> 1719 ft (no published value; terrain at the measured runway) |
| 140 | ZA-0046 | card position | [-28.66666603088379, 24.03333282470703] -> [-28.691594, 24.043819]; OSM way 124890244 (03/21) 30 m from the OurAirports position; card coordinates rounded (28.6667 S 24.0333 E) |
| 141 | ZA-0056 | elevation | 196 -> 1053 ft (OurAirports 196 ft is 857 ft off the ground at its own position and at the card) |
| 142 | ZA-0176 | elevation | 217 -> 223 ft (no published value; terrain at the measured runway) |
| 143 | ZA-0154 | elevation | 886 -> 889 ft (no published value; terrain at the measured runway) |
| 144 | ZA-0349 | runways | removed duplicate OSM runway None/None (same headings as OSM 08/26) |
| 145 | FASM | runways | unlabelled OSM way (180, 0) not used: the field has labelled runways 09/27 |
| 146 | FASM | elevation | 4400 -> 4585 ft (OurAirports 4400 ft is 185 ft off the ground at the measured runway) |
| 147 | ZA-0186 | elevation | 3 -> 0 ft (no published value; terrain at the measured runway) |
| 148 | FATM | runways | unlabelled OSM way (213, 33) not used: the field has labelled runways 11/29, 15/33 |
| 149 | FATM | elevation | 2675 -> 2980 ft (OurAirports 2675 ft is 305 ft off the ground at the measured runway) |
| 150 | FASL | elevation | 5247 -> 5089 ft (OurAirports 5247 ft is 158 ft off the ground at the measured runway) |
| 151 | ZA-0080 | elevation | 2800 -> 2694 ft (OurAirports 2800 ft is 106 ft off the ground at the measured runway) |
| 152 | FATA | runways | unlabelled OSM way (99, 279) not used: the field has labelled runways 11/29, 13/31 |
| 153 | FATB | elevation | 1900 -> 1585 ft (OurAirports 1900 ft is 315 ft off the ground at the measured runway) |
| 154 | ZA-0245 | runways | unlabelled OSM way (32, 212) not used: the field has labelled runways 10/28 |
| 155 | ZA-0248 | elevation | 2188 -> 2178 ft (no published value; terrain at the measured runway) |
| 156 | ZA-0150 | elevation | 3041 -> 3038 ft (no published value; terrain at the measured runway) |
| 157 | ZA-0164 | runways | unlabelled OSM way (112, 292) not used: the field has labelled runways 08/26 |
| 158 | ZA-0149 | elevation | 3730 -> 3727 ft (no published value; terrain at the measured runway) |
| 159 | ZA-0028 | card position | [-27.350000381469727, 30.166667938232422] -> [-27.333669, 30.148343]; OSM ways 191212164 (05/23) and 191212165 (11/29) 0.1-0.2 km from the OurAirports position; card coordinates rounded (27.35 S 30.1667 E) |
| 160 | ZA-0232 | elevation | 4400 -> 4524 ft (OurAirports 4400 ft is 124 ft off the ground at the measured runway) |
| 161 | FAWM | runways | removed duplicate OSM runway None/None (same headings as OSM None/None) |
| 162 | FAWM | runways | unlabelled OSM way (135, 315) not used: the field has labelled runways 07/25 |
| 163 | FAWV | runways | unlabelled OSM way (77, 257) not used: the field has labelled runways 06/24 |
| 164 | ZA-0182 | runways | removed duplicate OSM runway None/None (same headings as OSM 09/27) |
| 165 | ZA-0182 | runways | removed duplicate OSM runway None/None (same headings as OSM None/None) |
| 166 | ZA-0182 | runways | unlabelled OSM way (114, 294) not used: the field has labelled runways 09/27, 04/22 |
| 167 | ZA-0182 | elevation | 1260 -> 1240 ft (no published value; terrain at the measured runway) |
| 168 | FAWT | elevation | 3000 -> 2894 ft (OurAirports 3000 ft is 106 ft off the ground at the measured runway) |
| 169 | ZA-0354 | elevation | 1614 -> 1617 ft (no published value; terrain at the measured runway) |

## Heading disagreements, failed designator checks and non-reciprocal ends

| Card | Name | End | v1 | Sources (true °) | Designator check | Outcome |
|---|---|---|---|---|---|---|
| FALA | Lanseria Intl | 07 | 47 | AIP published 47.0, AIP thresholds 47.3, OSM geometry 47.3, OurAirports thresholds 47.4, OurAirports heading 57.0 | 2.6 | kept 47 (AIP published is the preferred source; others listed) |
| FARB | Richards Bay | 05 | 34.2 | AIP published 34.2, AIP thresholds 34.1, OSM geometry 34.1, OurAirports thresholds 33.8, OurAirports heading 34.0 | 10.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 61 is 11° from designator 05 x 10 |
| FARB | Richards Bay | 23 | 214.2 | AIP published 214.2, AIP thresholds 214.1, OSM geometry 214.1, OurAirports thresholds 213.8, OurAirports heading 214.0 | 10.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 241 is 11° from designator 23 x 10 |
| FAVG | Virginia | 05 | 22.3 | OSM geometry 27.9, OurAirports thresholds 27.3, OurAirports heading 28.0 | 5.6 | changed to 27.9 (OSM geometry first) |
| FAVG | Virginia | 23 | 202.3 | OSM geometry 207.9, OurAirports thresholds 207.3, OurAirports heading 208.0 | 5.6 | changed to 207.9 (OSM geometry first) |
| FACO | Alkantpan Test Range | 14/32 | [118, 293] | | | ends not reciprocal; AIP threshold bearing used for both ends |
| FABM | Bethlehem | 11 | 96 | AIP published 96.0, AIP thresholds 96.1, OSM geometry 96.0, OurAirports thresholds 96.4, OurAirports heading 96.0 | 10.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 120 is 10° from designator 11 x 10 |
| FABM | Bethlehem | 29 | 276 | AIP published 276.0, AIP thresholds 276.1, OSM geometry 276.0, OurAirports thresholds 276.4, OurAirports heading 276.0 | 10.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 300 is 10° from designator 29 x 10 |
| FAWN | Cape Winelands | 14/32 | [117.31, 293.57] | | | ends not reciprocal; AIP threshold bearing used for both ends |
| FAGR | Graaff Reinet | 02 | 15.0 | OurAirports thresholds 15.2, OurAirports heading 15.0, OSM geometry 15.4 | 23.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 43 is 23° from designator 02 x 10 |
| FAGR | Graaff Reinet | 20 | 195.0 | OurAirports thresholds 195.2, OurAirports heading 195.0, OSM geometry 195.4 | 23.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 223 is 23° from designator 20 x 10 |
| FAHL | Hluhluwe | 03 | 8 | OSM geometry 9.5 | 4.9 | changed to 9.5 (OSM geometry first) |
| FAHL | Hluhluwe | 21 | 188 | OSM geometry 189.5 | 4.9 | changed to 189.5 (OSM geometry first) |
| FACF | St Francis Airfield | 10 | 81 | AIP published 81.0, AIP thresholds 81.3, OSM geometry 81.3 | 11.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 111 is 12° from designator 10 x 10 |
| FACF | St Francis Airfield | 28 | 261 | AIP published 261.0, AIP thresholds 261.3, OSM geometry 261.3 | 11.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 291 is 12° from designator 28 x 10 |
| ZA-0086 | Aero Den | 18 | 171.7 | OSM geometry 171.7 | 11.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 192 is 12° from designator 18 x 10 |
| ZA-0086 | Aero Den | 36 | 351.7 | OSM geometry 351.7 | 11.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 12 is 12° from designator 36 x 10 |
| ZA-0286 | Almar Exclusive Game Ranch | 18 | 168.6 | OSM geometry 168.6 | 10.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 191 is 10° from designator 18 x 10 |
| ZA-0286 | Almar Exclusive Game Ranch | 36 | 348.6 | OSM geometry 348.6 | 10.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 11 is 10° from designator 36 x 10 |
| ZA-0049 | Baken Mine | 12 | 30.2 | OSM geometry 30.2 | 69.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 50 is 70° from designator 12 x 10 |
| ZA-0049 | Baken Mine | 30 | 210.2 | OSM geometry 210.2 | 69.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 230 is 70° from designator 30 x 10 |
| ZA-0321 | Black Oystercatcher | 14 | 120.0 | OurAirports heading 120.0, OSM geometry 117.2 | 5.4 | changed to 117.2 (OSM geometry first) |
| ZA-0321 | Black Oystercatcher | 32 | 300.0 | OurAirports heading 300.0, OSM geometry 297.2 | 5.4 | changed to 297.2 (OSM geometry first) |
| FABU | Bultfontein | 17 | 158.0 | OSM geometry 158.0 | 11.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 181 is 11° from designator 17 x 10 |
| FABU | Bultfontein | 35 | 338.0 | OSM geometry 338.0 | 11.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 1 is 11° from designator 35 x 10 |
| FACG | Caledon Airfield | 06 | 45.4 | OSM geometry 45.4 | 13.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 73 is 13° from designator 06 x 10 |
| FACG | Caledon Airfield | 24 | 225.4 | OSM geometry 225.4 | 13.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 253 is 13° from designator 24 x 10 |
| FACL | Carolina | 09 | 93.4 | OSM geometry 93.4 | 24.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 115 is 25° from designator 09 x 10 |
| FACL | Carolina | 27 | 273.4 | OSM geometry 273.4 | 24.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 295 is 25° from designator 27 x 10 |
| FACL | Carolina | 35 | 338.6 | OSM geometry 338.6 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 0 is 10° from designator 35 x 10 |
| FACL | Carolina | 17 | 158.6 | OSM geometry 158.6 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 180 is 10° from designator 17 x 10 |
| FACE | Ceres | 09 | 73.4 | OSM geometry 73.4 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 100 is 10° from designator 09 x 10 |
| FACE | Ceres | 27 | 253.4 | OSM geometry 253.4 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 280 is 10° from designator 27 x 10 |
| FAER | Ellisras Matimba | 15 | 69.9 | OSM geometry 69.9 | 63.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 87 is 63° from designator 15 x 10 |
| FAER | Ellisras Matimba | 33 | 249.9 | OSM geometry 249.9 | 63.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 267 is 63° from designator 33 x 10 |
| FAES | Eshowe | 04 | 24.3 | OSM geometry 24.3 | 10.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 51 is 11° from designator 04 x 10 |
| FAES | Eshowe | 22 | 204.3 | OSM geometry 204.3 | 10.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 231 is 11° from designator 22 x 10 |
| ZA-0053 | Ganspan | 05 | 38.6 | OSM geometry 38.6 | 10.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 61 is 11° from designator 05 x 10 |
| ZA-0053 | Ganspan | 23 | 218.6 | OSM geometry 218.6 | 10.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 241 is 11° from designator 23 x 10 |
| FAGI | Giyani | 04 | 326.1 | OSM geometry 326.1 | 56.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 343 is 57° from designator 04 x 10 |
| FAGI | Giyani | 22 | 146.1 | OSM geometry 146.1 | 56.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 163 is 57° from designator 22 x 10 |
| FAGT | Grahamstown | 04 | 20.0 | OSM geometry 21.2, OurAirports thresholds 20.0, OurAirports heading 20.0 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 50 is 10° from designator 04 x 10 |
| FAGT | Grahamstown | 22 | 200.0 | OSM geometry 201.2, OurAirports thresholds 200.0, OurAirports heading 200.0 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 230 is 10° from designator 22 x 10 |
| FAGT | Grahamstown | 12 | 100.0 | OSM geometry 101.6, OurAirports thresholds 99.9, OurAirports heading 100.0 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 130 is 10° from designator 12 x 10 |
| FAGT | Grahamstown | 30 | 280.0 | OSM geometry 281.6, OurAirports thresholds 279.9, OurAirports heading 280.0 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 310 is 10° from designator 30 x 10 |
| ZA-0255 | Grasdrif | 14 | 166.6 | OSM geometry 166.6 | 46.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 187 is 47° from designator 14 x 10 |
| ZA-0255 | Grasdrif | 32 | 346.6 | OSM geometry 346.6 | 46.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 7 is 47° from designator 32 x 10 |
| FAHU | H M S Bastard Memorial | 09 | 78.7 | OSM geometry 78.7 | 16.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 107 is 17° from designator 09 x 10 |
| FAHU | H M S Bastard Memorial | 27 | 258.7 | OSM geometry 258.7 | 16.8 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 287 is 17° from designator 27 x 10 |
| FAHU | H M S Bastard Memorial | 18 | 167.4 | OSM geometry 167.4 | 15.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 196 is 16° from designator 18 x 10 |
| FAHU | H M S Bastard Memorial | 36 | 347.4 | OSM geometry 347.4 | 15.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 16 is 16° from designator 36 x 10 |
| FAHJ | Harding | 08 | 61.9 | OSM geometry 61.9 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 90 is 10° from designator 08 x 10 |
| FAHJ | Harding | 26 | 241.9 | OSM geometry 241.9 | 10.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 270 is 10° from designator 26 x 10 |
| ZA-0316 | Himeville Airfield | 03 | 23.1 | OSM geometry 23.1 | 20.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 50 is 20° from designator 03 x 10 |
| ZA-0316 | Himeville Airfield | 21 | 203.1 | OSM geometry 203.1 | 20.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 230 is 20° from designator 21 x 10 |
| ZA-0038 | Hippo Pools | 10 | 357.0 | OurAirports heading 357.0, OSM geometry 357.2 | 84.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 16 is 84° from designator 10 x 10 |
| FAIS | Isithebe | 14 | 123.4 | OSM geometry 123.4 | 10.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 150 is 10° from designator 14 x 10 |
| FAIS | Isithebe | 32 | 303.4 | OSM geometry 303.4 | 10.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 330 is 10° from designator 32 x 10 |
| FALD | Londolozi | 18 | 177.1 | OSM geometry 177.1 | 17.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 197 is 17° from designator 18 x 10 |
| FALD | Londolozi | 36 | 357.1 | OSM geometry 357.1 | 17.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 17 is 17° from designator 36 x 10 |
| ZA-0368 | Mantuma | 14 | 165.6 | OSM geometry 165.6 | 50.4 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 190 is 50° from designator 14 x 10 |
| ZA-0368 | Mantuma | 32 | 345.6 | OSM geometry 345.6 | 50.4 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 10 is 50° from designator 32 x 10 |
| FAMI | Marble Hall | 04 | 41.2 | OSM geometry 41.2 | 20.6 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 61 is 21° from designator 04 x 10 |
| FAMI | Marble Hall | 22 | 221.2 | OSM geometry 221.2 | 20.6 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 241 is 21° from designator 22 x 10 |
| FAMU | Mkuze | 17 | 157.0 | OSM geometry 156.5, OurAirports thresholds 156.8, OurAirports heading 157.0 | 11.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 182 is 12° from designator 17 x 10 |
| FAMU | Mkuze | 35 | 337.0 | OSM geometry 336.5, OurAirports thresholds 336.8, OurAirports heading 337.0 | 11.7 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 2 is 12° from designator 35 x 10 |
| ZA-0110 | Panorama Airfield | 12 | 110.9 | OSM geometry 110.9 | 12.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 132 is 12° from designator 12 x 10 |
| ZA-0110 | Panorama Airfield | 30 | 290.9 | OSM geometry 290.9 | 12.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 312 is 12° from designator 30 x 10 |
| FAPK | Prieska | 16 | 149.3 | OSM geometry 149.3 | 13.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 173 is 13° from designator 16 x 10 |
| FAPK | Prieska | 34 | 329.3 | OSM geometry 329.3 | 13.2 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 353 is 13° from designator 34 x 10 |
| FAPK | Prieska | 13 | 121.1 | OSM geometry 121.1 | 15.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 145 is 15° from designator 13 x 10 |
| FAPK | Prieska | 31 | 301.1 | OSM geometry 301.1 | 15.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 325 is 15° from designator 31 x 10 |
| ZA-0351 | Rhino Park Airfield | 92 | 267.5 | OSM geometry 267.5 | 88.0 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 288 is 88° from designator 92 x 10 |
| ZA-0186 | Stanley Island Airstrip | 18 | 188.9 | OSM geometry 188.9 | 38.4 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 218 is 38° from designator 18 x 10 |
| ZA-0186 | Stanley Island Airstrip | 36 | 8.9 | OSM geometry 8.9 | 38.4 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 38 is 38° from designator 36 x 10 |
| ZA-0296 | Twee Rivieren | 14 | 141.0 | OSM geometry 141.0 | 19.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 160 is 20° from designator 14 x 10 |
| ZA-0296 | Twee Rivieren | 32 | 321.0 | OSM geometry 321.0 | 19.5 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 340 is 20° from designator 32 x 10 |
| FAUH | Uitenhage | 16L | 139.8 | OSM geometry 139.8 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 170 is 10° from designator 16L x 10 |
| FAUH | Uitenhage | 34R | 319.8 | OSM geometry 319.8 | 10.1 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 350 is 10° from designator 34R x 10 |
| FAVU | Volksrust | 10 | 93.4 | OSM geometry 93.4 | 16.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 117 is 17° from designator 10 x 10 |
| FAVU | Volksrust | 28 | 273.4 | OSM geometry 273.4 | 16.9 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 297 is 17° from designator 28 x 10 |
| FAWV | White River Mercy Air | 06 | 43.8 | OSM geometry 43.8, OurAirports thresholds 44.8, OurAirports heading 85.0 | 4.4 | kept 43.8 (OSM geometry is the preferred source; others listed) |
| FAWV | White River Mercy Air | 24 | 223.8 | OSM geometry 223.8, OurAirports thresholds 224.8, OurAirports heading 265.0 | 4.4 | kept 223.8 (OSM geometry is the preferred source; others listed) |
| ZA-0182 | Wings Park Airfield | 04 | 20.9 | OSM geometry 20.9 | 11.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 51 is 11° from designator 04 x 10 |
| ZA-0182 | Wings Park Airfield | 22 | 200.9 | OSM geometry 200.9 | 11.3 | kept (measured geometry; the label may be old or the OSM ref wrong): magnetic 231 is 11° from designator 22 x 10 |

## Elevation: sources more than 100 ft apart, or changed

| Card | Name | v1 ft | v2 ft | Chosen | Candidates (ft) | Why |
|---|---|---|---|---|---|---|
| FAPE | Chief Dawid Stuurman Intl | 190 | 229 | AIP | AIP 229, OurAirports 226, terrain_card 190, terrain_osm_runway 187 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FALE | King Shaka Intl | 305 | 307 | AIP | AIP 307, OurAirports 295, terrain_card 305, terrain_ourairports_pos 299, terrain_osm_runway 299 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FALA | Lanseria Intl | 4459 | 4521 | AIP | AIP 4521, OurAirports 4517, terrain_card 4459, terrain_osm_runway 4455 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAUP | Upington | 2756 | 2791 | AIP | AIP 2791, OurAirports 2782, terrain_card 2756, terrain_osm_runway 2755 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAWB | Wonderboom | 4068 | 4095 | AIP | AIP 4095, OurAirports 4095, terrain_card 4068, terrain_osm_runway 4058 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAHS | Eastgate / Air Force Base Hoedspruit | 1716 | 1801 | OurAirports | OurAirports 1801, terrain_card 1716, terrain_osm_runway 1722 | published (OurAirports) |
| FAGY | Greytown | 3511 | 3531 | AIP | AIP 3531, OurAirports 3531, terrain_card 3510, terrain_osm_runway 3507 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FALM | Makhado Air Force Base | 3055 | 3069 | AIP | AIP 3069, OurAirports 3069, terrain_card 3054, terrain_osm_runway 3035 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAOH | Oudtshoorn | 1053 | 1063 | AIP | AIP 1063, OurAirports 1063, terrain_card 1053, terrain_osm_runway 1053 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAOB | Overberg | 33 | 52 | AIP | AIP 52, OurAirports 52, terrain_card 33, terrain_osm_runway 38 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAPG | Plettenberg Bay | 443 | 465 | AIP | AIP 465, OurAirports 465, terrain_card 443, terrain_osm_runway 440 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAVG | Virginia | 23 | 20 | AIP | AIP 20, OurAirports 20, terrain_card 23, terrain_osm_runway 23 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FACO | Alkantpan Test Range | 3517 | 3530 | OurAirports | OurAirports 3530, terrain_card 3517, terrain_osm_runway 3513 | published (OurAirports) |
| FABW | Beaufort West | 2936 | 2929 | AIP | AIP 2929, OurAirports 2941, terrain_card 2936, terrain_ourairports_pos 2920, terrain_osm_runway 2919 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAKR | Krugersdorp | 5486 | 5500 | AIP | AIP 5500, OurAirports 5499, terrain_card 5486, terrain_osm_runway 5477 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAPA | Port Alfred | 299 | 315 | AIP | AIP 315, OurAirports 275, terrain_card 299, terrain_osm_runway 300 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAUL | Prince Mangosuthu Buthelezi | 1680 | 1720 | AIP | AIP 1720, OurAirports 1720, terrain_card 1680, terrain_osm_runway 1690 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FASZ | Skukuza | 1011 | 1040 | AIP | AIP 1040, OurAirports 1020, terrain_card 1010, terrain_osm_runway 1010 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAUS | Ulusaba | 1380 | 1380 | AIP | AIP 1380, OurAirports 1263, terrain_card 1430, terrain_osm_runway 1404 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| FAVM | Venetia Mine | 2326 | 2333 | AIP | AIP 2333, OurAirports 2333, terrain_card 2326, terrain_osm_runway 2326 | SACAA AIP AD 2.2 (read from the AD 2 PDF) |
| ZA-0086 | Aero Den | 4050 | 4050 | OurAirports | OurAirports 4050, terrain_card 4065, terrain_ourairports_pos 4016, terrain_osm_runway 3952 | published (OurAirports) |
| ZA-0017 | Alberta | 5540 | 5540 | OurAirports | OurAirports 5540, terrain_card 5312 | published (OurAirports); 228 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0015 | Aldam | 5105 | 4531 | terrain_card | OurAirports 5105, terrain_card 4531 | OurAirports 5105 ft is 574 ft off the ground at its own position and at the card |
| ZA-0029 | Amersfoort | 4500 | 5374 | terrain_osm_runway | OurAirports 4500, terrain_card 5358, terrain_ourairports_pos 5374, terrain_osm_runway 5374 | OurAirports 4500 ft is 874 ft off the ground at the measured runway |
| ZA-0063 | Amphitheatre Lodge | 3900 | 4075 | terrain_osm_runway | OurAirports 3900, terrain_card 4085, terrain_osm_runway 4075 | OurAirports 3900 ft is 175 ft off the ground at the measured runway |
| ZA-0012 | Arizona | 5500 | 4905 | terrain_ourairports_pos | OurAirports 5500, terrain_card 4957, terrain_ourairports_pos 4905 | OurAirports 5500 ft is 595 ft off the ground at its own position and at the card |
| ZA-0346 | Askari Airstrip | 1575 | 1719 | terrain_osm_runway | OurAirports 1575, terrain_card 1719, terrain_osm_runway 1719 | OurAirports 1575 ft is 144 ft off the ground at the measured runway |
| FABF | Barkly East | 5940 | 5830 | terrain_osm_runway | OurAirports 5940, terrain_card 5830, terrain_osm_runway 5830 | OurAirports 5940 ft is 110 ft off the ground at the measured runway |
| ZA-0048 | Barkly West | 3800 | 3800 | OurAirports | OurAirports 3800, terrain_card 3629 | published (OurAirports); 171 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0055 | Barrange | 3300 | 3130 | terrain_osm_runway | OurAirports 3300, terrain_card 3127, terrain_osm_runway 3130 | OurAirports 3300 ft is 170 ft off the ground at the measured runway |
| ZA-0037 | Benics | 5100 | 4948 | terrain_osm_runway | OurAirports 5100, terrain_card 5026, terrain_ourairports_pos 4948, terrain_osm_runway 4948 | OurAirports 5100 ft is 152 ft off the ground at the measured runway |
| ZA-0039 | Blackie Swart | 3300 | 3300 | OurAirports | OurAirports 3300, terrain_card 3143, terrain_ourairports_pos 3153, terrain_osm_runway 3250 | published (OurAirports); 147 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0071 | Blyde Canyon | 4300 | 3993 | terrain_osm_runway | OurAirports 4300, terrain_card 3937, terrain_osm_runway 3993 | OurAirports 4300 ft is 307 ft off the ground at the measured runway |
| ZA-0087 | Botsalano | 4659 | 4659 | OurAirports | OurAirports 4659, terrain_card 4570, terrain_ourairports_pos 4672 | published (OurAirports) |
| ZA-0075 | Boulders Game Ranch 2 (Microlight) | 1500 | 1752 | terrain_osm_runway | OurAirports 1500, terrain_card 1611, terrain_ourairports_pos 1631, terrain_osm_runway 1752 | OurAirports 1500 ft is 252 ft off the ground at the measured runway |
| ZA-0019 | Braehead | 4300 | 4584 | terrain_osm_runway | OurAirports 4300, terrain_card 4557, terrain_ourairports_pos 4560, terrain_osm_runway 4584 | OurAirports 4300 ft is 284 ft off the ground at the measured runway |
| ZA-0011 | Brandfort Moreson | 4647 | 4478 | terrain_osm_runway | OurAirports 4647, terrain_card 4475, terrain_osm_runway 4478 | OurAirports 4647 ft is 169 ft off the ground at the measured runway |
| ZA-0093 | Britstown | 3500 | 3500 | OurAirports | OurAirports 3500, terrain_card 3724 | published (OurAirports); 224 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0006 | Brosterlea Farm | 5500 | 5879 | terrain_ourairports_pos | OurAirports 5500, terrain_card 5850, terrain_ourairports_pos 5879 | OurAirports 5500 ft is 379 ft off the ground at its own position and at the card |
| FACX | Cathcart | 3959 | 3959 | OurAirports | OurAirports 3959, terrain_card 3973, terrain_ourairports_pos 3862 | published (OurAirports) |
| FACE | Ceres | 1519 | 1923 | terrain_osm_runway | OurAirports 1519, terrain_card 1923, terrain_osm_runway 1923 | OurAirports 1519 ft is 404 ft off the ground at the measured runway |
| ZA-0061 | Clan | 2180 | 2464 | terrain_osm_runway | OurAirports 2180, terrain_card 2425, terrain_ourairports_pos 2467, terrain_osm_runway 2464 | OurAirports 2180 ft is 284 ft off the ground at the measured runway |
| ZA-0030 | Dasville | 5250 | 5250 | OurAirports | OurAirports 5250, terrain_card 5115 | published (OurAirports); 135 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0177 | Delta Golf Airstrip | 203 | 194 | terrain_osm_runway | terrain_card 203, terrain_ourairports_pos 190, terrain_osm_runway 194 | no published value; terrain at the measured runway |
| ZA-0052 | Dippiesfield | 4500 | 4500 | OurAirports | OurAirports 4500, terrain_card 4603, terrain_osm_runway 4593 | published (OurAirports); 103 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FADC | Douglas Cape | 3360 | 3366 | terrain_osm_runway | terrain_card 3360, terrain_osm_runway 3366 | no published value; terrain at the measured runway |
| FADZ | Drakensberg Gardens | 5948 | 5459 | terrain_osm_runway | OurAirports 5948, terrain_card 5568, terrain_ourairports_pos 5459, terrain_osm_runway 5459 | OurAirports 5948 ft is 489 ft off the ground at the measured runway |
| ZA-0187 | Dudley&#x27;s Field | 689 | 682 | terrain_osm_runway | terrain_card 689, terrain_osm_runway 682 | no published value; terrain at the measured runway |
| ZA-0223 | Eagle Flight Academy Airfield | 4070 | 4180 | terrain_osm_runway | OurAirports 4070, terrain_card 4183, terrain_osm_runway 4180 | OurAirports 4070 ft is 110 ft off the ground at the measured runway |
| FAEG | Egnep | 2299 | 2299 | OurAirports | OurAirports 2299, terrain_card 2438 | published (OurAirports); 139 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FAFG | Flamingo Vlei | 3248 | 3248 | OurAirports | OurAirports 3248, terrain_card 3094 | published (OurAirports); 154 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0112 | Fly Inn Estate | 5300 | 5197 | terrain_osm_runway | OurAirports 5300, terrain_card 5197, terrain_osm_runway 5197 | OurAirports 5300 ft is 103 ft off the ground at the measured runway |
| ZA-0036 | Forel | 6464 | 5141 | terrain_card | OurAirports 6464, terrain_card 5141 | OurAirports 6464 ft is 1323 ft off the ground at its own position and at the card |
| FAFO | Fort Beaufort | 1581 | 1745 | terrain_osm_runway | OurAirports 1581, terrain_card 1745, terrain_osm_runway 1745 | OurAirports 1581 ft is 164 ft off the ground at the measured runway |
| FAFU | Fraaiuitzicht | 4841 | 4416 | terrain_card | OurAirports 4841, terrain_card 4416 | OurAirports 4841 ft is 425 ft off the ground at its own position and at the card |
| FAGJ | Gifvlei | 3199 | 3199 | OurAirports | OurAirports 3199, terrain_card 2999 | published (OurAirports); 200 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0229 | Glendower Farm | 4300 | 4132 | terrain_osm_runway | OurAirports 4300, terrain_card 4124, terrain_osm_runway 4132 | OurAirports 4300 ft is 168 ft off the ground at the measured runway |
| FAHB | Hartebeespoortdam | 3740 | 3740 | OurAirports | OurAirports 3740, terrain_card 3980 | published (OurAirports); 240 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FAHH | Hibberdene | 89 | 89 | OurAirports | OurAirports 89, terrain_card 197 | published (OurAirports); 108 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0316 | Himeville Airfield | 5349 | 5102 | terrain_osm_runway | OurAirports 5349, terrain_card 5102, terrain_osm_runway 5102 | OurAirports 5349 ft is 247 ft off the ground at the measured runway |
| ZA-0353 | Hoedspruit Civil Airfield | 1768 | 1772 | terrain_osm_runway | terrain_card 1768, terrain_osm_runway 1772 | no published value; terrain at the measured runway |
| ZA-0099 | Holbank | 5545 | 5541 | terrain_osm_runway | terrain_card 5545, terrain_ourairports_pos 5548, terrain_osm_runway 5541 | no published value; terrain at the measured runway |
| FAID | Idutywa | 2530 | 2530 | OurAirports | OurAirports 2530, terrain_card 2648, terrain_ourairports_pos 2562 | published (OurAirports) |
| FAIV | Ingwavuma | 2100 | 2264 | terrain_osm_runway | OurAirports 2100, terrain_card 2270, terrain_osm_runway 2264 | OurAirports 2100 ft is 164 ft off the ground at the measured runway |
| FAIA | Itala | 2665 | 2665 | OurAirports | OurAirports 2665, terrain_card 2828 | published (OurAirports); 163 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0104 | Kagga Kamma | 3494 | 3330 | terrain_osm_runway | OurAirports 3494, terrain_card 3330, terrain_osm_runway 3330 | OurAirports 3494 ft is 164 ft off the ground at the measured runway |
| ZA-0163 | Kalahari Oryx | 2880 | 3501 | terrain_osm_runway | OurAirports 2880, terrain_card 3497, terrain_osm_runway 3501 | OurAirports 2880 ft is 621 ft off the ground at the measured runway |
| FAKF | Koffee Bay | 10 | 10 | OurAirports | OurAirports 10, terrain_card 289 | published (OurAirports); 279 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0003 | Koppies | 4524 | 4593 | terrain_osm_runway | terrain_card 4524, terrain_ourairports_pos 4600, terrain_osm_runway 4593 | no published value; terrain at the measured runway |
| ZA-0181 | Kwelega Road Airstrip | 262 | 256 | terrain_osm_runway | terrain_card 262, terrain_osm_runway 256 | no published value; terrain at the measured runway |
| ZA-0040 | Lavino | 2550 | 2550 | OurAirports | OurAirports 2550, terrain_card 2703 | published (OurAirports); 153 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0189 | Leppan Airfield | 787 | 774 | terrain_osm_runway | terrain_card 787, terrain_osm_runway 774 | no published value; terrain at the measured runway |
| FALF | Loeriesfontein | 2997 | 2808 | terrain_osm_runway | OurAirports 2997, terrain_card 2805, terrain_osm_runway 2808 | OurAirports 2997 ft is 189 ft off the ground at the measured runway |
| FAMQ | Maclear | 4106 | 4396 | terrain_osm_runway | OurAirports 4106, terrain_card 4383, terrain_osm_runway 4396 | OurAirports 4106 ft is 290 ft off the ground at the measured runway |
| FAMP | Madimbo | 2116 | 1309 | terrain_osm_runway | OurAirports 2116, terrain_card 1309, terrain_osm_runway 1309 | OurAirports 2116 ft is 807 ft off the ground at the measured runway |
| FAGW | Magwa | 1823 | 1713 | terrain_osm_runway | OurAirports 1823, terrain_card 1716, terrain_osm_runway 1713 | OurAirports 1823 ft is 110 ft off the ground at the measured runway |
| FAMY | Malmesbury | 971 | 463 | terrain_osm_runway | OurAirports 971, terrain_card 463, terrain_osm_runway 463 | OurAirports 971 ft is 508 ft off the ground at the measured runway |
| FAZP | Mazeppa Bay | 13 | 177 | terrain_osm_runway | OurAirports 13, terrain_card 177, terrain_osm_runway 177 | OurAirports 13 ft is 164 ft off the ground at the measured runway |
| FABA | Microland Flight Park | 5476 | 5266 | terrain_osm_runway | OurAirports 5476, terrain_card 5266, terrain_osm_runway 5266 | OurAirports 5476 ft is 210 ft off the ground at the measured runway |
| ZA-0096 | Mkambati | 560 | 361 | terrain_osm_runway | OurAirports 560, terrain_card 361, terrain_osm_runway 361 | OurAirports 560 ft is 199 ft off the ground at the measured runway |
| FACA | Monte Carlo | 4995 | 5253 | terrain_osm_runway | OurAirports 4995, terrain_card 5233, terrain_osm_runway 5253 | OurAirports 4995 ft is 258 ft off the ground at the measured runway |
| ZA-0183 | Mtwentwe Farm Airfield | 499 | 495 | terrain_osm_runway | terrain_card 499, terrain_osm_runway 495 | no published value; terrain at the measured runway |
| ZA-0032 | New Scotland | 5280 | 5280 | OurAirports | OurAirports 5280, terrain_card 5082 | published (OurAirports); 198 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FANG | Ngala | 3357 | 1450 | terrain_osm_runway | OurAirports 3357, terrain_card 1460, terrain_osm_runway 1450 | OurAirports 3357 ft is 1907 ft off the ground at the measured runway |
| ZA-0371 | Nzumba Lodge Airstrip | 1280 | 1286 | terrain_osm_runway | terrain_card 1280, terrain_osm_runway 1286 | no published value; terrain at the measured runway |
| FAOD | Odendaalsrus | 1340 | 4367 | terrain_card | OurAirports 1340, terrain_card 4367 | OurAirports 1340 ft is 3027 ft off the ground at its own position and at the card |
| ZA-0143 | Orania | 3642 | 3638 | terrain_osm_runway | terrain_card 3642, terrain_osm_runway 3638 | no published value; terrain at the measured runway |
| FAOL | Othawa | 1098 | 1098 | OurAirports | OurAirports 1098, terrain_card 1257 | published (OurAirports); 159 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0156 | Pafuri Camp Airstrip | 686 | 679 | terrain_osm_runway | terrain_card 686, terrain_osm_runway 679 | no published value; terrain at the measured runway |
| FAPV | Petrusville | 4116 | 3999 | terrain_osm_runway | OurAirports 4116, terrain_card 3993, terrain_osm_runway 3999 | OurAirports 4116 ft is 117 ft off the ground at the measured runway |
| FAPC | Prince Albert | 2001 | 1785 | terrain_osm_runway | OurAirports 2001, terrain_card 1873, terrain_ourairports_pos 1795, terrain_osm_runway 1785 | OurAirports 2001 ft is 216 ft off the ground at the measured runway |
| FARD | Riversdale | 591 | 694 | terrain_osm_runway | OurAirports 591, terrain_card 696, terrain_osm_runway 694 | OurAirports 591 ft is 103 ft off the ground at the measured runway |
| ZA-0370 | Sabie Airfield | 3638 | 3619 | terrain_osm_runway | terrain_card 3638, terrain_osm_runway 3619 | no published value; terrain at the measured runway |
| ZA-0238 | Sanbona Wildlife Reserve Airfield | 1716 | 1719 | terrain_osm_runway | terrain_card 1716, terrain_osm_runway 1719 | no published value; terrain at the measured runway |
| ZA-0056 | Scottburg | 196 | 1053 | terrain_card | OurAirports 196, terrain_card 1053 | OurAirports 196 ft is 857 ft off the ground at its own position and at the card |
| ZA-0176 | Scottburgh Airfield | 217 | 223 | terrain_osm_runway | terrain_card 217, terrain_osm_runway 223 | no published value; terrain at the measured runway |
| ZA-0154 | Shingwedzi Camp Airstrip | 886 | 889 | terrain_osm_runway | terrain_card 886, terrain_osm_runway 889 | no published value; terrain at the measured runway |
| FASM | Siteka | 4400 | 4585 | terrain_osm_runway | OurAirports 4400, terrain_card 4514, terrain_osm_runway 4585 | OurAirports 4400 ft is 185 ft off the ground at the measured runway |
| ZA-0186 | Stanley Island Airstrip | 3 | 0 | terrain_osm_runway | terrain_card 3, terrain_osm_runway 0 | no published value; terrain at the measured runway |
| FATM | Stutterheim | 2675 | 2980 | terrain_osm_runway | OurAirports 2675, terrain_card 2972, terrain_osm_runway 2980 | OurAirports 2675 ft is 305 ft off the ground at the measured runway |
| ZA-0024 | Sun Valley Airfield | 5000 | 5000 | OurAirports | OurAirports 5000, terrain_card 4777 | published (OurAirports); 223 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FASL | Sutherland | 5247 | 5089 | terrain_osm_runway | OurAirports 5247, terrain_card 5089, terrain_osm_runway 5089 | OurAirports 5247 ft is 158 ft off the ground at the measured runway |
| ZA-0080 | Swartwater Highway Strip | 2800 | 2694 | terrain_osm_runway | OurAirports 2800, terrain_card 2694, terrain_osm_runway 2694 | OurAirports 2800 ft is 106 ft off the ground at the measured runway |
| FAGA | The Grange | 2600 | 2600 | OurAirports | OurAirports 2600, terrain_card 2726 | published (OurAirports); 126 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| FATB | Thorny Bush Game Lodge | 1900 | 1585 | terrain_osm_runway | OurAirports 1900, terrain_card 1585, terrain_osm_runway 1585 | OurAirports 1900 ft is 315 ft off the ground at the measured runway |
| ZA-0248 | Tutwa Airfield | 2188 | 2178 | terrain_osm_runway | terrain_card 2188, terrain_ourairports_pos 2178, terrain_osm_runway 2178 | no published value; terrain at the measured runway |
| ZA-0150 | Van Zylsrus | 3041 | 3038 | terrain_osm_runway | terrain_card 3041, terrain_osm_runway 3038 | no published value; terrain at the measured runway |
| ZA-0034 | Vanggatfontein | 5100 | 5100 | OurAirports | OurAirports 5100, terrain_card 5220 | published (OurAirports); 120 ft from terrain, kept (no measured runway, 100-300 ft or positions differ) |
| ZA-0149 | Vosburg | 3730 | 3727 | terrain_osm_runway | terrain_card 3730, terrain_osm_runway 3727 | no published value; terrain at the measured runway |
| ZA-0232 | Welgevonden Western Airstrip | 4400 | 4524 | terrain_osm_runway | OurAirports 4400, terrain_card 4531, terrain_osm_runway 4524 | OurAirports 4400 ft is 124 ft off the ground at the measured runway |
| ZA-0182 | Wings Park Airfield | 1260 | 1240 | terrain_osm_runway | terrain_card 1260, terrain_osm_runway 1240 | no published value; terrain at the measured runway |
| FAWT | Winterveldt Mine | 3000 | 2894 | terrain_osm_runway | OurAirports 3000, terrain_card 2894, terrain_osm_runway 2894 | OurAirports 3000 ft is 106 ft off the ground at the measured runway |
| ZA-0354 | Zandspruit Airstrip | 1614 | 1617 | terrain_osm_runway | terrain_card 1614, terrain_osm_runway 1617 | no published value; terrain at the measured runway |

## Code / position mismatches (the 25 from v1, plus new position flags)

| Card | Name | Evidence | Action |
|---|---|---|---|
| FAKG | Komati Power Station | Card is Komati Power Station (OurAirports FAKG at the card). The SACAA AIP AD 2-FAKG pages are **KWANDWE** (33°08'S 26°35'E, 830 km away) and OurAirports has Kwande ZA-0240 there. Before v2 the engine gave this card Kwandwe's runway 11/29 (from wst-data.js). | Not changed (needs MT). v2 no longer uses the Kwandwe AIP runway/elevation for this card. Proposed: keep the card as Komati Power Station and ask MT whether a Kwandwe (FAKG, AIP) card should exist; the FAKG aerodrome page and AIP links belong to Kwandwe. |
| ZA-0075 | Boulders Game Ranch 2 (Microlight) | ourairports_m 197 m, osm_runway_m 2992 m | Listed; not changed. |
| FABV | Brandviei Airfield | Card matches OurAirports FABV Brandviei at 0 m; ZA-0376 Butterworth (756 km) only shares the code in another column. | None: card correct, the other OurAirports record only shares the code. |
| FADG | Dordrecht | OurAirports FADG Dordrecht (closed) 2.2 km away; no OSM runway at either position. | Not changed (no runway evidence). |
| FAEG | Egnep | Card matches OurAirports FAEG Egnep at 0 m; ZA-0375 Elgin (1 525 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| FAER | Ellisras Matimba | Card matches OurAirports FAER Ellisras Matimba at 0 m, OSM 15/33 at 77 m; ZA-0374 Ekland Ranch (243 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| FAHD | Humansdorp | Card matches OurAirports FAHD Humansdorp at 0 m; ZA-0038 Hippo Pools (1 240 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| FAIW | Indwe | Card matches OurAirports FAIW Indwe at 253 m; ZA-0350 Ingwelala (906 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| FAJV | Jansenville | OurAirports FAJV Jansenville 2.7 km away; no OSM runway at either position. | Not changed (no runway evidence). |
| FAKW | Kareedouw | OurAirports FAKW Kareedouw (closed) 2.1 km away; no OSM runway at either position. | Not changed (no runway evidence). |
| FAMF | Malabar | Card matches OurAirports FAMF Malabar at 0 m; FAMQ Maclear (492 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| FAMY | Malmesbury | Card matches OurAirports FAMY Malmesbury at 0 m, OSM 16/34 at 26 m; FAZP Mazeppa Bay (934 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| ZA-0033 | Mooivlei | OurAirports ZA-0033 Mooivlei 3.7 km away; no OSM runway at either position. | Not changed (no runway evidence). |
| FANV | Nieuwoudtville Airfield | OurAirports FANV Nieuwoudtville (3.1 km NE) has OSM runway 08/26; the card position also has an unlabelled OSM runway way (31 m). Two strips, not clear which one the card means. | Not changed (not clear). Proposed: check imagery / the operator. |
| FAGA | The Grange | Card matches OurAirports FAGA The Grange at 0 m; FAHV Big Water (427 km) only shares the code. | None: card correct, the other OurAirports record only shares the code. |
| ZA-0298 | Umbabat Aero Camp Airfield | ourairports_m 0 m, osm_runway_m 2117 m | Listed; not changed. |
| ZA-0017 | Alberta | OSM way 222485266 (08/26) 0.7 km from the OurAirports position; no runway within 2 km of the card | **Corrected** card position [-27.984167098999023, 28.39444351196289] → [-28.010845, 28.322514] |
| ZA-0093 | Britstown | OSM ways 31870657 (02/20) and 125270827 (15/33) about 0.2 km from the OurAirports position; card coordinates are rounded (30.5833 S 23.5167 E); no runway within 2 km of the card | **Corrected** card position [-30.58333396911621, 23.516666412353516] → [-30.60212, 23.502614] |
| FACH | Cookhouse | OSM runway way 1511295459 34 m from the OurAirports position; no runway within 2 km of the card (OurAirports lists it closed) | **Corrected** card position [-32.74470138549805, 25.796300888061523] → [-32.789329, 25.817592] |
| FADP | Darlington Dam Lodge | OSM way 202286836 (05/23) 3 m from the OurAirports position; card 11.3 km away with no runway within 2 km | **Corrected** card position [-33.18320083618164, 25.193199157714844] → [-33.096683, 25.256839] |
| FAED | Edenburg | OSM ways 220845509 (04/22), 220845512 (09/27), 220845513 (16/34) 0.16-0.26 km from the OurAirports position; card coordinates rounded (29.75 S 25.90 E) | **Corrected** card position [-29.75, 25.899999618530273] → [-29.74625, 25.920452] |
| FAGJ | Gifvlei | OSM ways 221103922/3/5 and 1229724246 0.25-0.40 km from the OurAirports position; no runway within 2 km of the card | **Corrected** card position [-30.38330078125, 20.033300399780273] → [-30.368249, 20.016341] |
| FAIA | Itala | OSM way 95066272 (07/25) 43 m from the OurAirports position; card 13.7 km away with no runway within 2 km | **Corrected** card position [-27.4867000579834, 31.171100616455078] → [-27.531834, 31.299856] |
| FAOL | Othawa | OSM way 221579621 (02/20) 28 m from the OurAirports position; card coordinates rounded (24.733 S 31.400 E) | **Corrected** card position [-24.732999801635742, 31.399999618530273] → [-24.758414, 31.405406] |
| FARZ | Reitz | card latitude -22.784201 is 5 degrees off: OurAirports FARZ Reitz is at -27.784303, 28.430192 (same longitude), OSM way 125314774 (11/29) 0.17 km from it; Reitz is in the Free State, the old point is in Limpopo | **Corrected** card position [-22.784201, 28.4303] → [-27.784303, 28.430192] and province Limpopo → Free State |
| ZA-0046 | Schmidtsdrif | OSM way 124890244 (03/21) 30 m from the OurAirports position; card coordinates rounded (28.6667 S 24.0333 E) | **Corrected** card position [-28.66666603088379, 24.03333282470703] → [-28.691594, 24.043819] |
| ZA-0028 | Wakkerstroom | OSM ways 191212164 (05/23) and 191212165 (11/29) 0.1-0.2 km from the OurAirports position; card coordinates rounded (27.35 S 30.1667 E) | **Corrected** card position [-27.350000381469727, 30.166667938232422] → [-27.333669, 30.148343] |

## Cards OurAirports marks CLOSED (none deleted or hidden)

| Card | Name | OurAirports record | Runway seen in OSM? | Has heading in v2 | Proposed action |
|---|---|---|---|---|---|
| ZA-0082 | Alldays Safaris | ZA-0082 "Alldays Safaris Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0058 | Alverstone Airfield | ZA-0058 "Alverstone Airfield" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0062 | Amatikulu (Microlight) | ZA-0062 "Amatikulu (Microlight) Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0020 | Anton Fourie Farm | ZA-0020 "Anton Fourie Farm Airport" (596 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0010 | Arbeitsgenot | ZA-0010 "Arbeitsgenot Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0108 | Bethal | ZA-0108 "Bethal Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FABT | Bethesda Road | FABT "Bethesda Road Airport" (554 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0068 | Bonwa Phala | ZA-0068 "Bonwa Phala Airport" (227 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0087 | Botsalano | ZA-0087 "Botsalano Airport" (1103 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0075 | Boulders Game Ranch 2 (Microlight) | ZA-0075 "Boulders Game Ranch 2 (Microlight) Airport" (197 m from card) | way 347636307 ref 07/25 (1264 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
| ZA-0006 | Brosterlea Farm | ZA-0006 "Brosterlea Farm Airport" (670 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FACX | Cathcart | FACX "Cathcart Airport" (1694 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0195 | Contermanskloof Airstrip | ZA-0195 "Contermanskloof Airstrip" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FACH | Cookhouse | FACH "Cookhouse Airport" (0 m from card) | way 1511295459 (1081 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
| ZA-0030 | Dasville | ZA-0030 "Dasville Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FADV | Devon | FADV "Devon Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0341 | Dunnottar Airfield | ZA-0341 "Dunnottar Airfield" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAEG | Egnep | FAEG "Egnep Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0153 | Elandspad Airfield | ZA-0153 "Elandspad Airfield" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0031 | Evander Landing Strip | ZA-0031 "Evander Landing Strip Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAFG | Flamingo Vlei | FAFG "Flamingo Vlei Airport" (85 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0036 | Forel | ZA-0036 "Forel Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAFU | Fraaiuitzicht | FAFU "Fraaiuitzicht Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAGH | Glen Grey | FAGH "Glen Grey Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAHK | Haakdoornboom | FAHK "Haakdoornboom Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAHB | Hartebeespoortdam | FAHB "Hartebeespoortdam Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAHH | Hibberdene | FAHH "Hibberdene Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAHD | Humansdorp | FAHD "Humansdorp Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAID | Idutywa | FAID "Idutywa Airport" (1054 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAOF | Jack Duvenhage | FAOF "Jack Duvenhage Airport" (1812 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAJF | Jagersfontain | FAJF "Jagersfontain Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAKF | Koffee Bay | FAKF "Koffee Bay Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FADM | Kokstad | FADM "Kokstad Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAKO | Komga | FAKO "Komga Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0147 | Lady Grey Golf Course Airstrip | ZA-0147 "Lady Grey Golf Course Airstrip" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0040 | Lavino | ZA-0040 "Lavino Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAMF | Malabar | FAMF "Malabar Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAML | Manyani Game Lodge | FAML "Manyani Game Lodge Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAMZ | Msauli | FAMZ "Msauli Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FANH | New Hanover | FANH "New Hanover Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FANL | New Largo | FANL "New Largo Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0032 | New Scotland | ZA-0032 "New Scotland Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FANA | Nongoma | FANA "Nongoma Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAOD | Odendaalsrus | FAOD "Odendaalsrus Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0116 | Pumba Airstrip | ZA-0116 "Pumba Airstrip" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0064 | Riverview | ZA-0064 "Riverview Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0056 | Scottburg | ZA-0056 "Scottburg Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAWW | Sodwana Airstrip | ZA-0166 "Sodwana Airstrip" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0065 | St Lucia Estuary | ZA-0065 "St Lucia Estuary" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0024 | Sun Valley Airfield | ZA-0024 "Sun Valley Airfield" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAGA | The Grange | FAGA "The Grange Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0298 | Umbabat Aero Camp Airfield | ZA-0298 "Umbabat Aero Camp Airfield" (0 m from card) | way 222858589 (996 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
| FAUB | Underberg | FAUB "Underberg Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAVP | Vanderbijlpark | FAVP "Vanderbijlpark Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0034 | Vanggatfontein | ZA-0034 "Vanggatfontein Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0023 | Villiers | ZA-0023 "Villiers Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAVI | Von Abo&#x27;s Villa | FAVI "Von Abo's Villa Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0276 | Witfontein | ZA-0276 "Witfontein Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |

58 closed-in-OurAirports cards; 3 still have a runway in OSM.


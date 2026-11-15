# Hand check: 30 random aerodromes, heading + elevation recomputed from the raw sources (15 Nov 2026)

Seed 1511. Heading = first runway end with a heading, recomputed independently from its raw source: OSM way geometry (first node to last node, geofabrik-runways.json), OurAirports runways.csv, or for AIP the other sources listed for that end. 'designator' = |magnetic heading (true - WMM2025 declination) - designator x 10|. Elevation = v2 value vs OurAirports airports.csv, Copernicus terrain at the card (Open-Meteo) and the AIP PDF (AD 2.2 item 3).

| # | ID | end | v2 true hdg | heading source | recomputed | Δ° | designator Δ° | v2 elev ft | elev source | OurAirports ft | terrain ft | AIP PDF ft | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ZA-0254 | 01 | 346.2 | OSM way 1036423883 | 346.2 | 0.0 | 3.9 | 141 | OurAirports | 141 | 138 | — | ok |
| 2 | FAOL | 02 | 0.3 | OSM way 221579621 | 0.3 | 0.0 | 0.1 | 1098 | OurAirports | 1098 | 1257 | — | ok |
| 3 | ZA-0326 | 21 | 182.0 | OSM way 1084649877 | 182.0 | 0.0 | 3.9 | 3800 | OurAirports | 3800 | 3783 | — | ok |
| 4 | ZA-0113 | 08 | 56.0 | OurAirports runways.csv | 56.0 | 0.0 | 2.1 | 4955 | OurAirports | 4955 | 4954 | — | ok |
| 5 | FAWO | 12 | 90.0 | OSM way 5837372 | 90.0 | 0.0 | 1.2 | 2608 | OurAirports | 2608 | 2602 | — | ok |
| 6 | ZA-0261 | 18 | 160.4 | OSM way 126871047 | 160.4 | 0.0 | 2.1 | 2224 | OurAirports | 2224 | 2188 | — | ok |
| 7 | FAHS | 09 | 78.0 | AIP (vs AIP thresholds) | 76.9 | 1.1 | 7.1 | 1801 | OurAirports | 1801 | 1716 | — | ok |
| 8 | ZA-0188 | 14 | 114.6 | OSM way 389533685 | 114.6 | 0.0 | 4.1 | 659 | terrain | — | 659 | — | ok |
| 9 | FAWN | 05 | 25.2 | AIP (vs AIP thresholds) | 24.6 | 0.6 | 2.0 | 399 | AIP PDF | 399 | 400 | 399 | ok |
| 10 | FABA | 03 | 12.4 | OSM way 5948255 | 12.4 | 0.0 | 3.0 | 5266 | terrain | 5476 | 5266 | — | ok |
| 11 | FAPE | 08 | 58.0 | AIP (vs AIP thresholds) | 58.0 | 0.0 | 8.7 | 229 | AIP PDF | 226 | 190 | 229 | ok |
| 12 | FAVW | 08 | 58.5 | OSM way 6767699 | 58.5 | 0.0 | 4.9 | 4124 | OurAirports | 4124 | 4114 | — | ok |
| 13 | FAHC | 16 | 141.1 | OSM way 108880843 | 141.1 | 0.0 | 8.1 | 3619 | OurAirports | 3619 | 3599 | — | ok |
| 14 | ZA-0238 | 17 | 145.2 | OSM way 222165686 | 145.2 | 0.0 | 3.0 | 1719 | terrain | — | 1716 | — | ok |
| 15 | FAIS | 14 | 123.4 | OSM way 132968850 | 123.4 | 0.0 | 10.2 | 313 | OurAirports | 313 | 325 | — | ok |
| 16 | ZA-0306 | 06 | 26.0 | OSM way 1087341791 | 26.0 | 0.0 | 5.0 | 61 | OurAirports | 61 | 59 | — | ok |
| 17 | ZA-0223 | 17 | 153.9 | OSM way 184794950 | 153.9 | 0.0 | 6.0 | 4180 | terrain | 4070 | 4183 | — | ok |
| 18 | FADY | 12 | 97.2 | OSM way 71365319 | 97.2 | 0.0 | 2.9 | 4037 | OurAirports | 4037 | 4012 | — | ok |
| 19 | ZA-0093 | 02 | 354.7 | OSM way 31870657 | 354.7 | 0.0 | 0.2 | 3500 | OurAirports | 3500 | 3724 | — | ok |
| 20 | FAKH | 10 | 77.6 | OSM way 128807162 | 77.6 | 0.0 | 0.4 | 2723 | OurAirports | 2723 | 2730 | — | ok |
| 21 | FAMC | 11 | 85.6 | OSM way 5915629 | 85.6 | 0.0 | 3.0 | 4022 | OurAirports | 4022 | 4006 | — | ok |
| 22 | ZA-0026 | 09 | 70.8 | OSM way 129553005 | 70.8 | 0.0 | 0.9 | 4150 | OurAirports | 4150 | 4150 | — | ok |
| 23 | ZA-0296 | 14 | 141.0 | OSM way 33709127 | 141.0 | 0.0 | 19.5 | 2933 | OurAirports | 2933 | 2913 | — | ok |
| 24 | FAMB | 02 | 359.0 | OurAirports runways.csv | 359.0 | 0.0 | 0.4 | 4886 | OurAirports | 4886 | 4862 | — | ok |
| 25 | FATI | 07 | 51.5 | OSM way 151162515 | 51.5 | 0.0 | 0.5 | 3225 | OurAirports | 3225 | 3212 | — | ok |
| 26 | FACG | 14 | 110.9 | OSM way 200184342 | 110.9 | 0.0 | 1.4 | 936 | OurAirports | 936 | 925 | — | ok |
| 27 | FACR | 13 | 109.9 | OSM way 165166735 | 109.9 | 0.0 | 0.7 | 5000 | OurAirports | 5000 | 4974 | — | ok |
| 28 | FAVU | 10 | 93.4 | OSM way 165804392 | 93.4 | 0.0 | 16.9 | 5610 | OurAirports | 5610 | 5604 | — | ok |
| 29 | ZA-0361 | 17 | 150.0 | OSM way 1577622681 | 150.0 | 0.0 | 4.9 | 259 | OurAirports | 259 | 243 | — | ok |
| 30 | ZA-0078 | 10 | 88.2 | OSM way 102655828 | 88.2 | 0.0 | 4.6 | 3203 | OurAirports | 3203 | 3205 | — | ok |

**30/30** match their raw sources (heading within 1° of the recomputed OSM/OurAirports value, AIP within 3° of the other sources; elevation equal to the chosen source, terrain within 150 ft of the card-point terrain because v2 samples terrain at the runway).

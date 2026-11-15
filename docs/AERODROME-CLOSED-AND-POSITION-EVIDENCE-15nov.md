# Closed and wrong-position aerodrome cards: evidence (15 Nov 2026)

Branch fix/engine-gaps-15nov. No card was removed or hidden. Built from the rwdb v2 verification (tools/rwdb/verify_v2.py, docs/RWDB-V2-VERIFICATION-15nov.md).

Sources:
- OurAirports airports.csv / runways.csv, https://davidmegginson.github.io/ourairports-data/ (retrieved 15 Nov 2026 11:26 UTC = 13:26 SAST; raw copy tools/rwdb/raw/airports.csv, runways.csv).
- OpenStreetMap runway ways (aeroway=runway), Geofabrik South Africa extract of 14 Nov 2026 (tools/rwdb/raw/osm-geof/geofabrik-runways.json); every "way N" below links to openstreetmap.org/way/N.
- SACAA AIP AD 2 PDFs on the site (site/aip/<icao>/ad2-<icao>.pdf) for FAKG.
- Position corrections applied: tools/rwdb/raw-v2/card-position-fixes.json (old / new / evidence), commit cb624d814 (site/wst/wst-cards-data.js only).

Counts: 27 code/position rows (11 corrected, the rest listed), 58 cards OurAirports marks closed.

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
| ZA-0017 | Alberta | OSM [way 222485266](https://www.openstreetmap.org/way/222485266) (08/26) 0.7 km from the OurAirports position; no runway within 2 km of the card | **Corrected** card position [-27.984167098999023, 28.39444351196289] → [-28.010845, 28.322514] |
| ZA-0093 | Britstown | OSM ways 31870657 (02/20) and 125270827 (15/33) about 0.2 km from the OurAirports position; card coordinates are rounded (30.5833 S 23.5167 E); no runway within 2 km of the card | **Corrected** card position [-30.58333396911621, 23.516666412353516] → [-30.60212, 23.502614] |
| FACH | Cookhouse | OSM runway [way 1511295459](https://www.openstreetmap.org/way/1511295459) 34 m from the OurAirports position; no runway within 2 km of the card (OurAirports lists it closed) | **Corrected** card position [-32.74470138549805, 25.796300888061523] → [-32.789329, 25.817592] |
| FADP | Darlington Dam Lodge | OSM [way 202286836](https://www.openstreetmap.org/way/202286836) (05/23) 3 m from the OurAirports position; card 11.3 km away with no runway within 2 km | **Corrected** card position [-33.18320083618164, 25.193199157714844] → [-33.096683, 25.256839] |
| FAED | Edenburg | OSM ways 220845509 (04/22), 220845512 (09/27), 220845513 (16/34) 0.16-0.26 km from the OurAirports position; card coordinates rounded (29.75 S 25.90 E) | **Corrected** card position [-29.75, 25.899999618530273] → [-29.74625, 25.920452] |
| FAGJ | Gifvlei | OSM ways 221103922/3/5 and 1229724246 0.25-0.40 km from the OurAirports position; no runway within 2 km of the card | **Corrected** card position [-30.38330078125, 20.033300399780273] → [-30.368249, 20.016341] |
| FAIA | Itala | OSM [way 95066272](https://www.openstreetmap.org/way/95066272) (07/25) 43 m from the OurAirports position; card 13.7 km away with no runway within 2 km | **Corrected** card position [-27.4867000579834, 31.171100616455078] → [-27.531834, 31.299856] |
| FAOL | Othawa | OSM [way 221579621](https://www.openstreetmap.org/way/221579621) (02/20) 28 m from the OurAirports position; card coordinates rounded (24.733 S 31.400 E) | **Corrected** card position [-24.732999801635742, 31.399999618530273] → [-24.758414, 31.405406] |
| FARZ | Reitz | card latitude -22.784201 is 5 degrees off: OurAirports FARZ Reitz is at -27.784303, 28.430192 (same longitude), OSM [way 125314774](https://www.openstreetmap.org/way/125314774) (11/29) 0.17 km from it; Reitz is in the Free State, the old point is in Limpopo | **Corrected** card position [-22.784201, 28.4303] → [-27.784303, 28.430192] and province Limpopo → Free State |
| ZA-0046 | Schmidtsdrif | OSM [way 124890244](https://www.openstreetmap.org/way/124890244) (03/21) 30 m from the OurAirports position; card coordinates rounded (28.6667 S 24.0333 E) | **Corrected** card position [-28.66666603088379, 24.03333282470703] → [-28.691594, 24.043819] |
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
| ZA-0075 | Boulders Game Ranch 2 (Microlight) | ZA-0075 "Boulders Game Ranch 2 (Microlight) Airport" (197 m from card) | [way 347636307](https://www.openstreetmap.org/way/347636307) ref 07/25 (1264 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
| ZA-0006 | Brosterlea Farm | ZA-0006 "Brosterlea Farm Airport" (670 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FACX | Cathcart | FACX "Cathcart Airport" (1694 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0195 | Contermanskloof Airstrip | ZA-0195 "Contermanskloof Airstrip" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FACH | Cookhouse | FACH "Cookhouse Airport" (0 m from card) | [way 1511295459](https://www.openstreetmap.org/way/1511295459) (1081 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
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
| ZA-0298 | Umbabat Aero Camp Airfield | ZA-0298 "Umbabat Aero Camp Airfield" (0 m from card) | [way 222858589](https://www.openstreetmap.org/way/222858589) (996 m) | yes | Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch. |
| FAUB | Underberg | FAUB "Underberg Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAVP | Vanderbijlpark | FAVP "Vanderbijlpark Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0034 | Vanggatfontein | ZA-0034 "Vanggatfontein Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0023 | Villiers | ZA-0023 "Villiers Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| FAVI | Von Abo&#x27;s Villa | FAVI "Von Abo's Villa Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |
| ZA-0276 | Witfontein | ZA-0276 "Witfontein Airport" (0 m from card) | no | no | Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner. |

58 closed-in-OurAirports cards; 3 still have a runway in OSM.



# METAR / TAF issue schedule per station, and a fetch plan tuned to it (15 Nov 2026)

Report only. No code or config changed. All times SAST (UTC+2) unless marked Z.

## Data used
- aviationweather.gov (AWC) Data API, pulled 15 Nov 2026 ~13:30 SAST:
  - `metar?ids=<one station>&hours=168&format=json`: every METAR/SPECI from 8 Nov 14:00 to 15 Nov 13:30 SAST (7 days), with AWC `receiptTime`.
  - `taf?ids=...&date=<every hour back 7 days>&time=issue|valid`: every distinct TAF seen in the 7 days (664 TAFs), with `issueTime` and AWC `dbPopTime`.
- Our Cloudflare KV `go-around-wx` only keeps the newest copy (`wx/snapshot`, `wx/now`, `wx/work`, `ops/probes`), no history, so the AWC history is the only record. KV metadata today: METAR fetched 13:30:53, TAF 13:20:53 SAST.
- Our fetcher (netlify/lib/wx_snapshot.mjs, run by cloudflare/worker cron `*/10 * * * *`): one bbox call `bbox=-35.5,16,-22,33.5`, METAR due every 20 min, TAF every 40 min. Pages re-read every 5 min.

"On AWC after obs time" = AWC `receiptTime` minus the report's own time. That is the earliest moment anybody can fetch it from AWC.
Stations FBSK, FDMS, FQMA, FXMM, FYKT, FYOG, FYWH are not on our cards but fall inside the bbox.
FALM has a TAF but no METAR. FAEO, FAGM, FASB only send occasional reports.

Raw replies and the scripts are in `docs/wx-history-15nov/` (`m-<ICAO>.json`, `taf-hist.json`, `wxan.py`, `tafan.py`).

## METAR schedule (7 days, 8 to 15 Nov 2026)
| Station | On cards | Routine reports | Hours (SAST) | AUTO share | SPECIs in 7 d | Hours with a report / hours | On AWC after obs time: median / p90 (min) | Expect on AWC (SAST minute) |
|---|---|---|---|---|---|---|---|---|
| FABL | yes | hourly at :00 | 05:00–20:00 | 0% | 0 | 107/167 | 8.3 / 10.1 | xx:08–:11 |
| FACT | yes | hourly at :00 | 24 h | 0% | 23 | 166/168 | 5.3 / 5.8 | xx:05–:06 |
| FAEL | yes | hourly at :00 | 05:00–20:00 | 0% | 52 | 111/168 | 5.3 / 12.1 | xx:05–:13 |
| FAEO | yes | SPECI only (no routine) | irregular (a few a week) | 0% | 12 | 15/159 | 15.8 / 48.7 | — |
| FAGG | yes | hourly at :00 | 24 h | 23% | 47 | 163/168 | 5.3 / 6.6 | xx:05–:07 |
| FAGM | yes | hourly at :00, few days | irregular (a few a week) | 0% | 0 | 6/122 | 5.2 / 5.3 | xx:05–:06 |
| FAHS | yes | hourly at :00 | 24 h | 100% | 0 | 150/168 | 5.3 / 5.4 | xx:05–:06 |
| FAKM | yes | hourly at :00 | 24 h | 30% | 14 | 160/168 | 5.3 / 10.9 | xx:05–:11 |
| FAKN | yes | hourly at :00 | 24 h | 49% | 22 | 156/168 | 6.2 / 8.6 | xx:06–:09 |
| FALA | yes | hourly at :00 | 24 h | 28% | 33 | 168/168 | 5.4 / 8.4 | xx:05–:09 |
| FALE | yes | hourly at :00 | 24 h | 0% | 50 | 168/168 | 5.3 / 6.6 | xx:05–:07 |
| FALW | yes | hourly at :00 | 24 h | 100% | 0 | 149/167 | 12.1 / 20.3 | xx:12–:21 |
| FAMM | yes | hourly at :00 | 24 h | 35% | 9 | 155/168 | 5.4 / 8.5 | xx:05–:09 |
| FAOR | yes | every 30 min, :00 and :30 | 24 h | 0% | 0 | 164/168 | 0.3 / 3.2 | xx:00–:03 and xx:30–:33 |
| FAPE | yes | hourly at :00 | 24 h | 0% | 51 | 164/168 | 5.3 / 10.2 | xx:05–:11 |
| FAPN | yes | hourly at :00 | 24 h | 100% | 0 | 147/168 | 18.3 / 19.3 | xx:18–:20 |
| FAPP | yes | hourly at :00 | 24 h | 38% | 4 | 158/168 | 5.5 / 8.5 | xx:05–:09 |
| FASB | yes | SPECI only (no routine) | irregular (a few a week) | 21% | 14 | 14/144 | 13.5 / 21.8 | — |
| FAUP | yes | hourly at :00 | 24 h | 18% | 16 | 156/168 | 5.3 / 12.1 | xx:05–:13 |
| FAUT | yes | hourly at :00 | 05:00–20:00 | 61% | 0 | 109/167 | 5.3 / 5.5 | xx:05–:06 |
| FAVV | yes | hourly at :00 | 24 h | 100% | 0 | 151/168 | 6.2 / 6.2 | xx:06–:07 |
| FAWB | yes | hourly at :00 | 24 h | 98% | 0 | 146/168 | 15.1 / 15.5 | xx:15–:16 |
| FAWK | yes | hourly at :00 | 24 h | 100% | 0 | 149/168 | 16.1 / 16.2 | xx:16–:17 |
| FBSK | no (neighbour, in bbox) | hourly at :00 | 24 h | 0% | 0 | 144/168 | 7.6 / 9.5 | xx:07–:10 |
| FDMS | no (neighbour, in bbox) | hourly at :00 | 08:00–17:00 | 0% | 0 | 67/168 | 4.3 / 17.4 | xx:04–:18 |
| FQMA | no (neighbour, in bbox) | hourly at :00 | 24 h | 0% | 0 | 164/168 | 2.3 / 15.3 | xx:02–:16 |
| FXMM | no (neighbour, in bbox) | hourly at :00 | irregular (a few a week) | 0% | 0 | 30/148 | 5.4 / 6.0 | xx:05–:07 |
| FYKT | no (neighbour, in bbox) | hourly at :00 | 24 h | 71% | 0 | 127/167 | 15.2 / 16.5 | xx:15–:17 |
| FYOG | no (neighbour, in bbox) | hourly at :00 | 24 h | 100% | 0 | 147/167 | 8.4 / 8.6 | xx:08–:09 |
| FYWH | no (neighbour, in bbox) | hourly at :00 | 03:00–21:00 | 20% | 0 | 120/168 | 12.9 / 26.3 | xx:12–:27 |

What this shows:
- **Routine METARs are at :00 every hour**, plus **FAOR at :00 and :30**. No SA station sends half-hourly except FAOR.
- **Most stations reach AWC at xx:05 to xx:06** (about 5 minutes 20 seconds after the hour). FAOR is near-instant (0 to 3 min).
- **Late stations:** FALW about xx:12, FAWB xx:15, FAWK xx:16, FAPN xx:18 (all AUTO). FABL about xx:08.
- **Daytime-only stations:** FABL, FAEL and FAUT send routine METARs from about 05:00 to 20:00 SAST only. At night those cards correctly fall back.
- **Missed hours happen:** e.g. FACT 2 of 168 hours missing (one was 15 Nov 12:00 SAST), FAPN 21, FAWB 22, FAHS 18.
- SPECIs (unscheduled) come at any minute. FAEL, FAPE, FALE and FAGG send the most (47 to 52 a week).

## TAF schedule (7 days)
| Station | Kind | Routine issue times UTC (SAST) | Validity starts UTC (SAST) | Length | AMD in 7 d | On AWC after issue: median / max (min) |
|---|---|---|---|---|---|---|
| FABL | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 5 | 6.1 / 562.2 |
| FACT | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 30 h | 2 | 13.3 / 498.2 |
| FAEL | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 2 | 30.3 / 33.5 |
| FAGG | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 6 | 10.6 / 59.5 |
| FAHS | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 0 | 30.3 / 33.5 |
| FAKM | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 0 | 30.3 / 60.3 |
| FAKN | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 3 | 30.2 / 33.5 |
| FALA | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 5 | 12.4 / 196.3 |
| FALE | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 30 h | 6 | 13.2 / 562.2 |
| FALM | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 0 | 30.3 / 33.5 |
| FAOR | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 30 h | 8 | 13.3 / 91.5 |
| FAPE | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 2 | 30.2 / 222.4 |
| FAPP | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 3 | 30.2 / 33.5 |
| FAUP | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 2 | 9.1 / 30.3 |
| FAUT | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 2 | 30.3 / 33.5 |
| FAWB | short daytime (8–11 h) | 0300Z (05:00), 0600Z (08:00), 0900Z (11:00) | 04Z (06), 07Z (09), 10Z (12) | 11 h | 2 | 30.3 / 33.5 |
| FBSK | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 30 h | 1 | 2.6 / 62.3 |
| FDMS | short (6–9 h) | 0700Z (09:00), 1000Z (12:00) | 09Z (11), 12Z (14) | 9 h | 0 | 4.3 / 46.5 |
| FQMA | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 30 h | 0 | 15.4 / 107.9 |
| FXMM | long (24–30 h) | 0400Z (06:00) | 06Z (08) | 24 h | 0 | 26.2 / 196.2 |
| FYKT | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 0 | -0.6 / 18.5 |
| FYOG | 3-hourly, 9 h | 0800Z (10:00), 1100Z (13:00), 1400Z (16:00), 1700Z (19:00), 2000Z (22:00), 2300Z (01:00) | 09Z (11), 12Z (14), 15Z (17), 18Z (20), 21Z (23) | 9 h | 1 | 4.2 / 76.5 |
| FYWH | long (24–30 h) | 0400Z (06:00), 1000Z (12:00), 1600Z (18:00), 2200Z (00:00) | 00Z (02), 06Z (08), 12Z (14), 18Z (20) | 24 h | 0 | -0.6 / 18.5 |

What this shows:
- **Two families of SA TAFs:**
  1. **Long TAFs (24 or 30 h)**: FABL, FACT, FAGG, FALA, FALE, FAOR, FAPE, FAUP. Issued **04Z, 10Z, 16Z, 22Z = 06:00, 12:00, 18:00, 00:00 SAST**, valid from **2 hours later** (08:00, 14:00, 20:00, 02:00 SAST).
  2. **Short daytime TAFs (8 to 11 h)**: FAEL, FAHS, FAKM, FAKN, FALM, FAPP, FAUT, FAWB. Issued **03Z, 06Z, 09Z = 05:00, 08:00, 11:00 SAST**, valid from **1 hour later** (06:00, 09:00, 12:00 SAST). The last one runs out about 21:00 SAST, so **there is no TAF at these 8 stations from about 21:00 to 06:00 SAST**. "No TAF" at night there is real, not a bug.
- **When TAFs reach AWC:** long TAFs about 6 to 13 minutes after the issue time (FAPE about 30). Short TAFs about **30 minutes** after the issue time.
- **AMD (amended) TAFs** come at any time (FAOR 8, FAGG and FALE 6 in 7 days).
- **The "early TAF" gap:** every new TAF is issued 1 to 2 hours before it starts. AWC's normal TAF call only returns the newest TAF per station, so from the issue time until the new validity starts, we only hold a TAF that is not valid yet. The old TAF (still valid) is dropped. That is the 10Z to 12Z gap seen on 15 Nov at 12 stations. The fix MT chose ("use the early TAF") covers this. A safer extra is to keep the previous TAF too until the new one starts.

## Where today's delay comes from
| Step | Today | Typical | Worst |
|---|---|---|---|
| Station to AWC | fixed by AWC | about 5 min (FAOR 0, late AUTO stations 12 to 18) | 20 min |
| AWC to our KV | METAR every 20 min, TAF every 40 min (cron every 10 min). On 15 Nov the METAR fetches ran at xx:10:5x, xx:30:5x, xx:50:5x | the :05 batch is caught at xx:10:52; FALW, FAWB, FAWK, FAPN (on AWC :12 to :18) wait until xx:30:53 | +20 min METAR, +40 min TAF |
| KV to an open page | page re-read every 5 min, CDN max-age 60 s | +3 min | +6 min |
| **Total, METAR** | | **about 13 min after the hour (late AUTO stations about 33 min)** | **about 36 min** |
| **Total, TAF** | | **about 30 to 40 min after issue** | **about 75 min** |

Measured 15 Nov: FACT 1100Z METAR on AWC 13:05:15, fetched 13:10:52, first seen on a page 13:11:39 SAST. FACT 10Z TAF on AWC 12:13, on the site 12:40:52 SAST.

## Proposed fetch plan (tuned to the schedule)
One call returns every station, so the plan is "how often to call", not per station.

**METAR** (one bbox call per poll):
- Every minute from xx:04 to xx:20 (catches the :05 batch, FABL :08, FALW :12, FAWB :15, FAWK :16, FAPN :18).
- Every minute from xx:30 to xx:34 (FAOR half-hourly).
- Every 5 minutes the rest of the hour (SPECIs): xx:00, :25, :40, :45, :50, :55.
- Early stop: when every station that reported last hour has a new :00 report, drop to 5-minute polling until xx:30.
- About 17 + 5 + 6 = **28 calls per hour, 672 per day** (worst case; about 400 with early stop). Today: 72 per day.

**TAF** (one bbox call per poll):
- Every minute in these windows: **05:00 to 05:45, 06:00 to 06:45, 08:00 to 08:45, 11:00 to 11:45, 12:00 to 12:45, 18:00 to 18:45, 00:00 to 00:45 SAST** (03Z, 04Z, 06Z, 09Z, 10Z, 16Z, 22Z).
- Every 10 minutes the rest of the day (AMDs).
- Stop each window early when every expected station has a TAF with the new issue time.
- About 7 x 46 = 322 + about 110 = **~430 calls per day** (about 250 with early stop). Today: 36 per day.

**Total AWC calls: about 1,100 per day worst case** (AWC asks for no more than 100 calls a minute; this is at most 2 a minute).

**Expected delay with this plan:**
- METAR on our server **within 1 minute of AWC**: about 6 min after the hour for most stations, FAOR about 1 to 4 min, late AUTO stations 13 to 19 min.
- TAF on our server within 1 minute of AWC: about 7 to 14 min after issue (long), about 31 min (short).
- Pages: to keep the "instant" feel, the page should re-check at the same moments (xx:06, :09, :13, :17, :20, :31, then every 5 min), using the ETag on `/api/wx-now` so an unchanged reply is tiny. Then a new METAR shows on an open page about **1 to 2 minutes after AWC**.

**Limits to check before building (Cloudflare free plan):**
- Cron every minute is allowed. CPU is 10 ms per run on the free plan, so the minute polls must only fetch, compare times, and stop. The heavy compose (the 770 KB snapshot) must only run when something new arrived.
- **KV free plan = 1,000 writes per day.** Writing every minute (1,440) would break it. Write only when a new report arrived: about 2 to 4 METAR changes an hour plus TAFs, so about 100 to 150 writes a day.
- Real push to open pages (WebSocket/Durable Objects) needs Workers Paid ($5/month). The plan above works on the free plan with smart page polling; push only saves the last minute or so.
- What we cannot change: the 5 minutes (FAOR 0, AUTO up to 18) between the station and AWC.

## Decisions needed from MT
1. Approve the METAR and TAF windows above (or ask for every-minute all day: about 2,900 calls/day, more CPU, same KV rule).
2. Page re-check at the scheduled minutes (free) or real push ($5/month).
3. Keep the previous TAF until the new TAF's validity starts (together with "use the early TAF").

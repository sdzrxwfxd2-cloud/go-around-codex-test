# ga-core-v2-wire.js notes

Comment blocks moved out of site/engine/ga-core-v2-wire.js on 13 Nov 2026 (pilot-safety fix) to keep main.html inside tools/perf-budget.json. Each block was replaced in the code by `/* notes: N */`.

## 1

```
/* PERF 13 Nov 2026 (E-10): a verdict is a pure function of its input, so the same input in the same minute gives the
     same answer. Taps between Depart / Land and Now / +1h / +2h / +3h, the second pass of each applyS and the 60 s
     re-runs hit this cache instead of running the rules again. The key is the whole input (weather included, so new data
     is a new key), with the arrival time and the clock rounded to the minute; the cache is emptied every minute, so no
     answer is older than the page's own 60 s re-run. Results are read-only for every caller (toCard / toLegacy copy). */
```

## 2

```
/* PERF 13 Nov 2026 (core engine review, bug E-01): phaseOf() runs for every card on every pass. Before phase.js has
     set WMPHASE (the list page loads the wire and wst-card.js first), it fell through to a whole-document querySelector
     each time: about 60 s of main-thread work on a 4x-slow phone for 640 cards. Nothing on the page can change inside one
     synchronous loop, so the stored value and the DOM lookup are read once per turn and reused until the next turn.
     Same answer, same order of checks. */
```

## 3

```
/* E-02 (13 Nov 2026): Depart / Land and Now / +1h / +2h / +3h fire wm:phase, but nothing re-ran the card verdicts, so the
     cards kept the old answer under the new words for up to 60 s. Re-run on the next frame. Attached on every page, because
     the Status view builds its cards after load (watchListPages() returns early there). The mode is shared between frames
     through localStorage ('storage'); the arrival time is per frame. The aerodrome page keeps its own runAdPage listener. */
```

## 4

```
/* fix/ipad-safari (12 Nov 2026): phaseOf() runs once per card, and before wst/phase.js has set WMPHASE (and while
     'wm.phaseMode' is not saved) every call fell through to this document-wide attribute query. No element on the site
     matches it, so each call walked the whole ~70,000-node page: ~2,500 walks on a reload = 6-13 s of blocked main
     thread in WebKit (black page under the bars on iPad). Same answer, but the walk now runs at most once per second. */
```

## 5

```
/* Speed (13 Nov 2026, Land tap 1.7 s vs 0.34 s on live): the E-10 precompute asks for the full copy while the pilot is
         still on Land Now; its arrival re-ran every card a second time (same answers) and kept the page busy after the tap.
         Re-run only when the view on screen is a later arrival that needs those hours; otherwise the next +1h/+2h/+3h tap
         reads the fresh copy itself. */
```

## 6

```
/* PERF 13 Nov 2026 (E-05): every card looked itself up by scanning all 640 points and re-parsing every hour stamp, so one
     pass did 640 x 640 comparisons. The copy object is kept for its lifetime (memoCopy), so an index built once per copy
     answers each card directly. Same match rules: the ICAO first, then the nearest point within 0.01 deg (first wins on a tie). */
```

## 7

```
/* E-10 (13 Nov 2026): after a tap, work out the verdicts the next tap will most likely ask for, in small idle slices,
     so that tap is answered from the cache: in Land, the other arrival times (Now, +1h, +2h, +3h); in Depart, Land Now.
     Same code path as a real pass (weather from the card, the same engine); nothing is written to the page. */
```

## 8

```
/* applyS() re-evaluates every card. Calling it every 500ms (up to 40 times)
       blocked the main thread for many seconds once model data arrived — the
       loading-shell outage around 12:49 SAST on deploy 5cf79068. Run once when
       live official data arrives, and once more when the model copy first appears. */
```

## 9

```
/* 2.4.0 (MT wind rule, 13 Nov 2026): the card's wind row shows the wind the verdict used.
     Source labels (METAR / TAF / Open-Meteo) live in the i note, not on the weather line.
     Unknown wind is "—", never "undefined°", "000°" or "Calm".
     Writes only when the html changes, so observers stay quiet. */
```

## 10

```
/* #verd (the verdict the engine writes) lives INSIDE #s-wx on fact.html
         and the aerodrome pages. Watching the whole section re-entered runAdPage
         on every paint and could freeze the page (clocks stuck on --:--, no cards).
         Ignore mutations inside #verd and debounce the rest. */
```
